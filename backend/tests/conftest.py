import os

# アプリ import 前にテスト用環境を固定する
os.environ.setdefault("APP_ENV", "test")
os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite://")
os.environ.setdefault("AWS_STUB_MODE", "true")
os.environ.setdefault("HULFT_STUB_MODE", "true")
os.environ.setdefault("INTERNAL_API_KEY", "test-internal-key")
os.environ.setdefault("CORS_ORIGINS", "http://localhost:5173")

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool

from app.config import get_settings
from app.db import session as db_session_module
from app.db.session import get_db
from app.domain.models import Base
from app.main import create_app

TEST_INTERNAL_KEY = "test-internal-key"


def _init_test_engine():
    get_settings.cache_clear()
    db_session_module._engine = create_async_engine(
        "sqlite+aiosqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    db_session_module._async_session_factory = async_sessionmaker(
        db_session_module._engine, class_=AsyncSession, expire_on_commit=False
    )
    return db_session_module._engine


@pytest.fixture
async def db_session() -> AsyncSession:
    engine = _init_test_engine()
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    async with db_session_module.get_session_factory()() as session:
        yield session


@pytest.fixture
async def client(db_session: AsyncSession) -> AsyncClient:
    app = create_app()

    async def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
    app.dependency_overrides.clear()


@pytest.fixture
def internal_headers() -> dict[str, str]:
    return {"X-API-Key": TEST_INTERNAL_KEY, "Content-Type": "application/json"}


async def create_program(client: AsyncClient, total_sessions: int = 2) -> dict:
    res = await client.post(
        "/api/programs",
        json={"field": "金融", "total_sessions": total_sessions, "evaluator_ids": ["senior-1"]},
    )
    assert res.status_code == 201
    return res.json()


async def create_and_start_session(
    client: AsyncClient, program_id: str, goal: str = "予算感をヒアリング"
) -> dict:
    res = await client.post(
        f"/api/programs/{program_id}/sessions",
        json={"goal": goal, "time_limit_minutes": 15},
    )
    assert res.status_code == 201
    session = res.json()
    start = await client.post(f"/api/sessions/{session['id']}/start")
    assert start.status_code == 200
    return start.json()
