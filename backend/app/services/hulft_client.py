import json
import logging
from uuid import UUID

import httpx

from app.config import get_settings

logger = logging.getLogger(__name__)

_HULFT_LOGIN_URL = "https://app.square.hulft.com/v1/users/login"
_HULFT_TOKEN_URL = "https://app.square.hulft.com/v1/rest-api-token"


class HulftClient:
    async def _get_access_token(self) -> str | None:
        settings = get_settings()
        if not settings.hulft_email or not settings.hulft_password:
            logger.warning("HULFT credentials not set")
            return None

        # Step 1: Login API でアクセストークン取得
        async with httpx.AsyncClient(timeout=30) as client:
            login_resp = await client.post(
                _HULFT_LOGIN_URL,
                json={"email": settings.hulft_email, "password": settings.hulft_password},
            )
            login_resp.raise_for_status()
            login_token = login_resp.json().get("accessToken")

        if not login_token or not settings.hulft_refresh_token:
            return login_token

        # Step 2: リフレッシュトークンで REST API 用トークンを取得
        async with httpx.AsyncClient(timeout=30) as client:
            token_resp = await client.put(
                _HULFT_TOKEN_URL,
                json={"refreshToken": settings.hulft_refresh_token},
                headers={"Authorization": f"Bearer {login_token}"},
            )
            token_resp.raise_for_status()
            return token_resp.json().get("accessToken")

    async def send_session_complete(
        self,
        session_id: UUID,
        program_id: UUID,
        review_token: str,
        payload: dict,
    ) -> None:
        settings = get_settings()
        body = {
            "event": "session_complete",
            "session_id": str(session_id),
            "program_id": str(program_id),
            "review_url": f"/api/review/{review_token}",
            "payload": payload,
        }
        if settings.hulft_stub_mode or not settings.hulft_webhook_url:
            logger.info("HULFT stub session_complete: %s", json.dumps(body, ensure_ascii=False))
            await self._stub_writeback(session_id, payload)
            return

        token = await self._get_access_token()
        headers = {"Authorization": f"Bearer {token}"} if token else {}
        async with httpx.AsyncClient(timeout=30) as client:
            await client.post(settings.hulft_webhook_url, json=body, headers=headers)

    async def send_overall_review_request(self, program_id: UUID) -> None:
        settings = get_settings()
        body = {"event": "overall_review_request", "program_id": str(program_id)}
        if settings.hulft_stub_mode or not settings.hulft_webhook_url:
            logger.info("HULFT stub overall_review_request: %s", json.dumps(body, ensure_ascii=False))
            return

        token = await self._get_access_token()
        headers = {"Authorization": f"Bearer {token}"} if token else {}
        async with httpx.AsyncClient(timeout=30) as client:
            await client.post(settings.hulft_webhook_url, json=body, headers=headers)

    async def _stub_writeback(self, session_id: UUID, payload: dict) -> None:
        formatted = (
            f"# ロープレ記録\n\n"
            f"**分野**: {payload.get('field')}\n"
            f"**回数**: 第{payload.get('session_number')}回\n"
            f"**目標**: {payload.get('goal')}\n\n"
            f"## 文字起こし\n\n{payload.get('transcript', '')}"
        )
        logger.info("HULFT stub writeback for session %s (%d chars)", session_id, len(formatted))
