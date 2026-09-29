from dataclasses import dataclass
from pathlib import Path
from environs import Env
from sqlalchemy.engine import make_url

from app.paths import PROJECT_ROOT, project_path


@dataclass(frozen=True)
class BotConfig:
    token: str


@dataclass(frozen=True)
class WebAppConfig:
    host: str = "0.0.0.0"
    port: int = 8080


@dataclass(frozen=True)
class DatabaseConfig:
    url: str = "postgresql+psycopg://dompulse@localhost:5432/dompulse"


@dataclass(frozen=True)
class YandexAIConfig:
    api_key: str
    folder_id: str


@dataclass(frozen=True)
class StorageConfig:
    root: Path


@dataclass(frozen=True)
class Config:
    max_bot: BotConfig
    webapp: WebAppConfig
    database: DatabaseConfig
    yandex_ai: YandexAIConfig
    storage: StorageConfig


def read_environment(path: str | Path | None = None) -> Env:
    env = Env()
    env.read_env(project_path(path) if path is not None else PROJECT_ROOT / ".env", recurse=False)
    return env


def normalize_database_url(value: str) -> str:
    url = make_url(value)
    if url.get_backend_name() in ("postgres", "postgresql"):
        return url.set(drivername="postgresql+psycopg").render_as_string(hide_password=False)
    if url.get_backend_name() == "sqlite" and url.database not in (None, "", ":memory:"):
        url = url.set(database=project_path(url.database).as_posix())
        return url.render_as_string(hide_password=False)
    return value


def database_config(env: Env) -> DatabaseConfig:
    return DatabaseConfig(url=normalize_database_url(
        env.str("DATABASE_URL", "postgresql+psycopg://dompulse@localhost:5432/dompulse")
    ))


def load_database_config(path: str | Path | None = None) -> DatabaseConfig:
    return database_config(read_environment(path))


def load_webapp_config(path: str | Path | None = None) -> WebAppConfig:
    env = read_environment(path)
    return WebAppConfig(
        host=env.str("WEBAPP_HOST", "0.0.0.0"),
        port=env.int("WEBAPP_PORT", 8080),
    )


def load_config(path: str | Path | None = None) -> Config:
    env = read_environment(path)
    root = project_path(env.str("MEDIA_ROOT", "data/media"))
    return Config(
        max_bot=BotConfig(token=env.str("BOT_TOKEN")),
        webapp=WebAppConfig(
            host=env.str("WEBAPP_HOST", "0.0.0.0"),
            port=env.int("WEBAPP_PORT", 8080)
        ),
        database=database_config(env),
        yandex_ai=YandexAIConfig(
            api_key=env.str("YANDEX_API_KEY"),
            folder_id=env.str("YANDEX_FOLDER_ID")
        ),
        storage=StorageConfig(root=root)
    )
