from datetime import UTC, datetime

import pytest
from app.database.models import Apartment, House, Issue, User, UserApartment
from sqlalchemy import delete
from sqlalchemy.orm import Session

from tests.test_api import headers, issue_body
from tests.test_resident_photos import image, upload
from tests.test_staff import ROOT, login

pytest_plugins = ["tests.test_staff"]
ISSUES = "/api/v1/houses/1/issues"


@pytest.fixture
def visibility_api(staff_api):
    client, engine, _ = staff_api
    with Session(engine) as session:
        # 101 lives in entrance 1, 102 in entrance 2, 103 in another house.
        # 104 is a neighbor upstairs; 105 shares the author's apartment.
        upstairs = Apartment(house_id=1, number=8, entrance=1, floor=2)
        cohabitant = User(max_user_id=105, name="Жилец той же квартиры")
        session.get(House, 2).entrances_count = 2
        another_house = Apartment(house_id=2, number=8, entrance=2, floor=1)
        session.add_all([upstairs, cohabitant, another_house])
        session.flush()
        session.add_all(
            [
                UserApartment(user_id=4, apartment_id=upstairs.id),
                UserApartment(user_id=cohabitant.id, apartment_id=1),
                UserApartment(user_id=1, apartment_id=another_house.id),
            ]
        )
        session.commit()
    return staff_api


def report(client, place, *, author=101, photo=False):
    body = issue_body(place=place)
    response = (
        upload(client, body, [image()])
        if photo
        else client.post(ISSUES, json=body, headers=headers(author))
    )
    assert response.status_code == 201, response.text
    return response.json()


def ids(client, user, path=ISSUES):
    response = client.get(path, headers=headers(user))
    assert response.status_code == 200, response.text
    return {item["id"] for item in response.json()["items"]}


@pytest.mark.parametrize("zone", ["entrance", "corridor", "stairs", "elevator", "technical"])
def test_indoor_issues_are_visible_throughout_the_matching_entrance(visibility_api, zone):
    client, _, _ = visibility_api
    issue = report(client, {"zone": zone, "entrance": 1, "floor": 1})
    for user in (101, 104, 105):
        assert issue["id"] in ids(client, user)
        assert client.get(f"/api/v1/issues/{issue['id']}", headers=headers(user)).status_code == 200
    for user in (102, 103):
        assert client.get(f"/api/v1/issues/{issue['id']}", headers=headers(user)).status_code == 404
    assert issue["id"] not in ids(client, 102)


@pytest.mark.parametrize("zone", ["courtyard", "parking", "house"])
def test_outdoor_issues_are_visible_to_every_entrance_but_not_other_houses(visibility_api, zone):
    client, _, _ = visibility_api
    # Legacy (1, 1) values are normalized, not used to limit the audience.
    issue = report(client, {"zone": zone, "entrance": 1, "floor": 1})
    assert issue["place"]["entrance"] is None
    for user in (101, 102, 104, 105):
        assert issue["id"] in ids(client, user)
        assert client.get(f"/api/v1/issues/{issue['id']}", headers=headers(user)).status_code == 200
    assert client.get(f"/api/v1/issues/{issue['id']}", headers=headers(103)).status_code == 404


def test_private_apartment_issue_and_photos_are_author_only_even_for_cohabitants(visibility_api):
    client, _, _ = visibility_api
    issue = report(
        client, {"zone": "apartment", "entrance": 1, "floor": 1, "apartment_id": 1}, photo=True
    )
    path = f"/api/v1/issues/{issue['id']}"
    photo = f"{path}/photos/{issue['photo_ids'][0]}"
    assert issue["id"] in ids(client, 101)
    assert client.get(photo, headers=headers()).status_code == 200
    for user in (102, 103, 104, 105):
        assert client.get(path, headers=headers(user)).status_code == 404
        assert client.get(photo, headers=headers(user)).status_code == 404
    assert issue["id"] not in ids(client, 105)
    assert client.get(photo).status_code == 401
    login(client)
    detail = client.get(f"{ROOT}/issues/{issue['id']}")
    assert detail.status_code == 200
    assert client.get(detail.json()["photos"][0]["url"]).status_code == 200
    login(client, "other")
    assert client.get(f"{ROOT}/issues/{issue['id']}").status_code == 404


def test_entrance_photo_cannot_be_opened_from_another_entrance(visibility_api):
    client, _, _ = visibility_api
    issue = report(client, {"zone": "corridor", "entrance": 1, "floor": 2}, photo=True)
    photo = f"/api/v1/issues/{issue['id']}/photos/{issue['photo_ids'][0]}"
    assert client.get(photo, headers=headers(104)).status_code == 200
    assert client.get(photo, headers=headers(102)).status_code == 404


def test_membership_matches_house_and_entrance_together_and_supports_multiple_apartments(
    visibility_api,
):
    client, engine, _ = visibility_api
    issue = report(client, {"zone": "corridor", "entrance": 2, "floor": 3}, author=102)
    # 101 owns an apartment in entrance 2 of house 2, not house 1.
    assert issue["id"] not in ids(client, 101)
    with Session(engine) as session:
        session.add(UserApartment(user_id=1, apartment_id=2))
        session.commit()
    assert issue["id"] in ids(client, 101)
    assert client.get(f"/api/v1/issues/{issue['id']}", headers=headers()).status_code == 200


def test_author_retains_own_report_from_another_entrance_and_staff_sees_all_scopes(visibility_api):
    client, _, _ = visibility_api
    entrance = report(client, {"zone": "corridor", "entrance": 2, "floor": 2})
    private = report(client, {"zone": "apartment", "entrance": 1, "floor": 1, "apartment_id": 1})
    yard = report(client, {"zone": "courtyard"})
    assert entrance["id"] in ids(client, 101)
    assert entrance["id"] in ids(client, 102)
    assert entrance["id"] not in ids(client, 104)
    login(client)
    staff_ids = {row["id"] for row in client.get(ROOT + "/issues").json()["items"]}
    assert {entrance["id"], private["id"], yard["id"]} <= staff_ids


def test_pagination_excludes_hidden_issues_before_computing_the_cursor(visibility_api):
    client, _, _ = visibility_api
    first = report(client, {"zone": "corridor", "entrance": 1, "floor": 1})
    report(client, {"zone": "apartment", "entrance": 1, "floor": 1, "apartment_id": 1})
    report(client, {"zone": "corridor", "entrance": 2, "floor": 3}, author=102)
    last = report(client, {"zone": "courtyard"}, author=102)
    page = client.get(ISSUES + "?limit=1", headers=headers(104)).json()
    assert [row["id"] for row in page["items"]] == [first["id"]]
    assert page["next_cursor"] == first["id"]
    page = client.get(
        ISSUES + f"?limit=1&cursor={page['next_cursor']}", headers=headers(104)
    ).json()
    assert [row["id"] for row in page["items"]] == [last["id"]]
    assert page["next_cursor"] is None


def test_legacy_reports_without_location_are_author_only(visibility_api):
    client, engine, _ = visibility_api
    # Staff fixture issue 1 has no place, as do reports created through the bot.
    assert 1 in ids(client, 101)
    for user in (102, 104, 105):
        assert 1 not in ids(client, user)
        assert client.get("/api/v1/issues/1", headers=headers(user)).status_code == 404
    assert client.get("/api/v1/issues/1/photos/1", headers=headers(105)).status_code == 404
    with Session(engine) as session:
        session.get(Issue, 1).apartment_id = 1
        session.commit()
    assert client.get("/api/v1/issues/1", headers=headers()).status_code == 200
    assert client.get("/api/v1/issues/1", headers=headers(105)).status_code == 404


def test_revoked_house_access_and_rejection_hide_even_an_authors_report(visibility_api):
    client, engine, _ = visibility_api
    issue = report(client, {"zone": "courtyard"})
    path = f"/api/v1/issues/{issue['id']}"
    with Session(engine) as session:
        session.get(Issue, issue["id"]).rejected_at = datetime.now(UTC)
        session.commit()
    assert client.get(path, headers=headers()).status_code == 404
    assert issue["id"] not in ids(client, 101)
    with Session(engine) as session:
        session.get(Issue, issue["id"]).rejected_at = None
        session.execute(
            delete(UserApartment).where(UserApartment.user_id == 1, UserApartment.apartment_id == 1)
        )
        session.commit()
    assert client.get(path, headers=headers()).status_code == 404
