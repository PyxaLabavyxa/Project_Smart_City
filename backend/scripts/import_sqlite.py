"""Copy the chatbot's existing SQLite records into an empty migrated PostgreSQL DB."""

import argparse
import asyncio
from datetime import UTC, datetime
from pathlib import Path

from app.database.models import Base
from sqlalchemy import MetaData, func, select, text
from sqlalchemy.engine import URL, make_url
from sqlalchemy.ext.asyncio import create_async_engine

from smart_city_api.core.config import Settings
from smart_city_api.runtime import loop_factory

TABLES = ("houses", "users", "apartments", "user_apartments", "issues", "issue_photos")


async def import_database(source_path: Path, target_url: str) -> dict[str, int]:
    source_path = await asyncio.to_thread(source_path.resolve, strict=True)
    if make_url(target_url).drivername != "postgresql+psycopg":
        raise ValueError("Target must use postgresql+psycopg")
    source = create_async_engine(
        URL.create(
            "sqlite+aiosqlite", database=source_path.as_uri(), query={"mode": "ro", "uri": "true"}
        ),
        hide_parameters=True,
    )
    target = create_async_engine(target_url, hide_parameters=True)
    counts = {}
    try:
        metadata = MetaData()
        async with source.connect() as reader, target.begin() as writer:
            await reader.run_sync(
                lambda connection: metadata.reflect(connection, only=list(TABLES))
            )
            await writer.execute(
                text("LOCK TABLE " + ", ".join(TABLES) + " IN ACCESS EXCLUSIVE MODE")
            )
            for name in TABLES:
                if await writer.scalar(
                    select(func.count()).select_from(Base.metadata.tables[name])
                ):
                    raise ValueError("Target tables must be empty; no records were imported")
            for name in TABLES:
                target_table = Base.metadata.tables[name]
                counts[name] = 0
                result = await reader.stream(select(metadata.tables[name]))
                async for batch in result.mappings().partitions(500):
                    records = []
                    for row in batch:
                        record = dict(row)
                        for key, value in record.items():
                            if isinstance(value, datetime) and value.tzinfo is None:
                                record[key] = value.replace(tzinfo=UTC)
                        records.append(record)
                    await writer.execute(target_table.insert(), records)
                    counts[name] += len(records)
                await writer.execute(
                    text(
                        "SELECT setval(pg_get_serial_sequence(:table, 'id'), "
                        f"COALESCE((SELECT max(id) FROM {name}), 1), "
                        f"EXISTS(SELECT 1 FROM {name}))"
                    ),
                    {"table": name},
                )
    finally:
        await source.dispose()
        await target.dispose()
    return counts


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path)
    args = parser.parse_args()
    settings = Settings()
    if not settings.database_url:
        parser.error("Set DATABASE_URL for the empty target PostgreSQL database")
    counts = asyncio.run(
        import_database(args.source, settings.database_url.get_secret_value()),
        loop_factory=loop_factory,
    )
    for name, count in counts.items():
        print(f"{name}: {count}")


if __name__ == "__main__":
    main()
