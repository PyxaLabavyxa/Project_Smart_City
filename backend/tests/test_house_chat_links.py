import asyncio
from types import SimpleNamespace as NS
from unittest.mock import AsyncMock

import pytest
from app.database.models import HouseChat
from app.services.house_chats import confirm_connection, normalize_chat_link
from chatbot.services.house_chat_delivery import process_menu
from chatbot.services.house_chat_links import refresh_one_link
from maxapi.types.errors import Error
from sqlalchemy.orm import Session

from tests.test_api import headers
from tests.test_house_chat_delivery import bot_stub, pending_menu
from tests.test_house_chats import connect
from tests.test_staff import ROOT, login

pytest_plugins = ["tests.test_api", "tests.test_staff"]
LINK = "https://max.ru/join/House_1-token"


def test_resident_group_is_scoped_and_absence_is_normal(api):
    client, engine, _ = api
    path = "/api/v1/houses/1/chat"
    assert client.get(path).status_code == 401
    assert client.get(path, headers=headers(103)).status_code == 404
    assert client.get(path, headers=headers(104)).status_code == 404
    assert client.get(path, headers=headers()).json() == {
        "status": "not_connected",
        "title": "Общий чат дома",
        "join_url": None,
    }
    connect(engine)
    assert client.get(path, headers=headers()).json()["status"] == "link_missing"
    with Session(engine) as s:
        row = s.get(HouseChat, 1)
        row.platform_link, row.menu_status = LINK, "pending"
        s.commit()
    data = client.get(path, headers=headers()).json()
    assert data == {"status": "available", "title": "Домовой чат", "join_url": LINK}
    assert client.get("/api/v1/houses/2/chat", headers=headers()).status_code == 404
    with Session(engine) as s:
        row = s.get(HouseChat, 1)
        row.status, row.error = "attention", "Internal connection detail"
        s.commit()
    assert client.get(path, headers=headers()).json() == {
        "status": "unavailable",
        "title": "Общий чат дома",
        "join_url": None,
    }


def test_staff_link_override_and_disconnect(staff_api):
    client, engine, _ = staff_api
    connect(engine)
    with Session(engine) as s:
        s.get(HouseChat, 1).platform_link = LINK
        s.commit()
    path = ROOT + "/max-chats/1/link"
    data = {"chat_id": -100, "revision": 1, "join_url": "https://max.ru/house_public"}
    assert client.put(path, json=data).status_code == 401
    auth = login(client)
    assert client.put(path, json=data).status_code == 403
    assert client.put(ROOT + "/max-chats/2/link", json=data, headers=auth).status_code == 404
    assert client.put(path, json=data, headers=auth).status_code == 204
    chat = client.get(ROOT + "/max-chats").json()[0]
    assert chat["join_url"] == chat["custom_join_url"] == data["join_url"]
    assert chat["revision"] == 1  # Updating a link must not cancel queued announcements.
    assert client.put(path, json={**data, "chat_id": -200}, headers=auth).status_code == 409
    assert client.put(path, json={**data, "revision": 2}, headers=auth).status_code == 409
    assert client.put(path, json={**data, "join_url": None}, headers=auth).status_code == 204
    chat = client.get(ROOT + "/max-chats").json()[0]
    assert chat["join_url"] == LINK and chat["custom_join_url"] is None
    assert client.post(ROOT + "/max-chats/1/disconnect", headers=auth).status_code == 204
    assert client.put(path, json=data, headers=auth).status_code == 409
    with Session(engine) as s:
        row = s.get(HouseChat, 1)
        assert row.platform_link is None and row.join_url is None


@pytest.mark.parametrize(
    "link",
    [
        "https://evil.example/join/123",
        "https://max.ru.evil.example/join/123",
        "https://max.ru@evil.example/join/123",
        "http://max.ru/join/123",
        "javascript:alert(1)",
        "https://max.ru/",
        "https://max.ru/join/123?startapp=foo",
        "https://max.ru/join/123#token",
        "https://max.ru:443/join/123",
        "https://max.ru/join/%2fabc",
        "https://max.ru/join/a\nb",
    ],
)
def test_invalid_links_are_rejected(staff_api, link):
    client, engine, _ = staff_api
    connect(engine)
    assert normalize_chat_link(link) is None
    response = client.put(
        ROOT + "/max-chats/1/link",
        headers=login(client),
        json={
            "chat_id": -100,
            "revision": 1,
            "join_url": link,
        },
    )
    assert response.status_code == 422


def test_connection_and_menu_refresh_capture_platform_links(staff_api):
    client, engine, _ = staff_api
    auth = login(client)
    code = client.post(ROOT + "/max-chats/1/code", headers=auth).json()["command"].split()[1]

    async def confirm():
        async with client.app.state.database.sessions() as s:
            await confirm_connection(s, code, -100, "Домовой чат", 1, link=LINK)

    asyncio.run(confirm())
    assert client.get(ROOT + "/max-chats").json()[0]["join_url"] == LINK
    bot = bot_stub()
    bot.get_chat_by_id = AsyncMock(return_value=NS(link="https://max.ru/join/new-token"))
    asyncio.run(process_menu(bot, client.app.state.database.sessions))
    assert client.get(ROOT + "/max-chats").json()[0]["join_url"] == "https://max.ru/join/new-token"


def test_metadata_failure_does_not_break_menu_or_staff_link(staff_api):
    client, engine, _ = staff_api
    pending_menu(engine)
    with Session(engine) as s:
        row = s.get(HouseChat, 1)
        row.join_url, row.platform_link = LINK, "https://max.ru/join/old"
        s.commit()
    bot = bot_stub()
    bot.get_chat_by_id = AsyncMock(side_effect=TimeoutError)
    asyncio.run(process_menu(bot, client.app.state.database.sessions))
    with Session(engine) as s:
        row = s.get(HouseChat, 1)
        assert row.menu_status == "ready" and row.join_url == LINK
        assert row.platform_link == "https://max.ru/join/old"


def test_background_check_backfills_existing_groups_without_messages(staff_api):
    client, engine, _ = staff_api
    connect(engine)
    with Session(engine) as s:
        s.get(HouseChat, 1).join_url = LINK
        s.commit()
    bot = NS(
        get_chat_by_id=AsyncMock(
            return_value=NS(status="active", link="https://max.ru/join/updated")
        )
    )

    async def check():
        assert await refresh_one_link(bot, client.app.state.database.sessions)
        assert not await refresh_one_link(bot, client.app.state.database.sessions)

    asyncio.run(check())
    assert bot.get_chat_by_id.await_count == 1
    with Session(engine) as s:
        row = s.get(HouseChat, 1)
        assert row.join_url == LINK and row.platform_link == "https://max.ru/join/updated"
        assert row.menu_status == "ready" and row.revision == 1


@pytest.mark.parametrize(
    "response,expected",
    [
        (NS(status="closed", link=None), "attention"),
        (NS(status="removed", link=None), "attention"),
        (Error(code=403, raw={}), "attention"),
        (Error(code=404, raw={}), "attention"),
        (Error(code=500, raw={}), "connected"),
    ],
)
def test_background_check_disables_only_confirmed_unavailable_groups(staff_api, response, expected):
    client, engine, _ = staff_api
    connect(engine)
    with Session(engine) as s:
        s.get(HouseChat, 1).platform_link = LINK
        s.commit()
    bot = NS(get_chat_by_id=AsyncMock(return_value=response))
    asyncio.run(refresh_one_link(bot, client.app.state.database.sessions))
    with Session(engine) as s:
        row = s.get(HouseChat, 1)
        assert row.status == expected
        assert row.platform_link == (LINK if expected == "connected" else None)


def test_slow_metadata_cannot_restore_a_disconnected_group(staff_api):
    client, engine, _ = staff_api
    connect(engine)

    async def metadata(**kwargs):
        with Session(engine) as s:
            row = s.get(HouseChat, 1)
            row.chat_id, row.status, row.revision = None, "disconnected", 2
            s.commit()
        return NS(status="active", link=LINK)

    bot = NS(get_chat_by_id=AsyncMock(side_effect=metadata))
    asyncio.run(refresh_one_link(bot, client.app.state.database.sessions))
    with Session(engine) as s:
        row = s.get(HouseChat, 1)
        assert row.platform_link is None and row.status == "disconnected"
