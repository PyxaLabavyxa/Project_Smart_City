import asyncio
from types import SimpleNamespace as NS
from unittest.mock import AsyncMock

from app.database.models import AnnouncementDelivery, HouseChat, StaffHouse
from chatbot.handlers import house_chats as handlers
from chatbot.services.house_chat_delivery import process_announcement, process_menu
from maxapi import Dispatcher, Router
from maxapi.types.errors import Error
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from tests.test_house_chats import BODY, connect
from tests.test_staff import ROOT, login

pytest_plugins = ["tests.test_api", "tests.test_staff"]


def bot_stub():
    return NS(
        get_me_from_chat=AsyncMock(
            return_value=NS(
                is_owner=False,
                is_admin=True,
                permissions=["write", "pin_message", "read_all_messages"],
            )
        ),
        send_message=AsyncMock(return_value=NS(message=NS(body=NS(mid="message-1")))),
        edit_message=AsyncMock(return_value=NS(success=True)),
        pin_message=AsyncMock(return_value=NS(success=True)),
    )


def pending_menu(engine):
    connect(engine)
    with Session(engine) as s:
        row = s.get(HouseChat, 1)
        row.menu_status = "pending"
        s.commit()


def queue(client):
    auth = login(client)
    draft = client.post(ROOT + "/announcements", json=BODY, headers=auth).json()
    response = client.post(
        ROOT + f"/announcements/{draft['id']}/send", json={"version": 1}, headers=auth
    )
    assert response.status_code == 200, response.text
    return auth, draft["id"]


def test_menu_once_and_restore_reuses_message(staff_api):
    client, engine, _ = staff_api
    pending_menu(engine)
    bot = bot_stub()
    sessions = client.app.state.database.sessions
    assert asyncio.run(process_menu(bot, sessions))
    assert not asyncio.run(process_menu(bot, sessions))
    assert bot.send_message.await_count == 1
    assert bot.send_message.call_args.kwargs["notify"] is False
    with Session(engine) as s:
        assert s.get(HouseChat, 1).menu_message_id == "message-1"
    auth = login(client)
    client.post(ROOT + "/max-chats/1/menu", headers=auth)
    asyncio.run(process_menu(bot, sessions))
    assert bot.send_message.await_count == 1 and bot.edit_message.await_count == 1
    assert bot.pin_message.await_count == 2


def test_only_explicit_announcements_are_delivered(staff_api):
    client, engine, _ = staff_api
    connect(engine)
    bot = bot_stub()
    sessions = client.app.state.database.sessions
    assert not asyncio.run(process_announcement(bot, sessions))
    queue(client)
    assert asyncio.run(process_announcement(bot, sessions))
    assert not asyncio.run(process_announcement(bot, sessions))
    assert bot.send_message.await_count == 1
    assert (
        bot.send_message.call_args.kwargs["text"]
        == "🔔 Уведомление от УК\n🔧 Ремонт и обслуживание дома\n\n"
        + BODY["title"] + "\n\n" + BODY["text"] + "\n\nУправляющая компания"
    )
    with Session(engine) as s:
        assert s.scalar(select(AnnouncementDelivery)).status == "sent"


def test_timeout_is_uncertain_and_never_automatically_resent(staff_api):
    client, engine, _ = staff_api
    connect(engine)
    bot = bot_stub()
    auth, aid = queue(client)
    bot.send_message.side_effect = TimeoutError()
    sessions = client.app.state.database.sessions
    asyncio.run(process_announcement(bot, sessions))
    assert not asyncio.run(process_announcement(bot, sessions))
    response = client.post(ROOT + f"/announcements/{aid}/retry", headers=auth)
    assert response.json()["deliveries"][0]["status"] == "uncertain"
    assert bot.send_message.await_count == 1


def test_max_refusal_is_retryable_only_after_connection_check(staff_api):
    client, engine, _ = staff_api
    connect(engine)
    bot = bot_stub()
    auth, aid = queue(client)
    bot.send_message.return_value = Error(code=403, raw={})
    asyncio.run(process_announcement(bot, client.app.state.database.sessions))
    result = client.get(ROOT + f"/announcements/{aid}").json()
    assert result["deliveries"][0]["status"] == "failed"
    assert client.post(ROOT + f"/announcements/{aid}/retry", headers=auth).status_code == 409


def test_disconnect_cancels_pending_delivery(staff_api):
    client, engine, _ = staff_api
    connect(engine)
    bot = bot_stub()
    auth, _ = queue(client)
    client.post(ROOT + "/max-chats/1/disconnect", headers=auth)
    assert not asyncio.run(process_announcement(bot, client.app.state.database.sessions))
    bot.send_message.assert_not_awaited()


def test_ordinary_group_messages_and_non_admin_codes_are_silent(staff_api, monkeypatch):
    client, engine, _ = staff_api
    bot = NS(get_chat_member=AsyncMock(return_value=NS(is_owner=False, is_admin=False)))
    message = NS(
        recipient=NS(chat_id=-100, chat_type="chat"),
        body=NS(text="Привет, соседи!"),
        answer=AsyncMock(),
    )
    event = NS(message=message, from_user=NS(user_id=444, is_bot=False), bot=bot)
    asyncio.run(handlers.group_message(event))
    bot.get_chat_member.assert_not_awaited()
    message.answer.assert_not_awaited()
    message.body.text = "/domoved " + "a" * 24
    asyncio.run(handlers.group_message(event))
    message.answer.assert_not_awaited()
    with Session(engine) as s:
        assert s.get(HouseChat, 1) is None


def test_dispatcher_keeps_group_messages_out_of_private_flows():
    private_calls = []
    private = Router()

    @private.message_created()
    async def private_message(event):
        private_calls.append(event)

    @private.message_callback()
    async def private_callback(event):
        private_calls.append(event)

    dispatcher = Dispatcher()
    dispatcher.include_routers(handlers.router, private)
    message = NS(recipient=NS(chat_id=-100, chat_type="chat"), body=NS(text="/start"))
    event = NS(update_type="message_created", message=message, get_ids=lambda: (-100, 444))
    asyncio.run(dispatcher.handle(event))
    assert private_calls == []
    event.update_type = "message_callback"
    asyncio.run(dispatcher.handle(event))
    assert private_calls == []
    message.recipient.chat_type = "dialog"
    asyncio.run(dispatcher.handle(event))
    assert private_calls == [event]


def test_revoked_staff_access_cancels_delivery(staff_api):
    client, engine, _ = staff_api
    connect(engine)
    queue(client)
    with Session(engine) as session:
        session.execute(delete(StaffHouse).where(StaffHouse.staff_id == 1))
        session.commit()
    bot = bot_stub()
    asyncio.run(process_announcement(bot, client.app.state.database.sessions))
    bot.send_message.assert_not_awaited()
    with Session(engine) as session:
        assert session.scalar(select(AnnouncementDelivery)).status == "cancelled"
