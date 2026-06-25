import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import evaluations, feedback, health, internal, programs, sessions
from app.config import get_settings
from app.db.session import get_engine
from app.domain.models import Base
from app.websocket import hearing

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    if settings.app_env == "development":
        async with get_engine().begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        logger.info("Database tables ensured (development mode)")
    yield


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(title="Syodan Backend", version="0.1.0", lifespan=lifespan)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(health.router)
    app.include_router(programs.router)
    app.include_router(sessions.router)
    app.include_router(evaluations.router)
    app.include_router(feedback.router)
    app.include_router(internal.router)
    app.include_router(hearing.router)

    return app


app = create_app()
