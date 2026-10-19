from pathlib import Path

from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, text


def test_preferences_migration_preserves_existing_users_and_defaults(monkeypatch, tmp_path):
    url = "sqlite:///" + (tmp_path / "migration.db").as_posix()
    monkeypatch.setenv("DATABASE_URL", url.replace("sqlite:///", "sqlite+aiosqlite:///"))
    config = Config(str(Path(__file__).resolve().parents[1] / "alembic.ini"))
    command.upgrade(config, "0009")
    engine = create_engine(url)
    try:
        with engine.begin() as connection:
            connection.execute(
                text("INSERT INTO users (id, max_user_id, name) VALUES (1, 101, 'resident')")
            )
        command.upgrade(config, "head")
        with engine.connect() as connection:
            row = connection.execute(
                text(
                    "SELECT name, notify_personal_messages, notify_issue_messages, "
                    "notify_issue_statuses, notify_announcements FROM users WHERE id=1"
                )
            ).one()
            assert tuple(row) == ("resident", 1, 1, 1, 1)
        command.downgrade(config, "0009")
        with engine.connect() as connection:
            assert connection.scalar(text("SELECT name FROM users WHERE id=1")) == "resident"
        command.upgrade(config, "head")
    finally:
        engine.dispose()
