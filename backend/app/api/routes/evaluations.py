from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.domain.schemas import (
    EvaluationResponse,
    EvaluationSubmit,
    OverallReviewPageResponse,
    OverallReviewResponse,
    ReviewPageResponse,
)
from app.services.evaluation_service import EvaluationService

router = APIRouter(tags=["evaluations"])


@router.get("/api/review/overall/{token}", response_model=OverallReviewPageResponse)
async def get_overall_review_page(
    token: str, db: AsyncSession = Depends(get_db)
) -> OverallReviewPageResponse:
    service = EvaluationService(db)
    page = await service.get_overall_review_page(token)
    if not page:
        raise HTTPException(status_code=404, detail="Overall review page not found")
    return page


@router.post("/api/review/overall/{token}/reviews", response_model=OverallReviewResponse)
async def submit_overall_review(
    token: str, body: EvaluationSubmit, db: AsyncSession = Depends(get_db)
) -> OverallReviewResponse:
    service = EvaluationService(db)
    try:
        return await service.submit_overall_review(token, body.evaluator_id, body.content)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e


@router.get("/api/review/{token}", response_model=ReviewPageResponse)
async def get_review_page(token: str, db: AsyncSession = Depends(get_db)) -> ReviewPageResponse:
    service = EvaluationService(db)
    page = await service.get_review_page(token)
    if not page:
        raise HTTPException(status_code=404, detail="Review page not found")
    return page


@router.post("/api/review/{token}/evaluations", response_model=EvaluationResponse)
async def submit_session_evaluation(
    token: str, body: EvaluationSubmit, db: AsyncSession = Depends(get_db)
) -> EvaluationResponse:
    service = EvaluationService(db)
    try:
        return await service.submit_session_evaluation(token, body.evaluator_id, body.content)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
