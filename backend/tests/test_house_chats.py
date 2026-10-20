import asyncio
from datetime import UTC, datetime, timedelta

import pytest
from app.database.models import AnnouncementDelivery, HouseChat
from app.services.house_chats import ConnectionError, code_hash, confirm_connection
from sqlalchemy import select
from sqlalchemy.orm import Session

from tests.test_staff import ROOT, login

pytest_plugins = ["tests.test_api", "tests.test_staff"]

BODY = {
    "topic": "works",
    "title": "Работы во дворе",
    "text": "Завтра с 10 до 12 часов.",
    "house_ids": [1],
}


def connect(engine, house=1, chat=-100):
    with Session(engine) as session:
        session.add(
            HouseChat(
                house_id=house,
                chat_id=chat,
                title="Домовой чат",
                status="connected",
                menu_status="ready",
                revision=1,
            )
        )
        session.commit()


def test_chat_access_and_one_time_code(staff_api):
    client, engine, _ = staff_api
    assert client.get(ROOT + "/max-chats").status_code == 401
    auth = login(client)
    assert [c["house_id"] for c in client.get(ROOT + "/max-chats").json()] == [1]
    assert client.post(ROOT + "/max-chats/1/code").status_code == 403
    assert client.post(ROOT + "/max-chats/2/code", headers=auth).status_code == 404
    first = client.post(ROOT + "/max-chats/1/code", headers=auth).json()["command"].split()[1]
    second = client.post(ROOT + "/max-chats/1/code", headers=auth).json()["command"].split()[1]
    assert first != second
    with Session(engine) as s:
        record = s.get(HouseChat, 1)
        assert record.code_hash == code_hash(second) and record.code_hash != second

    async def confirm():
        async with client.app.state.database.sessions() as s:
            with pytest.raises(ConnectionError):
                await confirm_connection(s, first, -100, "Группа", 444)
            await s.rollback()
            await confirm_connection(s, second, -100, "Группа", 444)
            with pytest.raises(ConnectionError):
                await confirm_connection(s, second, -100, "Группа", 444)

    asyncio.run(confirm())
    chat = client.get(ROOT + "/max-chats").json()[0]
    assert chat["status"] == "connected" and chat["menu_status"] == "pending"
    assert "code_hash" not in chat and "connected_by" not in chat
    assert client.post(ROOT + "/max-chats/1/code", headers=auth).status_code == 409


def test_expired_code_and_chat_already_owned(staff_api):
    client, engine, _ = staff_api
    auth = login(client)
    code = client.post(ROOT + "/max-chats/1/code", headers=auth).json()["command"].split()[1]
    with Session(engine) as s:
        row = s.get(HouseChat, 1)
        row.code_expires_at = datetime.now(UTC) - timedelta(seconds=1)
        s.commit()

    async def expired():
        async with client.app.state.database.sessions() as s:
            with pytest.raises(ConnectionError):
                await confirm_connection(s, code, -100, "Группа", 444)

    asyncio.run(expired())
    code = client.post(ROOT + "/max-chats/1/code", headers=auth).json()["command"].split()[1]
    connect(engine, 2, -100)

    async def collision():
        async with client.app.state.database.sessions() as s:
            with pytest.raises(ConnectionError):
                await confirm_connection(s, code, -100, "Группа", 444)

    asyncio.run(collision())
    assert client.get(ROOT + "/max-chats").json()[0]["chat_id"] is None


def test_draft_preview_publish_is_idempotent(staff_api):
    client, engine, _ = staff_api
    auth = login(client)
    response = client.post(ROOT + "/announcements", json=BODY, headers=auth)
    assert response.status_code == 201, response.text
    draft = response.json()
    path = ROOT + f"/announcements/{draft['id']}"
    assert draft["status"] == "draft" and draft["deliveries"][0]["status"] == "draft"
    assert client.post(path + "/send", json={"version": 1}, headers=auth).status_code == 409
    connect(engine)
    updated = client.put(
        path, json={**BODY, "title": "Изменённый заголовок", "version": 1}, headers=auth
    ).json()
    assert updated["version"] == 2
    assert client.post(path + "/send", json={"version": 1}, headers=auth).status_code == 409
    for _ in range(2):
        sent = client.post(path + "/send", json={"version": 2}, headers=auth)
        assert sent.status_code == 200, sent.text
        assert sent.json()["deliveries"][0]["status"] == "pending"
    assert client.put(path, json={**BODY, "version": 2}, headers=auth).status_code == 409
    with Session(engine) as s:
        deliveries = s.scalars(select(AnnouncementDelivery)).all()
        assert len(deliveries) == 1 and deliveries[0].chat_id == -100


def test_scope_validation_disconnect_and_uncertain_retry(staff_api):
    client, engine, _ = staff_api
    auth = login(client)
    assert (
        client.post(
            ROOT + "/announcements", json={**BODY, "house_ids": [1, 2]}, headers=auth
        ).status_code
        == 404
    )
    assert (
        client.post(
            ROOT + "/announcements", json={**BODY, "house_ids": [1, 1]}, headers=auth
        ).status_code
        == 422
    )
    assert (
        client.post(ROOT + "/announcements", json={**BODY, "text": "   "}, headers=auth).status_code
        == 422
    )
    connect(engine)
    draft = client.post(ROOT + "/announcements", json=BODY, headers=auth).json()
    path = ROOT + f"/announcements/{draft['id']}"
    client.post(path + "/send", json={"version": 1}, headers=auth)
    with Session(engine) as s:
        s.scalar(select(AnnouncementDelivery)).status = "uncertain"
        s.commit()
    assert (
        client.post(path + "/retry", headers=auth).json()["deliveries"][0]["status"] == "uncertain"
    )
    assert client.post(ROOT + "/max-chats/1/disconnect", headers=auth).status_code == 204
    assert client.get(ROOT + "/max-chats").json()[0]["chat_id"] is None
    login(client, "other")
    assert client.get(path).status_code == 404
    assert client.get(ROOT + "/announcements").json()["items"] == []
