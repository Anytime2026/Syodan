from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.session import get_db
from app.dependencies import verify_internal_api_key
from app.domain.models import CustomerProfile, HearingSession, Program
from app.domain.schemas import EvaluationArtifactRequest
from app.services.session_finalize import SessionFinalizeService

router = APIRouter(prefix="/internal", tags=["internal"])


@router.get("/sessions/{session_id}/notification-payload", dependencies=[Depends(verify_internal_api_key)])
async def get_notification_payload(
    session_id: UUID,
    db: AsyncSession = Depends(get_db),
) -> dict:
    result = await db.execute(
        select(HearingSession)
        .options(selectinload(HearingSession.program).selectinload(Program.customer_profile))
        .where(HearingSession.id == session_id)
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    program = session.program
    profile: CustomerProfile | None = program.customer_profile if program else None
    base_url = "https://syodan-alb-520683133.ap-northeast-1.elb.amazonaws.com"

    return {
        "session_id": str(session.id),
        "field": program.field if program else "",
        "session_number": session.session_number,
        "goal": session.goal,
        "true_challenge": profile.true_challenge if profile else "",
        "transcript": session.transcript or "",
        "review_url": f"{base_url}/api/review/{session.review_token}",
    }


@router.post("/evaluation-artifacts", dependencies=[Depends(verify_internal_api_key)])
async def receive_evaluation_artifact(
    body: EvaluationArtifactRequest,
    db: AsyncSession = Depends(get_db),
) -> dict[str, str]:
    service = SessionFinalizeService(db)
    await service.apply_evaluation_artifact(
        session_id=body.session_id,
        program_id=body.program_id,
        formatted_transcript=body.formatted_transcript,
        artifact_type=body.artifact_type,
    )
    return {"status": "ok"}
