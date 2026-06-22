from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import attributes, selectinload
from sqlalchemy.orm.base import NO_VALUE

from app.domain.enums import ProgramStatus, SessionStatus
from app.domain.models import HearingSession, Program
from app.domain.schemas import EvaluationResponse, SessionListItem, SessionResponse


class SessionService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def create_session(self, program_id: UUID, goal: str, time_limit_minutes: int) -> HearingSession:
        program = await self._get_program(program_id)
        if not program:
            raise ValueError("Program not found")

        active = [
            s
            for s in program.sessions
            if s.status not in (SessionStatus.ABANDONED.value, SessionStatus.EVALUATED.value)
            and s.status != SessionStatus.COMPLETED.value
        ]
        in_progress = [s for s in active if s.status == SessionStatus.IN_PROGRESS.value]
        if in_progress:
            raise ValueError("A session is already in progress")

        completed_numbers = {
            s.session_number
            for s in program.sessions
            if s.status
            in (
                SessionStatus.COMPLETED.value,
                SessionStatus.EVALUATION_REQUESTED.value,
                SessionStatus.EVALUATED.value,
            )
        }
        next_number = 1
        while next_number in completed_numbers:
            next_number += 1
        if next_number > program.total_sessions:
            raise ValueError("All sessions completed")

        session = HearingSession(
            program_id=program_id,
            session_number=next_number,
            goal=goal,
            time_limit_minutes=time_limit_minutes,
            status=SessionStatus.NOT_STARTED.value,
            conversation_log=[],
        )
        if program.status == ProgramStatus.CREATED.value:
            program.status = ProgramStatus.IN_PROGRESS.value

        self.db.add(session)
        await self.db.commit()
        await self.db.refresh(session)
        return session

    async def start_session(self, session_id: UUID) -> HearingSession:
        session = await self._get_session(session_id)
        if not session:
            raise ValueError("Session not found")
        if session.status != SessionStatus.NOT_STARTED.value:
            raise ValueError("Session cannot be started")

        session.status = SessionStatus.IN_PROGRESS.value
        session.started_at = datetime.now(UTC)
        await self.db.commit()
        await self.db.refresh(session)
        return session

    async def abort_session(self, session_id: UUID) -> HearingSession:
        session = await self._get_session(session_id)
        if not session:
            raise ValueError("Session not found")
        if session.status not in (
            SessionStatus.NOT_STARTED.value,
            SessionStatus.IN_PROGRESS.value,
        ):
            raise ValueError("Session cannot be aborted")

        session.status = SessionStatus.ABANDONED.value
        session.ended_at = datetime.now(UTC)
        await self.db.commit()
        await self.db.refresh(session)
        return session

    async def list_sessions(self, program_id: UUID) -> list[HearingSession]:
        result = await self.db.execute(
            select(HearingSession)
            .where(
                HearingSession.program_id == program_id,
                HearingSession.status != SessionStatus.ABANDONED.value,
            )
            .order_by(HearingSession.session_number)
        )
        return list(result.scalars().all())

    async def get_session_detail(self, session_id: UUID) -> HearingSession | None:
        return await self._get_session(session_id)

    async def _get_program(self, program_id: UUID) -> Program | None:
        result = await self.db.execute(
            select(Program).options(selectinload(Program.sessions)).where(Program.id == program_id)
        )
        return result.scalar_one_or_none()

    async def _get_session(self, session_id: UUID) -> HearingSession | None:
        result = await self.db.execute(
            select(HearingSession)
            .options(
                selectinload(HearingSession.evaluations),
                selectinload(HearingSession.program).selectinload(Program.customer_profile),
            )
            .where(HearingSession.id == session_id)
        )
        return result.scalar_one_or_none()

    def to_response(self, session: HearingSession, reveal_challenge: bool = False) -> SessionResponse:
        loaded_evals = attributes.instance_state(session).attrs.evaluations.loaded_value
        if loaded_evals is NO_VALUE:
            evaluations = []
        else:
            evaluations = [EvaluationResponse.model_validate(e) for e in (loaded_evals or [])]
        return SessionResponse(
            id=session.id,
            program_id=session.program_id,
            session_number=session.session_number,
            goal=session.goal,
            time_limit_minutes=session.time_limit_minutes,
            title=session.title,
            status=session.status,
            started_at=session.started_at,
            ended_at=session.ended_at,
            transcript=session.transcript,
            reveal_challenge=reveal_challenge,
            evaluations=evaluations,
        )

    def to_list_item(self, session: HearingSession) -> SessionListItem:
        return SessionListItem(
            id=session.id,
            session_number=session.session_number,
            title=session.title,
            status=session.status,
            started_at=session.started_at,
            ended_at=session.ended_at,
        )
