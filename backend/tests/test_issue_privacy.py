"""Direct HTTP access checks; each test uses an isolated database."""
from sqlalchemy import text

from tests.test_api import headers, issue_body
from tests.test_resident_photos import image, upload

pytest_plugins = ["tests.test_api"]


def test_private_issue_access_family_and_guessed_photo_ids(api, tmp_path):
    client, engine, _ = api
    client.app.state.settings.media_root = tmp_path / "media"
    private = upload(client, issue_body(place={
        "zone": "apartment", "entrance": 1, "floor": 1, "apartment_id": 1,
    }), [image()]).json()
    shared = upload(client, issue_body(), [image("red")]).json()
    detail = f"/api/v1/issues/{private['id']}"
    photo = f"{detail}/photos/{private['photo_ids'][0]}"
    for identity in (102, 103, 104):
        assert client.get(detail, headers=headers(identity)).status_code == 404
        assert client.get(photo, headers=headers(identity)).status_code == 404
    assert client.get(detail).status_code == 401
    assert client.get(photo).status_code == 401
    assert [row["id"] for row in client.get(
        "/api/v1/houses/1/issues", headers=headers(102),
    ).json()["items"]] == [shared["id"]]
    assert client.get(
        f"/api/v1/issues/{shared['id']}/photos/{private['photo_ids'][0]}",
        headers=headers(102),
    ).status_code == 404
    # Family members deliberately share one apartment, without sharing authorship.
    with engine.begin() as connection:
        connection.execute(text(
            "INSERT INTO user_apartments (user_id, apartment_id) VALUES (2, 1)"
        ))
    assert client.get(detail, headers=headers(102)).json()["mine"] is False
    result = client.get(photo, headers=headers(102))
    assert result.status_code == 200
    assert result.headers["cache-control"] == "no-store"


def test_creation_rejects_foreign_apartment_and_forged_author_without_side_effects(api):
    client, engine, _ = api
    path = "/api/v1/houses/1/issues"
    for body in (
        issue_body(place={"zone": "apartment", "entrance": 2, "floor": 3, "apartment_id": 2}),
        issue_body(place={"zone": "apartment", "entrance": 1, "floor": 1, "apartment_id": 3}),
        issue_body(place={"zone": "corridor", "entrance": 1, "floor": 1, "apartment_id": 2}),
        issue_body(user_id=2),
    ):
        assert client.post(path, headers=headers(), json=body).status_code == 422
    assert client.post(path, json=issue_body()).status_code == 401
    for identity in (103, 104):
        assert client.post(path, headers=headers(identity), json=issue_body()).status_code == 404
    with engine.connect() as connection:
        assert connection.scalar(text("SELECT count(*) FROM issues")) == 0
        assert connection.scalar(text("SELECT count(*) FROM issue_events")) == 0

