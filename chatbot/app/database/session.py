import asyncio
from pathlib import Path

from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker

from app.config_data.config import Config, load_config
from app.database.models import Base


config: Config = load_config()

engine = create_async_engine(config.database.url)

session_factory = async_sessionmaker(
    bind=engine,
    expire_on_commit=False,
)

async def create_tables() -> None:
    if engine.dialect.name == "sqlite":
        database_path = engine.url.database
        if database_path and database_path != ":memory:":
            Path(database_path).parent.mkdir(parents=True, exist_ok=True)

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
