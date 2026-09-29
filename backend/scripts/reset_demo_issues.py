import argparse
import asyncio

from app.database.demo_issues import reset_demo_issues

from smart_city_api.core.config import Settings
from smart_city_api.db.session import Database
from smart_city_api.runtime import loop_factory


async def run():
    settings = Settings()
    if not settings.database_url:
        raise ValueError("DATABASE_URL is required")
    db = Database(settings.database_url.get_secret_value())
    try:
        async with db.sessions.begin() as session:
            count = await reset_demo_issues(session)
        print(f"Created {count} demo incidents: two per house")
    finally:
        await db.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--replace-all-issues", action="store_true", required=True)
    parser.parse_args()
    asyncio.run(run(), loop_factory=loop_factory)
