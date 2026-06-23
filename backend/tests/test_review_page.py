"""要件定義 §5.4 先輩評価ページ・§9.4 UUID URL"""

from uuid import UUID

import pytest
from httpx import AsyncClient
from sqlalchemy import select

from app.db import session as db_session_module
from app.domain.models import HearingSession
from tests.conftest import create_and_start_session, create_program


@pytest.mark.asyncio
async def test_review_page_shows_true_challenge_for_evaluator(client: AsyncClient) -> None:
    program = await create_program(client)
    session = await create_and_start_session(client, program["id"])

    from app.api.routes import sessions as sessions_routes

    sessions_routes.append_conversation(str(session["id"]), "user", "課題は？")
    sessions_routes.append_conversation(str(session["id"]), "ai", "いくつかあります")
    await client.post(f"/api/sessions/{session['id']}/end")

    async with db_session_module.get_session_factory()() as db:
        result = await db.execute(
            select(HearingSession).where(HearingSession.id == UUID(session["id"]))
        )
        row = result.scalar_one()
        token = row.review_token

    assert len(token) >= 32

    res = await client.get(f"/api/review/{token}")
    assert res.status_code == 200
    body = res.json()
    assert body["program_field"] == "金融"
    assert body["session_number"] == 1
    assert body["goal"]
    assert body["true_challenge"]
    assert "部門間" in body["true_challenge"] or len(body["true_challenge"]) > 0
    assert body["formatted_transcript"]


@pytest.mark.asyncio
async def test_submit_session_evaluation_persists_to_session(client: AsyncClient) -> None:
    program = await create_program(client)
    session = await create_and_start_session(client, program["id"])

    from app.api.routes import sessions as sessions_routes

    sessions_routes.append_conversation(str(session["id"]), "user", "課題は？")
    sessions_routes.append_conversation(str(session["id"]), "ai", "いくつかあります")
    await client.post(f"/api/sessions/{session['id']}/end")

    async with db_session_module.get_session_factory()() as db:
        result = await db.execute(
            select(HearingSession).where(HearingSession.id == UUID(session["id"]))
        )
        token = result.scalar_one().review_token

    submit = await client.post(
        f"/api/review/{token}/evaluations",
        json={"evaluator_id": "田中先輩", "content": "ヒアリングが丁寧でした"},
    )
    assert submit.status_code == 200
    assert submit.json()["evaluator_id"] == "田中先輩"
    assert submit.json()["content"] == "ヒアリングが丁寧でした"

    detail = await client.get(f"/api/sessions/{session['id']}")
    assert detail.status_code == 200
    body = detail.json()
    assert body["status"] == "evaluated"
    assert len(body["evaluations"]) == 1
    assert body["evaluations"][0]["content"] == "ヒアリングが丁寧でした"


@pytest.mark.asyncio
async def test_submit_session_evaluation_upserts_same_evaluator(client: AsyncClient) -> None:
    program = await create_program(client)
    session = await create_and_start_session(client, program["id"])

    from app.api.routes import sessions as sessions_routes

    sessions_routes.append_conversation(str(session["id"]), "user", "hello")
    sessions_routes.append_conversation(str(session["id"]), "ai", "hi")
    await client.post(f"/api/sessions/{session['id']}/end")

    async with db_session_module.get_session_factory()() as db:
        result = await db.execute(
            select(HearingSession).where(HearingSession.id == UUID(session["id"]))
        )
        token = result.scalar_one().review_token

    await client.post(
        f"/api/review/{token}/evaluations",
        json={"evaluator_id": "佐藤", "content": "初稿"},
    )
    await client.post(
        f"/api/review/{token}/evaluations",
        json={"evaluator_id": "佐藤", "content": "改訂版"},
    )

    detail = await client.get(f"/api/sessions/{session['id']}")
    evals = detail.json()["evaluations"]
    assert len(evals) == 1
    assert evals[0]["content"] == "改訂版"


@pytest.mark.asyncio
async def test_review_page_not_found_for_invalid_token(client: AsyncClient) -> None:
    res = await client.get("/api/review/invalid-token-00000000000000000000000000000000")
    assert res.status_code == 404
