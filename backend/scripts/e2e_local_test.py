"""ローカル統合テスト（フロント相当のAPIフロー + フロントHTTP）。"""

from __future__ import annotations

import os
import sys

import httpx

API_BASE = os.environ.get("API_BASE_URL", "http://localhost:8001").rstrip("/")
FRONT_BASE = os.environ.get("FRONT_BASE_URL", "http://localhost:5175").rstrip("/")
TIMEOUT = 30.0


def fail(msg: str) -> None:
    print(f"FAIL: {msg}")
    sys.exit(1)


def ok(msg: str) -> None:
    print(f"OK: {msg}")


def main() -> None:
    print(f"API: {API_BASE}  Frontend: {FRONT_BASE}")
    with httpx.Client(timeout=TIMEOUT) as client:
        for path in ("/", "/roleplay/setup"):
            res = client.get(f"{FRONT_BASE}{path}")
            if res.status_code != 200:
                fail(f"frontend GET {path} -> {res.status_code}")
            if "<!doctype html" not in res.text.lower():
                fail(f"frontend GET {path} is not HTML")
        ok("frontend pages load (/, /roleplay/setup)")

        program = client.post(
            f"{API_BASE}/api/programs",
            json={"field": "金融", "total_sessions": 1, "evaluator_ids": ["senior-1"]},
        )
        if program.status_code != 201:
            fail(f"create program: {program.status_code}")
        program_id = program.json()["id"]
        profile = program.json().get("customer_profile") or {}
        if profile.get("true_challenge") is not None:
            fail("true_challenge should be hidden on create")
        ok("program created, true_challenge hidden")

        session = client.post(
            f"{API_BASE}/api/programs/{program_id}/sessions",
            json={"goal": "現状課題をヒアリング", "time_limit_minutes": 15},
        )
        if session.status_code != 201:
            fail(f"create session: {session.status_code} {session.text}")
        session_id = session.json()["id"]

        started = client.post(f"{API_BASE}/api/sessions/{session_id}/start")
        if started.status_code != 200 or started.json().get("status") != "in_progress":
            fail(f"start session: {started.status_code}")
        ok("session started (roleplay setup flow)")

        ended = client.post(f"{API_BASE}/api/sessions/{session_id}/end")
        if ended.status_code != 200:
            fail(f"end empty session: {ended.status_code}")
        ok("session end accepted")

        cors = client.options(
            f"{API_BASE}/api/programs",
            headers={
                "Origin": "http://localhost:5173",
                "Access-Control-Request-Method": "POST",
            },
        )
        if cors.headers.get("access-control-allow-origin") != "http://localhost:5173":
            fail("CORS for localhost:5173 missing")
        ok("CORS for localhost:5173")

    print("All local E2E checks passed.")


if __name__ == "__main__":
    main()
