import asyncio
import json
import logging
from pathlib import Path
from typing import Any

import boto3
from botocore.config import Config
from botocore.exceptions import BotoCoreError, ClientError

from app.config import Settings, get_settings

logger = logging.getLogger(__name__)

_STUB_TTS_MP3 = Path(__file__).resolve().parent.parent / "assets" / "stub_tts.mp3"

_BOTO_CONFIG = Config(retries={"max_attempts": 3, "mode": "standard"})


def _service_client(service: str, settings: Settings | None = None):
    settings = settings or get_settings()
    return boto3.client(
        service,
        region_name=settings.aws_region,
        config=_BOTO_CONFIG,
    )


def _s3_client(settings: Settings | None = None):
    settings = settings or get_settings()
    kwargs: dict[str, Any] = {
        "region_name": settings.aws_region,
        "config": _BOTO_CONFIG,
    }
    if settings.s3_endpoint_url:
        kwargs["endpoint_url"] = settings.s3_endpoint_url
    return boto3.client("s3", **kwargs)


class BedrockClient:
    def __init__(self, settings: Settings | None = None) -> None:
        self.settings = settings or get_settings()

    def invoke(self, model_id: str, system: str, user_message: str, max_tokens: int = 1024) -> str:
        if self.settings.aws_stub_mode:
            return self._stub_response(system, user_message)

        client = _service_client("bedrock-runtime", self.settings)
        body = {
            "anthropic_version": "bedrock-2023-05-31",
            "max_tokens": max_tokens,
            "system": system,
            "messages": [{"role": "user", "content": user_message}],
        }
        try:
            response = client.invoke_model(
                modelId=model_id,
                body=json.dumps(body),
                contentType="application/json",
                accept="application/json",
            )
        except (ClientError, BotoCoreError):
            logger.exception(
                "Bedrock invoke failed (model=%s, region=%s)",
                model_id,
                self.settings.aws_region,
            )
            raise
        payload = json.loads(response["body"].read())
        return payload["content"][0]["text"]

    def invoke_stream(
        self, model_id: str, system: str, user_message: str, max_tokens: int = 1024
    ):
        """Yield text deltas as they are generated (lower time-to-first-token)."""
        if self.settings.aws_stub_mode:
            yield self._stub_response(system, user_message)
            return

        client = _service_client("bedrock-runtime", self.settings)
        body = {
            "anthropic_version": "bedrock-2023-05-31",
            "max_tokens": max_tokens,
            "system": system,
            "messages": [{"role": "user", "content": user_message}],
        }
        try:
            response = client.invoke_model_with_response_stream(
                modelId=model_id,
                body=json.dumps(body),
                contentType="application/json",
                accept="application/json",
            )
        except (ClientError, BotoCoreError):
            logger.exception(
                "Bedrock stream invoke failed (model=%s, region=%s)",
                model_id,
                self.settings.aws_region,
            )
            raise
        for event in response["body"]:
            chunk = event.get("chunk")
            if not chunk:
                continue
            data = json.loads(chunk["bytes"])
            if data.get("type") == "content_block_delta":
                delta = data.get("delta", {})
                text = delta.get("text")
                if text:
                    yield text

    def _stub_response(self, system: str, user_message: str) -> str:
        if "JSON" in system or "json" in system.lower():
            if "customer profile" in system.lower() or "顧客" in system:
                return json.dumps(
                    {
                        "name": "田中 健太",
                        "industry": "金融",
                        "company_size": "中堅（300名）",
                        "role_title": "情報システム部長",
                        "surface_need": "社内システムの老朽化対応",
                        "true_challenge": "部門間のデータ連携不全により意思決定が遅延している",
                        "personality_type": "慎重・課題にまだ気づいていない",
                        "initial_awareness": 25,
                    },
                    ensure_ascii=False,
                )
            return json.dumps(
                {
                    "awareness_level": 35,
                    "rapport_level": 45,
                    "disclosed_info": ["現行システムの課題"],
                    "session_summary": "予算感と導入時期について質問があった。",
                    "title": "現状課題のヒアリング",
                },
                ensure_ascii=False,
            )
        if "顧客" in system or "customer" in system.lower():
            return "そうですね、現状のシステムについてはいくつか課題を感じています。もう少し詳しくお聞きしてもよろしいでしょうか。"
        return "了解しました。"


class TranscribeClient:
    def __init__(self, settings: Settings | None = None) -> None:
        self.settings = settings or get_settings()

    async def transcribe_stream_pcm(self, pcm_bytes: bytes, sample_rate: int = 16000) -> str:
        """Near real-time STT via Transcribe streaming (avoids batch-job queue latency)."""
        if self.settings.aws_stub_mode:
            return "本日はお時間いただきありがとうございます。現状の課題についてお伺いしたいのですが。"
        if not pcm_bytes:
            raise ValueError("No audio received for transcription")

        from amazon_transcribe.client import TranscribeStreamingClient
        from amazon_transcribe.handlers import TranscriptResultStreamHandler

        client = TranscribeStreamingClient(region=self.settings.aws_region)
        stream = await client.start_stream_transcription(
            language_code="ja-JP",
            media_sample_rate_hz=sample_rate,
            media_encoding="pcm",
        )

        final_parts: list[str] = []

        class _Handler(TranscriptResultStreamHandler):
            async def handle_transcript_event(self, transcript_event) -> None:
                for result in transcript_event.transcript.results:
                    if result.is_partial or not result.alternatives:
                        continue
                    final_parts.append(result.alternatives[0].transcript)

        handler = _Handler(stream.output_stream)

        async def _write() -> None:
            chunk = 1024 * 8
            for i in range(0, len(pcm_bytes), chunk):
                await stream.input_stream.send_audio_event(audio_chunk=pcm_bytes[i : i + chunk])
            await stream.input_stream.end_stream()

        await asyncio.gather(_write(), handler.handle_events())
        return "".join(final_parts).strip()

    def transcribe_audio(self, audio_bytes: bytes, media_format: str = "webm") -> str:
        if self.settings.aws_stub_mode:
            return "本日はお時間いただきありがとうございます。現状の課題についてお伺いしたいのですが。"
        if not audio_bytes:
            raise ValueError("No audio received for transcription")

        import time
        import uuid

        client = _service_client("transcribe", self.settings)
        job_name = f"syodan-{uuid.uuid4().hex[:12]}"
        s3 = S3Client(self.settings)
        temp_key = f"temp/stt/{job_name}.{media_format}"
        s3.put_bytes(temp_key, audio_bytes, content_type=f"audio/{media_format}")

        try:
            client.start_transcription_job(
                TranscriptionJobName=job_name,
                Media={"MediaFileUri": f"s3://{self.settings.s3_bucket_name}/{temp_key}"},
                MediaFormat=media_format,
                LanguageCode="ja-JP",
            )
        except (ClientError, BotoCoreError):
            logger.exception("Transcribe start failed (region=%s)", self.settings.aws_region)
            raise

        for _ in range(60):
            job = client.get_transcription_job(TranscriptionJobName=job_name)
            status = job["TranscriptionJob"]["TranscriptionJobStatus"]
            if status == "COMPLETED":
                import httpx

                uri = job["TranscriptionJob"]["Transcript"]["TranscriptFileUri"]
                resp = httpx.get(uri, timeout=30)
                data = resp.json()
                return data["results"]["transcripts"][0]["transcript"]
            if status == "FAILED":
                reason = job["TranscriptionJob"].get("FailureReason", "unknown")
                logger.error("Transcribe job failed: %s", reason)
                raise RuntimeError(f"Transcription failed: {reason}")
            time.sleep(1)
        raise TimeoutError("Transcription timed out")


class PollyClient:
    def __init__(self, settings: Settings | None = None) -> None:
        self.settings = settings or get_settings()

    def synthesize(self, text: str) -> bytes:
        if self.settings.aws_stub_mode:
            try:
                return self._synthesize_aws(text)
            except Exception:
                logger.warning("Polly unavailable in stub mode; using bundled stub audio")
                if _STUB_TTS_MP3.is_file():
                    return _STUB_TTS_MP3.read_bytes()
                return b""

        return self._synthesize_aws(text)

    def _synthesize_aws(self, text: str) -> bytes:
        client = _service_client("polly", self.settings)
        try:
            response = client.synthesize_speech(
                Text=text,
                OutputFormat="mp3",
                VoiceId=self.settings.polly_voice_id,
                Engine=self.settings.polly_engine,
                LanguageCode="ja-JP",
            )
        except (ClientError, BotoCoreError):
            logger.exception("Polly synthesize failed (region=%s)", self.settings.aws_region)
            raise
        return response["AudioStream"].read()


class S3Client:
    def __init__(self, settings: Settings | None = None) -> None:
        self.settings = settings or get_settings()

    def put_bytes(self, key: str, data: bytes, content_type: str = "application/octet-stream") -> str:
        if self.settings.aws_stub_mode:
            logger.info("S3 stub put: %s (%d bytes)", key, len(data))
            return key

        client = _s3_client(self.settings)
        client.put_object(
            Bucket=self.settings.s3_bucket_name,
            Key=key,
            Body=data,
            ContentType=content_type,
            ServerSideEncryption="AES256",
        )
        return key

    def generate_presigned_url(self, key: str, expires_in: int = 3600) -> str | None:
        if not key:
            return None
        if self.settings.aws_stub_mode:
            return f"stub://{key}"

        client = _s3_client(self.settings)
        return client.generate_presigned_url(
            "get_object",
            Params={"Bucket": self.settings.s3_bucket_name, "Key": key},
            ExpiresIn=expires_in,
        )
