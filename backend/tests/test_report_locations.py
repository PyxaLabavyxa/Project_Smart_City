import hashlib
from uuid import uuid4

import pytest
from app.database.enums import IssueCategory
from app.database.models import Issue, StaffNotification
from sqlalchemy import select
from sqlalchemy.orm import Session

from smart_city_api.schemas.app import CreateIssue
from tests.test_api import headers, issue_body
from tests.test_resident_photos import image, upload
from tests.test_staff import ROOT, login, status_body

pytest_plugins = ["tests.test_staff"]
ISSUES = "/api/v1/houses/1/issues"


@pytest.mark.parametrize(
    "zone,place,allowed",
    [
        (
            "courtyard",
            {"zone": "courtyard"},
            {"yard", "garbage", "electricity", "water", "security", "other"},
        ),
        (
            "corridor",
            {"zone": "corridor", "entrance": 1, "floor": 3},
            {
                "water",
                "heating",
                "electricity",
                "elevator",
                "entrance",
                "garbage",
                "security",
                "other",
            },
        ),
        (
            "apartment",
            {"zone": "apartment", "entrance": 1, "floor": 1, "apartment_id": 1},
            {"water", "heating", "electricity", "security", "other"},
        ),
    ],
)
def test_category_matrix_is_enforced_by_api(api, zone, place, allowed):
    client, _, _ = api
    for category in IssueCategory:
        response = client.post(
            ISSUES, json=issue_body(category=category.value, place=place), headers=headers()
        )
        assert response.status_code == (201 if category.value in allowed else 422), (
            zone,
            category,
            response.text,
        )


@pytest.mark.parametrize("zone", ["courtyard", "parking", "house"])
def test_outdoor_location_has_no_floor_and_accepts_old_clients(api, zone):
    client, engine, _ = api
    request = issue_body(place={"zone": zone}, category="yard")
    first = client.post(ISSUES, json=request, headers=headers())
    assert first.status_code == 201, first.text
    row = first.json()
    assert row["place"] == {"zone": zone, "entrance": None, "floor": None, "apartment_id": None}
    legacy = {**request, "place": {"zone": zone, "entrance": 1, "floor": 1}}
    assert client.post(ISSUES, json=legacy, headers=headers()).json()["id"] == row["id"]
    with Session(engine) as session:
        stored = session.get(Issue, row["id"])
        assert stored.entrance is None and stored.floor is None
        # Simulate a row saved by the previously deployed API, including its retry hash.
        stored.entrance = stored.floor = 1
        data = CreateIssue.model_validate(legacy)
        old_data = data.model_copy(
            update={"place": data.place.model_copy(update={"entrance": 1, "floor": 1})}
        )
        stored.request_hash = hashlib.sha256(
            f"1:{old_data.model_dump_json(exclude={'request_id'})}".encode()
        ).hexdigest()
        session.commit()
    assert client.post(ISSUES, json=legacy, headers=headers()).json()["id"] == row["id"]
    assert (
        client.get(f"/api/v1/issues/{row['id']}", headers=headers()).json()["place"] == row["place"]
    )
    assert (
        client.post(ISSUES, json={**request, "title": "Different"}, headers=headers()).status_code
        == 409
    )


@pytest.mark.parametrize(
    "place",
    [
        {"zone": "courtyard", "entrance": 2, "floor": 1},
        {"zone": "courtyard", "entrance": 1},
        {"zone": "courtyard", "apartment_id": 1},
        {"zone": "corridor"},
        {"zone": "corridor", "floor": 2},
        {"zone": "entrance", "entrance": 1, "floor": 2},
    ],
)
def test_contradictory_or_missing_indoor_location_is_rejected(api, place):
    client, _, _ = api
    assert client.post(ISSUES, json=issue_body(place=place), headers=headers()).status_code == 422


@pytest.mark.parametrize(
    "place,category",
    [
        ({"zone": "courtyard"}, "yard"),
        ({"zone": "corridor", "entrance": 1, "floor": 3}, "entrance"),
        ({"zone": "apartment", "entrance": 1, "floor": 1, "apartment_id": 1}, "water"),
    ],
)
def test_new_locations_support_staff_photos_chat_and_status_notifications(
    staff_api, place, category
):
    client, engine, _ = staff_api
    response = upload(client, issue_body(place=place, category=category), [image()])
    assert response.status_code == 201, response.text
    created = response.json()
    issue_id = created["id"]
    csrf = login(client)
    detail = client.get(f"{ROOT}/issues/{issue_id}")
    assert detail.status_code == 200, detail.text
    detail = detail.json()
    assert detail["category"] == category
    assert detail["floor"] == place.get("floor")
    assert detail["entrance"] == place.get("entrance")
    assert client.get(detail["photos"][0]["url"]).status_code == 200
    assert any(row["id"] == issue_id for row in client.get(ROOT + "/issues").json()["items"])
    reply = {"text": "Подскажите точный ориентир", "request_id": str(uuid4())}
    assert (
        client.post(f"{ROOT}/issues/{issue_id}/messages", json=reply, headers=csrf).status_code
        == 200
    )
    chat = f"/api/v1/issues/{issue_id}/messages"
    assert client.get(chat, headers=headers()).json()["items"][0]["text"] == reply["text"]
    assert client.get(chat, headers=headers(102)).status_code == 404
    assert (
        client.post(
            f"{ROOT}/issues/{issue_id}/status", json=status_body(), headers=csrf
        ).status_code
        == 200
    )
    assert (
        client.get(f"/api/v1/issues/{issue_id}", headers=headers()).json()["status"]
        == "in_progress"
    )
    with Session(engine) as session:
        assert (
            len(
                session.scalars(
                    select(StaffNotification).where(StaffNotification.issue_id == issue_id)
                ).all()
            )
            == 2
        )
