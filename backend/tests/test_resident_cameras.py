from unittest.mock import AsyncMock
from uuid import uuid4

import pytest
from app.database.camera_data import provision_cameras
from app.database.models import House, HouseCamera
from sqlalchemy import select
from sqlalchemy.orm import Session

from smart_city_api.services import camera_media
from tests.test_api import headers
from tests.test_staff import ROOT, login

pytest_plugins = ["tests.test_staff"]
CAMERAS = "/api/v1/houses/1/cameras"


@pytest.fixture(autouse=True)
def camera_frames(monkeypatch, api, tmp_path):
    api[0].app.state.settings.media_root = tmp_path
    monkeypatch.setattr(camera_media, "frame", AsyncMock(return_value=b"\xff\xd8frame\xff\xd9"))


def body(**changes):
    return {
        "name": "Моя камера",
        "source_url": "https://camera.example/snapshot.jpg?token=test",
        "note": "Входная площадка",
        "is_public": False,
        "request_id": str(uuid4()),
        "place": {"entrance": 1, "floor": 1, "zone": "entrance"},
        **changes,
    }


def create(client, **changes):
    response = client.post(CAMERAS, headers=headers(), json=body(**changes))
    assert response.status_code == 201, response.text
    return response.json()


def test_personal_camera_is_owner_only_in_list_and_preview(api):
    client, _, _ = api
    camera = create(client)
    assert camera["mine"] and camera["visibility"] == "private"
    assert camera["moderation_status"] == "approved"
    assert "source_url" not in camera and "owner_id" not in camera
    assert camera in client.get(CAMERAS, headers=headers()).json()
    for other in (102, 103, 104):
        assert (
            client.get(
                f"/api/v1/cameras/{camera['id']}/preview", headers=headers(other)
            ).status_code
            == 404
        )
    assert [c["id"] for c in client.get(CAMERAS, headers=headers(102)).json()] == ["1"]
    frame = client.get(f"/api/v1/cameras/{camera['id']}/preview", headers=headers())
    assert frame.status_code == 200
    assert frame.json()["src"].startswith("data:image/jpeg;base64,")
    assert frame.headers["cache-control"] == "no-store"
    assert client.get(f"/api/v1/cameras/{camera['id']}/preview").status_code == 401
    assert client.post(CAMERAS, json=body()).status_code == 401
    assert (
        client.post("/api/v1/houses/2/cameras", headers=headers(), json=body()).status_code == 404
    )


def test_creation_retry_preserves_one_camera_and_rejects_changed_payload(api):
    client, engine, _ = api
    payload = body()
    first = client.post(CAMERAS, headers=headers(), json=payload)
    retry = client.post(CAMERAS, headers=headers(), json=payload)
    assert first.status_code == retry.status_code == 201
    assert first.json()["id"] == retry.json()["id"]
    changed = client.post(CAMERAS, headers=headers(), json={**payload, "is_public": True})
    assert changed.status_code == 409
    with Session(engine) as session:
        assert len(list(session.scalars(select(HouseCamera).where(HouseCamera.owner_id == 1)))) == 1


@pytest.mark.parametrize(
    "url",
    [
        "rtsp://camera.example/live",
        "javascript:alert(1)",
        "/images/cameras/yard-1.png",
        "https://user:password@camera.example/frame.jpg",
        "https://camera.example/frame.jpg#fragment",
        "not a URL",
    ],
)
def test_source_urls_are_validated(api, url):
    client, _, _ = api
    assert client.post(CAMERAS, headers=headers(), json=body(source_url=url)).status_code == 422


@pytest.mark.parametrize(
    "place",
    [
        {"entrance": 3, "floor": 1, "zone": "entrance"},
        {"entrance": 1, "floor": 4, "zone": "corridor"},
        {"entrance": 1, "floor": 2, "zone": "entrance"},
        {"entrance": 2, "floor": 1, "zone": "courtyard"},
        {"entrance": 2, "floor": 3, "zone": "apartment", "apartment_id": 2},
        {"entrance": 1, "floor": 1, "zone": "apartment", "apartment_id": 3},
        {"entrance": 1, "floor": 1, "zone": "apartment"},
        {"entrance": 1, "floor": 1, "zone": "not-a-zone"},
    ],
)
def test_location_requires_real_house_and_own_apartment(api, place):
    client, _, _ = api
    assert client.post(CAMERAS, headers=headers(), json=body(place=place)).status_code == 422


def test_own_apartment_location_is_preserved(api):
    client, _, _ = api
    place = {"entrance": 1, "floor": 1, "zone": "apartment", "apartment_id": 1}
    assert create(client, place=place)["place"] == place


def test_outdoor_camera_preserves_zone_without_an_entrance_or_floor(api):
    client, engine, _ = api
    camera = create(client, place={"entrance": 1, "floor": 1, "zone": "courtyard"})
    expected = {"entrance": None, "floor": None, "zone": "courtyard", "apartment_id": None}
    assert camera["place"] == expected
    assert (
        next(c for c in client.get(CAMERAS, headers=headers()).json() if c["id"] == camera["id"])[
            "place"
        ]
        == expected
    )
    with Session(engine) as session:
        stored = session.get(HouseCamera, int(camera["id"]))
        assert stored.entrance is None and stored.floor is None and stored.zone == "courtyard"


def test_public_camera_requires_scoped_staff_approval_and_csrf(staff_api):
    client, engine, _ = staff_api
    private = create(client)
    public = create(client, name="Камера для соседей", is_public=True)
    assert public["moderation_status"] == "pending"
    assert public["id"] not in [c["id"] for c in client.get(CAMERAS, headers=headers(102)).json()]
    assert (
        client.get(f"/api/v1/cameras/{public['id']}/preview", headers=headers(102)).status_code
        == 404
    )
    assert (
        client.get(f"/api/v1/cameras/{public['id']}/preview", headers=headers()).status_code == 200
    )
    assert client.get(ROOT + "/cameras").status_code == 401
    other = login(client, "other")
    assert client.get(ROOT + "/cameras").json()["items"] == []
    path = ROOT + f"/cameras/{public['id']}/moderate"
    assert client.post(path, headers=other, json={"decision": "approved"}).status_code == 404
    csrf = login(client)
    queue = client.get(ROOT + "/cameras").json()
    assert queue["total"] == 1 and queue["items"][0]["id"] == public["id"]
    assert queue["items"][0]["source_url"] is None
    assert (
        client.post(
            ROOT + f"/cameras/{private['id']}/moderate", headers=csrf, json={"decision": "approved"}
        ).status_code
        == 404
    )
    assert client.post(path, json={"decision": "approved"}).status_code == 403
    for _ in range(2):
        assert client.post(path, headers=csrf, json={"decision": "approved"}).status_code == 200
    assert (
        client.post(
            path, headers=csrf, json={"decision": "rejected", "reason": "Changed"}
        ).status_code
        == 409
    )
    assert client.get(ROOT + "/cameras").json()["total"] == 0
    assert client.get(ROOT + "/cameras?status=approved").json()["total"] == 2
    neighbor = client.get(CAMERAS, headers=headers(102)).json()
    assert public["id"] in [c["id"] for c in neighbor]
    assert not next(c for c in neighbor if c["id"] == public["id"])["mine"]
    assert (
        client.get(f"/api/v1/cameras/{public['id']}/preview", headers=headers(102)).status_code
        == 200
    )
    assert (
        client.get(f"/api/v1/cameras/{public['id']}/preview", headers=headers(103)).status_code
        == 404
    )
    with Session(engine) as session:
        camera = session.get(HouseCamera, int(public["id"]))
        assert camera.reviewed_by == 1 and camera.reviewed_at is not None


def test_rejection_requires_reason_and_keeps_camera_private_to_owner(staff_api):
    client, _, _ = staff_api
    public = create(client, is_public=True)
    csrf = login(client)
    path = ROOT + f"/cameras/{public['id']}/moderate"
    assert client.post(path, headers=csrf, json={"decision": "rejected"}).status_code == 422
    result = client.post(
        path,
        headers=csrf,
        json={"decision": "rejected", "reason": "Камера направлена в окно квартиры"},
    )
    assert result.status_code == 200
    owner = next(
        c for c in client.get(CAMERAS, headers=headers()).json() if c["id"] == public["id"]
    )
    assert owner["moderation_status"] == "rejected" and owner["moderation_reason"]
    assert public["id"] not in [c["id"] for c in client.get(CAMERAS, headers=headers(102)).json()]
    assert (
        client.get(f"/api/v1/cameras/{public['id']}/preview", headers=headers(102)).status_code
        == 404
    )


def test_staff_camera_list_includes_existing_cameras_and_filters_scoped_public_only(staff_api):
    client, engine, _ = staff_api
    private = create(client)
    pending = create(client, is_public=True)
    with Session(engine) as session:
        session.add(HouseCamera(house_id=2, name="Другой дом", status="online", note=""))
        session.commit()
    login(client)
    all_cameras = client.get(ROOT + "/cameras?status=all").json()
    assert all_cameras["total"] == 2
    assert {c["id"] for c in all_cameras["items"]} == {"1", pending["id"]}
    legacy = next(c for c in all_cameras["items"] if c["id"] == "1")
    assert legacy["owner_name"] == "Камера дома" and legacy["source_url"] is None
    assert private["id"] not in {c["id"] for c in all_cameras["items"]}
    approved = client.get(ROOT + "/cameras?status=approved").json()
    assert [c["id"] for c in approved["items"]] == ["1"]
    page = client.get(ROOT + "/cameras?status=all&page_size=1&page=2").json()
    assert page["total"] == 2 and [c["id"] for c in page["items"]] == ["1"]
    assert client.get(ROOT + "/cameras?status=unknown").status_code == 422
    login(client, "other")
    assert client.get(ROOT + "/cameras?status=all").json()["total"] == 1


@pytest.mark.parametrize("kind", ["existing", "pending", "approved", "rejected"])
def test_staff_can_delete_public_cameras_only_with_house_access_and_csrf(staff_api, kind):
    client, engine, _ = staff_api
    payload = body(is_public=True)
    camera_id = (
        "1"
        if kind == "existing"
        else client.post(CAMERAS, headers=headers(), json=payload).json()["id"]
    )
    private = create(client)
    path = ROOT + f"/cameras/{camera_id}"
    assert client.delete(path).status_code == 401
    other = login(client, "other")
    assert client.delete(path, headers=other).status_code == 404
    csrf = login(client)
    assert client.delete(path).status_code == 403
    assert client.delete(ROOT + f"/cameras/{private['id']}", headers=csrf).status_code == 404
    if kind in ("approved", "rejected"):
        assert (
            client.post(
                path + "/moderate", headers=csrf, json={"decision": kind, "reason": "Проверено"}
            ).status_code
            == 200
        )
    for _ in range(2):
        assert client.delete(path, headers=csrf).status_code == 204
    for resident in (101, 102):
        assert camera_id not in [
            c["id"] for c in client.get(CAMERAS, headers=headers(resident)).json()
        ]
        assert (
            client.get(
                f"/api/v1/cameras/{camera_id}/preview", headers=headers(resident)
            ).status_code
            == 404
        )
    assert camera_id not in [
        c["id"] for c in client.get(ROOT + "/cameras?status=all").json()["items"]
    ]
    assert (
        client.post(path + "/moderate", headers=csrf, json={"decision": "approved"}).status_code
        == 404
    )
    with Session(engine) as session:
        assert session.get(HouseCamera, int(camera_id)).deleted_at is not None
    if kind != "existing":
        assert client.post(CAMERAS, headers=headers(), json=payload).status_code == 409


def test_deleted_demo_camera_does_not_return_when_demo_cameras_are_provisioned(staff_api):
    client, engine, _ = staff_api
    with Session(engine) as session:
        session.get(HouseCamera, 1).name = "Подъезд 1"
        session.commit()
    csrf = login(client)
    assert client.delete(ROOT + "/cameras/1", headers=csrf).status_code == 204

    async def provision():
        async with client.app.state.database.sessions.begin() as session:
            await provision_cameras(session, await session.get(House, 1))

    client.portal.call(provision)
    client.portal.call(provision)
    with Session(engine) as session:
        cameras = list(session.scalars(select(HouseCamera).where(HouseCamera.house_id == 1)))
        assert len(cameras) == 3
        assert next(c for c in cameras if c.name == "Подъезд 1").deleted_at is not None
    assert "Подъезд 1" not in [c["name"] for c in client.get(CAMERAS, headers=headers()).json()]


def test_camera_location_filters_apply_before_five_item_pagination(staff_api):
    client, engine, _ = staff_api
    cameras = [
        create(client, is_public=True, place={"entrance": entrance, "floor": floor, "zone": zone})
        for entrance, floor, zone in (
            (1, 1, "entrance"),
            (1, 2, "corridor"),
            (1, 2, "elevator"),
            (2, 2, "corridor"),
            (2, 3, "corridor"),
            (1, 3, "stairs"),
        )
    ]
    create(client, place={"entrance": 1, "floor": 2, "zone": "corridor"})
    with Session(engine) as session:
        session.add(
            HouseCamera(
                house_id=2,
                name="Чужая",
                status="online",
                note="",
                entrance=1,
                floor=2,
                zone="corridor",
            )
        )
        session.commit()
    login(client)
    house = client.get(ROOT + "/me").json()["houses"][0]
    assert house["entrances_count"] == 2 and house["floors_count"] == 3
    first = client.get(ROOT + "/cameras?status=all").json()
    second = client.get(ROOT + "/cameras?status=all&page=2").json()
    assert first["total"] == second["total"] == 7
    assert len(first["items"]) == 5 and len(second["items"]) == 2
    assert not {c["id"] for c in first["items"]} & {c["id"] for c in second["items"]}
    floor = client.get(ROOT + "/cameras?status=all&floor=2").json()
    assert floor["total"] == 3 and {c["id"] for c in floor["items"]} == {
        c["id"] for c in cameras[1:4]
    }
    combined = client.get(
        ROOT + "/cameras?status=pending&house_id=1&entrance=1&floor=2&zone=corridor"
    ).json()
    assert combined["total"] == 1 and combined["items"][0]["id"] == cameras[1]["id"]
    assert client.get(ROOT + "/cameras?status=all&house_id=2").json()["total"] == 0
    assert client.get(ROOT + "/cameras?status=approved&floor=2").json()["total"] == 0
    for invalid in ("floor=0", "floor=201", "entrance=0", "house_id=0"):
        assert client.get(ROOT + "/cameras?" + invalid).status_code == 422
