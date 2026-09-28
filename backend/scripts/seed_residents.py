"""Populate sample apartments and utility accounts for existing residents."""

import asyncio

from app.database.models import User
from sqlalchemy import select

from smart_city_api.core.config import Settings
from smart_city_api.db.session import Database
from smart_city_api.runtime import loop_factory
from smart_city_api.services.sample_data import ensure_sample_data


async def main():
    settings = Settings()
    if not settings.sample_data_enabled or not settings.database_url:
        raise SystemExit("SAMPLE_DATA_ENABLED=true and DATABASE_URL are required")
    database = Database(settings.database_url.get_secret_value())
    try:
        async with database.sessions() as session:
            ids = list(await session.scalars(select(User.id)))
            for user_id in ids:
                await ensure_sample_data(session, user_id)
        print(f"Prepared sample data for {len(ids)} residents")
    finally:
        await database.close()


if __name__ == "__main__":
    asyncio.run(main(), loop_factory=loop_factory)
