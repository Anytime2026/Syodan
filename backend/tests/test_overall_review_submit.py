"""先輩総評入力ページ・RDS保存"""

from uuid import UUID

import pytest
from httpx import AsyncClient
from sqlalchemy import select

from app.db import session as db_session_module
from app.domain.models import Program
from tests.conftest import create_and_start_session, create_program


async def _complete_all_sessions(client: AsyncClient, total_sessions: int = 1) -> tuple[dict, dict]:
    program = await create_program(client, total_sessions=total_sessions)
    last_session = None
    for _ in range(total_sessions):
        session = await create_and_start_session(client, program["id"])
        from app.api.routes import sessions as sessions_routes

        sessions_routes.append_conversation(str(session["id"]), "user", "課題を深掘り")
        sessions_routes.append_conversation(str(session["id"]), "ai", "そうですね")
        await client.post(f"/api/sessions/{session['id']}/end")
        last_session = session
    assert last_session is not None
    return program, last_session


@pytest.mark.asyncio
async def test_overall_review_token_generated_on_series_complete(client: AsyncClient) -> None:
    program, _ = await _complete_all_sessions(client, total_sessions=1)

    prog = await client.get(f"/api/programs/{program['id']}")
    assert prog.json()["status"] == "overall_review_requested"

    async with db_session_module.get_session_factory()() as db:
        result = await db.execute(select(Program).where(Program.id == UUID(program["id"])))
        row = result.scalar_one()
        assert row.overall_review_token
        assert len(row.overall_review_token) >= 32


@pytest.mark.asyncio
async def test_overall_review_page_and_submit(client: AsyncClient) -> None:
    program, _ = await _complete_all_sessions(client, total_sessions=1)

    async with db_session_module.get_session_factory()() as db:
        result = await db.execute(select(Program).where(Program.id == UUID(program["id"])))
        token = result.scalar_one().overall_review_token

    page = await client.get(f"/api/review/overall/{token}")
    assert page.status_code == 200
    body = page.json()
    assert body["program_field"] == "金融"
    assert body["total_sessions"] == 1
    assert body["true_challenge"]
    assert len(body["sessions"]) == 1
    assert body["overall_reviews"] == []

    submit = await client.post(
        f"/api/review/overall/{token}/reviews",
        json={"evaluator_id": "鈴木先輩", "content": "全体的に課題把握ができていました"},
    )
    assert submit.status_code == 200
    assert submit.json()["content"] == "全体的に課題把握ができていました"

    prog = await client.get(f"/api/programs/{program['id']}")
    reviews = prog.json()["overall_reviews"]
    assert len(reviews) == 1
    assert reviews[0]["evaluator_id"] == "鈴木先輩"


@pytest.mark.asyncio
async def test_overall_review_not_found_for_invalid_token(client: AsyncClient) -> None:
    res = await client.get("/api/review/overall/invalid-token-00000000000000000000000000000000")
    assert res.status_code == 404
