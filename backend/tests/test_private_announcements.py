import asyncio
from types import SimpleNamespace as NS
from unittest.mock import AsyncMock

import pytest
from app.database.models import AnnouncementPrivateDelivery, User, UserApartment
from chatbot.middlewares.private_dialog import PrivateDialogMiddleware, record_dialog
from chatbot.services.house_chat_delivery import process_private_announcement
from maxapi.types.errors import Error
from sqlalchemy import select
from sqlalchemy.orm import Session

from tests.test_house_chat_delivery import bot_stub
from tests.test_house_chats import BODY
from tests.test_staff import ROOT, login

pytest_plugins = ["tests.test_api", "tests.test_staff"]


def enable(engine, *, opt_out=False):
    with Session(engine) as session:
        session.get(User, 1).bot_dialog_started = True
        session.get(User, 2).bot_dialog_started = True
        session.get(User, 2).notify_announcements = not opt_out
        session.add(UserApartment(user_id=1, apartment_id=2))
        session.commit()


def draft(client, **overrides):
    auth = login(client)
    response = client.post(
        ROOT + "/announcements", json={**BODY, "channels": ["private"], **overrides}, headers=auth
    )
    assert response.status_code == 201, response.text
    return auth, response.json()


def publish(client, auth, item):
    response = client.post(
        ROOT + f"/announcements/{item['id']}/send", json={"version": item["version"]}, headers=auth
    )
    assert response.status_code == 200, response.text
    return response.json()


def test_scoped_choices_and_explicit_people_validation(staff_api):
    client, engine, _ = staff_api
    auth = login(client)
    result = client.get(ROOT + "/announcement-residents").json()
    assert {r["id"] for r in result["items"]} == {1, 2}
    assert not any(r["available"] for r in result["items"])
    assert client.get(ROOT + "/announcement-residents?q=101").json()["items"][0]["id"] == 1
    base = {**BODY, "channels": ["private"], "audience": "residents"}
    assert client.post(ROOT + "/announcements", json=base, headers=auth).status_code == 422
    assert (
        client.post(
            ROOT + "/announcements", json={**base, "resident_ids": [3]}, headers=auth
        ).status_code
        == 404
    )
    assert (
        client.post(
            ROOT + "/announcements",
            json={**base, "resident_ids": [1], "channels": ["groups", "private"]},
            headers=auth,
        ).status_code
        == 422
    )


def test_private_draft_freezes_deduplicated_eligible_recipients(staff_api):
    client, engine, _ = staff_api
    enable(engine, opt_out=True)
    auth, item = draft(client)
    assert item["deliveries"] == [] and item["excluded_count"] == 1
    assert [d["user_id"] for d in item["private_deliveries"]] == [1]
    with Session(engine) as session:
        session.get(User, 2).notify_announcements = True
        session.commit()
    for _ in range(2):
        assert len(publish(client, auth, item)["private_deliveries"]) == 1
    bot = bot_stub()
    sessions = client.app.state.database.sessions
    assert asyncio.run(process_private_announcement(bot, sessions))
    assert not asyncio.run(process_private_announcement(bot, sessions))
    bot.send_message.assert_awaited_once_with(
        user_id=101,
        text=BODY["title"] + "\n\n" + BODY["text"] + "\n\nУправляющая компания",
        notify=True,
    )


def test_one_selected_resident_is_not_a_house_broadcast(staff_api):
    client, engine, _ = staff_api
    enable(engine)
    auth, item = draft(client, audience="residents", resident_ids=[2])
    publish(client, auth, item)
    bot = bot_stub()
    asyncio.run(process_private_announcement(bot, client.app.state.database.sessions))
    assert bot.send_message.call_args.kwargs["user_id"] == 102
    assert not asyncio.run(process_private_announcement(bot, client.app.state.database.sessions))


def test_opt_out_is_checked_again_before_publish_and_delivery(staff_api):
    client, engine, _ = staff_api
    enable(engine)
    auth, item = draft(client, audience="residents", resident_ids=[1])
    publish(client, auth, item)
    with Session(engine) as session:
        session.get(User, 1).notify_announcements = False
        session.commit()
    bot = bot_stub()
    asyncio.run(process_private_announcement(bot, client.app.state.database.sessions))
    bot.send_message.assert_not_awaited()
    with Session(engine) as session:
        assert session.scalar(select(AnnouncementPrivateDelivery)).status == "cancelled"
    auth, empty = draft(client, audience="residents", resident_ids=[1])
    assert (
        client.post(
            ROOT + f"/announcements/{empty['id']}/send", json={"version": 1}, headers=auth
        ).status_code
        == 409
    )


@pytest.mark.parametrize(
    "failure,status", [(TimeoutError(), "uncertain"), (Error(code=403, raw={}), "failed")]
)
def test_private_failures_never_trigger_unrequested_repeats(staff_api, failure, status):
    client, engine, _ = staff_api
    enable(engine)
    auth, item = draft(client, audience="residents", resident_ids=[1])
    publish(client, auth, item)
    bot = bot_stub()
    if isinstance(failure, Exception):
        bot.send_message.side_effect = failure
    else:
        bot.send_message.return_value = failure
    sessions = client.app.state.database.sessions
    asyncio.run(process_private_announcement(bot, sessions))
    assert not asyncio.run(process_private_announcement(bot, sessions))
    assert bot.send_message.await_count == 1
    result = client.get(ROOT + f"/announcements/{item['id']}").json()
    assert result["private_deliveries"][0]["status"] == status
    retry = client.post(ROOT + f"/announcements/{item['id']}/retry", headers=auth)
    assert retry.status_code == (409 if status == "failed" else 200)


def test_private_dialog_tracking_ignores_group_events(monkeypatch):
    from chatbot.middlewares import private_dialog

    record = AsyncMock()
    monkeypatch.setattr(private_dialog, "record_dialog", record)
    middleware = PrivateDialogMiddleware()
    handler = AsyncMock()
    event = NS(
        update_type="message_created",
        message=NS(recipient=NS(chat_type="chat")),
        from_user=NS(user_id=101),
    )
    asyncio.run(middleware(handler, event, {}))
    record.assert_not_awaited()
    event.message.recipient.chat_type = "dialog"
    asyncio.run(middleware(handler, event, {}))
    record.assert_awaited_once_with(101, True)


def test_dialog_flag_can_be_restored_after_user_opens_bot(staff_api):
    client, engine, _ = staff_api
    asyncio.run(record_dialog(101, True, client.app.state.database.sessions))
    with Session(engine) as session:
        assert session.get(User, 1).bot_dialog_started
    asyncio.run(record_dialog(101, False, client.app.state.database.sessions))
    with Session(engine) as session:
        assert not session.get(User, 1).bot_dialog_started
