import asyncio
import json
import logging
import re
import threading
from collections.abc import Callable
from queue import Queue

from app.config import get_settings
from app.domain.models import CustomerProfile, CustomerState, HearingSession
from app.integrations.aws_clients import BedrockClient, PollyClient, TranscribeClient

logger = logging.getLogger(__name__)

_PCM_SAMPLE_RATE = 16000
_SENTENCE_BOUNDARY = re.compile(r"[。．！？!?\n]")
_MIN_SYNTH_CHARS = 12
# 初回チャンクは読点でも区切り、最小文字数も下げて「最初の音声が出るまで」を短縮する
_FIRST_BOUNDARY = re.compile(r"[。．！？!?\n、，,]")
_FIRST_MIN_CHARS = 4

CHAT_SYSTEM_TEMPLATE = """あなたはB2B商談の見込み顧客としてロールプレイします。
プロファイルの名前で自己紹介・応答してください（例: 田中 健太）。
性格・業界・役職・表面ニーズ・真の課題・現在の気づき度に沿って自然な日本語で応答してください。
営業担当の質問に対し、一度に長すぎず、リアルな会話調で答えてください。
真の課題を直接明かさないでください。気づき度が低いほど課題認識は曖昧に。
残り時間が少ない場合は会話を締めに向かうが、相手が締め中なら協調的に続けてください。

【参考資料について】
提供されている「参考資料（事前インプット）」がある場合、これは営業担当から事前に送付された製品仕様や営業資料等の参考情報です。あなたは既にこの内容を把握している前提でロールプレイを行ってください。営業担当から「送った資料」「添付ファイル」「事前テキスト」などの言及があった場合は、この参考資料を指していると理解し、その内容に沿って受け答えをしてください。
{materials_section}
【顧客プロファイル】
{profile_json}

【現在の状態】
{state_json}

【今回の目標（営業側）】
{goal}

【残り秒数】
{remaining_sec}
"""



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
        profile_hints: dict | None = None,
        materials_text: str | None = None,
    ) -> str:
        profile_data: dict = {
            "name": profile.name,
            "industry": profile.industry,
            "company_size": profile.company_size,
            "role_title": profile.role_title,
            "surface_need": profile.surface_need,
            "true_challenge": profile.true_challenge,
            "personality_type": profile.personality_type,
        }
        if profile_hints and profile_hints.get("it_knowledge_level"):
            profile_data["it_knowledge_level"] = profile_hints["it_knowledge_level"]
        profile_json = json.dumps(profile_data, ensure_ascii=False)
        state_json = json.dumps(
            {
                "awareness_level": state.awareness_level,
                "rapport_level": state.rapport_level,
                "disclosed_info": state.disclosed_info,
            },
            ensure_ascii=False,
        )
        materials_section = ""
        if materials_text:
            materials_section = f"\n【参考資料（事前インプット）】\n{materials_text}\n"

        return CHAT_SYSTEM_TEMPLATE.format(
            materials_section=materials_section,
            profile_json=profile_json,
            state_json=state_json,
            goal=goal,
            remaining_sec=remaining_sec,
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
        max_tokens: int = 400,
    ) -> str:
        """Stream the LLM response, synthesizing speech sentence-by-sentence.

        Runs synchronously (intended for asyncio.to_thread). LLM token generation
        and Polly synthesis run on separate threads via a bounded queue, so the
        model keeps generating the next sentence while the current one is being
        synthesized. `on_audio` is invoked (in order) for each audio chunk so the
        client can start playback early.
        """
        full_parts: list[str] = []
        buffer = ""
        first_done = False
        # 文をキューに積み、別スレッドで順次合成する（LLM生成とTTSを並列化）
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

        def _enqueue(text: str) -> None:
            text = text.strip()
            if text:
                sentence_queue.put(text)

        try:
            for delta in self.bedrock.invoke_stream(
                self.settings.bedrock_chat_model_id,
                system_prompt,
                user_text,
                max_tokens=max_tokens,
            ):
                full_parts.append(delta)
                buffer += delta
                while True:
                    boundary = _SENTENCE_BOUNDARY if first_done else _FIRST_BOUNDARY
                    min_chars = _MIN_SYNTH_CHARS if first_done else _FIRST_MIN_CHARS
                    match = boundary.search(buffer)
                    if not match:
                        break
                    end = match.end()
                    candidate = buffer[:end]
                    if len(candidate.strip()) < min_chars:
                        break
                    _enqueue(candidate)
                    buffer = buffer[end:]
                    first_done = True
            _enqueue(buffer)
        finally:
            sentence_queue.put(None)
            worker.join()

        return "".join(full_parts).strip()


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
