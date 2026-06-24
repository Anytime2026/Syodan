"""AWS ALB 上のヒアリング WebSocket + Bedrock パイプライン検証。

使い方:
  set API_BASE_URL=http://syodan-alb-xxx.ap-northeast-1.elb.amazonaws.com
  python scripts/test_hearing_ws.py
"""

from __future__ import annotations

import asyncio
import json
import os
import struct
import subprocess
import sys
import time

import httpx
import websockets

API_BASE = os.environ.get("API_BASE_URL", "http://localhost:8000").rstrip("/")
WS_BASE = os.environ.get("WS_BASE_URL", API_BASE.replace("https://", "wss://").replace("http://", "ws://")).rstrip("/")
TIMEOUT = float(os.environ.get("HEARING_TEST_TIMEOUT_SEC", "120"))


def _is_bedrock_stub_profile(profile: dict) -> bool:
    """Matches BedrockClient._stub_response customer profile JSON exactly."""
    return (
        profile.get("name") == "田中 健太"
        and profile.get("industry") == "金融"
        and profile.get("company_size") == "中堅（300名）"
        and profile.get("role_title") == "情報システム部長"
    )


def fail(msg: str) -> None:
    print(f"FAIL: {msg}")
    sys.exit(1)


def ok(msg: str) -> None:
    print(f"OK: {msg}")


def mp3_to_pcm_s16le(mp3_path: str, sample_rate: int = 16000) -> bytes:
    proc = subprocess.run(
        [
            "ffmpeg",
            "-hide_banner",
            "-loglevel",
            "error",
            "-i",
            mp3_path,
            "-ac",
            "1",
            "-ar",
            str(sample_rate),
            "-f",
            "s16le",
            "pipe:1",
        ],
        capture_output=True,
        check=True,
    )
    return proc.stdout


async def recv_until_turn_complete(ws, timeout: float) -> dict:
    user_text = ""
    ai_text = ""
    got_audio = False
    got_partial = False
    t0 = time.monotonic()
    first_audio_at: float | None = None

    deadline = asyncio.get_event_loop().time() + timeout
    while asyncio.get_event_loop().time() < deadline:
        try:
            msg = await asyncio.wait_for(ws.recv(), timeout=30)
        except TimeoutError:
            fail("timed out waiting for WebSocket messages")

        if isinstance(msg, bytes):
            if len(msg) > 0:
                got_audio = True
                if first_audio_at is None:
                    first_audio_at = time.monotonic() - t0
            continue

        data = json.loads(msg)
        mtype = data.get("type")
        if mtype == "transcript_partial":
            got_partial = True
        elif mtype == "transcript":
            if data.get("speaker") == "user":
                user_text = data.get("text", "")
            if data.get("speaker") == "ai":
                ai_text = data.get("text", "")
        elif mtype == "error":
            fail(f"websocket error: {data.get('message')}")
        elif mtype == "turn_complete":
            break

    return {
        "user_text": user_text,
        "ai_text": ai_text,
        "got_audio": got_audio,
        "got_partial": got_partial,
        "first_audio_sec": first_audio_at,
    }


async def run_batch_turn(ws, audio_bytes: bytes, media_format: str) -> dict:
    await ws.send(json.dumps({"type": "ptt_start", "media_format": media_format}))
    await ws.send(audio_bytes)
    await ws.send(json.dumps({"type": "ptt_end", "media_format": media_format}))
    return await recv_until_turn_complete(ws, TIMEOUT)


async def run_pcm_stream_turn(ws, pcm_bytes: bytes, chunk_size: int = 8192) -> dict:
    await ws.send(
        json.dumps(
            {"type": "ptt_start", "media_format": "pcm_s16le", "sample_rate": 16000}
        )
    )
    for i in range(0, len(pcm_bytes), chunk_size):
        await ws.send(pcm_bytes[i : i + chunk_size])
        await asyncio.sleep(0.05)
    await ws.send(json.dumps({"type": "ptt_end", "media_format": "pcm_s16le"}))
    return await recv_until_turn_complete(ws, TIMEOUT)


async def main() -> None:
    print(f"API: {API_BASE}  WS: {WS_BASE}")
    stub_mode = False

    with httpx.Client(base_url=API_BASE, timeout=TIMEOUT) as client:
        program = client.post(
            "/api/programs",
            json={"field": "金融", "total_sessions": 1, "evaluator_ids": ["ws-test"]},
        )
        if program.status_code != 201:
            fail(f"create program: {program.status_code} {program.text}")
        program_id = program.json()["id"]
        profile = program.json().get("customer_profile") or {}
        stub_mode = _is_bedrock_stub_profile(profile)
        if stub_mode:
            print(
                "WARN: Bedrock stub profile detected (backend AWS_STUB_MODE=true). "
                "Testing WebSocket pipeline only."
            )
        elif profile.get("industry") == "金融" and profile.get("company_size") == "中堅（300名）":
            fail("customer profile looks like Bedrock stub template - check AWS_STUB_MODE / IAM")
        else:
            ok(f"program created with LLM profile (industry={profile.get('industry')})")

        session = client.post(
            f"/api/programs/{program_id}/sessions",
            json={"goal": "WebSocketテスト", "time_limit_minutes": 5},
        )
        if session.status_code != 201:
            fail(f"create session: {session.status_code}")
        session_id = session.json()["id"]

        started = client.post(f"/api/sessions/{session_id}/start")
        if started.status_code != 200:
            fail(f"start session: {started.status_code}")

    uri = f"{WS_BASE}/ws/sessions/{session_id}/hearing"
    print(f"Connecting: {uri}")

    test_mp3 = os.path.join(os.path.dirname(__file__), "..", "tmp-test.mp3")
    if not os.path.isfile(test_mp3):
        fail(f"test audio missing: {test_mp3} (run: aws polly synthesize-speech ...)")
    with open(test_mp3, "rb") as f:
        audio_bytes = f.read()

    stub_ai = "そうですね、現状のシステムについてはいくつか課題を感じています"

    async with websockets.connect(uri, open_timeout=30) as ws:
        print("--- PCM streaming turn ---")
        try:
            pcm_bytes = mp3_to_pcm_s16le(test_mp3)
        except (subprocess.CalledProcessError, FileNotFoundError):
            # ffmpeg なし環境: 1秒の無音 PCM
            pcm_bytes = struct.pack("<" + "h" * 16000, *([0] * 16000))
            print("WARN: ffmpeg unavailable; using 1s silence PCM")

        pcm_result = await run_pcm_stream_turn(ws, pcm_bytes)
        if not pcm_result["user_text"]:
            fail("no user transcript received (PCM path)")
        ok(f"PCM user transcript: {pcm_result['user_text'][:80]}...")
        if pcm_result["first_audio_sec"] is not None:
            ok(f"PCM first audio latency: {pcm_result['first_audio_sec']:.2f}s")

        print("--- legacy batch turn (webm/mp3) ---")
        batch_result = await run_batch_turn(ws, audio_bytes, "mp3")

    if not batch_result["user_text"]:
        fail("no user transcript received (batch path)")
    ok(f"batch user transcript: {batch_result['user_text'][:80]}...")

    if not batch_result["ai_text"]:
        fail("no AI transcript received")
    if stub_mode:
        ok(f"AI response (stub): {batch_result['ai_text'][:120]}...")
    elif stub_ai in batch_result["ai_text"]:
        fail(f"AI response is stub template: {batch_result['ai_text'][:120]}")
    else:
        ok(f"AI response (Bedrock): {batch_result['ai_text'][:120]}...")

    if not batch_result["got_audio"]:
        print("WARN: no Polly audio bytes received (empty TTS or playback skipped)")
    else:
        ok("Polly audio bytes received")

    print("Hearing WebSocket pipeline check passed.")


if __name__ == "__main__":
    asyncio.run(main())
