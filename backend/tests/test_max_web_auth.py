import json
import time
from io import BytesIO

from PIL import Image

from tests.test_api import headers, issue_body, launch

pytest_plugins = ["tests.test_api"]


def test_max_web_without_cookies_keeps_signed_auth_and_house_permissions(api):
    client, _, _ = api
    origin = client.app.state.settings.cors_origins[0]
    signed = launch()
    response = client.post(
        "/api/v1/auth/max", json={"init_data": signed}, headers={"Origin": origin}
    )
    assert response.status_code == 204
    client.cookies.clear()  # Safari's third-party cookie restriction.
    assert client.get("/api/v1/me").status_code == 401
    auth = {"Authorization": "Bearer " + signed}
    assert client.get("/api/v1/me", headers=auth).json()["id"] == 1
    assert client.get("/api/v1/houses/2/issues", headers=auth).status_code == 404
    response = client.post("/api/v1/houses/1/issues", json=issue_body(), headers=auth)
    assert response.status_code == 201, response.text
    assert client.cookies.get("dompulse_session") is None


def test_max_web_without_cookies_rejects_expired_and_tampered_launch(api):
    client, _, _ = api
    for signed in [launch(at=int(time.time()) - 3601), launch() + "&user={}"]:
        auth = {"Authorization": "Bearer " + signed}
        assert client.get("/api/v1/me", headers=auth).status_code == 401
        response = client.post("/api/v1/houses/1/issues", json=issue_body(), headers=auth)
        assert response.status_code == 401


def test_max_web_multipart_and_private_photos_work_without_cookies(api, tmp_path):
    client, _, _ = api
    client.app.state.settings.media_root = tmp_path / "media"
    content = BytesIO()
    Image.new("RGB", (24, 16), "red").save(content, "PNG")
    client.cookies.clear()
    response = client.post(
        "/api/v1/houses/1/issues/with-photos",
        data={"data": json.dumps(issue_body())},
        files=[("photos", ("test.png", content.getvalue(), "image/png"))],
        headers=headers(),
    )
    assert response.status_code == 201, response.text
    issue = response.json()
    path = f"/api/v1/issues/{issue['id']}/photos/{issue['photo_ids'][0]}"
    assert client.get(path).status_code == 401
    photo = client.get(path, headers=headers())
    assert photo.status_code == 200
    assert photo.headers["content-type"] == "image/jpeg"
    assert "no-store" in photo.headers["cache-control"]
    assert client.get(path, headers=headers(103)).status_code == 404


def test_max_web_bearer_header_is_allowed_by_cors(api):
    client, _, _ = api
    origin = client.app.state.settings.cors_origins[0]
    response = client.options("/api/v1/me", headers={
        "Origin": origin,
        "Access-Control-Request-Method": "GET",
        "Access-Control-Request-Headers": "authorization",
    })
    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == origin
    assert "authorization" in response.headers["access-control-allow-headers"].lower()
