import asyncio

from alembic import context
from app.database.models import Base
from sqlalchemy.ext.asyncio import create_async_engine

from smart_city_api.core.config import Settings
from smart_city_api.runtime import loop_factory


def migrate(connection):
    context.configure(
        connection=connection,
        target_metadata=Base.metadata,
        compare_type=True,
        render_as_batch=connection.dialect.name == "sqlite",
    )
    with context.begin_transaction():
        context.run_migrations()


async def online():
    settings = Settings()
    if not settings.database_url:
        raise RuntimeError("DATABASE_URL is required for migrations")
    engine = create_async_engine(settings.database_url.get_secret_value(), hide_parameters=True)
    try:
        async with engine.connect() as connection:
            await connection.run_sync(migrate)
    finally:
        await engine.dispose()


if context.is_offline_mode():
    raise RuntimeError("Run migrations against an explicitly configured database")
else:
    asyncio.run(online(), loop_factory=loop_factory)
