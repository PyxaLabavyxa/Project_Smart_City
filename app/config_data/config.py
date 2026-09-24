from dataclasses import dataclass
from pathlib import Path
from environs import Env


@dataclass(frozen=True)
class BotConfig:
    token: str


@dataclass(frozen=True)
class WebAppConfig:
    host: str = "0.0.0.0"
    port: int = 8080


@dataclass(frozen=True)
class DatabaseConfig:
    url: str = "sqlite+aiosqlite:///./data/smart_city.db"


@dataclass(frozen=True)
class YandexAIConfig:
    api_key: str
    folder_id: str


@dataclass(frozen=True)
class Config:
    max_bot: BotConfig
    webapp: WebAppConfig
    database: DatabaseConfig
    yandex_ai: YandexAIConfig


def load_config(path: str | Path | None = None) -> Config:
    env = Env()
    env.read_env(path)
    return Config(
        max_bot=BotConfig(token=env.str("BOT_TOKEN")),
        webapp=WebAppConfig(
            host=env.str("WEBAPP_HOST", "0.0.0.0"),
            port=env.int("WEBAPP_PORT", 8080),
        ),
        database=DatabaseConfig(
            url=env.str("DATABASE_URL", "sqlite+aiosqlite:///./data/smart_city.db")
        ),
        yandex_ai=YandexAIConfig(
            api_key=env.str("YANDEX_API_KEY"),
            folder_id=env.str("YANDEX_FOLDER_ID")
        )
    )
