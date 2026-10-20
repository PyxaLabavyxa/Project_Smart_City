from pathlib import Path

import pytest
from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, text


def test_camera_migration_preserves_existing_stills_and_protects_private_rollback(
    monkeypatch, tmp_path
):
    url = "sqlite:///" + (tmp_path / "cameras.db").as_posix()
    monkeypatch.setenv("DATABASE_URL", url.replace("sqlite:///", "sqlite+aiosqlite:///"))
    config = Config(str(Path(__file__).resolve().parents[1] / "alembic.ini"))
    command.upgrade(config, "0010")
    engine = create_engine(url)
    try:
        with engine.begin() as connection:
            connection.execute(
                text("INSERT INTO users (id,max_user_id,name) VALUES (1,101,'resident')")
            )
            connection.execute(
                text(
                    "INSERT INTO houses (id,address,entrances_count,floors_count,"
                    "apartments_per_floor) VALUES (1,'house',2,3,4)"
                )
            )
            connection.execute(
                text(
                    "INSERT INTO house_cameras (id,house_id,name,status,note,preview_url) "
                    "VALUES (1,1,'Двор','online','existing','/images/cameras/yard-1.png')"
                )
            )
        command.upgrade(config, "head")
        with engine.connect() as connection:
            row = connection.execute(
                text(
                    "SELECT visibility,moderation_status,owner_id,zone,preview_url "
                    "FROM house_cameras WHERE id=1"
                )
            ).one()
            assert tuple(row) == (
                "public",
                "approved",
                None,
                "courtyard",
                "/images/cameras/yard-1.png",
            )
        command.downgrade(config, "0010")
        command.upgrade(config, "head")
        with engine.begin() as connection:
            connection.execute(
                text("UPDATE house_cameras SET deleted_at=CURRENT_TIMESTAMP WHERE id=1")
            )
        with pytest.raises(RuntimeError, match="deletion schema"):
            command.downgrade(config, "0011")
        with engine.begin() as connection:
            assert connection.scalar(text("SELECT deleted_at FROM house_cameras WHERE id=1"))
            connection.execute(text("UPDATE house_cameras SET deleted_at=NULL WHERE id=1"))
        command.downgrade(config, "0011")
        command.upgrade(config, "head")
        with engine.begin() as connection:
            connection.execute(
                text(
                    "INSERT INTO house_cameras (house_id,name,status,note,owner_id,"
                    "visibility,moderation_status) "
                    "VALUES (1,'private','online','',1,'private','approved')"
                )
            )
        with pytest.raises(RuntimeError, match="privacy schema"):
            command.downgrade(config, "0010")
        with engine.connect() as connection:
            assert (
                connection.scalar(text("SELECT visibility FROM house_cameras WHERE owner_id=1"))
                == "private"
            )
    finally:
        engine.dispose()
