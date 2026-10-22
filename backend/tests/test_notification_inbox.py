import asyncio
from datetime import UTC, datetime, timedelta
from unittest.mock import AsyncMock
from uuid import uuid4

from app.database.models import (
    AnnouncementDelivery,
    InboxNotification,
    MiniAppPresence,
    StaffHouse,
    StaffNotification,
    User,
)
from sqlalchemy import select
from sqlalchemy.orm import Session

from tests.test_api import headers, issue_body
from tests.test_house_chats import BODY, connect
from tests.test_staff import ROOT, login, status_body

pytest_plugins = ["tests.test_staff"]
INBOX = "/api/v1/me/inbox"


def insert(engine, **values):
    with Session(engine) as session:
        row = InboxNotification(
            event_key=str(uuid4()),
            kind="issue_status",
            title="Статус заявки",
            body="В работе",
            **values,
        )
        session.add(row)
        session.commit()
        return row.id


def test_resident_inbox_auth_isolation_and_idempotent_read(api):
    client, engine, _ = api
    mine = insert(engine, user_id=1, house_id=1)
    other = insert(engine, user_id=2, house_id=1)
    with Session(engine) as session:
        session.get(InboxNotification, mine).title = "Обращение №11 — в работе"
        session.commit()
    assert client.get(INBOX).status_code == 401
    result = client.get(INBOX, headers=headers()).json()
    assert [row["id"] for row in result["items"]] == [mine]
    assert result["unread_count"] == 1
    assert result["items"][0]["title"] == "Изменён статус вашего обращения №11: в работе"
    with Session(engine) as session:
        assert session.get(InboxNotification, mine).title == "Обращение №11 — в работе"
    assert client.post(f"{INBOX}/{other}/read", json={}, headers=headers()).status_code == 404
    for _ in range(2):
        response = client.post(f"{INBOX}/{mine}/read", json={}, headers=headers())
        assert response.status_code == 200 and response.json()["unread_count"] == 0
    assert client.get(INBOX + "?unread_only=true", headers=headers()).json()["items"] == []
    assert client.get(INBOX, headers=headers()).json()["items"][0]["read_at"]


def test_read_all_uses_snapshot_does_not_erase_arriving_events_and_paginates(api):
    client, engine, _ = api
    ids = [insert(engine, user_id=1) for _ in range(5)]
    page = client.get(INBOX + "?limit=2", headers=headers()).json()
    assert [row["id"] for row in page["items"]] == ids[-2:][::-1]
    second = client.get(f"{INBOX}?limit=2&before={page['next_cursor']}", headers=headers()).json()
    assert [row["id"] for row in second["items"]] == ids[1:3][::-1]
    latest = insert(engine, user_id=1)
    assert (
        client.post(
            INBOX + "/read-all", json={"through_id": page["snapshot_id"]}, headers=headers()
        ).json()["unread_count"]
        == 1
    )
    assert [
        row["id"]
        for row in client.get(INBOX + "?unread_only=true", headers=headers()).json()["items"]
    ] == [latest]
    assert client.get(INBOX + "?limit=0", headers=headers()).status_code == 422


def test_staff_inbox_assignment_revocation_and_csrf(staff_api):
    client, engine, _ = staff_api
    own = insert(engine, staff_id=1, house_id=1)
    insert(engine, staff_id=1, house_id=2)
    insert(engine, staff_id=2, house_id=1)
    assert client.get(ROOT + "/inbox").status_code == 401
    auth = login(client)
    assert [row["id"] for row in client.get(ROOT + "/inbox").json()["items"]] == [own]
    assert client.post(f"{ROOT}/inbox/{own}/read", json={}).status_code == 403
    assert (
        client.post(f"{ROOT}/inbox/{own}/read", json={}, headers=auth).json()["unread_count"] == 0
    )
    with Session(engine) as session:
        session.delete(session.scalar(select(StaffHouse).where(StaffHouse.staff_id == 1)))
        session.commit()
    assert client.get(ROOT + "/inbox").json()["items"] == []
    assert client.post(f"{ROOT}/inbox/{own}/read", json={}, headers=auth).status_code == 404


def test_personal_message_history_survives_online_and_disabled_bot_and_retry(staff_api):
    client, engine, _ = staff_api
    with Session(engine) as session:
        session.get(User, 2).notify_personal_messages = False
        session.add(
            MiniAppPresence(
                user_id=2,
                client_id=str(uuid4()),
                sequence=1,
                expires_at=datetime.now(UTC) + timedelta(minutes=1),
            )
        )
        session.commit()
    request = {"recipient_id": 2, "text": "Здравствуйте, соседи", "request_id": str(uuid4())}
    for _ in range(2):
        assert (
            client.post(
                "/api/v1/apartments/1/messages", json=request, headers=headers()
            ).status_code
            == 201
        )
    page = client.get(INBOX, headers=headers(102)).json()
    assert len(page["items"]) == page["unread_count"] == 1
    assert page["items"][0]["href"] == "/messages/7"
    assert page["items"][0]["apartment_id"] == 2
    assert client.get(INBOX, headers=headers()).json()["items"] == []


def test_issue_status_and_reply_atomic_dedup_and_no_group_spam(staff_api):
    client, engine, _ = staff_api
    auth = login(client)
    body = status_body()
    for _ in range(2):
        assert client.post(ROOT + "/issues/1/status", json=body, headers=auth).status_code == 200
    message = {"text": "Мастер уже выехал", "request_id": str(uuid4())}
    for _ in range(2):
        assert (
            client.post(ROOT + "/issues/1/messages", json=message, headers=auth).status_code == 200
        )
    rows = client.get(INBOX, headers=headers()).json()["items"]
    assert {row["kind"] for row in rows} == {"issue_status", "issue_message"}
    assert len(rows) == 2 and rows[0]["href"] == "/issues/1/chat"
    assert client.get(INBOX, headers=headers(102)).json()["items"] == []
    with Session(engine) as session:
        assert not session.scalar(select(AnnouncementDelivery))


def test_new_issue_and_resident_reply_reach_only_assigned_staff(staff_api):
    client, engine, _ = staff_api
    request = issue_body()
    for _ in range(2):
        response = client.post("/api/v1/houses/1/issues", json=request, headers=headers())
        assert response.status_code == 201, response.text
    issue_id = response.json()["id"]
    message = {"text": "Уточнение для диспетчера", "request_id": str(uuid4())}
    for _ in range(2):
        assert (
            client.post(
                f"/api/v1/issues/{issue_id}/messages", json=message, headers=headers()
            ).status_code
            == 200
        )
    login(client)
    rows = client.get(ROOT + "/inbox").json()["items"]
    assert len(rows) == 2 and {row["kind"] for row in rows} == {"issue_created", "resident_message"}
    login(client, "other")
    assert client.get(ROOT + "/inbox").json()["items"] == []


def test_published_group_announcement_in_app_even_without_bot_dialog(staff_api):
    client, engine, _ = staff_api
    connect(engine)
    auth = login(client)
    draft = client.post(ROOT + "/announcements", json=BODY, headers=auth).json()
    assert client.get(INBOX, headers=headers()).json()["items"] == []
    for _ in range(2):
        response = client.post(
            f"{ROOT}/announcements/{draft['id']}/send",
            json={"version": draft["version"]},
            headers=auth,
        )
        assert response.status_code == 200, response.text
    for resident in (101, 102):
        rows = client.get(INBOX, headers=headers(resident)).json()["items"]
        assert (
            len(rows) == 1 and rows[0]["kind"] == "announcement" and rows[0]["body"] == BODY["text"]
        )
    assert client.get(INBOX, headers=headers(103)).json()["items"] == []


def test_online_status_stays_in_inbox_without_false_read_receipt(staff_api):
    from chatbot.services.staff_notifications import deliver_pending

    client, engine, _ = staff_api
    auth = login(client)
    assert (
        client.post(ROOT + "/issues/1/status", json=status_body(), headers=auth).status_code == 200
    )
    with Session(engine) as session:
        session.add(
            MiniAppPresence(
                user_id=1,
                client_id=str(uuid4()),
                sequence=1,
                expires_at=datetime.now(UTC) + timedelta(minutes=1),
            )
        )
        session.commit()
    bot = AsyncMock()
    assert asyncio.run(deliver_pending(bot, client.app.state.database.sessions)) == 0
    bot.send_message.assert_not_called()
    assert client.get(INBOX, headers=headers()).json()["unread_count"] == 1
    delivery = client.get(ROOT + "/issues/1").json()["notifications"][0]
    assert delivery["delivery"] == "in_app"
    with Session(engine) as session:
        assert session.scalar(select(StaffNotification)).suppression_reason == "online"


def test_rejected_issue_reason_is_readable_without_dead_link(staff_api):
    from tests.test_staff_actions import rejection

    client, _, _ = staff_api
    auth = login(client)
    assert client.post(ROOT + "/issues/1/reject", json=rejection(), headers=auth).status_code == 200
    assert client.get("/api/v1/issues/1", headers=headers()).status_code == 404
    event = client.get(INBOX, headers=headers()).json()["items"][0]
    assert event["href"] == "/issues" and rejection()["reason"] in event["body"]


def test_camera_request_and_review_do_not_leak_camera_credentials(staff_api, monkeypatch):
    from smart_city_api.services import camera_media
    from tests.test_resident_cameras import body

    client, _, _ = staff_api
    monkeypatch.setattr(camera_media, "frame", AsyncMock(return_value=b"\xff\xd8frame\xff\xd9"))
    response = client.post(
        "/api/v1/houses/1/cameras",
        headers=headers(),
        json=body(is_public=True, password="private-password"),
    )
    assert response.status_code == 201, response.text
    auth = login(client)
    events = client.get(ROOT + "/inbox").json()["items"]
    assert len(events) == 1 and events[0]["kind"] == "camera_request"
    assert "private-password" not in str(events) and "token=test" not in str(events)
    camera = client.get(ROOT + "/cameras").json()["items"]
    target = next(row for row in camera if str(row["id"]) == str(response.json()["id"]))
    decision = client.post(
        f"{ROOT}/cameras/{target['id']}/moderate", headers=auth, json={"decision": "approved"}
    )
    assert decision.status_code == 200, decision.text
    assert client.get(INBOX, headers=headers()).json()["items"][0]["kind"] == "camera_review"


def test_registration_queue_and_decision(staff_api):
    from tests.test_registration import BODY as REGISTRATION
    from tests.test_registration import install_catalog

    client, engine, _ = staff_api
    install_catalog(engine)
    client.app.state.settings.onboarding_test_mode = False
    response = client.post("/api/v1/registration", headers=headers(104), json=REGISTRATION)
    assert response.status_code == 200, response.text
    auth = login(client)
    assert client.get(ROOT + "/inbox").json()["items"][0]["kind"] == "registration"
    assert client.post(ROOT + "/registrations/1/approve", headers=auth).status_code == 200
    assert client.get(INBOX, headers=headers(104)).json()["items"][0]["kind"] == "registration"


def test_private_announcement_to_one_resident_is_not_duplicated_when_online(staff_api):
    from chatbot.services.house_chat_delivery import process_private_announcement

    from tests.test_private_announcements import draft, enable, publish

    client, engine, _ = staff_api
    enable(engine)
    auth, item = draft(client, audience="residents", resident_ids=[1])
    publish(client, auth, item)
    with Session(engine) as session:
        session.add(
            MiniAppPresence(
                user_id=1,
                client_id=str(uuid4()),
                sequence=1,
                expires_at=datetime.now(UTC) + timedelta(minutes=1),
            )
        )
        session.commit()
    bot = AsyncMock()
    assert asyncio.run(process_private_announcement(bot, client.app.state.database.sessions))
    bot.send_message.assert_not_called()
    assert client.get(INBOX, headers=headers()).json()["unread_count"] == 1
    assert client.get(INBOX, headers=headers(102)).json()["items"] == []


def test_manual_issue_for_resident_goes_to_inbox_and_other_assigned_staff(staff_api):
    from app.database.models import StaffUser

    from tests.test_staff_reports import report

    client, engine, _ = staff_api
    with Session(engine) as session:
        colleague = StaffUser(login="colleague", name="Коллега", password_hash="unused")
        session.add(colleague)
        session.flush()
        colleague_id = colleague.id
        session.add(StaffHouse(staff_id=colleague_id, house_id=1))
        session.commit()
    auth = login(client)
    request = report()
    for _ in range(2):
        response = client.post(ROOT + "/issues", json=request, headers=auth)
        assert response.status_code == 201, response.text
    assert client.get(INBOX, headers=headers()).json()["items"][0]["kind"] == "issue_created"
    assert client.get(ROOT + "/inbox").json()["items"] == []  # Creator already knows.
    with Session(engine) as session:
        rows = list(
            session.scalars(
                select(InboxNotification).where(InboxNotification.staff_id == colleague_id)
            )
        )
        assert len(rows) == 1 and rows[0].kind == "issue_created"


def test_disabled_bot_preference_keeps_inbox_and_is_not_reported_as_read(staff_api):
    from chatbot.services.staff_notifications import deliver_pending

    client, engine, _ = staff_api
    with Session(engine) as session:
        session.get(User, 1).notify_issue_statuses = False
        session.commit()
    auth = login(client)
    assert (
        client.post(ROOT + "/issues/1/status", json=status_body(), headers=auth).status_code == 200
    )
    bot = AsyncMock()
    assert asyncio.run(deliver_pending(bot, client.app.state.database.sessions)) == 0
    bot.send_message.assert_not_called()
    assert client.get(INBOX, headers=headers()).json()["unread_count"] == 1
    assert client.get(ROOT + "/issues/1").json()["notifications"][0]["delivery"] == "muted"


def test_legacy_pending_bot_event_without_inbox_is_not_lost_while_online(staff_api):
    from chatbot.services.staff_notifications import deliver_pending
    from sqlalchemy import delete

    client, engine, _ = staff_api
    auth = login(client)
    assert (
        client.post(ROOT + "/issues/1/status", json=status_body(), headers=auth).status_code == 200
    )
    with Session(engine) as session:
        session.execute(delete(InboxNotification))  # Simulate a queued event from before migration.
        session.add(
            MiniAppPresence(
                user_id=1,
                client_id=str(uuid4()),
                sequence=1,
                expires_at=datetime.now(UTC) + timedelta(minutes=1),
            )
        )
        session.commit()
    bot = AsyncMock()
    bot.send_message.return_value = object()
    assert asyncio.run(deliver_pending(bot, client.app.state.database.sessions)) == 1
    bot.send_message.assert_awaited_once()
