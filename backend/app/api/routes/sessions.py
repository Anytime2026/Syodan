from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.domain.schemas import SessionCreate, SessionListItem, SessionResponse
from app.services.program_service import ProgramService
from app.services.session_finalize import SessionFinalizeService
from app.services.session_service import SessionService

router = APIRouter(tags=["sessions"])


@router.post("/api/programs/{program_id}/sessions", response_model=SessionResponse, status_code=status.HTTP_201_CREATED)
async def create_session(
    program_id: UUID,
    body: SessionCreate,
    db: AsyncSession = Depends(get_db),
) -> SessionResponse:
    service = SessionService(db)
    try:
        session = await service.create_session(program_id, body.goal, body.time_limit_minutes)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    return service.to_response(session)


@router.get("/api/programs/{program_id}/sessions", response_model=list[SessionListItem])
async def list_sessions(program_id: UUID, db: AsyncSession = Depends(get_db)) -> list[SessionListItem]:
    service = SessionService(db)
    sessions = await service.list_sessions(program_id)
    return [service.to_list_item(s) for s in sessions]


@router.get("/api/sessions/{session_id}", response_model=SessionResponse)
async def get_session(session_id: UUID, db: AsyncSession = Depends(get_db)) -> SessionResponse:
    service = SessionService(db)
    session = await service.get_session_detail(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    program_service = ProgramService(db)
    program = await program_service.get_program(session.program_id)
    reveal = program_service.to_response(program).reveal_challenge if program else False  # type: ignore[arg-type]
    return service.to_response(session, reveal_challenge=reveal)


@router.post("/api/sessions/{session_id}/start", response_model=SessionResponse)
async def start_session(session_id: UUID, db: AsyncSession = Depends(get_db)) -> SessionResponse:
    service = SessionService(db)
    try:
        session = await service.start_session(session_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    return service.to_response(session)


@router.post("/api/sessions/{session_id}/abort", response_model=SessionResponse)
async def abort_session(session_id: UUID, db: AsyncSession = Depends(get_db)) -> SessionResponse:
    service = SessionService(db)
    try:
        session = await service.abort_session(session_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    return service.to_response(session)


# In-memory recording buffer keyed by session_id (single-task ECS scope)
_recording_buffers: dict[str, bytes] = {}
_conversation_logs: dict[str, list[dict]] = {}


@router.post("/api/sessions/{session_id}/end", response_model=SessionResponse)
async def end_session(session_id: UUID, db: AsyncSession = Depends(get_db)) -> SessionResponse:
    finalize = SessionFinalizeService(db)
    key = str(session_id)
    recording = _recording_buffers.pop(key, b"")
    conversation = _conversation_logs.pop(key, [])
    try:
        session = await finalize.finalize_session(session_id, recording, conversation)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    service = SessionService(db)
    return service.to_response(session)


def append_recording(session_id: str, chunk: bytes) -> None:
    _recording_buffers[session_id] = _recording_buffers.get(session_id, b"") + chunk


def append_conversation(session_id: str, speaker: str, text: str) -> None:
    log = _conversation_logs.setdefault(session_id, [])
    log.append({"speaker": speaker, "text": text})


def get_conversation_log(session_id: str) -> list[dict]:
    return list(_conversation_logs.get(session_id, []))
