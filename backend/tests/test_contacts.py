import importlib.util
from pathlib import Path

import pytest
from alembic.migration import MigrationContext
from alembic.operations import Operations
from app.database.models import CompanyHouse, ManagementCompany
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import Session

from tests.test_api import headers
from tests.test_staff import ROOT, login

pytest_plugins = ["tests.test_staff"]


def contact(kind="phone", value="+7 (495) 123-45-67", **changes):
    return {
        "kind": kind, "label": "Диспетчерская", "value": value, "note": "Круглосуточно", **changes
    }


def test_staff_contacts_persist_replace_and_are_visible_only_to_house_residents(staff_api):
    client, engine, _ = staff_api
    with Session(engine) as session:
        session.add(ManagementCompany(id=1, name="УК Наш дом"))
        session.flush()
        session.add(CompanyHouse(house_id=1, company_id=1))
        session.commit()
    resident_path = "/api/v1/houses/1/contacts"
    staff_path = ROOT + "/houses/1/contacts"
    assert client.get(staff_path).status_code == 401
    assert client.get(resident_path).status_code == 401
    assert client.get(resident_path, headers=headers()).json() == {
        "company_name": "УК Наш дом", "items": []
    }
    csrf = login(client)
    items = [
        contact(),
        contact("email", "office@example.ru", label="Приёмная", note="Пн–пт, 9:00–18:00"),
        contact("address", "Улица Домовая, 1", label="Офис", note=""),
        contact("website", "https://example.ru/contacts", label="Сайт", note=""),
    ]
    assert client.post(staff_path, json={"items": items}).status_code == 403
    saved = client.post(staff_path, headers=csrf, json={"items": items})
    assert saved.status_code == 200, saved.text
    assert saved.json()["items"] == items
    assert client.get(resident_path, headers=headers(102)).json() == saved.json()
    assert client.get(staff_path).json() == saved.json()
    assert client.get(resident_path, headers=headers(103)).status_code == 404
    assert client.get(resident_path, headers=headers(104)).status_code == 404
    assert client.get(ROOT + "/houses/2/contacts").status_code == 404
    assert (
        client.post(ROOT + "/houses/2/contacts", headers=csrf, json={"items": []}).status_code
        == 404
    )
    changed = [contact(value="112", note="Экстренная связь")]
    assert client.post(staff_path, headers=csrf, json={"items": changed}).status_code == 200
    assert client.get(resident_path, headers=headers()).json()["items"] == changed
    assert client.post(staff_path, headers=csrf, json={"items": changed}).json()["items"] == changed
    with engine.connect() as connection:
        assert connection.scalar(text("SELECT count(*) FROM house_contacts")) == 1
    assert client.post(staff_path, headers=csrf, json={"items": []}).status_code == 200
    assert client.get(resident_path, headers=headers()).json()["items"] == []


@pytest.mark.parametrize(
    "item",
    [
        contact(value="call me"),
        contact(value="+1"),
        contact("email", "bad-email"),
        contact("email", "test@example.ru?subject=injected"),
        contact("website", "javascript:alert(1)"),
        contact("website", "https://user:password@example.ru"),
        contact("website", "https://example.ru:invalid"),
        contact("website", "https://"),
        contact(label=" "),
        contact(note="a" * 201),
        contact("address", "address\nwith control"),
        contact(kind="unknown"),
    ],
)
def test_invalid_contact_never_replaces_existing_data(staff_api, item):
    client, _, _ = staff_api
    csrf = login(client)
    path = ROOT + "/houses/1/contacts"
    assert client.post(path, headers=csrf, json={"items": [contact()]}).status_code == 200
    assert client.post(path, headers=csrf, json={"items": [item]}).status_code == 422
    assert client.get(path).json()["items"] == [contact()]


def test_contacts_limit_and_scope_cannot_be_overridden(staff_api):
    client, _, _ = staff_api
    csrf = login(client)
    path = ROOT + "/houses/1/contacts"
    assert client.post(path, headers=csrf, json={"items": [contact()] * 13}).status_code == 422
    assert client.post(path, headers=csrf, json={"items": [], "house_id": 2}).status_code == 422
    assert client.get(path).json()["items"] == []
    client.post(ROOT + "/auth/logout", headers=csrf)
    other_csrf = login(client, "other")
    assert client.get(path).status_code == 404
    assert client.post(path, headers=other_csrf, json={"items": [contact()]}).status_code == 404


def test_contacts_migration_upgrades_and_downgrades_without_changing_houses(tmp_path):
    migration_path = (
        Path(__file__).resolve().parents[1] / "migrations/versions/0007_house_contacts.py"
    )
    spec = importlib.util.spec_from_file_location("contacts_migration", migration_path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    engine = create_engine(f"sqlite:///{tmp_path / 'migration.db'}")
    try:
        with engine.begin() as connection:
            connection.execute(text("CREATE TABLE houses (id INTEGER PRIMARY KEY, address TEXT)"))
            connection.execute(text("INSERT INTO houses VALUES (1, 'Existing house')"))
            with Operations.context(MigrationContext.configure(connection)):
                module.upgrade()
                assert "house_contacts" in inspect(connection).get_table_names()
                connection.execute(text(
                    "INSERT INTO house_contacts (house_id, position, label, kind, value) "
                    "VALUES (1, 0, 'Office', 'phone', '112')"
                ))
                assert connection.scalar(text("SELECT note FROM house_contacts")) == ""
                module.downgrade()
                assert "house_contacts" not in inspect(connection).get_table_names()
                assert connection.scalar(text("SELECT address FROM houses")) == "Existing house"
                module.upgrade()
                assert "house_contacts" in inspect(connection).get_table_names()
    finally:
        engine.dispose()
