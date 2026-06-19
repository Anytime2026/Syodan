"""AWS ALB 上のヒアリング WebSocket + Bedrock パイプライン検証。

使い方:
  set API_BASE_URL=http://syodan-alb-xxx.ap-northeast-1.elb.amazonaws.com
  python scripts/test_hearing_ws.py
"""

from __future__ import annotations

import asyncio
import json
import os
import sys

import httpx
import websockets

API_BASE = os.environ.get("API_BASE_URL", "http://localhost:8000").rstrip("/")
WS_BASE = os.environ.get("WS_BASE_URL", API_BASE.replace("https://", "wss://").replace("http://", "ws://")).rstrip("/")
TIMEOUT = float(os.environ.get("HEARING_TEST_TIMEOUT_SEC", "120"))


def fail(msg: str) -> None:
    print(f"FAIL: {msg}")
    sys.exit(1)


def ok(msg: str) -> None:
    print(f"OK: {msg}")


async def main() -> None:
    print(f"API: {API_BASE}  WS: {WS_BASE}")

    with httpx.Client(base_url=API_BASE, timeout=TIMEOUT) as client:
        program = client.post(
            "/api/programs",
            json={"field": "金融", "total_sessions": 1, "evaluator_ids": ["ws-test"]},
        )
        if program.status_code != 201:
            fail(f"create program: {program.status_code} {program.text}")
        program_id = program.json()["id"]
        profile = program.json().get("customer_profile") or {}
        if profile.get("industry") == "金融" and profile.get("company_size") == "中堅（300名）":
            fail("customer profile looks like Bedrock stub template — check AWS_STUB_MODE / IAM")
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

    user_text = ""
    ai_text = ""
    got_audio = False
    stub_ai = "そうですね、現状のシステムについてはいくつか課題を感じています"

    async with websockets.connect(uri, open_timeout=30) as ws:
        await ws.send(json.dumps({"type": "ptt_start"}))
        await ws.send(audio_bytes)
        await ws.send(json.dumps({"type": "ptt_end", "media_format": "mp3"}))

        deadline = asyncio.get_event_loop().time() + TIMEOUT
        while asyncio.get_event_loop().time() < deadline:
            try:
                msg = await asyncio.wait_for(ws.recv(), timeout=30)
            except TimeoutError:
                fail("timed out waiting for WebSocket messages")

            if isinstance(msg, bytes):
                if len(msg) > 0:
                    got_audio = True
                continue

            data = json.loads(msg)
            mtype = data.get("type")
            if mtype == "transcript":
                if data.get("speaker") == "user":
                    user_text = data.get("text", "")
                if data.get("speaker") == "ai":
                    ai_text = data.get("text", "")
            elif mtype == "error":
                fail(f"websocket error: {data.get('message')}")
            elif mtype == "turn_complete":
                break

    if not user_text:
        fail("no user transcript received")
    ok(f"user transcript: {user_text[:80]}...")

    if not ai_text:
        fail("no AI transcript received")
    if stub_ai in ai_text:
        fail(f"AI response is stub template: {ai_text[:120]}")
    ok(f"AI response (Bedrock): {ai_text[:120]}...")

    if not got_audio:
        print("WARN: no Polly audio bytes received (empty TTS or playback skipped)")
    else:
        ok("Polly audio bytes received")

    print("Hearing WebSocket pipeline check passed.")


if __name__ == "__main__":
    asyncio.run(main())
