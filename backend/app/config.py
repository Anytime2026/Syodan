from functools import lru_cache

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_env: str = "development"
    log_level: str = "INFO"
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"

    database_url: str = "postgresql+asyncpg://syodan:syodan_dev@localhost:5432/syodan"

    aws_region: str = "ap-northeast-1"
    aws_stub_mode: bool = True
    s3_bucket_name: str = "syodan-audio-dev"
    s3_endpoint_url: str | None = None

    bedrock_chat_model_id: str = "jp.anthropic.claude-sonnet-4-6"
    bedrock_analysis_model_id: str = "jp.anthropic.claude-sonnet-4-6"

    polly_voice_id: str = "Takumi"
    polly_engine: str = "neural"
    polly_speech_rate: str = "110%"

    internal_api_key: str = "change-me-local-dev-key"
    hulft_webhook_url: str | None = None
    hulft_stub_mode: bool = True
    frontend_base_url: str = "http://localhost:5173"
    hulft_email: str | None = None
    hulft_password: str | None = None
    hulft_refresh_token: str | None = None

    session_time_warning_sec: int = 120

    @model_validator(mode="after")
    def disable_aws_stub_in_production(self) -> "Settings":
        if self.app_env == "production":
            object.__setattr__(self, "aws_stub_mode", False)
        return self

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
