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
from app.services.prompts import PROFILE_SYSTEM, split_profile_data

logger = logging.getLogger(__name__)

_PROFILE_MAX_TOKENS = (1536, 2048, 2048)


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
        base_fields, persona_extras = split_profile_data(profile_data)
        profile = CustomerProfile(program_id=program.id, persona_extras=persona_extras, **base_fields)
        state = CustomerState(
            program_id=program.id,
            awareness_level=base_fields["initial_awareness"],
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
        prompt = user_prompt
        for attempt, max_tokens in enumerate(_PROFILE_MAX_TOKENS, start=1):
            raw = self.bedrock.invoke(
                settings.bedrock_analysis_model_id,
                PROFILE_SYSTEM,
                prompt,
                max_tokens=max_tokens,
            )
            try:
                return _parse_llm_json(raw)
            except json.JSONDecodeError as exc:
                last_error = exc
                logger.warning(
                    "Profile JSON parse failed (attempt %d, max_tokens=%d): %s",
                    attempt,
                    max_tokens,
                    exc,
                )
                prompt = (
                    f"{user_prompt}\n\n"
                    "【重要】前回の出力はJSONとして不完全でした。"
                    "各文字列は指定字数以内に収め、閉じたJSONオブジェクト1つのみを返してください。"
                )
        raise ValueError("customer profile JSON could not be parsed") from last_error

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
            .execution_options(populate_existing=True)
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
            materials_filename=program.materials_filename,
            sessions=session_items,
            overall_reviews=overall_reviews,
        )

    async def upload_material(self, program_id: UUID, filename: str, content: bytes) -> Program | None:
        import io
        import pypdf

        program = await self.get_program(program_id)
        if not program:
            return None

        ext = filename.split(".")[-1].lower() if "." in filename else ""
        extracted_text = ""

        if ext == "pdf":
            try:
                pdf_file = io.BytesIO(content)
                reader = pypdf.PdfReader(pdf_file)
                text_list = []
                for page in reader.pages:
                    t = page.extract_text()
                    if t:
                        text_list.append(t)
                extracted_text = "\n".join(text_list)
            except Exception as e:
                logger.error(f"Failed to parse PDF {filename}: {e}")
                raise ValueError("PDFファイルの解析に失敗しました。ファイルが破損しているか、テキストが含まれていない可能性があります。")
            if not extracted_text.strip():
                raise ValueError("PDFファイルからテキストを抽出できませんでした。スキャンされた画像PDFではないか、またはテキストが含まれているか確認してください。")
        elif ext in ("txt", "md"):
            try:
                extracted_text = content.decode("utf-8", errors="ignore")
                if not extracted_text.strip():
                    raise ValueError("ファイルの中身が空であるか、テキストが含まれていません。")
            except Exception as e:
                logger.error(f"Failed to decode text file {filename}: {e}")
                raise ValueError("テキストファイルの読み込みに失敗しました。")
        else:
            raise ValueError("サポートされていないファイル形式です。PDF、TXT、またはMDファイルのみアップロード可能です。")

        program.materials_text = extracted_text
        program.materials_filename = filename
        await self.db.commit()
        await self.db.refresh(program)
        return program

