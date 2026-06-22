"""要件定義 §9.5 HULFT Square 書き戻し内部 API"""

from uuid import UUID

import pytest
from httpx import AsyncClient

from tests.conftest import create_and_start_session, create_program, internal_headers


@pytest.mark.asyncio
async def test_internal_api_rejects_missing_key(client: AsyncClient) -> None:
    program = await create_program(client)
    session = await create_and_start_session(client, program["id"])

    res = await client.post(
        "/internal/evaluation-artifacts",
        json={
            "session_id": session["id"],
            "formatted_transcript": "# 整形済み",
            "artifact_type": "session",
        },
    )
    assert res.status_code == 401


@pytest.mark.asyncio
async def test_internal_api_rejects_invalid_key(client: AsyncClient) -> None:
    program = await create_program(client)
    session = await create_and_start_session(client, program["id"])

    res = await client.post(
        "/internal/evaluation-artifacts",
        headers={"X-API-Key": "wrong-key", "Content-Type": "application/json"},
        json={
            "session_id": session["id"],
            "formatted_transcript": "# 整形済み",
            "artifact_type": "session",
        },
    )
    assert res.status_code == 401


@pytest.mark.asyncio
async def test_internal_api_updates_formatted_transcript_idempotent(
    client: AsyncClient, internal_headers: dict[str, str]
) -> None:
    program = await create_program(client)
    session = await create_and_start_session(client, program["id"])

    from app.api.routes import sessions as sessions_routes

    sessions_routes.append_conversation(str(session["id"]), "user", "質問")
    sessions_routes.append_conversation(str(session["id"]), "ai", "回答")
    await client.post(f"/api/sessions/{session['id']}/end")

    payload = {
        "session_id": session["id"],
        "formatted_transcript": "# HULFT整形版\n\n営業: 質問\n顧客: 回答",
        "artifact_type": "session",
    }
    first = await client.post("/internal/evaluation-artifacts", headers=internal_headers, json=payload)
    assert first.status_code == 200
    assert first.json() == {"status": "ok"}

    second = await client.post(
        "/internal/evaluation-artifacts",
        headers=internal_headers,
        json={**payload, "formatted_transcript": "# 上書き版"},
    )
    assert second.status_code == 200

    review = await client.get(f"/api/sessions/{session['id']}")
    assert review.status_code == 200
    # formatted_transcript は先輩評価ページ API で確認
    from sqlalchemy import select

    from app.db import session as db_session_module
    from app.domain.models import HearingSession

    async with db_session_module.get_session_factory()() as db:
        result = await db.execute(
            select(HearingSession).where(HearingSession.id == UUID(session["id"]))
        )
        row = result.scalar_one()
        assert row.formatted_transcript == "# 上書き版"
        token = row.review_token

    page = await client.get(f"/api/review/{token}")
    assert "# 上書き版" in (page.json().get("formatted_transcript") or "")


@pytest.mark.asyncio
async def test_overall_artifact_closes_program(client: AsyncClient, internal_headers: dict[str, str]) -> None:
    program = await create_program(client, total_sessions=1)
    session = await create_and_start_session(client, program["id"])

    from app.api.routes import sessions as sessions_routes

    sessions_routes.append_conversation(str(session["id"]), "user", "a")
    sessions_routes.append_conversation(str(session["id"]), "ai", "b")
    await client.post(f"/api/sessions/{session['id']}/end")

    res = await client.post(
        "/internal/evaluation-artifacts",
        headers=internal_headers,
        json={
            "program_id": program["id"],
            "formatted_transcript": "# 総評用",
            "artifact_type": "overall",
        },
    )
    assert res.status_code == 200

    detail = await client.get(f"/api/programs/{program['id']}")
    assert detail.json()["status"] == "closed"
    assert detail.json()["reveal_challenge"] is True
    assert detail.json()["customer_profile"]["true_challenge"]
