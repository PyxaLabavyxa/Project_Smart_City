import asyncio
import os
from pathlib import Path
from uuid import uuid4

import pytest
from alembic import command
from alembic.autogenerate import compare_metadata
from alembic.config import Config
from alembic.migration import MigrationContext
from app.database.models import Base
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.engine import make_url

from scripts.import_sqlite import import_database
from smart_city_api.runtime import loop_factory


@pytest.fixture
def migrated_postgres(monkeypatch):
    url = os.environ.get("TEST_POSTGRES_URL")
    if not url:
        pytest.skip("TEST_POSTGRES_URL is required for PostgreSQL migration tests")
    schema = "qa_migration_" + uuid4().hex
    admin = create_engine(url)
    with admin.begin() as connection:
        connection.execute(text(f'CREATE SCHEMA "{schema}"'))
    scoped = make_url(url).update_query_dict({"options": f"-csearch_path={schema}"})
    target = scoped.render_as_string(hide_password=False)
    monkeypatch.setenv("DATABASE_URL", target)
    config = Config(str(Path(__file__).resolve().parents[1] / "alembic.ini"))
    engine = create_engine(target)
    try:
        yield config, engine, target
    finally:
        engine.dispose()
        with admin.begin() as connection:
            connection.execute(text(f'DROP SCHEMA "{schema}" CASCADE'))
        admin.dispose()


def test_postgres_upgrade_matches_shared_models_and_downgrade_is_reversible(migrated_postgres):
    config, engine, _ = migrated_postgres
    command.upgrade(config, "0001")
    with engine.begin() as connection:
        connection.execute(
            text("INSERT INTO users(id, max_user_id, name) VALUES(1, 1, 'existing')")
        )
    command.upgrade(config, "head")
    with engine.connect() as connection:
        assert connection.scalar(text("SELECT name FROM users WHERE id=1")) == "existing"
        differences = compare_metadata(MigrationContext.configure(connection), Base.metadata)
        assert differences == []
    command.downgrade(config, "0001")
    assert "issue_events" not in inspect(engine).get_table_names()
    command.upgrade(config, "head")
    command.downgrade(config, "base")
    command.upgrade(config, "head")


def test_sqlite_import_preserves_ids_and_resets_postgres_sequences(migrated_postgres, tmp_path):
    config, engine, target = migrated_postgres
    command.upgrade(config, "head")
    path = tmp_path / "source.db"
    source = create_engine(f"sqlite:///{path}")
    Base.metadata.create_all(source)
    with source.begin() as connection:
        connection.execute(
            text("INSERT INTO users(id, max_user_id, name) VALUES(7, 70, 'original')")
        )
    source.dispose()
    counts = asyncio.run(import_database(path, target), loop_factory=loop_factory)
    assert counts["users"] == 1
    with engine.begin() as connection:
        assert connection.scalar(text("SELECT name FROM users WHERE id=7")) == "original"
        assert (
            connection.scalar(
                text("INSERT INTO users(max_user_id, name) VALUES(80, 'next') RETURNING id")
            )
            == 8
        )
    with pytest.raises(ValueError, match="empty"):
        asyncio.run(import_database(path, target), loop_factory=loop_factory)
    with engine.connect() as connection:
        assert connection.scalar(text("SELECT count(*) FROM users")) == 2
