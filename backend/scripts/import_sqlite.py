"""Copy the chatbot's existing SQLite records into an empty migrated PostgreSQL DB."""

import argparse
import sqlite3
from datetime import UTC, datetime
from pathlib import Path

from app.database.models import Base
from sqlalchemy import MetaData, create_engine, func, select, text
from sqlalchemy.engine import make_url

from smart_city_api.core.config import Settings

TABLES = ("houses", "users", "apartments", "user_apartments", "issues", "issue_photos")


def import_database(source_path: Path, target_url: str) -> dict[str, int]:
    source_path = source_path.resolve(strict=True)
    if make_url(target_url).drivername != "postgresql+psycopg":
        raise ValueError("Target must use postgresql+psycopg")
    source = create_engine(
        "sqlite://",
        creator=lambda: sqlite3.connect(
            source_path.as_uri() + "?mode=ro",
            uri=True,
        ),
    )
    target = create_engine(target_url, hide_parameters=True)
    counts = {}
    try:
        metadata = MetaData()
        metadata.reflect(source, only=list(TABLES))
        with source.connect() as reader, target.begin() as writer:
            writer.execute(text("LOCK TABLE " + ", ".join(TABLES) + " IN ACCESS EXCLUSIVE MODE"))
            for name in TABLES:
                if writer.scalar(select(func.count()).select_from(Base.metadata.tables[name])):
                    raise ValueError("Target tables must be empty; no records were imported")
            for name in TABLES:
                target_table = Base.metadata.tables[name]
                counts[name] = 0
                result = reader.execute(select(metadata.tables[name])).mappings()
                for batch in result.partitions(500):
                    records = []
                    for row in batch:
                        record = dict(row)
                        for key, value in record.items():
                            if isinstance(value, datetime) and value.tzinfo is None:
                                record[key] = value.replace(tzinfo=UTC)
                        records.append(record)
                    writer.execute(target_table.insert(), records)
                    counts[name] += len(records)
                writer.execute(
                    text(
                        "SELECT setval(pg_get_serial_sequence(:table, 'id'), "
                        f"COALESCE((SELECT max(id) FROM {name}), 1), "
                        f"EXISTS(SELECT 1 FROM {name}))"
                    ),
                    {"table": name},
                )
    finally:
        source.dispose()
        target.dispose()
    return counts


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path)
    args = parser.parse_args()
    settings = Settings()
    if not settings.database_url:
        parser.error("Set DATABASE_URL for the empty target PostgreSQL database")
    counts = import_database(args.source, settings.database_url.get_secret_value())
    for name, count in counts.items():
        print(f"{name}: {count}")


if __name__ == "__main__":
    main()
