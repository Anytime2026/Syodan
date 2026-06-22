"""AWS ALB 上のバックエンド向けスモークテスト。

使い方:
  set API_BASE_URL=https://your-alb.ap-northeast-1.elb.amazonaws.com
  python scripts/smoke_test.py

ローカル:
  python scripts/smoke_test.py  # デフォルト http://localhost:8000
"""

from __future__ import annotations

import os
import sys
import uuid

import httpx

API_BASE = os.environ.get("API_BASE_URL", "http://localhost:8000").rstrip("/")
TIMEOUT = float(os.environ.get("SMOKE_TIMEOUT_SEC", "30"))


def fail(msg: str) -> None:
    print(f"FAIL: {msg}")
    sys.exit(1)


def ok(msg: str) -> None:
    print(f"OK: {msg}")


def main() -> None:
    print(f"Smoke test target: {API_BASE}")
    with httpx.Client(base_url=API_BASE, timeout=TIMEOUT) as client:
        health = client.get("/health")
        if health.status_code != 200:
            fail(f"/health returned {health.status_code}")
        ok("/health")

        origin = "http://localhost:5173"
        cors = client.options(
            "/api/programs",
            headers={
                "Origin": origin,
                "Access-Control-Request-Method": "POST",
            },
        )
        if cors.headers.get("access-control-allow-origin") != origin:
            fail(f"CORS missing for {origin}")
        ok(f"CORS allows {origin}")

        program = client.post(
            "/api/programs",
            json={"field": "金融", "total_sessions": 1, "evaluator_ids": ["smoke"]},
        )
        if program.status_code != 201:
            fail(f"create program: {program.status_code} {program.text}")
        program_id = program.json()["id"]
        ok(f"program created {program_id}")

        session = client.post(
            f"/api/programs/{program_id}/sessions",
            json={"goal": "スモークテスト", "time_limit_minutes": 1},
        )
        if session.status_code != 201:
            fail(f"create session: {session.status_code}")
        session_id = session.json()["id"]

        started = client.post(f"/api/sessions/{session_id}/start")
        if started.status_code != 200:
            fail(f"start session: {started.status_code}")

        aborted = client.post(f"/api/sessions/{session_id}/abort")
        if aborted.status_code != 200:
            fail(f"abort session: {aborted.status_code}")
        ok("session start/abort")

        bad_key = client.post(
            "/internal/evaluation-artifacts",
            headers={"X-API-Key": str(uuid.uuid4())},
            json={"formatted_transcript": "x", "artifact_type": "session"},
        )
        if bad_key.status_code != 401:
            fail(f"internal API should reject invalid key, got {bad_key.status_code}")
        ok("internal API rejects invalid key")

    print("All smoke checks passed.")


if __name__ == "__main__":
    main()
