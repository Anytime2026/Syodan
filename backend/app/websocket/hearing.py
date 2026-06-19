import asyncio
import json
import logging
from datetime import UTC, datetime
from uuid import UUID

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from sqlalchemy import select

from app.config import get_settings
from app.db.session import AsyncSessionLocal
from app.domain.enums import SessionStatus
from app.domain.models import CustomerProfile, CustomerState, HearingSession
from app.services.audio_pipeline import AudioPipeline
from app.api.routes import sessions as sessions_routes

logger = logging.getLogger(__name__)
router = APIRouter(tags=["websocket"])


@router.websocket("/ws/sessions/{session_id}/hearing")
async def hearing_websocket(websocket: WebSocket, session_id: UUID) -> None:
    await websocket.accept()
    settings = get_settings()
    pipeline = AudioPipeline()
    audio_buffer = bytearray()
    ptt_active = False
    time_warning_sent = False

    async with AsyncSessionLocal() as db:
        session = await _load_session(db, session_id)
        if not session or session.status != SessionStatus.IN_PROGRESS.value:
            await websocket.send_json({"type": "error", "message": "Session not in progress"})
            await websocket.close()
            return

        profile = await _load_profile(db, session.program_id)
        state = await _load_state(db, session.program_id)
        if not profile or not state:
            await websocket.send_json({"type": "error", "message": "Customer data missing"})
            await websocket.close()
            return

    try:
        while True:
            message = await websocket.receive()
            if message.get("type") == "websocket.disconnect":
                break

            if "bytes" in message and message["bytes"] is not None:
                chunk = message["bytes"]
                audio_buffer.extend(chunk)
                sessions_routes.append_recording(str(session_id), chunk)
                continue

            if "text" not in message or message["text"] is None:
                continue

            data = json.loads(message["text"])
            msg_type = data.get("type")

            if msg_type == "ptt_start":
                ptt_active = True
                audio_buffer = bytearray()
                continue

            if msg_type == "ptt_end":
                ptt_active = False
                if not audio_buffer:
                    await websocket.send_json({"type": "error", "message": "No audio received"})
                    await websocket.send_json({"type": "turn_complete"})
                    continue

                media_format = data.get("media_format", "webm")

                async with AsyncSessionLocal() as db:
                    session = await _load_session(db, session_id)
                    state = await _load_state(db, session.program_id)  # type: ignore[union-attr]
                    profile = await _load_profile(db, session.program_id)  # type: ignore[union-attr]
                    remaining = _remaining_seconds(session)  # type: ignore[arg-type]

                system = pipeline.build_system_prompt(profile, state, session.goal, remaining)  # type: ignore[arg-type]
                user_text, ai_text, audio_out = await asyncio.to_thread(
                    pipeline.process_turn,
                    bytes(audio_buffer),
                    system,
                    media_format,
                )
                audio_buffer = bytearray()

                sessions_routes.append_conversation(str(session_id), "user", user_text)
                sessions_routes.append_conversation(str(session_id), "ai", ai_text)

                await websocket.send_json({"type": "transcript", "speaker": "user", "text": user_text})
                await websocket.send_json({"type": "transcript", "speaker": "ai", "text": ai_text})
                if audio_out:
                    await websocket.send_bytes(audio_out)
                await websocket.send_json({"type": "turn_complete"})

            if msg_type == "ping":
                async with AsyncSessionLocal() as db:
                    session = await _load_session(db, session_id)
                    if not session:
                        break
                    remaining = _remaining_seconds(session)
                if (
                    not time_warning_sent
                    and remaining <= settings.session_time_warning_sec
                    and remaining > 0
                ):
                    time_warning_sent = True
                    await websocket.send_json({"type": "time_warning", "remaining_sec": remaining})
                if remaining <= 0:
                    await websocket.send_json({"type": "session_ended", "reason": "timeout"})
                    break

    except WebSocketDisconnect:
        logger.info("WebSocket disconnected for session %s", session_id)
    except Exception:
        logger.exception("WebSocket error for session %s", session_id)
        await websocket.send_json({"type": "error", "message": "Internal error"})


async def _load_session(db, session_id: UUID) -> HearingSession | None:
    result = await db.execute(select(HearingSession).where(HearingSession.id == session_id))
    return result.scalar_one_or_none()


async def _load_profile(db, program_id: UUID) -> CustomerProfile | None:
    result = await db.execute(select(CustomerProfile).where(CustomerProfile.program_id == program_id))
    return result.scalar_one_or_none()


async def _load_state(db, program_id: UUID) -> CustomerState | None:
    result = await db.execute(select(CustomerState).where(CustomerState.program_id == program_id))
    return result.scalar_one_or_none()


def _remaining_seconds(session: HearingSession) -> int:
    if not session.started_at:
        return session.time_limit_minutes * 60
    elapsed = (datetime.now(UTC) - session.started_at).total_seconds()
    return max(0, int(session.time_limit_minutes * 60 - elapsed))
