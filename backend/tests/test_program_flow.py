"""要件定義 §5.1 プログラム管理・§5.5 真の課題非公開"""

import pytest
from httpx import AsyncClient

from tests.conftest import create_and_start_session, create_program


@pytest.mark.asyncio
async def test_create_program_generates_customer_profile(client: AsyncClient) -> None:
    program = await create_program(client)
    assert program["field"] == "金融"
    assert program["total_sessions"] == 2
    assert program["status"] == "created"
    assert program["reveal_challenge"] is False
    profile = program["customer_profile"]
    assert profile is not None
    assert profile["true_challenge"] is None
    assert profile["industry"]
    assert profile["personality_type"]
    assert profile.get("name")
    assert 0 <= profile["initial_awareness"] <= 100


@pytest.mark.asyncio
async def test_true_challenge_hidden_until_all_sessions_done(client: AsyncClient) -> None:
    program = await create_program(client, total_sessions=1)
    program_id = program["id"]
    assert program["customer_profile"]["true_challenge"] is None

    session = await create_and_start_session(client, program_id)
    from app.api.routes import sessions as sessions_routes

    sessions_routes.append_conversation(str(session["id"]), "user", "現状の課題を教えてください")
    sessions_routes.append_conversation(str(session["id"]), "ai", "そうですね、いくつかあります")

    end = await client.post(f"/api/sessions/{session['id']}/end")
    assert end.status_code == 200
    assert end.json()["status"] == "evaluation_requested"

    detail = await client.get(f"/api/programs/{program_id}")
    assert detail.status_code == 200
    body = detail.json()
    # 全回完了後も総評完了まではユーザーに非公開（要件 §5.5）
    assert body["reveal_challenge"] is False
    assert body["customer_profile"]["true_challenge"] is None
    assert body["status"] in ("all_sessions_done", "overall_review_requested")


@pytest.mark.asyncio
async def test_create_program_with_personality_override(client: AsyncClient) -> None:
    res = await client.post(
        "/api/programs",
        json={
            "field": "製造業 / 車・自動車部品",
            "total_sessions": 2,
            "personality_type": "せっかちで要点を急ぐ",
            "sub_field": "車・自動車部品",
            "it_knowledge_level": "ITが苦手（専門用語やシステム用語は通じない）",
        },
    )
    assert res.status_code == 201
    body = res.json()
    assert body["field"] == "製造業 / 車・自動車部品"
    assert body["customer_profile"]["personality_type"] == "せっかちで要点を急ぐ"
    assert body["sessions"] == []
    assert body["overall_reviews"] == []


@pytest.mark.asyncio
async def test_cors_allows_localhost_frontend(client: AsyncClient) -> None:
    res = await client.options(
        "/api/programs",
        headers={
            "Origin": "http://localhost:5173",
            "Access-Control-Request-Method": "POST",
        },
    )
    assert res.status_code == 200
    assert res.headers.get("access-control-allow-origin") == "http://localhost:5173"
