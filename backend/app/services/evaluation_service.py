import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.domain.enums import ProgramStatus, SessionStatus
from app.domain.models import (
    CustomerProfile,
    CustomerState,
    Evaluation,
    HearingSession,
    OverallReview,
    Program,
)
from app.domain.schemas import (
    EvaluationResponse,
    OverallReviewPageResponse,
    OverallReviewResponse,
    ReviewPageResponse,
    SessionSummaryForReview,
)
from app.integrations.aws_clients import S3Client


class EvaluationService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.s3 = S3Client()

    async def get_review_page(self, token: str) -> ReviewPageResponse | None:
        session = await self._get_session_by_token(token)
        if not session:
            return None

        profile = await self._get_profile(session.program_id)
        program = session.program

        return ReviewPageResponse(
            session_id=session.id,
            program_id=session.program_id,
            program_field=program.field,
            session_number=session.session_number,
            goal=session.goal,
            true_challenge=profile.true_challenge if profile else "",
            formatted_transcript=session.formatted_transcript or session.transcript,
            recording_url=self.s3.generate_presigned_url(session.recording_s3_key or ""),
            evaluations=[EvaluationResponse.model_validate(e) for e in session.evaluations],
        )

    async def submit_session_evaluation(
        self, token: str, evaluator_id: str, content: str
    ) -> EvaluationResponse:
        session = await self._get_session_by_token(token)
        if not session:
            raise ValueError("Review page not found")
        if session.status not in (
            SessionStatus.EVALUATION_REQUESTED.value,
            SessionStatus.EVALUATED.value,
        ):
            raise ValueError("Session is not accepting evaluations")

        existing = await self.db.execute(
            select(Evaluation).where(
                Evaluation.session_id == session.id,
                Evaluation.evaluator_id == evaluator_id,
            )
        )
        evaluation = existing.scalar_one_or_none()
        if evaluation:
            evaluation.content = content
        else:
            evaluation = Evaluation(
                session_id=session.id,
                evaluator_id=evaluator_id,
                content=content,
            )
            self.db.add(evaluation)

        session.status = SessionStatus.EVALUATED.value
        await self.db.commit()
        await self.db.refresh(evaluation)
        return EvaluationResponse.model_validate(evaluation)

    async def get_overall_review_page(self, token: str) -> OverallReviewPageResponse | None:
        program = await self._get_program_by_overall_token(token)
        if not program:
            return None

        profile = program.customer_profile
        state = program.customer_state
        sessions = sorted(program.sessions, key=lambda s: s.session_number)

        return OverallReviewPageResponse(
            program_id=program.id,
            program_field=program.field,
            total_sessions=program.total_sessions,
            true_challenge=profile.true_challenge if profile else "",
            session_summaries=list(state.session_summaries or []) if state else [],
            sessions=[
                SessionSummaryForReview(
                    session_number=s.session_number,
                    title=s.title,
                    goal=s.goal,
                    formatted_transcript=s.formatted_transcript or s.transcript,
                )
                for s in sessions
                if s.status
                not in (SessionStatus.ABANDONED.value, SessionStatus.NOT_STARTED.value)
            ],
            overall_reviews=[
                OverallReviewResponse.model_validate(r)
                for r in (program.overall_reviews or [])
                if r.content
            ],
        )

    async def submit_overall_review(
        self, token: str, evaluator_id: str, content: str
    ) -> OverallReviewResponse:
        program = await self._get_program_by_overall_token(token)
        if not program:
            raise ValueError("Overall review page not found")
        if program.status not in (
            ProgramStatus.OVERALL_REVIEW_REQUESTED.value,
            ProgramStatus.CLOSED.value,
        ):
            raise ValueError("Program is not accepting overall reviews")

        existing = await self.db.execute(
            select(OverallReview).where(
                OverallReview.program_id == program.id,
                OverallReview.evaluator_id == evaluator_id,
            )
        )
        review = existing.scalar_one_or_none()
        if review:
            review.content = content
        else:
            review = OverallReview(
                program_id=program.id,
                evaluator_id=evaluator_id,
                content=content,
                review_token=token,
            )
            self.db.add(review)

        await self.db.commit()
        await self.db.refresh(review)
        return OverallReviewResponse.model_validate(review)

    @staticmethod
    def ensure_overall_review_token(program: Program) -> str:
        if program.overall_review_token:
            return program.overall_review_token
        token = uuid.uuid4().hex
        program.overall_review_token = token
        return token

    async def _get_session_by_token(self, token: str) -> HearingSession | None:
        result = await self.db.execute(
            select(HearingSession)
            .options(
                selectinload(HearingSession.evaluations),
                selectinload(HearingSession.program),
            )
            .where(HearingSession.review_token == token)
        )
        return result.scalar_one_or_none()

    async def _get_program_by_overall_token(self, token: str) -> Program | None:
        result = await self.db.execute(
            select(Program)
            .options(
                selectinload(Program.sessions),
                selectinload(Program.overall_reviews),
                selectinload(Program.customer_profile),
                selectinload(Program.customer_state),
            )
            .where(Program.overall_review_token == token)
        )
        return result.scalar_one_or_none()

    async def _get_profile(self, program_id: uuid.UUID) -> CustomerProfile | None:
        result = await self.db.execute(
            select(CustomerProfile).where(CustomerProfile.program_id == program_id)
        )
        return result.scalar_one_or_none()
