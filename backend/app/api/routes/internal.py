from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.dependencies import verify_internal_api_key
from app.domain.schemas import EvaluationArtifactRequest
from app.services.session_finalize import SessionFinalizeService

router = APIRouter(prefix="/internal", tags=["internal"])


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
