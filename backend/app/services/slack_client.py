import logging

import httpx

from app.config import get_settings

logger = logging.getLogger(__name__)

_SLACK_API_BASE = "https://slack.com/api"


class SlackClient:
    async def send_feedback(self, message: str) -> None:
        settings = get_settings()
        if settings.slack_stub_mode or not settings.slack_bot_token:
            logger.info("Slack stub feedback: %s", message)
            return

        text = f"【SalesGym フィードバック】\n{message}"
        channel_ids = self._configured_channels() or await self._list_member_channels()
        if not channel_ids:
            raise RuntimeError(
                "no_channels: SLACK_FEEDBACK_CHANNELS を設定するか、"
                "Slackアプリに channels:read / groups:read を追加してください"
            )

        async with httpx.AsyncClient(timeout=30) as client:
            headers = {"Authorization": f"Bearer {settings.slack_bot_token}"}
            for channel_id in channel_ids:
                resp = await client.post(
                    f"{_SLACK_API_BASE}/chat.postMessage",
                    headers=headers,
                    json={"channel": channel_id, "text": text},
                )
                resp.raise_for_status()
                data = resp.json()
                if not data.get("ok"):
                    error = data.get("error", "unknown_error")
                    logger.error("Slack chat.postMessage failed: %s (channel=%s)", error, channel_id)
                    raise RuntimeError(f"Slack API error: {error}")

    def _configured_channels(self) -> list[str]:
        settings = get_settings()
        if not settings.slack_feedback_channels:
            return []
        return [c.strip() for c in settings.slack_feedback_channels.split(",") if c.strip()]

    async def _list_member_channels(self) -> list[str]:
        settings = get_settings()
        if not settings.slack_bot_token:
            return []

        channel_ids: list[str] = []
        cursor: str | None = None

        async with httpx.AsyncClient(timeout=30) as client:
            headers = {"Authorization": f"Bearer {settings.slack_bot_token}"}
            while True:
                params: dict[str, str] = {
                    "types": "public_channel,private_channel",
                    "exclude_archived": "true",
                    "limit": "200",
                }
                if cursor:
                    params["cursor"] = cursor

                resp = await client.get(
                    f"{_SLACK_API_BASE}/conversations.list",
                    headers=headers,
                    params=params,
                )
                resp.raise_for_status()
                data = resp.json()
                if not data.get("ok"):
                    error = data.get("error", "unknown_error")
                    logger.error("Slack conversations.list failed: %s", error)
                    raise RuntimeError(f"Slack API error: {error}")

                for ch in data.get("channels", []):
                    if ch.get("is_member"):
                        channel_ids.append(ch["id"])

                cursor = (data.get("response_metadata") or {}).get("next_cursor")
                if not cursor:
                    break

        return channel_ids
