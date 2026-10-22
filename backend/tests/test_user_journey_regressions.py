import asyncio
from unittest.mock import AsyncMock
from uuid import uuid4

from sqlalchemy import delete, select
from sqlalchemy.orm import Session
from tests.test_api import headers

from app.database.models import InboxNotification, MessageNotification, UserApartment

pytest_plugins = ["tests.test_api", "tests.test_staff"]


def send(client, text):
    response = client.post(
        "/api/v1/apartments/1/messages",
        headers=headers(),
        json={"recipient_id": 2, "text": text, "request_id": str(uuid4())},
    )
    assert response.status_code == 201
    return response.json()["id"]


def test_queued_message_is_suppressed_after_recipient_membership_is_revoked(api):
    from smart_city_api.db.session import Database

    from chatbot.services.message_notifications import deliver_pending

    client, engine, _ = api
    send(client, "До отзыва доступа")
    with Session(engine) as session:
        session.execute(delete(UserApartment).where(UserApartment.user_id == 2))
        session.commit()
    assert client.get("/api/v1/apartments/2/messages", headers=headers(102)).status_code == 404

    async def check():
        db = Database(client.app.state.settings.database_url.get_secret_value())
        bot = AsyncMock()
        try:
            await deliver_pending(bot, db.sessions)
            bot.send_message.assert_not_called()
        finally:
            await db.close()

    asyncio.run(check())
    with Session(engine) as session:
        assert session.scalar(select(MessageNotification)).suppressed_at is not None


def test_read_conversation_marks_only_displayed_incoming_messages_for_this_resident(api):
    client, engine, _ = api
    first = send(client, "Прочитано")
    later = send(client, "Ещё не показано")
    with Session(engine) as session:
        session.add(UserApartment(user_id=4, apartment_id=2))
        session.add(
            InboxNotification(
                user_id=4,
                event_key=f"apartment-message:{first}",
                kind="personal_message",
                title="Сообщение",
                body="",
            )
        )
        session.commit()
    body = {"apartment_id": 2, "sender_number": 7, "through_message_id": first}
    path = "/api/v1/me/inbox/read-conversation"
    assert client.post(path, headers=headers(), json=body).status_code == 404
    for _ in range(2):
        response = client.post(path, headers=headers(102), json=body)
        assert response.status_code == 200, response.text
        assert response.json()["unread_count"] == 1
    with Session(engine) as session:
        rows = session.scalars(select(InboxNotification).order_by(InboxNotification.id)).all()
        assert rows[0].read_at is not None
        assert rows[1].event_key == f"apartment-message:{later}" and rows[1].read_at is None
        assert rows[2].user_id == 4 and rows[2].read_at is None
        queued = session.scalars(select(MessageNotification).order_by(MessageNotification.id)).all()
        assert queued[0].suppressed_at is not None and queued[1].suppressed_at is None
    assert (
        client.post(path, headers=headers(102), json={**body, "sender_number": 19}).status_code
        == 404
    )
    with Session(engine) as session:
        session.execute(delete(UserApartment).where(UserApartment.user_id == 2))
        session.commit()
    assert client.post(path, headers=headers(102), json=body).status_code == 404


def test_queued_uk_reply_is_suppressed_after_house_membership_is_revoked(staff_api):
    from smart_city_api.db.session import Database
    from tests.test_staff import ROOT, login

    from app.database.models import StaffNotification
    from chatbot.services.staff_notifications import deliver_pending

    client, engine, _ = staff_api
    auth = login(client)
    response = client.post(
        ROOT + "/issues/1/messages",
        headers=auth,
        json={"text": "Ответ УК до удаления квартиры", "request_id": str(uuid4())},
    )
    assert response.status_code == 200
    with Session(engine) as session:
        session.execute(delete(UserApartment).where(UserApartment.user_id == 1))
        session.commit()

    async def check():
        db = Database(client.app.state.settings.database_url.get_secret_value())
        bot = AsyncMock()
        try:
            await deliver_pending(bot, db.sessions)
            bot.send_message.assert_not_called()
        finally:
            await db.close()

    asyncio.run(check())
    with Session(engine) as session:
        assert session.scalar(select(StaffNotification)).suppression_reason == "access"
