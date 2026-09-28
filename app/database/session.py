from pathlib import Path

from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker

from app.config_data.config import load_database_config
from app.database.models import Base


database_config = load_database_config()

engine = create_async_engine(database_config.url, pool_pre_ping=True, hide_parameters=True)

session_factory = async_sessionmaker(
    bind=engine,
    expire_on_commit=False,
)

async def create_tables() -> None:
    if engine.dialect.name == "postgresql":
        # Shared schema is managed explicitly by backend Alembic migrations.
        return
    if engine.dialect.name == "sqlite":
        database_path = engine.url.database
        if database_path and database_path != ":memory:":
            Path(database_path).parent.mkdir(parents=True, exist_ok=True)

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
