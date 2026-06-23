import logging
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.config import get_settings
from app.domain.enums import ProgramStatus, SessionStatus
from app.domain.models import CustomerProfile, CustomerState, HearingSession, Program
from app.domain.schemas import (
    CustomerProfileResponse,
    CustomerStateResponse,
    OverallReviewResponse,
    ProgramResponse,
    SessionListItem,
)
from app.integrations.aws_clients import BedrockClient

logger = logging.getLogger(__name__)

PROFILE_SYSTEM = """あなたは営業ロープレ用のB2B顧客ペルソナ生成器です。
指定分野に沿った現実的な顧客プロファイルを返してください。
出力はJSONオブジェクト1つのみ。説明文・マークダウン・コードブロックは禁止。
キー: name, industry, company_size, role_title, surface_need, true_challenge, personality_type, initial_awareness(0-100整数)
name は日本人のフルネーム（姓と名をスペース区切り、例: 田中 健太）。読みやすく一般的な名前にすること。難読・造語・カタカナのみの名前は避ける。
文字列内の改行は使わず、ダブルクォートはエスケープすること。
真の課題は表面ニーズの奥にある本質的課題とし、ユーザーには後で開示する前提で詳細に書いてください。"""


def _parse_llm_json(raw: str) -> dict:
    import json
    import re

    text = raw.strip()
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*", "", text)
        text = re.sub(r"\s*```$", "", text)
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        start = text.find("{")
        end = text.rfind("}") + 1
        if start >= 0 and end > start:
            return json.loads(text[start:end])
        raise


class ProgramService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.bedrock = BedrockClient()

    async def create_program(
        self,
        field: str,
        total_sessions: int,
        evaluator_ids: list[str],
        user_id: str,
        personality_type: str | None = None,
        sub_field: str | None = None,
        it_knowledge_level: str | None = None,
    ) -> Program:
        profile_hints: dict[str, str] = {}
        if it_knowledge_level:
            profile_hints["it_knowledge_level"] = it_knowledge_level

        program = Program(
            field=field,
            total_sessions=total_sessions,
            evaluator_ids=evaluator_ids,
            user_id=user_id,
            status=ProgramStatus.CREATED.value,
            profile_hints=profile_hints or None,
        )
        self.db.add(program)
        await self.db.flush()

        profile_data = await self._generate_profile(field, sub_field)
        if personality_type:
            profile_data["personality_type"] = personality_type
        profile = CustomerProfile(program_id=program.id, **profile_data)
        state = CustomerState(
            program_id=program.id,
            awareness_level=profile_data["initial_awareness"],
            rapport_level=30,
            disclosed_info=[],
            session_summaries=[],
        )
        self.db.add_all([profile, state])
        await self.db.commit()
        await self.db.refresh(program)
        return program

    async def _generate_profile(self, field: str, sub_field: str | None = None) -> dict:
        import json

        settings = get_settings()
        user_prompt = f"分野: {field}"
        if sub_field:
            user_prompt += f"\nセクター（詳細分野）: {sub_field}"
        last_error: json.JSONDecodeError | None = None
        for attempt in range(3):
            raw = self.bedrock.invoke(
                settings.bedrock_analysis_model_id,
                PROFILE_SYSTEM,
                user_prompt,
                max_tokens=800,
            )
            try:
                return _parse_llm_json(raw)
            except json.JSONDecodeError as exc:
                last_error = exc
                logger.warning("Profile JSON parse failed (attempt %d): %s", attempt + 1, exc)
        raise last_error  # type: ignore[misc]

    async def get_program(self, program_id: UUID) -> Program | None:
        result = await self.db.execute(
            select(Program)
            .options(
                selectinload(Program.customer_profile),
                selectinload(Program.customer_state),
                selectinload(Program.sessions),
                selectinload(Program.overall_reviews),
            )
            .where(Program.id == program_id)
        )
        return result.scalar_one_or_none()

    def to_response(self, program: Program) -> ProgramResponse:
        reveal = program.status == ProgramStatus.CLOSED.value

        profile_resp = None
        if program.customer_profile:
            cp = program.customer_profile
            profile_resp = CustomerProfileResponse(
                name=cp.name or "",
                industry=cp.industry,
                company_size=cp.company_size,
                role_title=cp.role_title,
                surface_need=cp.surface_need,
                personality_type=cp.personality_type,
                initial_awareness=cp.initial_awareness,
                true_challenge=cp.true_challenge if reveal else None,
            )

        state_resp = None
        if program.customer_state:
            cs = program.customer_state
            state_resp = CustomerStateResponse(
                awareness_level=cs.awareness_level,
                rapport_level=cs.rapport_level,
                disclosed_info=cs.disclosed_info or [],
                session_summaries=cs.session_summaries or [],
            )

        completed = sum(
            1
            for s in program.sessions
            if s.status
            in (
                SessionStatus.COMPLETED.value,
                SessionStatus.EVALUATION_REQUESTED.value,
                SessionStatus.EVALUATED.value,
            )
        )

        sessions = sorted(program.sessions, key=lambda s: s.session_number)
        session_items = [
            SessionListItem(
                id=s.id,
                session_number=s.session_number,
                title=s.title,
                status=s.status,
                started_at=s.started_at,
                ended_at=s.ended_at,
            )
            for s in sessions
            if s.status != SessionStatus.ABANDONED.value
        ]
        overall_reviews = [
            OverallReviewResponse.model_validate(r) for r in (program.overall_reviews or [])
        ]

        return ProgramResponse(
            id=program.id,
            field=program.field,
            total_sessions=program.total_sessions,
            status=program.status,
            created_at=program.created_at,
            reveal_challenge=reveal,
            customer_profile=profile_resp,
            customer_state=state_resp,
            completed_sessions=completed,
            sessions=session_items,
            overall_reviews=overall_reviews,
        )
