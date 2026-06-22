from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.session import get_db
from app.domain.models import CustomerProfile, HearingSession
from app.domain.schemas import EvaluationResponse, ReviewPageResponse
from app.integrations.aws_clients import S3Client

router = APIRouter(tags=["evaluations"])


@router.get("/api/review/{token}", response_model=ReviewPageResponse)
async def get_review_page(token: str, db: AsyncSession = Depends(get_db)) -> ReviewPageResponse:
    result = await db.execute(
        select(HearingSession)
        .options(selectinload(HearingSession.evaluations))
        .where(HearingSession.review_token == token)
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Review page not found")

    profile_result = await db.execute(
        select(CustomerProfile).where(CustomerProfile.program_id == session.program_id)
    )
    profile = profile_result.scalar_one_or_none()

    from app.domain.models import Program

    program_result = await db.execute(select(Program).where(Program.id == session.program_id))
    program = program_result.scalar_one()

    s3 = S3Client()

    return ReviewPageResponse(
        session_id=session.id,
        program_field=program.field,
        session_number=session.session_number,
        goal=session.goal,
        true_challenge=profile.true_challenge if profile else "",
        formatted_transcript=session.formatted_transcript or session.transcript,
        recording_url=s3.generate_presigned_url(session.recording_s3_key or ""),
        evaluations=[EvaluationResponse.model_validate(e) for e in session.evaluations],
    )
