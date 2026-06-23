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
from app.domain.models import CustomerProfile, CustomerState, HearingSession, Program
from app.integrations.aws_clients import TranscribeStreamSession
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
    media_format = "pcm_s16le"
    transcribe_session: TranscribeStreamSession | None = None
    last_partial_sent = ""

    async with AsyncSessionLocal() as db:
        session = await _load_session(db, session_id)
        if not session or session.status != SessionStatus.IN_PROGRESS.value:
            await websocket.send_json({"type": "error", "message": "Session not in progress"})
            await websocket.close()
            return

        profile = await _load_profile(db, session.program_id)
        state = await _load_state(db, session.program_id)
        program = await _load_program(db, session.program_id)
        if not profile or not state:
            await websocket.send_json({"type": "error", "message": "Customer data missing"})
            await websocket.close()
            return

    cached_session = session
    cached_profile = profile
    cached_state = state
    cached_program = program

    async def send_partial(text: str) -> None:
        nonlocal last_partial_sent
        if not text or text == last_partial_sent:
            return
        last_partial_sent = text
        await websocket.send_json({"type": "transcript_partial", "text": text})

    def on_partial(text: str) -> None:
        asyncio.create_task(send_partial(text))

    try:
        while True:
            message = await websocket.receive()
            if message.get("type") == "websocket.disconnect":
                break

            if "bytes" in message and message["bytes"] is not None:
                chunk = message["bytes"]
                sessions_routes.append_recording(str(session_id), chunk)
                if transcribe_session is not None:
                    await transcribe_session.feed(chunk)
                    if transcribe_session.partial_text:
                        await send_partial(transcribe_session.partial_text)
                else:
                    audio_buffer.extend(chunk)
                continue

            if "text" not in message or message["text"] is None:
                continue

            data = json.loads(message["text"])
            msg_type = data.get("type")

            if msg_type == "ptt_start":
                ptt_active = True
                audio_buffer = bytearray()
                last_partial_sent = ""
                media_format = data.get("media_format", "pcm_s16le")
                if media_format == "pcm_s16le":
                    sample_rate = int(data.get("sample_rate", 16000))
                    transcribe_session = TranscribeStreamSession(
                        on_partial=on_partial,
                        sample_rate=sample_rate,
                    )
                    await transcribe_session.start()
                else:
                    transcribe_session = None
                continue

            if msg_type == "ptt_end":
                ptt_active = False
                turn_media_format = data.get("media_format", media_format)

                try:
                    if turn_media_format == "pcm_s16le" and transcribe_session is not None:
                        try:
                            user_text = await transcribe_session.finish()
                        except Exception:
                            logger.exception("Streaming STT failed for session %s", session_id)
                            await websocket.send_json(
                                {
                                    "type": "error",
                                    "message": "Speech recognition failed (STT). Check microphone audio.",
                                }
                            )
                            await websocket.send_json({"type": "turn_complete"})
                            transcribe_session = None
                            continue
                        finally:
                            transcribe_session = None
                    else:
                        if not audio_buffer:
                            await websocket.send_json({"type": "error", "message": "No audio received"})
                            await websocket.send_json({"type": "turn_complete"})
                            continue
                        batch_format = turn_media_format if turn_media_format != "pcm_s16le" else "webm"
                        try:
                            user_text = await pipeline.transcribe_turn(
                                bytes(audio_buffer), batch_format
                            )
                        except Exception:
                            logger.exception("STT failed for session %s", session_id)
                            await websocket.send_json(
                                {
                                    "type": "error",
                                    "message": "Speech recognition failed (STT). Check microphone audio.",
                                }
                            )
                            await websocket.send_json({"type": "turn_complete"})
                            audio_buffer = bytearray()
                            continue
                        finally:
                            audio_buffer = bytearray()

                    if not user_text.strip():
                        await websocket.send_json({"type": "error", "message": "No speech detected"})
                        await websocket.send_json({"type": "turn_complete"})
                        continue

                    remaining = _remaining_seconds(cached_session)
                    profile_hints = cached_program.profile_hints if cached_program else None
                    system = pipeline.build_system_prompt(
                        cached_profile,
                        cached_state,
                        cached_session.goal,
                        remaining,
                        profile_hints,
                    )

                    sessions_routes.append_conversation(str(session_id), "user", user_text)
                    await websocket.send_json(
                        {"type": "transcript", "speaker": "user", "text": user_text}
                    )
                    last_partial_sent = ""

                    loop = asyncio.get_running_loop()
                    audio_queue: asyncio.Queue[bytes | None] = asyncio.Queue()

                    async def audio_sender() -> None:
                        while True:
                            item = await audio_queue.get()
                            if item is None:
                                break
                            await websocket.send_bytes(item)

                    sender_task = asyncio.create_task(audio_sender())

                    def emit_audio(audio: bytes) -> None:
                        asyncio.run_coroutine_threadsafe(audio_queue.put(audio), loop)

                    ai_text = ""
                    try:
                        ai_text = await asyncio.to_thread(
                            pipeline.stream_ai_audio, system, user_text, emit_audio
                        )
                    except Exception as exc:
                        logger.exception("AI/TTS pipeline failed for session %s", session_id)
                        err_msg = str(exc) or type(exc).__name__
                        if "bedrock" in err_msg.lower() or "AccessDenied" in err_msg:
                            detail = "AI response failed (Bedrock). Check model access and IAM."
                        elif "polly" in err_msg.lower():
                            detail = "Voice synthesis failed (Polly/TTS)."
                        else:
                            detail = f"AI response failed: {err_msg[:200]}"
                        await websocket.send_json({"type": "error", "message": detail})
                    finally:
                        await audio_queue.put(None)
                        await sender_task

                    if not ai_text:
                        await websocket.send_json({"type": "turn_complete"})
                        continue

                    sessions_routes.append_conversation(str(session_id), "ai", ai_text)
                    await websocket.send_json(
                        {"type": "transcript", "speaker": "ai", "text": ai_text}
                    )
                    await websocket.send_json({"type": "turn_complete"})
                except Exception:
                    logger.exception("Unexpected turn error for session %s", session_id)
                    await websocket.send_json(
                        {"type": "error", "message": "Internal error during turn processing"}
                    )
                    await websocket.send_json({"type": "turn_complete"})

            if msg_type == "ping":
                remaining = _remaining_seconds(cached_session)
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


async def _load_program(db, program_id: UUID) -> Program | None:
    result = await db.execute(select(Program).where(Program.id == program_id))
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
