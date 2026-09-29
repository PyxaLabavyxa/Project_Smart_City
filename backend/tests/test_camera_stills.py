from datetime import UTC, datetime
from unittest.mock import patch

from tests.test_api import headers

pytest_plugins = ["tests.test_api"]


def test_camera_provisioning_and_frame_rotation_are_authorized(api):
    client, _, _ = api
    client.app.state.settings.sample_data_enabled = True
    profile = client.get("/api/v1/me", headers=headers(104)).json()
    house_id = profile["houses"][0]["id"]
    cameras = client.get(f"/api/v1/houses/{house_id}/cameras", headers=headers(104)).json()
    assert {camera["name"] for camera in cameras} == {"Подъезд 1", "Подъезд 2", "Двор"}
    client.get("/api/v1/me", headers=headers(104))
    assert client.get(f"/api/v1/houses/{house_id}/cameras", headers=headers(104)).json() == cameras
    camera_id = cameras[0]["id"]
    with patch("smart_city_api.api.routes.services.datetime") as clock:
        clock.now.return_value = datetime(2026, 9, 29, 12, 0, 0, tzinfo=UTC)
        first = client.get(f"/api/v1/cameras/{camera_id}/preview", headers=headers(104))
        clock.now.return_value = datetime(2026, 9, 29, 12, 0, 5, tzinfo=UTC)
        second = client.get(f"/api/v1/cameras/{camera_id}/preview", headers=headers(104))
    assert first.status_code == second.status_code == 200
    assert first.json()["src"].endswith("-1.png")
    assert second.json()["src"].endswith("-2.png")
    assert first.headers["cache-control"] == "no-store"
    assert (
        client.get(f"/api/v1/cameras/{camera_id}/preview", headers=headers(103)).status_code == 404
    )
