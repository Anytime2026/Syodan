from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.domain.schemas import ProgramCreate, ProgramResponse
from app.services.program_service import ProgramService

router = APIRouter(prefix="/api/programs", tags=["programs"])


@router.post("", response_model=ProgramResponse, status_code=status.HTTP_201_CREATED)
async def create_program(body: ProgramCreate, db: AsyncSession = Depends(get_db)) -> ProgramResponse:
    service = ProgramService(db)
    program = await service.create_program(
        field=body.field,
        total_sessions=body.total_sessions,
        evaluator_ids=body.evaluator_ids,
        user_id=body.user_id,
    )
    loaded = await service.get_program(program.id)
    return service.to_response(loaded)  # type: ignore[arg-type]


@router.get("/{program_id}", response_model=ProgramResponse)
async def get_program(program_id: UUID, db: AsyncSession = Depends(get_db)) -> ProgramResponse:
    service = ProgramService(db)
    program = await service.get_program(program_id)
    if not program:
        raise HTTPException(status_code=404, detail="Program not found")
    return service.to_response(program)
