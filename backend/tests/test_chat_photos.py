import json
from io import BytesIO
from uuid import uuid4

import pytest
from app.database.models import ApartmentMessage, ChatPhoto, IssueMessage, StaffNotification
from PIL import Image
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from tests.test_api import headers
from tests.test_staff import ROOT, login
from tests.test_staff_actions import registration_rows

pytest_plugins = ["tests.test_staff"]
NEIGHBOR = "/api/v1/apartments/1/messages"
ISSUE = "/api/v1/issues/1/messages"


def image(color="red"):
    content = BytesIO()
    Image.new("RGB", (24, 16), color).save(content, "PNG")
    return content.getvalue()


def upload(client, path, *, auth=None, data=None, files=None):
    return client.post(
        path + "/with-photos",
        data={"data": json.dumps(data or {"text": "", "request_id": str(uuid4())})},
        files=files or [("photos", ("test.png", image(), "image/png"))],
        headers=auth if auth is not None else headers(),
    )


def media(client):
    return sorted((client.app.state.settings.media_root / "chat").glob("*.jpg"))


def test_neighbor_photo_only_retry_and_private_access(staff_api):
    client, engine, _ = staff_api
    data = {"text": "", "recipient_id": 2, "request_id": str(uuid4())}
    sent = upload(client, NEIGHBOR, data=data)
    assert sent.status_code == 201, sent.text
    result = sent.json()
    assert result["text"] == "📷 Фотография"
    assert len(result["photos"]) == 1
    url = result["photos"][0]["url"]
    for user in (101, 102):
        photo = client.get(url, headers=headers(user))
        assert photo.status_code == 200
        assert photo.headers["content-type"] == "image/jpeg"
        assert "no-store" in photo.headers["cache-control"]
        with Image.open(BytesIO(photo.content)) as decoded:
            assert decoded.size == (24, 16)
    for user in (103, 104):
        assert client.get(url, headers=headers(user)).status_code == 404
    assert client.get(url).status_code == 401
    retry = upload(client, NEIGHBOR, data=data)
    assert retry.status_code == 201 and retry.json() == result
    conflict = upload(
        client,
        NEIGHBOR,
        data=data,
        files=[("photos", ("different.png", image("blue"), "image/png"))],
    )
    assert conflict.status_code == 409
    assert len(media(client)) == 1
    with Session(engine) as session:
        assert session.scalar(select(func.count()).select_from(ApartmentMessage)) == 1
        assert session.scalar(select(func.count()).select_from(ChatPhoto)) == 1
    incoming = client.get("/api/v1/apartments/2/messages", headers=headers(102)).json()["items"]
    assert incoming[0]["photos"] == result["photos"]
    assert incoming[0]["direction"] == "incoming"
    login(client)
    assert client.get(url.replace("/api/v1/", ROOT + "/")).status_code == 404


def test_issue_photos_are_shared_with_assigned_staff_only(staff_api):
    client, _, _ = staff_api
    data = {"text": "Вот место поломки", "request_id": str(uuid4())}
    result = upload(client, ISSUE, data=data)
    assert result.status_code == 200, result.text
    result = result.json()
    assert result["text"] == data["text"]
    url = result["photos"][0]["url"]
    assert client.get(url, headers=headers()).status_code == 200
    assert client.get(url, headers=headers(102)).status_code == 404
    assert upload(client, ISSUE, auth=headers(102)).status_code == 404
    assert client.get(ISSUE, headers=headers()).json()["items"][0]["photos"] == result["photos"]
    login(client)
    detail = client.get(ROOT + "/issues/1").json()
    staff_url = detail["messages"][0]["photos"][0]["url"]
    assert client.get(staff_url).status_code == 200
    login(client, "other")
    assert client.get(staff_url).status_code == 404
    assert len(media(client)) == 1


def test_staff_sends_photo_only_and_queues_one_notification(staff_api):
    client, engine, _ = staff_api
    csrf = login(client)
    data = {"text": "", "request_id": str(uuid4())}
    path = ROOT + "/issues/1/messages"
    sent = upload(client, path, data=data, auth=csrf)
    assert sent.status_code == 200, sent.text
    assert upload(client, path, data=data, auth=csrf).json() == sent.json()
    reply = client.get(ISSUE, headers=headers()).json()["items"][0]
    assert reply["direction"] == "staff" and len(reply["photos"]) == 1
    assert client.get(reply["photos"][0]["url"], headers=headers()).status_code == 200
    assert (
        upload(
            client,
            path,
            data=data,
            auth=csrf,
            files=[("photos", ("new.png", image("blue"), "image/png"))],
        ).status_code
        == 409
    )
    assert upload(client, path, auth={}).status_code == 403
    assert len(media(client)) == 1
    with Session(engine) as session:
        assert session.scalar(select(func.count()).select_from(IssueMessage)) == 1
        assert session.scalar(select(func.count()).select_from(StaffNotification)) == 1


@pytest.mark.parametrize("path", [NEIGHBOR, ISSUE, ROOT + "/issues/1/messages"])
def test_invalid_second_photo_leaves_no_partial_message_or_file(staff_api, path):
    client, engine, _ = staff_api
    auth = login(client) if path.startswith(ROOT) else headers()
    data = {"text": "Проверка", "request_id": str(uuid4())}
    if path == NEIGHBOR:
        data["recipient_id"] = 2
    result = upload(
        client,
        path,
        auth=auth,
        data=data,
        files=[
            ("photos", ("ok.png", image(), "image/png")),
            ("photos", ("bad.png", b"not-an-image", "image/png")),
        ],
    )
    assert result.status_code == 422, result.text
    assert not media(client)
    with Session(engine) as session:
        assert session.scalar(select(func.count()).select_from(ChatPhoto)) == 0
        assert session.scalar(select(func.count()).select_from(ApartmentMessage)) == 0
        assert session.scalar(select(func.count()).select_from(IssueMessage)) == 0


def test_upload_limits_and_recipient_validation(staff_api):
    client, _, _ = staff_api
    data = {"text": "x", "recipient_id": 3, "request_id": str(uuid4())}
    assert upload(client, NEIGHBOR, data=data).status_code == 422
    assert not media(client)
    data["recipient_id"] = 2
    files = [("photos", (f"{i}.png", image(), "image/png")) for i in range(11)]
    assert upload(client, NEIGHBOR, data=data, files=files).status_code == 400
    assert not media(client)
    assert (
        client.post(ISSUE + "/with-photos", data={"data": "{}"}, headers=headers()).status_code
        == 422
    )


def test_photo_retry_cannot_be_replaced_by_text_only(staff_api):
    client, _, _ = staff_api
    data = {"text": "Фото", "request_id": str(uuid4())}
    assert upload(client, ISSUE, data=data).status_code == 200
    assert client.post(ISSUE, json=data, headers=headers()).status_code == 409
    data = {**data, "request_id": str(uuid4()), "recipient_id": 2}
    assert upload(client, NEIGHBOR, data=data).status_code == 201
    assert client.post(NEIGHBOR, json=data, headers=headers()).status_code == 409


def test_deleting_author_removes_owned_chat_files_but_keeps_neighbor_files(staff_api):
    client, engine, _ = staff_api
    registration_rows(engine)
    assert upload(client, ISSUE).status_code == 200
    data = {"text": "Фото", "recipient_id": 2, "request_id": str(uuid4())}
    assert upload(client, NEIGHBOR, data=data).status_code == 201
    data = {**data, "recipient_id": 1, "request_id": str(uuid4())}
    incoming = upload(client, "/api/v1/apartments/2/messages", data=data, auth=headers(102))
    assert incoming.status_code == 201
    csrf = login(client)
    assert upload(client, ROOT + "/issues/1/messages", auth=csrf).status_code == 200
    assert len(media(client)) == 4
    deleted = client.delete(ROOT + "/registrations/1/user", headers=csrf)
    assert deleted.status_code == 204, deleted.text
    assert len(media(client)) == 1
    with Session(engine) as session:
        assert session.scalar(select(func.count()).select_from(ChatPhoto)) == 1
    assert client.get(incoming.json()["photos"][0]["url"], headers=headers(102)).status_code == 200
