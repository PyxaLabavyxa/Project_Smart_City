"""Integration checks against the bot's real ORM schema in isolated SQLite files."""

import asyncio
import importlib
from contextlib import asynccontextmanager
from pathlib import Path

import pytest
from sqlalchemy import create_engine, event, text
from sqlalchemy.orm import Session

from smart_city_api.db.resident_tables import ResidentTables, SchemaUnavailable
from smart_city_api.db.session import Database
from smart_city_api.repositories.resident import ResidentRepository
from smart_city_api.services.resident import HouseNotFound, ResidentNotFound, ResidentService


@pytest.fixture
def resident_database(tmp_path, monkeypatch):
    bot_root = Path(__file__).resolve().parents[2]
    # Test-only import: the runtime API does not import bot config/session or require bot secrets.
    monkeypatch.syspath_prepend(str(bot_root))
    models = importlib.import_module("app.database.models")
    path = tmp_path / "resident.db"
    engine = create_engine(f"sqlite:///{path}")
    models.Base.metadata.create_all(engine)
    with Session(engine) as session:
        session.add_all(
            [
                models.User(id=1, max_user_id=1001, name="Resident One"),
                models.User(id=2, max_user_id=1002, name="Resident Two"),
                models.User(id=3, max_user_id=1003, name="No apartment"),
                models.House(
                    id=1,
                    address="House One",
                    entrances_count=2,
                    floors_count=3,
                    apartments_per_floor=4,
                ),
                models.House(
                    id=2,
                    address="Private House",
                    entrances_count=1,
                    floors_count=1,
                    apartments_per_floor=1,
                ),
            ]
        )
        session.flush()
        session.add_all(
            [
                models.Apartment(id=1, house_id=1, number=7, entrance=1, floor=1),
                models.Apartment(id=2, house_id=1, number=19, entrance=1, floor=1),
                models.Apartment(id=3, house_id=1, number=40, entrance=2, floor=3),
                models.Apartment(id=4, house_id=2, number=7, entrance=1, floor=1),
            ]
        )
        session.flush()
        session.add_all(
            [
                models.UserApartment(user_id=1, apartment_id=1),
                models.UserApartment(user_id=1, apartment_id=2),
                models.UserApartment(user_id=2, apartment_id=4),
            ]
        )
        session.commit()
    engine.dispose()
    return f"sqlite+aiosqlite:///{path}"


@asynccontextmanager
async def resident_context(url, user_id):
    database = Database(url)
    statements = []
    event.listen(
        database.engine.sync_engine,
        "before_cursor_execute",
        lambda conn, cursor, statement, parameters, context, many: statements.append(statement),
    )
    try:
        async with database.sessions() as session:
            tables = await database.resident_tables.load(session)
            yield ResidentService(ResidentRepository(session, tables), user_id)
        assert not any(
            query.lstrip()
            .upper()
            .startswith(("INSERT ", "UPDATE ", "DELETE ", "CREATE ", "ALTER ", "DROP "))
            for query in statements
        )
    finally:
        await database.close()


def test_profile_returns_only_own_apartments_and_public_fields(resident_database):
    async def scenario():
        async with resident_context(resident_database, 1) as service:
            profile = (await service.me()).model_dump()
            assert profile["name"] == "Resident One"
            assert [item["id"] for item in profile["apartments"]] == [1, 2]
            assert set(profile) == {"id", "name", "apartments"}
        async with resident_context(resident_database, 999) as service:
            with pytest.raises(ResidentNotFound):
                await service.me()

    asyncio.run(scenario())


def test_houses_are_scoped_and_not_duplicated(resident_database):
    async def scenario():
        async with resident_context(resident_database, 1) as service:
            assert [house.id for house in await service.houses()] == [1]
        async with resident_context(resident_database, 2) as service:
            assert [house.id for house in await service.houses()] == [2]
        async with resident_context(resident_database, 3) as service:
            assert await service.houses() == []
            assert (await service.me()).apartments == []

    asyncio.run(scenario())


def test_foreign_and_missing_houses_are_indistinguishable(resident_database):
    async def scenario():
        async with resident_context(resident_database, 1) as service:
            for house_id in (2, 999):
                with pytest.raises(HouseNotFound):
                    await service.house(house_id)
                with pytest.raises(HouseNotFound):
                    await service.structure(house_id)
                with pytest.raises(HouseNotFound):
                    await service.apartments(
                        house_id, entrance=None, floor=None, number=None, cursor=0, limit=20
                    )

    asyncio.run(scenario())


def test_structure_uses_actual_apartments_not_a_numbering_formula(resident_database):
    async def scenario():
        async with resident_context(resident_database, 1) as service:
            structure = await service.structure(1)
            assert [
                (row.entrance, row.floor, row.apartments_count) for row in structure.floors
            ] == [(1, 1, 2), (2, 3, 1)]
            page = await service.apartments(
                1, entrance=None, floor=None, number=None, cursor=0, limit=20
            )
            assert [row.number for row in page.items] == [7, 19, 40]
            assert page.next_cursor is None

    asyncio.run(scenario())


def test_cursor_filters_and_equal_numbers_in_different_houses(resident_database):
    async def scenario():
        async with resident_context(resident_database, 1) as service:
            first = await service.apartments(
                1, entrance=None, floor=None, number=None, cursor=0, limit=2
            )
            assert [item.id for item in first.items] == [1, 2]
            assert first.next_cursor == 2
            last = await service.apartments(
                1, entrance=None, floor=None, number=None, cursor=first.next_cursor, limit=2
            )
            assert [item.id for item in last.items] == [3]
            assert last.next_cursor is None
            found = await service.apartments(1, entrance=1, floor=1, number=7, cursor=0, limit=20)
            assert [item.id for item in found.items] == [1]
            empty = await service.apartments(
                1, entrance=1, floor=3, number=None, cursor=0, limit=20
            )
            assert empty.items == []

    asyncio.run(scenario())


def test_reflection_is_cached_per_database_not_global(resident_database):
    async def scenario():
        database = Database(resident_database)
        tables = database.resident_tables
        try:
            async with database.sessions() as session:
                first = await tables.load(session)
                assert await tables.load(session) is first
            async with database.sessions() as session:
                assert await tables.load(session) is first
        finally:
            await database.close()

    asyncio.run(scenario())


@pytest.mark.parametrize("limit,cursor", [(0, 0), (-1, 0), (101, 0), (20, -1)])
def test_invalid_pagination_is_rejected(resident_database, limit, cursor):
    async def scenario():
        async with resident_context(resident_database, 1) as service:
            with pytest.raises(ValueError):
                await service.apartments(1, limit=limit, cursor=cursor)

    asyncio.run(scenario())


def test_pagination_boundaries_and_exhausted_cursor(resident_database):
    async def scenario():
        async with resident_context(resident_database, 1) as service:
            first = await service.apartments(1, limit=1)
            assert [item.id for item in first.items] == [1]
            assert first.next_cursor == 1
            whole = await service.apartments(1, limit=100)
            assert len(whole.items) == 3
            assert whole.next_cursor is None
            empty = await service.apartments(1, cursor=999)
            assert empty.items == []
            assert empty.next_cursor is None

    asyncio.run(scenario())


def test_incompatible_schema_fails_without_mutating_it():
    async def scenario():
        database = Database("sqlite+aiosqlite:///:memory:")
        try:
            async with database.engine.begin() as connection:
                for name in ResidentTables.required:
                    await connection.execute(text(f"CREATE TABLE {name} (id INTEGER)"))
            async with database.sessions() as session:
                with pytest.raises(SchemaUnavailable):
                    await ResidentTables().load(session)
                columns = (await session.execute(text("PRAGMA table_info(users)"))).all()
                assert [row[1] for row in columns] == ["id"]
        finally:
            await database.close()

    asyncio.run(scenario())
