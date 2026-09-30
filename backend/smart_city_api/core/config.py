from pathlib import Path

from pydantic import Field, IPvAnyNetwork, SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "Домовед API"
    database_url: SecretStr | None = None
    bot_token: SecretStr | None = None
    local_login_enabled: bool = False
    sample_data_enabled: bool = False
    onboarding_test_mode: bool = False
    local_login_networks: list[IPvAnyNetwork] = ["127.0.0.0/8", "::1/128"]
    local_session_secret: SecretStr | None = None
    session_cookie_secure: bool = True
    staff_session_hours: int = Field(default=8, ge=1, le=24)
    media_root: Path = Path("data/media")
    max_auth_age_seconds: int = Field(default=3600, ge=60, le=86400)
    cors_origins: list[str] = ["http://localhost:3000", "http://127.0.0.1:3000"]
