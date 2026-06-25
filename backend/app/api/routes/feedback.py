import logging

from fastapi import APIRouter, HTTPException, status

from app.domain.schemas import FeedbackCreate, FeedbackResponse
from app.services.slack_client import SlackClient

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/feedback", tags=["feedback"])


@router.post("", response_model=FeedbackResponse, status_code=status.HTTP_200_OK)
async def submit_feedback(body: FeedbackCreate) -> FeedbackResponse:
    client = SlackClient()
    try:
        await client.send_feedback(body.message.strip())
    except RuntimeError as exc:
        logger.exception("Failed to send feedback to Slack")
        msg = str(exc)
        if "missing_scope" in msg:
            detail = (
                "Slackアプリに chat:write・channels:read・groups:read スコープが必要です。"
                "api.slack.com のアプリ設定で追加し、ワークスペースへ再インストールしてください。"
                "または ECS の SLACK_FEEDBACK_CHANNELS に投稿先チャンネル名（例: #feedback）を設定してください。"
            )
        elif msg.startswith("no_channels:"):
            detail = msg.removeprefix("no_channels: ").strip()
        else:
            detail = "フィードバックの送信に失敗しました。しばらく待って再試行してください。"
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=detail,
        ) from exc
    return FeedbackResponse()
