import hashlib
import hmac
import json
import os
import time
from datetime import UTC, datetime, timedelta
from decimal import Decimal
from urllib.parse import urlencode
from uuid import uuid4

import pytest
from app.database.models import (
    Apartment,
    Base,
    House,
    HouseCamera,
    Invoice,
    Meter,
    User,
    UserApartment,
    UtilityAccount,
)
from fastapi.testclient import TestClient
from pydantic import SecretStr
from sqlalchemy import create_engine, text
from sqlalchemy.engine import make_url
from sqlalchemy.orm import Session

from smart_city_api.core.auth import InvalidLaunchData, validate_launch_data
from smart_city_api.core.config import Settings
from smart_city_api.main import create_app
from smart_city_api.runtime import loop_factory

TOKEN = "isolated-test-bot-token"


def launch(user_id=101, at=None):
    values = {
        "auth_date": str(int(time.time()) if at is None else at),
        "user": json.dumps({"id": user_id, "first_name": "Житель"}, ensure_ascii=False),
    }
    secret = hmac.digest(b"WebAppData", TOKEN.encode(), "sha256")
    values["hash"] = hmac.new(
        secret, "\n".join(f"{key}={values[key]}" for key in sorted(values)).encode(), hashlib.sha256
    ).hexdigest()
    return urlencode(values)


def headers(user_id=101):
    return {"Authorization": "Bearer " + launch(user_id)}


@pytest.fixture
def api(tmp_path):
    postgres = os.environ.get("TEST_POSTGRES_URL")
    admin = None
    schema = "qa_" + uuid4().hex
    if postgres:
        # Only a uniquely named disposable schema is created/dropped by these tests.
        admin = create_engine(postgres)
        with admin.begin() as connection:
            connection.execute(text(f'CREATE SCHEMA "{schema}"'))
        url = make_url(postgres).update_query_dict({"options": f"-csearch_path={schema}"})
        sync_url = url
        async_url = url.render_as_string(hide_password=False)
    else:
        path = tmp_path / "api.db"
        sync_url = f"sqlite:///{path}"
        async_url = f"sqlite+aiosqlite:///{path}"
    engine = create_engine(sync_url)
    Base.metadata.create_all(engine)
    today = datetime.now(UTC).date()
    period = today.strftime("%Y-%m")
    with Session(engine) as session:
        session.add_all(
            [
                User(id=1, max_user_id=101, name="Первый"),
                User(id=2, max_user_id=102, name="Второй"),
                User(id=3, max_user_id=103, name="Другой дом"),
                User(id=4, max_user_id=104, name="Без квартиры"),
                House(
                    id=1, address="Дом 1", entrances_count=2, floors_count=3, apartments_per_floor=4
                ),
                House(
                    id=2, address="Дом 2", entrances_count=1, floors_count=1, apartments_per_floor=1
                ),
            ]
        )
        session.flush()
        session.add_all(
            [
                Apartment(id=1, house_id=1, number=7, entrance=1, floor=1),
                Apartment(id=2, house_id=1, number=19, entrance=2, floor=3),
                Apartment(id=3, house_id=2, number=7, entrance=1, floor=1),
            ]
        )
        session.flush()
        session.add_all([UserApartment(user_id=i, apartment_id=i) for i in (1, 2, 3)])
        account = UtilityAccount(
            id=1,
            apartment_id=1,
            number="A-1",
            area=Decimal("45.2"),
            residents=2,
            reading_period=period,
            reading_open=today - timedelta(days=2),
            reading_close=today + timedelta(days=2),
        )
        session.add(account)
        session.flush()
        session.add_all(
            [
                Meter(id=1, account_id=1, kind="cold", serial="W-1", previous=Decimal("10.100")),
                Invoice(
                    account_id=1,
                    number="I-1",
                    period=period,
                    due=today,
                    charges=[
                        {"title": "Вода", "quantity": "1 м³", "tariff": "10 ₽", "amount": 1000}
                    ],
                ),
                HouseCamera(id=1, house_id=1, name="Вход", status="unavailable", note="Нет связи"),
            ]
        )
        session.commit()
    if postgres:
        # Explicit fixture IDs do not advance PostgreSQL sequences.
        with engine.begin() as connection:
            for table in Base.metadata.sorted_tables:
                name = table.name
                connection.execute(
                    text(
                        "SELECT setval(pg_get_serial_sequence(:table, 'id'), "
                        f"COALESCE((SELECT max(id) FROM {name}), 1), "
                        f"EXISTS(SELECT 1 FROM {name}))"
                    ),
                    {"table": name},
                )
    try:
        settings = Settings(
            _env_file=None, database_url=SecretStr(async_url), bot_token=SecretStr(TOKEN)
        )
        with TestClient(
            create_app(settings), backend_options={"loop_factory": loop_factory}
        ) as client:
            yield client, engine, period
    finally:
        engine.dispose()
        if admin:
            with admin.begin() as connection:
                connection.execute(text(f'DROP SCHEMA "{schema}" CASCADE'))
            admin.dispose()


def issue_body(**changes):
    return {
        "title": "Не горит свет",
        "description": "Лампа погасла",
        "category": "electricity",
        "request_id": str(uuid4()),
        "place": {"entrance": 1, "floor": 1, "zone": "corridor"},
        **changes,
    }


def test_max_auth_rejects_tampering_expiry_duplicates_and_unknown_user(api):
    client, _, _ = api
    assert client.get("/api/v1/me").status_code == 401
    assert client.get("/api/v1/me", headers=headers(999)).status_code == 403
    assert (
        client.get("/api/v1/me", headers={"Authorization": "Bearer " + launch(at=1)}).status_code
        == 401
    )
    for raw in [
        launch() + "&auth_date=1",
        launch().replace("101", "102"),
        "user=%zz",
        launch(at=int(time.time()) + 60),
    ]:
        with pytest.raises(InvalidLaunchData):
            validate_launch_data(raw, TOKEN, 86400)
    assert validate_launch_data(launch(), TOKEN, 86400) == 101


def test_profile_structure_and_cross_house_access(api):
    client, _, _ = api
    profile = client.get("/api/v1/me", headers=headers()).json()
    assert [a["id"] for a in profile["apartments"]] == [1]
    assert [h["id"] for h in profile["houses"]] == [1]
    assert "max_user_id" not in profile
    page = client.get("/api/v1/houses/1/apartments?limit=1", headers=headers()).json()
    assert page["items"][0]["number"] == 7
    second = client.get(
        f"/api/v1/houses/1/apartments?cursor={page['next_cursor']}", headers=headers()
    ).json()
    assert second["items"][0]["number"] == 19
    assert client.get("/api/v1/houses/2/apartments", headers=headers()).status_code == 404
    assert client.get("/api/v1/houses/1/apartments?limit=0", headers=headers()).status_code == 422
    assert client.get("/api/v1/me", headers=headers(104)).json()["houses"] == []


def test_issues_persist_idempotently_with_history_and_private_location(api):
    client, engine, _ = api
    body = issue_body()
    first = client.post("/api/v1/houses/1/issues", json=body, headers=headers())
    assert first.status_code == 201, first.text
    issue = first.json()
    assert issue["history"][0]["status"] == "new"
    assert (
        client.post("/api/v1/houses/1/issues", json=body, headers=headers()).json()["id"]
        == issue["id"]
    )
    assert (
        client.post(
            "/api/v1/houses/1/issues", json={**body, "title": "Changed"}, headers=headers()
        ).status_code
        == 409
    )
    assert client.get(f"/api/v1/issues/{issue['id']}", headers=headers(102)).status_code == 200
    assert client.get(f"/api/v1/issues/{issue['id']}", headers=headers(103)).status_code == 404
    private = client.post(
        "/api/v1/houses/1/issues",
        json=issue_body(
            place={
                "entrance": 1,
                "floor": 1,
                "zone": "apartment",
                "apartment_id": 1,
            }
        ),
        headers=headers(),
    ).json()
    assert client.get(f"/api/v1/issues/{private['id']}", headers=headers(102)).status_code == 404
    assert len(client.get("/api/v1/houses/1/issues", headers=headers(102)).json()["items"]) == 1
    with engine.connect() as connection:
        assert connection.scalar(text("SELECT count(*) FROM issues")) == 2
        assert connection.scalar(text("SELECT count(*) FROM issue_events")) == 2


def test_invalid_issue_location_and_client_author_are_rejected(api):
    client, _, _ = api
    for body in [
        issue_body(title="  "),
        issue_body(user_id=2),
        issue_body(place={"zone": "corridor", "entrance": 100, "floor": 1}),
        issue_body(place={"zone": "apartment", "entrance": 2, "floor": 3, "apartment_id": 2}),
    ]:
        assert (
            client.post("/api/v1/houses/1/issues", json=body, headers=headers()).status_code == 422
        )
    assert (
        client.post("/api/v1/houses/2/issues", json=issue_body(), headers=headers()).status_code
        == 404
    )


def test_messages_are_persistent_private_and_retry_safe(api):
    client, engine, _ = api
    body = {"recipient_id": 2, "text": "Здравствуйте", "request_id": str(uuid4())}
    sent = client.post("/api/v1/apartments/1/messages", json=body, headers=headers())
    assert sent.status_code == 201, sent.text
    assert sent.json()["direction"] == "outgoing"
    assert (
        client.post("/api/v1/apartments/1/messages", json=body, headers=headers()).json()["id"]
        == sent.json()["id"]
    )
    assert (
        client.post(
            "/api/v1/apartments/1/messages", json={**body, "text": "другое"}, headers=headers()
        ).status_code
        == 409
    )
    incoming = client.get("/api/v1/apartments/2/messages", headers=headers(102)).json()["items"]
    assert incoming[0]["direction"] == "incoming"
    assert incoming[0]["apartment"] == 7
    assert client.get("/api/v1/apartments/1/messages", headers=headers(102)).status_code == 404
    assert (
        client.post(
            "/api/v1/apartments/1/messages", json={**body, "recipient_id": 3}, headers=headers()
        ).status_code
        == 422
    )
    with engine.connect() as connection:
        assert connection.scalar(text("SELECT count(*) FROM apartment_messages")) == 1


def test_meter_registration_access_period_and_reading_validation(api):
    client, engine, period = api
    assert client.get("/api/v1/apartments/2/utilities", headers=headers(102)).json() is None
    assert client.get("/api/v1/apartments/1/utilities", headers=headers(102)).status_code == 404
    path = "/api/v1/meters/1/readings"
    assert (
        client.post(path, json={"value": "10.099", "period": period}, headers=headers()).status_code
        == 422
    )
    assert (
        client.post(path, json={"value": "11", "period": "2000-01"}, headers=headers()).status_code
        == 409
    )
    response = client.post(path, json={"value": "11.123", "period": period}, headers=headers())
    assert response.status_code == 200, response.text
    assert response.json()["meters"][0]["current"] == "11.123"
    assert response.json()["charges"][0]["amount"] == 1000
    assert (
        client.post(path, json={"value": "11.123", "period": period}, headers=headers()).status_code
        == 200
    )
    assert (
        client.post(path, json={"value": "12", "period": period}, headers=headers()).status_code
        == 409
    )
    assert (
        client.post(path, json={"value": "12", "period": period}, headers=headers(102)).status_code
        == 404
    )
    with engine.connect() as connection:
        assert connection.scalar(text("SELECT count(*) FROM meter_readings")) == 1


def test_catalogs_show_only_registered_data_and_unavailable_preview(api):
    client, _, _ = api
    assert len(client.get("/api/v1/houses/1/cameras", headers=headers()).json()) == 1
    assert client.get("/api/v1/cameras/1/preview", headers=headers()).status_code == 503
    assert client.get("/api/v1/cameras/1/preview", headers=headers(103)).status_code == 404
    assert client.get("/api/v1/houses/1/works", headers=headers()).json() == []


def test_session_survives_reload_and_requires_trusted_origin_for_mutations(api):
    client, _, _ = api
    origin = {"Origin": "http://localhost:3000"}
    client.base_url = "https://testserver"
    logged_in = client.post("/api/v1/auth/max", json={"init_data": launch()}, headers=origin)
    assert logged_in.status_code == 204
    assert "HttpOnly" in logged_in.headers["set-cookie"]
    assert "Secure" in logged_in.headers["set-cookie"]
    assert client.get("/api/v1/me").status_code == 200
    assert client.post("/api/v1/houses/1/issues", json=issue_body()).status_code == 403
    assert (
        client.post("/api/v1/houses/1/issues", json=issue_body(), headers=origin).status_code == 201
    )
    client.cookies.clear()
    assert (
        client.post(
            "/api/v1/auth/max",
            json={"init_data": launch()},
            headers={"Origin": "https://foreign.invalid"},
        ).status_code
        == 403
    )
    assert client.get("/api/v1/me").status_code == 401
