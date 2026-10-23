from pathlib import Path

import pytest
from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, text

pytest_plugins = ["tests.test_migrations"]


def check_status_upgrade(config, engine):
    command.upgrade(config, "0025")
    with engine.begin() as connection:
        connection.execute(text("INSERT INTO users(id,max_user_id,name) VALUES(1,101,'Resident')"))
        connection.execute(
            text(
                "INSERT INTO houses(id,address,entrances_count,floors_count,apartments_per_floor) "
                "VALUES(1,'Existing house',1,5,4)"
            )
        )
        connection.execute(
            text(
                "INSERT INTO issues(id,user_id,house_id,title,description,"
                "category,priority,status) "
                "VALUES(1,1,1,'Existing issue','Description','WATER','MEDIUM','NEW')"
            )
        )
    with engine.begin() as connection:
        connection.execute(
            text(
                "INSERT INTO house_chats(house_id,chat_id,status,menu_status,join_url) "
                "VALUES(1,-100,'connected','ready','https://max.ru/join/existing')"
            )
        )
    command.upgrade(config, "head")
    with engine.begin() as connection:
        assert connection.scalar(text("SELECT join_url FROM house_chats WHERE house_id=1")) == (
            "https://max.ru/join/existing"
        )
        assert connection.scalar(text("SELECT title FROM issues WHERE id=1")) == "Existing issue"
        connection.execute(text("UPDATE issues SET status='ACCEPTED' WHERE id=1"))
        connection.execute(text("INSERT INTO issue_events(issue_id,status) VALUES(1,'accepted')"))
    with pytest.raises(RuntimeError, match="history"):
        command.downgrade(config, "0025")
    with engine.begin() as connection:
        connection.execute(text("UPDATE issues SET status='NEW' WHERE id=1"))
    with pytest.raises(RuntimeError, match="history"):
        command.downgrade(config, "0025")
    with engine.begin() as connection:
        connection.execute(text("DELETE FROM issue_events WHERE status='accepted'"))
    command.downgrade(config, "0025")
    with engine.connect() as connection:
        assert connection.scalar(text("SELECT join_url FROM house_chats WHERE house_id=1")) == (
            "https://max.ru/join/existing"
        )
    command.upgrade(config, "head")
    with engine.begin() as connection:
        connection.execute(text("UPDATE issues SET status='ASSIGNED' WHERE id=1"))
        assert connection.scalar(text("SELECT title FROM issues WHERE id=1")) == "Existing issue"


def test_sqlite_status_migration_preserves_data_and_protects_history(monkeypatch, tmp_path):
    url = "sqlite:///" + (tmp_path / "statuses.db").as_posix()
    monkeypatch.setenv("DATABASE_URL", url.replace("sqlite:///", "sqlite+aiosqlite:///"))
    engine = create_engine(url)
    try:
        check_status_upgrade(
            Config(str(Path(__file__).resolve().parents[1] / "alembic.ini")), engine
        )
    finally:
        engine.dispose()


def test_postgres_native_enum_status_migration(migrated_postgres):
    config, engine, _ = migrated_postgres
    check_status_upgrade(config, engine)
