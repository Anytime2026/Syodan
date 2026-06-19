import json
import logging

from app.config import get_settings
from app.domain.models import CustomerProfile, CustomerState, HearingSession
from app.integrations.aws_clients import BedrockClient, PollyClient, TranscribeClient

logger = logging.getLogger(__name__)

CHAT_SYSTEM_TEMPLATE = """あなたはB2B商談の見込み顧客としてロールプレイします。
性格・業界・役職・表面ニーズ・真の課題・現在の気づき度に沿って自然な日本語で応答してください。
営業担当の質問に対し、一度に長すぎず、リアルな会話調で答えてください。
真の課題を直接明かさないでください。気づき度が低いほど課題認識は曖昧に。
残り時間が少ない場合は会話を締めに向かうが、相手が締め中なら協調的に続けてください。

【顧客プロファイル】
{profile_json}

【現在の状態】
{state_json}

【今回の目標（営業側）】
{goal}

【残り秒数】
{remaining_sec}
"""


class AudioPipeline:
    def __init__(self) -> None:
        self.settings = get_settings()
        self.transcribe = TranscribeClient()
        self.bedrock = BedrockClient()
        self.polly = PollyClient()

    def build_system_prompt(
        self,
        profile: CustomerProfile,
        state: CustomerState,
        goal: str,
        remaining_sec: int,
    ) -> str:
        profile_json = json.dumps(
            {
                "industry": profile.industry,
                "company_size": profile.company_size,
                "role_title": profile.role_title,
                "surface_need": profile.surface_need,
                "true_challenge": profile.true_challenge,
                "personality_type": profile.personality_type,
            },
            ensure_ascii=False,
        )
        state_json = json.dumps(
            {
                "awareness_level": state.awareness_level,
                "rapport_level": state.rapport_level,
                "disclosed_info": state.disclosed_info,
            },
            ensure_ascii=False,
        )
        return CHAT_SYSTEM_TEMPLATE.format(
            profile_json=profile_json,
            state_json=state_json,
            goal=goal,
            remaining_sec=remaining_sec,
        )

    def process_turn(
        self,
        audio_bytes: bytes,
        system_prompt: str,
        media_format: str = "webm",
    ) -> tuple[str, str, bytes]:
        user_text = self.transcribe.transcribe_audio(audio_bytes, media_format=media_format)
        ai_text = self.bedrock.invoke(
            self.settings.bedrock_chat_model_id,
            system_prompt,
            user_text,
            max_tokens=512,
        )
        audio_out = self.polly.synthesize(ai_text)
        return user_text, ai_text, audio_out
