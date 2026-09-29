import asyncio

from app.database.models import CompanyHouse, ManagementCompany, RegistrationRequest, UserApartment
from app.database.registration_demo import seed_registration_demo
from app.services.registration import registration_state, submit_registration
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from smart_city_api.db.session import Database
from tests.test_api import headers, launch
from tests.test_staff import login

pytest_plugins = ["tests.test_api", "tests.test_staff"]


def install_catalog(engine):
    with Session(engine) as session:
        company = ManagementCompany(name="УК для тестов")
        session.add(company)
        session.flush()
        session.add_all([CompanyHouse(house_id=i, company_id=company.id) for i in (1, 2)])
        session.commit()


BODY = {"full_name": "Иванов Иван Иванович", "company_id": 1, "house_id": 1, "apartment_number": 7}


def test_direct_max_login_creates_profile_without_apartment(api):
    client, _, _ = api
    response = client.post(
        "/api/v1/auth/max",
        json={"init_data": launch(999)},
        headers={"Origin": "http://localhost:3000"},
    )
    assert response.status_code == 204, response.text
    assert client.get("/api/v1/me", headers=headers(999)).json()["apartments"] == []
    assert client.get("/api/v1/registration", headers=headers(999)).json()["name"] == "Житель"


def test_auto_approval_shared_state_and_idempotency(api):
    client, engine, _ = api
    install_catalog(engine)
    client.app.state.settings.onboarding_test_mode = True
    state = client.get("/api/v1/registration", headers=headers(104)).json()
    assert not state["complete"] and state["name"] == "Без квартиры"
    for _ in range(2):
        response = client.post("/api/v1/registration", headers=headers(104), json=BODY)
        assert response.status_code == 200, response.text
        assert response.json()["complete"]
    assert client.get("/api/v1/me", headers=headers(104)).json()["name"] == BODY["full_name"]
    with Session(engine) as session:
        assert session.scalar(select(func.count()).select_from(RegistrationRequest)) == 1
        assert session.scalar(select(RegistrationRequest)).auto_approved
        assert (
            session.scalar(
                select(func.count()).select_from(UserApartment).where(UserApartment.user_id == 4)
            )
            == 1
        )

    async def bot_checks_same_state():
        db = client.app.state.database
        async with db.sessions() as session:
            assert (await registration_state(session, 4))["complete"]

    asyncio.run(bot_checks_same_state())


def test_bot_submission_is_seen_by_mini_app(api):
    client, engine, _ = api
    install_catalog(engine)

    async def bot():
        async with client.app.state.database.sessions.begin() as session:
            await submit_registration(session, 4, **BODY, source="bot", auto_approve=True)

    asyncio.run(bot())
    assert client.get("/api/v1/registration", headers=headers(104)).json()["complete"]
    assert len(client.get("/api/v1/me", headers=headers(104)).json()["apartments"]) == 1


def test_validation_and_pending_requests_do_not_grant_access(api):
    client, engine, _ = api
    install_catalog(engine)
    for changes in (
        {"company_id": 999},
        {"house_id": 999},
        {"apartment_number": 999},
        {"full_name": "   "},
    ):
        assert (
            client.post(
                "/api/v1/registration", headers=headers(104), json=BODY | changes
            ).status_code
            == 422
        )
    for _ in range(2):
        response = client.post("/api/v1/registration", headers=headers(104), json=BODY)
        assert response.json()["status"] == "pending"
    assert client.get("/api/v1/me", headers=headers(104)).json()["apartments"] == []
    assert client.get("/api/v1/houses/1/issues", headers=headers(104)).status_code == 404
    with Session(engine) as session:
        assert session.scalar(select(func.count()).select_from(RegistrationRequest)) == 1


def test_staff_scope_decisions_and_resubmission(staff_api):
    client, engine, _ = staff_api
    install_catalog(engine)
    assert client.post("/api/v1/registration", headers=headers(104), json=BODY).status_code == 200
    csrf = login(client, "other")
    assert client.get("/api/v1/staff/registrations").json()["total"] == 0
    assert client.post("/api/v1/staff/registrations/1/approve", headers=csrf).status_code == 404
    csrf = login(client)
    data = client.get("/api/v1/staff/registrations").json()
    assert data["items"][0]["full_name"] == BODY["full_name"]
    assert client.post("/api/v1/staff/registrations/1/reject", headers=csrf).status_code == 200
    assert client.post("/api/v1/staff/registrations/1/approve", headers=csrf).status_code == 409
    assert (
        client.post("/api/v1/registration", headers=headers(104), json=BODY).json()["status"]
        == "pending"
    )
    assert client.post("/api/v1/staff/registrations/2/approve", headers=csrf).status_code == 200
    assert client.get("/api/v1/registration", headers=headers(104)).json()["complete"]


def test_seed_five_houses_is_idempotent_and_does_not_assign(tmp_path):
    from app.database.models import Base, House, Issue

    async def scenario():
        db = Database(f"sqlite+aiosqlite:///{tmp_path / 'seed.db'}")
        try:
            async with db.engine.begin() as connection:
                await connection.run_sync(Base.metadata.create_all)
            for _ in range(2):
                async with db.sessions.begin() as session:
                    await seed_registration_demo(session)
            async with db.sessions() as session:
                assert list(
                    await session.scalars(select(House.floors_count).order_by(House.id))
                ) == [9, 7, 5, 12, 10]
                assert await session.scalar(select(func.count()).select_from(Issue)) == 10
                from smart_city_api.services.issues import issue_response

                for issue in await session.scalars(select(Issue)):
                    house = await session.get(House, issue.house_id)
                    response = await issue_response(session, issue, house, issue.user_id)
                    assert 1 <= response.place.floor <= house.floors_count
                assert await session.scalar(select(func.count()).select_from(UserApartment)) == 0
        finally:
            await db.close()

    asyncio.run(scenario())


def test_registration_migration_preserves_existing_data_and_matches_models(tmp_path):
    import importlib.util
    from pathlib import Path

    from alembic.autogenerate import compare_metadata
    from alembic.migration import MigrationContext
    from alembic.operations import Operations
    from app.database.models import Base
    from sqlalchemy import create_engine, text

    engine = create_engine(f"sqlite:///{tmp_path / 'migration.db'}")
    new_tables = {"management_companies", "company_houses", "registration_requests"}
    Base.metadata.create_all(
        engine, tables=[t for t in Base.metadata.sorted_tables if t.name not in new_tables]
    )
    source = Path(__file__).resolve().parents[1] / "migrations/versions/0006_registration.py"
    spec = importlib.util.spec_from_file_location("registration_migration", source)
    migration = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(migration)
    with engine.begin() as connection:
        connection.execute(
            text("INSERT INTO users (max_user_id, name) VALUES (123, 'Existing resident')")
        )
        context = MigrationContext.configure(connection)
        with Operations.context(context):
            migration.upgrade()
            assert compare_metadata(context, Base.metadata) == []
            migration.downgrade()
            assert (
                connection.scalar(text("SELECT name FROM users WHERE max_user_id=123"))
                == "Existing resident"
            )
            migration.upgrade()
    engine.dispose()


def test_additional_apartment_shared_by_family_and_no_duplicate_links(api):
    client, engine, _ = api
    install_catalog(engine)
    client.app.state.settings.onboarding_test_mode = True
    body = BODY | {"additional": True}
    for user in (102, 104, 102):
        result = client.post("/api/v1/registration", headers=headers(user), json=body)
        assert result.status_code == 200, result.text
        assert result.json()["application_status"] == "approved"
    with Session(engine) as session:
        assert (
            session.scalar(
                select(func.count())
                .select_from(UserApartment)
                .where(UserApartment.apartment_id == 1)
            )
            == 3
        )
        assert session.scalar(select(func.count()).select_from(RegistrationRequest)) == 2
    assert len(client.get("/api/v1/me", headers=headers(102)).json()["apartments"]) == 2


def test_additional_pending_is_not_reported_as_approved(api):
    client, engine, _ = api
    install_catalog(engine)
    for _ in range(2):
        result = client.post(
            "/api/v1/registration", headers=headers(102), json=BODY | {"additional": True}
        )
        assert result.json()["complete"] is True
        assert result.json()["application_status"] == "pending"
    assert len(client.get("/api/v1/me", headers=headers(102)).json()["apartments"]) == 1
    with Session(engine) as session:
        assert session.scalar(select(func.count()).select_from(RegistrationRequest)) == 1


def test_reset_incidents_removes_dependencies_and_creates_two_per_house(staff_api):
    from app.database.demo_issues import reset_demo_issues
    from app.database.models import House, Issue, IssueMessage, IssuePhoto, StaffNotification

    client, engine, _ = staff_api

    async def reset():
        async with client.app.state.database.sessions.begin() as session:
            assert await reset_demo_issues(session) == 4

    asyncio.run(reset())
    with Session(engine) as session:
        counts = session.execute(
            select(Issue.house_id, func.count()).group_by(Issue.house_id)
        ).all()
        assert counts == [(1, 2), (2, 2)]
        assert all(h.address.startswith("г. Казань, ") for h in session.scalars(select(House)))
        for model in (IssuePhoto, IssueMessage, StaffNotification):
            assert session.scalar(select(func.count()).select_from(model)) == 0
