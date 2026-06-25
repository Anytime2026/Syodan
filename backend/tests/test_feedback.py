import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_feedback_empty_message(client: AsyncClient) -> None:
    res = await client.post("/api/feedback", json={"message": ""})
    assert res.status_code == 422


@pytest.mark.asyncio
async def test_feedback_success_stub(client: AsyncClient) -> None:
    res = await client.post(
        "/api/feedback",
        json={"message": "UIが使いやすくて良いです"},
    )
    assert res.status_code == 200
    assert res.json() == {"ok": True}
