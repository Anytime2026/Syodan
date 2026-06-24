import json
import logging
from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.config import get_settings
from app.domain.enums import ProgramStatus, SessionStatus
from app.domain.models import CustomerProfile, CustomerState, HearingSession, Program
from app.integrations.aws_clients import BedrockClient, S3Client
from app.services.hulft_client import HulftClient

logger = logging.getLogger(__name__)

ANALYSIS_SYSTEM = """営業ロープレの会話を分析し、JSONのみ返してください。
キー: awareness_level(0-100), rapport_level(0-100), disclosed_info(文字列配列), session_summary(文字列), title(短いセッションタイトル)
気づき度は良いヒアリングで徐々に上がる想定。ラポール度も会話品質に応じて更新。"""


class SessionFinalizeService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.bedrock = BedrockClient()
        self.s3 = S3Client()
        self.hulft = HulftClient()

    async def finalize_session(
        self,
        session_id: UUID,
        recording_bytes: bytes,
        conversation_log: list[dict],
    ) -> HearingSession:
        session = await self._load_session(session_id)
        if not session:
            raise ValueError("Session not found")
        if session.status != SessionStatus.IN_PROGRESS.value:
            raise ValueError("Session is not in progress")

        transcript_lines = []
        for turn in conversation_log:
            speaker = "営業" if turn.get("speaker") == "user" else "顧客"
            transcript_lines.append(f"{speaker}: {turn.get('text', '')}")
        transcript = "\n".join(transcript_lines)

        recording_key = f"recordings/{session.program_id}/{session.id}.webm"
        if recording_bytes:
            self.s3.put_bytes(recording_key, recording_bytes, content_type="audio/webm")
            session.recording_s3_key = recording_key

        session.transcript = transcript
        session.conversation_log = conversation_log
        session.ended_at = datetime.now(UTC)

        analysis = await self._analyze(session, transcript)
        await self._update_customer_state(session.program_id, analysis, session.session_number)

        session.title = analysis.get("title", f"第{session.session_number}回ヒアリング")
        session.formatted_transcript = (
            f"# {session.title}\n\n"
            f"**目標**: {session.goal}\n\n"
            f"## 文字起こし\n\n{transcript}"
        )
        session.status = SessionStatus.EVALUATION_REQUESTED.value

        program = session.program
        completed_count = sum(
            1
            for s in program.sessions
            if s.id != session.id
            and s.status
            in (
                SessionStatus.EVALUATION_REQUESTED.value,
                SessionStatus.EVALUATED.value,
                SessionStatus.COMPLETED.value,
            )
        ) + 1

        if completed_count >= program.total_sessions:
            program.status = ProgramStatus.ALL_SESSIONS_DONE.value

        await self.db.commit()
        await self.db.refresh(session)

        profile = program.customer_profile
        await self.hulft.send_session_complete(
            session_id=session.id,
            program_id=program.id,
            review_token=session.review_token,
            payload={
                "field": program.field,
                "session_number": session.session_number,
                "goal": session.goal,
                "true_challenge": profile.true_challenge if profile else "",
                "transcript": transcript,
            },
        )

        if completed_count >= program.total_sessions:
            program.status = ProgramStatus.OVERALL_REVIEW_REQUESTED.value
            from app.services.evaluation_service import EvaluationService

            overall_token = EvaluationService.ensure_overall_review_token(program)
            await self.db.commit()
            await self.hulft.send_overall_review_request(
                program_id=program.id,
                overall_review_token=overall_token,
            )

        return session

    async def _analyze(self, session: HearingSession, transcript: str) -> dict:
        settings = get_settings()
        prompt = (
            f"回数: {session.session_number}\n"
            f"目標: {session.goal}\n"
            f"会話:\n{transcript}"
        )
        raw = self.bedrock.invoke(settings.bedrock_analysis_model_id, ANALYSIS_SYSTEM, prompt, max_tokens=800)
        try:
            return json.loads(raw)
        except json.JSONDecodeError:
            start = raw.find("{")
            end = raw.rfind("}") + 1
            return json.loads(raw[start:end])

    async def _update_customer_state(self, program_id: UUID, analysis: dict, session_number: int) -> None:
        result = await self.db.execute(select(CustomerState).where(CustomerState.program_id == program_id))
        state = result.scalar_one()
        state.awareness_level = analysis.get("awareness_level", state.awareness_level)
        state.rapport_level = analysis.get("rapport_level", state.rapport_level)
        disclosed = list(state.disclosed_info or [])
        for item in analysis.get("disclosed_info", []):
            if item not in disclosed:
                disclosed.append(item)
        state.disclosed_info = disclosed
        summaries = list(state.session_summaries or [])
        summaries.append({"session_number": session_number, "summary": analysis.get("session_summary", "")})
        state.session_summaries = summaries

    async def _load_session(self, session_id: UUID) -> HearingSession | None:
        result = await self.db.execute(
            select(HearingSession)
            .options(
                selectinload(HearingSession.program).selectinload(Program.sessions),
                selectinload(HearingSession.program).selectinload(Program.customer_profile),
            )
            .where(HearingSession.id == session_id)
        )
        return result.scalar_one_or_none()

    async def apply_evaluation_artifact(
        self,
        session_id: UUID | None,
        program_id: UUID | None,
        formatted_transcript: str,
        artifact_type: str,
    ) -> None:
        if artifact_type == "session" and session_id:
            result = await self.db.execute(select(HearingSession).where(HearingSession.id == session_id))
            session = result.scalar_one_or_none()
            if session:
                session.formatted_transcript = formatted_transcript
                await self.db.commit()
        elif artifact_type == "overall" and program_id:
            result = await self.db.execute(select(Program).where(Program.id == program_id))
            program = result.scalar_one_or_none()
            if program and program.status == ProgramStatus.OVERALL_REVIEW_REQUESTED.value:
                program.status = ProgramStatus.CLOSED.value
                await self.db.commit()
