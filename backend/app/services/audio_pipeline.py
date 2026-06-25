import asyncio
import logging
import re
import threading
from collections.abc import Callable
from queue import Queue

from app.config import get_settings
from app.domain.models import CustomerProfile, CustomerState
from app.integrations.aws_clients import BedrockClient, PollyClient, TranscribeClient
from app.services.prompts import build_chat_system_prompt, sanitize_customer_speech

logger = logging.getLogger(__name__)

_PCM_SAMPLE_RATE = 16000
_SENTENCE_BOUNDARY = re.compile(r"[。．！？!?\n]")
_MIN_SYNTH_CHARS = 12
# 初回チャンクは読点でも区切り、最小文字数も下げて「最初の音声が出るまで」を短縮する
_FIRST_BOUNDARY = re.compile(r"[。．！？!?\n、，,]")
_FIRST_MIN_CHARS = 4


def _paren_depth(text: str) -> int:
    depth = 0
    for ch in text:
        if ch in "（(":
            depth += 1
        elif ch in "）)":
            depth = max(0, depth - 1)
    return depth


def split_sentences_for_tts(text: str) -> list[str]:
    """Split sanitized speech into TTS chunks without breaking inside parentheses."""
    sentences: list[str] = []
    buffer = text
    first_done = False
    while buffer:
        boundary = _SENTENCE_BOUNDARY if first_done else _FIRST_BOUNDARY
        min_chars = _MIN_SYNTH_CHARS if first_done else _FIRST_MIN_CHARS
        match = None
        for candidate in boundary.finditer(buffer):
            end = candidate.end()
            if len(buffer[:end].strip()) < min_chars:
                continue
            if _paren_depth(buffer[:candidate.start()]) == 0:
                match = candidate
                break
        if not match:
            remainder = buffer.strip()
            if remainder:
                sentences.append(remainder)
            break
        end = match.end()
        chunk = buffer[:end].strip()
        if chunk:
            sentences.append(chunk)
        buffer = buffer[end:]
        first_done = True
    return sentences


class AudioPipeline:
    def __init__(self) -> None:
        self.settings = get_settings()
        self.transcribe = TranscribeClient()
        self.bedrock = BedrockClient()
        self.polly = PollyClient()

    def build_system_prompt(
        self,
        profile: CustomerProfile,
        state: CustomerState,
        goal: str,
        remaining_sec: int,
        session_number: int,
        profile_hints: dict | None = None,
        materials_text: str | None = None,
    ) -> str:
        return build_chat_system_prompt(
            profile,
            state,
            goal,
            remaining_sec,
            session_number,
            profile_hints,
            materials_text,
        )

    async def transcribe_turn(self, audio_bytes: bytes, media_format: str = "webm") -> str:
        """Transcode to PCM and run streaming STT; fall back to batch on failure."""
        if self.settings.aws_stub_mode:
            return await self.transcribe.transcribe_stream_pcm(b"", _PCM_SAMPLE_RATE)
        try:
            pcm = await _transcode_to_pcm(audio_bytes, media_format)
            return await self.transcribe.transcribe_stream_pcm(pcm, _PCM_SAMPLE_RATE)
        except Exception:
            logger.exception("Streaming transcription failed; falling back to batch job")
            return await asyncio.to_thread(
                self.transcribe.transcribe_audio, audio_bytes, media_format
            )

    def stream_ai_audio(
        self,
        system_prompt: str,
        user_text: str,
        on_audio: Callable[[bytes], None],
        messages: list[dict] | None = None,
        max_tokens: int = 400,
    ) -> str:
        """Stream LLM tokens, then sanitize once and synthesize speech by sentence.

        Sanitization runs on the complete utterance so partial parenthetical stage
        directions are never sent to Polly mid-stream.
        """
        full_parts: list[str] = []
        body_messages = messages if messages is not None else [{"role": "user", "content": user_text}]

        for delta in self.bedrock.invoke_stream(
            self.settings.bedrock_chat_model_id,
            system_prompt,
            user_text,
            max_tokens=max_tokens,
            messages=body_messages,
        ):
            full_parts.append(delta)

        full_clean = sanitize_customer_speech("".join(full_parts).strip())
        if not full_clean:
            return ""

        sentence_queue: Queue[str | None] = Queue()

        def _consume() -> None:
            while True:
                text = sentence_queue.get()
                if text is None:
                    break
                audio = self.polly.synthesize(text)
                if audio:
                    on_audio(audio)

        worker = threading.Thread(target=_consume, daemon=True)
        worker.start()
        try:
            for sentence in split_sentences_for_tts(full_clean):
                sentence_queue.put(sentence)
        finally:
            sentence_queue.put(None)
            worker.join()

        return full_clean


async def _transcode_to_pcm(audio_bytes: bytes, media_format: str = "webm") -> bytes:
    """Decode the recorded container (e.g. webm/opus) to 16kHz mono PCM s16le.

    Input container is auto-detected by ffmpeg from the byte stream, which is more
    robust than naming the demuxer (the webm demuxer is "matroska,webm").
    """
    proc = await asyncio.create_subprocess_exec(
        "ffmpeg",
        "-hide_banner",
        "-loglevel",
        "error",
        "-i",
        "pipe:0",
        "-ac",
        "1",
        "-ar",
        str(_PCM_SAMPLE_RATE),
        "-f",
        "s16le",
        "pipe:1",
        stdin=asyncio.subprocess.PIPE,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    stdout, stderr = await proc.communicate(input=audio_bytes)
    if proc.returncode != 0:
        raise RuntimeError(f"ffmpeg transcode failed: {stderr.decode('utf-8', 'ignore')[:500]}")
    return stdout
