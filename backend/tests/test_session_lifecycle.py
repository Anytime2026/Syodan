"""要件定義 §5.3 ヒアリングセッション・§7 状態遷移"""

import pytest
from httpx import AsyncClient

from tests.conftest import create_and_start_session, create_program


@pytest.mark.asyncio
async def test_session_lifecycle_start_end(client: AsyncClient) -> None:
    program = await create_program(client)
    session = await create_and_start_session(client, program["id"])
    assert session["status"] == "in_progress"
    assert session["started_at"] is not None

    from app.api.routes import sessions as sessions_routes

    sessions_routes.append_conversation(str(session["id"]), "user", "本日はよろしくお願いします")
    sessions_routes.append_conversation(str(session["id"]), "ai", "こちらこそよろしくお願いします")

    ended = await client.post(f"/api/sessions/{session['id']}/end")
    assert ended.status_code == 200
    body = ended.json()
    assert body["status"] == "evaluation_requested"
    assert body["title"]
    assert body["ended_at"] is not None

    program_after = await client.get(f"/api/programs/{program['id']}")
    assert program_after.json()["status"] == "in_progress"
    assert program_after.json()["completed_sessions"] == 1


@pytest.mark.asyncio
async def test_abort_session_allows_retry_same_round(client: AsyncClient) -> None:
    """異常終了時は破棄し同一回をやり直し可能（要件 §5.3・§7）"""
    program = await create_program(client)
    session = await create_and_start_session(client, program["id"])
    assert session["session_number"] == 1

    aborted = await client.post(f"/api/sessions/{session['id']}/abort")
    assert aborted.status_code == 200
    assert aborted.json()["status"] == "abandoned"

    retry = await client.post(
        f"/api/programs/{program['id']}/sessions",
        json={"goal": "再挑戦", "time_limit_minutes": 10},
    )
    assert retry.status_code == 201
    assert retry.json()["session_number"] == 1
    assert retry.json()["status"] == "not_started"

    listing = await client.get(f"/api/programs/{program['id']}/sessions")
    assert listing.status_code == 200
    assert len(listing.json()) == 1
    assert listing.json()[0]["session_number"] == 1


@pytest.mark.asyncio
async def test_cannot_start_two_sessions_in_parallel(client: AsyncClient) -> None:
    program = await create_program(client)
    s1 = await create_and_start_session(client, program["id"])

    conflict = await client.post(
        f"/api/programs/{program['id']}/sessions",
        json={"goal": "並行", "time_limit_minutes": 5},
    )
    assert conflict.status_code == 400

    await client.post(f"/api/sessions/{s1['id']}/abort")


@pytest.mark.asyncio
async def test_end_requires_in_progress(client: AsyncClient) -> None:
    program = await create_program(client)
    created = await client.post(
        f"/api/programs/{program['id']}/sessions",
        json={"goal": "未開始", "time_limit_minutes": 5},
    )
    session_id = created.json()["id"]
    bad = await client.post(f"/api/sessions/{session_id}/end")
    assert bad.status_code == 400


@pytest.mark.asyncio
async def test_all_sessions_complete_triggers_overall_review(client: AsyncClient) -> None:
    program = await create_program(client, total_sessions=1)
    session = await create_and_start_session(client, program["id"])

    from app.api.routes import sessions as sessions_routes

    sessions_routes.append_conversation(str(session["id"]), "user", "課題を深掘り")
    sessions_routes.append_conversation(str(session["id"]), "ai", "そうですね")

    await client.post(f"/api/sessions/{session['id']}/end")
    final = await client.get(f"/api/programs/{program['id']}")
    assert final.json()["status"] == "overall_review_requested"
    assert final.json()["completed_sessions"] == 1
