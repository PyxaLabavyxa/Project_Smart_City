from app.database.models import (
    Apartment,
    House,
    Invoice,
    Issue,
    Meter,
    UserApartment,
    UtilityAccount,
)
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from tests.test_api import headers

pytest_plugins = ["tests.test_api"]


def seed_explicitly(client, *user_ids):
    import asyncio

    from app.database.sample_data import provision_sample_resident
    async def seed():
        async with client.app.state.database.sessions.begin() as session:
            for user_id in user_ids:
                await provision_sample_resident(session, user_id)
    asyncio.run(seed())


def counts(engine):
    with Session(engine) as session:
        return [
            session.scalar(select(func.count()).select_from(model))
            for model in (House, Apartment, UserApartment, UtilityAccount, Invoice, Meter, Issue)
        ]


def test_sample_data_uses_only_confirmed_apartments_and_preserves_billing(api):
    client, engine, _ = api
    before_profile = client.get("/api/v1/me", headers=headers()).json()
    before_inventory = counts(engine)[:3]
    seed_explicitly(client, 1)
    after_profile = client.get("/api/v1/me", headers=headers()).json()
    assert after_profile["apartments"] == before_profile["apartments"]
    assert counts(engine)[:3] == before_inventory
    account = client.get("/api/v1/apartments/1/utilities", headers=headers()).json()
    assert account["number"] == "A-1"
    assert len(account["meters"]) == 1
    before = counts(engine)
    seed_explicitly(client, 1)
    assert counts(engine) == before


def test_sample_data_never_creates_houses_or_assigns_apartments_to_new_users(api):
    client, engine, _ = api
    before = counts(engine)
    seed_explicitly(client, 4)
    assert client.get("/api/v1/me", headers=headers(104)).json()["apartments"] == []
    assert counts(engine) == before
