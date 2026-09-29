import json
from io import BytesIO

from PIL import Image
from sqlalchemy import text

from tests.test_api import headers, issue_body

pytest_plugins = ["tests.test_api"]


def image(color="blue"):
    output = BytesIO()
    Image.new("RGB", (32, 24), color).save(output, "PNG")
    return output.getvalue()


def upload(client, body, files, user=101):
    return client.post(
        "/api/v1/houses/1/issues/with-photos",
        headers=headers(user),
        data={"data": json.dumps(body)},
        files=[("photos", ("photo.png", content, "image/png")) for content in files],
    )


def test_upload_read_privacy_retry_and_changed_photos(api, tmp_path):
    client, engine, _ = api
    client.app.state.settings.media_root = tmp_path / "media"
    body = issue_body(place={"zone": "apartment", "entrance": 1, "floor": 1, "apartment_id": 1})
    response = upload(client, body, [image()])
    assert response.status_code == 201, response.text
    issue = response.json()
    assert len(issue["photo_ids"]) == 1
    path = f"/api/v1/issues/{issue['id']}/photos/{issue['photo_ids'][0]}"
    result = client.get(path, headers=headers())
    assert result.status_code == 200
    assert result.headers["content-type"] == "image/jpeg"
    assert client.get(path, headers=headers(102)).status_code == 404
    assert client.get(path, headers=headers(103)).status_code == 404
    assert client.get(path).status_code == 401
    assert upload(client, body, [image()]).json() == issue
    assert upload(client, body, [image("red")]).status_code == 409
    assert len(list((tmp_path / "media/issues").glob("*"))) == 1
    with engine.connect() as connection:
        assert connection.scalar(text("select count(*) from issues")) == 1
        assert connection.scalar(text("select count(*) from issue_photos")) == 1


def test_rejected_uploads_leave_no_files_or_issues(api, tmp_path):
    client, engine, _ = api
    client.app.state.settings.media_root = tmp_path / "media"
    assert upload(client, issue_body(), [image(), b"not an image"]).status_code == 422
    assert upload(client, issue_body(), [b"x" * (10 * 1024 * 1024 + 1)]).status_code == 422
    assert upload(client, issue_body(), [image()] * 11).status_code == 400
    assert upload(client, issue_body(), [image()], user=103).status_code == 404
    assert not list((tmp_path / "media/issues").glob("*"))
    with engine.connect() as connection:
        assert connection.scalar(text("select count(*) from issues")) == 0


def test_shared_issue_photos_visible_only_to_same_house(api, tmp_path):
    client, _, _ = api
    client.app.state.settings.media_root = tmp_path / "media"
    issue = upload(client, issue_body(), [image(), image("red")]).json()
    path = f"/api/v1/issues/{issue['id']}/photos/{issue['photo_ids'][0]}"
    assert client.get(path, headers=headers(102)).status_code == 200
    assert client.get(path, headers=headers(103)).status_code == 404
