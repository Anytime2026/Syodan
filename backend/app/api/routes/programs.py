from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status, File, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.domain.schemas import ProgramCreate, ProgramResponse
from app.services.program_service import ProgramService

router = APIRouter(prefix="/api/programs", tags=["programs"])


@router.post("", response_model=ProgramResponse, status_code=status.HTTP_201_CREATED)
async def create_program(body: ProgramCreate, db: AsyncSession = Depends(get_db)) -> ProgramResponse:
    service = ProgramService(db)
    try:
        program = await service.create_program(
            field=body.field,
            total_sessions=body.total_sessions,
            evaluator_ids=body.evaluator_ids,
            user_id=body.user_id,
            personality_type=body.personality_type,
            sub_field=body.sub_field,
            it_knowledge_level=body.it_knowledge_level,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="顧客プロフィールの生成に失敗しました。しばらく待って再試行してください。",
        ) from exc
    loaded = await service.get_program(program.id)
    return service.to_response(loaded)  # type: ignore[arg-type]


@router.get("/{program_id}", response_model=ProgramResponse)
async def get_program(program_id: UUID, db: AsyncSession = Depends(get_db)) -> ProgramResponse:
    service = ProgramService(db)
    program = await service.get_program(program_id)
    if not program:
        raise HTTPException(status_code=404, detail="Program not found")
    return service.to_response(program)


@router.post("/{program_id}/upload-material", response_model=ProgramResponse)
async def upload_material(
    program_id: UUID,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db)
) -> ProgramResponse:
    MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB
    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="ファイルサイズが大きすぎます。最大10MBまでアップロード可能です。"
        )

    filename = file.filename or ""
    ext = filename.split(".")[-1].lower() if "." in filename else ""
    if ext not in ("pdf", "txt", "md"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="サポートされていないファイル形式です。PDF、TXT、またはMDファイルのみアップロード可能です。"
        )

    service = ProgramService(db)
    try:
        program = await service.upload_material(program_id, filename, content)
        if not program:
            raise HTTPException(status_code=404, detail="Program not found")
        return service.to_response(program)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

