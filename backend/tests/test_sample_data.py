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


def test_sample_data_is_repeatable_and_preserves_existing_billing(api):
    client, engine, _ = api
    client.app.state.settings.sample_data_enabled = True
    seed_explicitly(client, 1)
    profile = client.get("/api/v1/me", headers=headers()).json()
    assert len(profile["apartments"]) == 2
    before = counts(engine)
    assert client.get("/api/v1/me", headers=headers()).status_code == 200
    assert counts(engine) == before
    old = client.get("/api/v1/apartments/1/utilities", headers=headers()).json()
    assert old["number"] == "A-1"
    assert len(old["meters"]) == 1
    new_id = next(a["id"] for a in profile["apartments"] if a["id"] != 1)
    account = client.get(f"/api/v1/apartments/{new_id}/utilities", headers=headers()).json()
    assert len(account["meters"]) == 3
    assert len(account["charges"]) == 7
    assert account["invoiceNumber"].startswith("КВ-")
    assert sum(c["amount"] for c in account["charges"]) > 0
    assert (
        client.get(f"/api/v1/apartments/{new_id}/utilities", headers=headers(102)).status_code
        == 404
    )


def test_explicit_legacy_seed_creates_two_apartments(api):
    client, _, _ = api
    assert client.get("/api/v1/me", headers=headers(104)).json()["apartments"] == []
    client.app.state.settings.sample_data_enabled = True
    assert client.get("/api/v1/me", headers=headers(104)).json()["apartments"] == []
    seed_explicitly(client, 4)
    profile = client.get("/api/v1/me", headers=headers(104)).json()
    assert len(profile["apartments"]) == 2
    assert len({a["number"] for a in profile["apartments"]}) == 2
    assert {a["entrance"] for a in profile["apartments"]} == {1, 2}
    assert profile["houses"][0]["floors_count"] == 15
    house_id = profile["houses"][0]["id"]
    with Session(api[1]) as session:
        assert (
            session.scalar(
                select(func.count()).select_from(Apartment).where(Apartment.house_id == house_id)
            )
            == 120
        )


def test_residents_share_house_but_not_apartments_and_can_message(api):
    from uuid import uuid4

    client, _, _ = api
    client.app.state.settings.sample_data_enabled = True
    seed_explicitly(client, 4, 3)
    first = client.get("/api/v1/me", headers=headers(104)).json()
    second = client.get("/api/v1/me", headers=headers(103)).json()
    first_apartment = first["apartments"][0]
    neighbor = next(a for a in second["apartments"] if a["house_id"] == first_apartment["house_id"])
    assert first_apartment["id"] != neighbor["id"]
    response = client.post(
        f"/api/v1/apartments/{first_apartment['id']}/messages",
        headers=headers(104),
        json={"recipient_id": neighbor["id"], "text": "Здравствуйте!", "request_id": str(uuid4())},
    )
    assert response.status_code == 201, response.text
