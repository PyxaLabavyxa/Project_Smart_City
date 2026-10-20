from pathlib import Path

from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, inspect, text


def test_chat_photos_migrate_existing_history_without_changing_messages(monkeypatch, tmp_path):
    path = tmp_path / "chat-migration.db"
    monkeypatch.setenv("DATABASE_URL", "sqlite+aiosqlite:///" + path.as_posix())
    config = Config(str(Path(__file__).resolve().parents[1] / "alembic.ini"))
    command.upgrade(config, "0014")
    engine = create_engine("sqlite:///" + path.as_posix())
    try:
        with engine.begin() as conn:
            conn.execute(text("INSERT INTO users (id,max_user_id,name) VALUES (1,101,'Resident')"))
            conn.execute(
                text(
                    "INSERT INTO houses (id,address,entrances_count,"
                    "floors_count,apartments_per_floor) "
                    "VALUES (1,'House',1,1,2)"
                )
            )
            conn.execute(
                text(
                    "INSERT INTO apartments (id,house_id,number,entrance,floor) "
                    "VALUES (1,1,1,1,1),(2,1,2,1,1)"
                )
            )
            conn.execute(
                text(
                    "INSERT INTO apartment_messages (id,user_id,sender_id,recipient_id,"
                    "text,request_id) VALUES (1,1,1,2,'Old history','old-request')"
                )
            )
        command.upgrade(config, "head")
        assert "chat_photos" in inspect(engine).get_table_names()
        with engine.connect() as conn:
            assert (
                conn.scalar(text("SELECT text FROM apartment_messages WHERE id=1")) == "Old history"
            )
        command.downgrade(config, "0014")
        assert "chat_photos" not in inspect(engine).get_table_names()
        with engine.connect() as conn:
            assert (
                conn.scalar(text("SELECT text FROM apartment_messages WHERE id=1")) == "Old history"
            )
        command.upgrade(config, "head")
    finally:
        engine.dispose()
