from pathlib import Path

import pytest
from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, inspect, text


def test_upgrade_preserves_data_and_rollback_protects_history(monkeypatch, tmp_path):
    url = "sqlite:///" + (tmp_path / "inbox.db").as_posix()
    monkeypatch.setenv("DATABASE_URL", url.replace("sqlite:///", "sqlite+aiosqlite:///"))
    config = Config(str(Path(__file__).resolve().parents[1] / "alembic.ini"))
    command.upgrade(config, "0021")
    engine = create_engine(url)
    try:
        with engine.begin() as connection:
            connection.execute(
                text("INSERT INTO users (id,max_user_id,name) VALUES (1,101,'Resident')")
            )
        command.upgrade(config, "head")
        assert "suppression_reason" in {
            col["name"] for col in inspect(engine).get_columns("staff_notifications")
        }
        with engine.begin() as connection:
            assert connection.scalar(text("SELECT name FROM users WHERE id=1")) == "Resident"
            connection.execute(
                text(
                    "INSERT INTO inbox_notifications (user_id,event_key,kind,title,body) "
                    "VALUES (1,'test','issue_status','Title','Body')"
                )
            )
        with pytest.raises(RuntimeError, match="notification history"):
            command.downgrade(config, "0021")
        with engine.begin() as connection:
            assert connection.scalar(text("SELECT body FROM inbox_notifications")) == "Body"
            connection.execute(text("DELETE FROM inbox_notifications"))
        command.downgrade(config, "0021")
        with engine.connect() as connection:
            assert (
                connection.scalar(text("SELECT onboarding_status FROM users WHERE id=1"))
                == "not_started"
            )
        command.upgrade(config, "head")
        assert "inbox_notifications" in inspect(engine).get_table_names()
    finally:
        engine.dispose()
