import importlib.util
from pathlib import Path

import sqlalchemy as sa
from alembic.migration import MigrationContext
from alembic.operations import Operations


def test_link_migration_preserves_connected_groups_and_is_reversible(tmp_path):
    path = Path(__file__).resolve().parents[1] / "migrations/versions/0025_house_chat_links.py"
    spec = importlib.util.spec_from_file_location("chat_link_migration", path)
    migration = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(migration)
    engine = sa.create_engine(f"sqlite:///{tmp_path / 'migration.db'}")
    with engine.begin() as connection:
        connection.execute(
            sa.text(
                "CREATE TABLE house_chats (house_id INTEGER PRIMARY KEY, "
                "chat_id BIGINT, title VARCHAR(200), revision INTEGER)"
            )
        )
        connection.execute(sa.text("INSERT INTO house_chats VALUES (1,-100,'Existing group',7)"))
        migration.op = Operations(MigrationContext.configure(connection))
        migration.upgrade()
        assert tuple(connection.execute(sa.text("SELECT * FROM house_chats")).one()) == (
            1,
            -100,
            "Existing group",
            7,
            None,
            None,
            None,
        )
        migration.downgrade()
        assert tuple(connection.execute(sa.text("SELECT * FROM house_chats")).one()) == (
            1,
            -100,
            "Existing group",
            7,
        )
        migration.upgrade()
    engine.dispose()
