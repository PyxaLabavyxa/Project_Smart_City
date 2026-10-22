import asyncio
from datetime import UTC, datetime, timedelta
from unittest.mock import AsyncMock

import pytest
from app.database.models import (
    Announcement,
    AnnouncementDelivery,
    AnnouncementPrivateDelivery,
    HouseWork,
    StaffHouse,
    User,
    UserApartment,
)
from chatbot.services.house_chat_delivery import process_announcement, process_private_announcement
from maxapi.types.errors import Error
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from tests.test_api import headers
from tests.test_house_chat_delivery import bot_stub
from tests.test_house_chats import BODY, connect
from tests.test_private_announcements import enable
from tests.test_staff import ROOT, login

pytest_plugins = ["tests.test_api", "tests.test_staff"]


def body(**overrides):
    start = datetime.now(UTC).replace(microsecond=0) + timedelta(days=1)
    return {
        **BODY,
        "channels": ["private"],
        "work": {
            "starts_at": start.isoformat(),
            "ends_at": (start + timedelta(hours=2)).isoformat(),
            "location": "Подъезд 1 · водоснабжение",
        },
        **overrides,
    }


def create(client, auth, data):
    result = client.post(ROOT + "/announcements", json=data, headers=auth)
    assert result.status_code == 201, result.text
    return result.json()


def send(client, auth, draft):
    result = client.post(
        ROOT + f"/announcements/{draft['id']}/send",
        json={"version": draft["version"]},
        headers=auth,
    )
    assert result.status_code == 200, result.text
    return result.json()


def test_work_is_published_atomically_once_in_each_house_and_private_audience_is_deduplicated(
    staff_api,
):
    client, engine, _ = staff_api
    enable(engine)
    with Session(engine) as session:
        session.add(StaffHouse(staff_id=1, house_id=2))
        session.add(UserApartment(user_id=1, apartment_id=3))
        session.commit()
    auth = login(client)
    draft = create(client, auth, body(house_ids=[1, 2]))
    assert client.get("/api/v1/houses/1/works", headers=headers()).json() == []
    result = send(client, auth, draft)
    send(client, auth, draft)
    assert {d["user_id"] for d in result["private_deliveries"]} == {1, 2}
    with Session(engine) as session:
        assert session.scalar(select(func.count()).select_from(HouseWork)) == 2
        assert session.scalar(select(func.count()).select_from(AnnouncementPrivateDelivery)) == 2
    first = client.get("/api/v1/houses/1/works", headers=headers()).json()[0]
    second = client.get("/api/v1/houses/2/works", headers=headers(103)).json()[0]
    assert first["title"] == second["title"] == BODY["title"]
    assert first["description"] == BODY["text"]
    assert first["starts_at"].endswith("Z")
    assert client.get("/api/v1/houses/1/works", headers=headers(103)).status_code == 404
    # Other staff cannot inspect or publish this announcement.
    other = login(client, "other")
    assert client.get(ROOT + f"/announcements/{draft['id']}").status_code == 404
    assert (
        client.post(
            ROOT + f"/announcements/{draft['id']}/send", json={"version": 1}, headers=other
        ).status_code
        == 404
    )


def test_work_notification_includes_dates_and_matches_staff_preview(staff_api):
    client, engine, _ = staff_api
    enable(engine)
    connect(engine)
    auth = login(client)
    result = send(client, auth, create(client, auth, body(channels=["groups", "private"])))
    expected = (
        f"🔔 Уведомление от УК\n🔧 Запланированные работы\n\n"
        f"{result['title']}\n\n{result['message_body']}\n\nУправляющая компания"
    )
    assert result["message_topic"] == "🔧 Запланированные работы"
    assert "МСК" in expected and result["work"]["location"] in expected
    bot = bot_stub()
    sessions = client.app.state.database.sessions
    asyncio.run(process_announcement(bot, sessions))
    asyncio.run(process_private_announcement(bot, sessions))
    assert all(call.kwargs["text"] == expected for call in bot.send_message.await_args_list)


def test_unknown_end_is_published_delivered_and_completed_without_changing_the_notice(staff_api):
    client, engine, _ = staff_api
    enable(engine)
    auth = login(client)
    data = body()
    data["work"].update(
        starts_at=(datetime.now(UTC) - timedelta(hours=1)).isoformat(), ends_at=None
    )
    draft = create(client, auth, data)
    published = send(client, auth, draft)
    works = client.get("/api/v1/houses/1/works", headers=headers()).json()
    assert len(works) == 1 and works[0]["ends_at"] is None
    assert "Срок окончания уточняется" in published["message_body"]
    assert "None" not in published["message_body"] and "🛠" not in published["message_body"]
    bot = bot_stub()
    asyncio.run(process_private_announcement(bot, client.app.state.database.sessions))
    text = bot.send_message.call_args.kwargs["text"]
    assert "🔔 Уведомление от УК\n🔧 Запланированные работы" in text
    assert "Срок окончания уточняется" in bot.send_message.call_args.kwargs["text"]
    path = ROOT + f"/announcements/{draft['id']}/complete-work"
    other = login(client, "other")
    assert client.post(path, json={"version": 1}, headers=other).status_code == 404
    auth = login(client)
    assert client.post(path, json={"version": 2}, headers=auth).status_code == 409
    completed = client.post(path, json={"version": 1}, headers=auth)
    assert completed.status_code == 200, completed.text
    result = completed.json()
    assert result["work_completed_at"].endswith("Z")
    assert result["message_body"] == published["message_body"]
    assert result["work"]["ends_at"] is None
    assert client.get("/api/v1/houses/1/works", headers=headers()).json() == []
    repeat = client.post(path, json={"version": 1}, headers=auth)
    assert repeat.json()["work_completed_at"] == result["work_completed_at"]
    with Session(engine) as session:
        statuses = session.scalars(select(AnnouncementPrivateDelivery.status)).all()
        assert sorted(statuses) == ["cancelled", "sent"]
        assert session.scalar(select(func.count()).select_from(HouseWork)) == 1
    retry = client.post(ROOT + f"/announcements/{draft['id']}/retry", headers=auth)
    assert retry.status_code == 409


def test_future_unknown_work_and_drafts_cannot_be_completed(staff_api):
    client, _, _ = staff_api
    auth = login(client)
    data = body()
    del data["work"]["ends_at"]
    draft = create(client, auth, data)
    assert draft["work"]["ends_at"] is None
    path = ROOT + f"/announcements/{draft['id']}/complete-work"
    assert client.post(path, json={"version": 1}, headers=auth).status_code == 409
    send(client, auth, draft)
    assert client.post(path, json={"version": 1}, headers=auth).status_code == 409


def test_failed_or_opted_out_notifications_do_not_remove_the_work(staff_api):
    client, engine, _ = staff_api
    enable(engine, opt_out=True)
    auth = login(client)
    draft = create(client, auth, body())
    send(client, auth, draft)
    bot = bot_stub()
    bot.send_message = AsyncMock(return_value=Error(code=403, raw={}))
    asyncio.run(process_private_announcement(bot, client.app.state.database.sessions))
    assert len(client.get("/api/v1/houses/1/works", headers=headers()).json()) == 1
    with Session(engine) as session:
        session.get(User, 1).bot_dialog_started = True
        session.commit()
    path = ROOT + f"/announcements/{draft['id']}/retry"
    assert client.post(path, headers=auth).status_code == 200
    bot = bot_stub()
    asyncio.run(process_private_announcement(bot, client.app.state.database.sessions))
    assert not asyncio.run(process_private_announcement(bot, client.app.state.database.sessions))
    with Session(engine) as session:
        assert session.scalar(select(func.count()).select_from(HouseWork)) == 1


def test_calendar_is_available_even_when_no_resident_has_started_the_bot(staff_api):
    client, _, _ = staff_api
    auth = login(client)
    draft = create(client, auth, body())
    result = send(client, auth, draft)
    assert result["private_deliveries"] == [] and result["excluded_count"] == 2
    assert len(client.get("/api/v1/houses/1/works", headers=headers()).json()) == 1


def test_work_rechecks_new_private_recipients_before_publishing(staff_api):
    client, engine, _ = staff_api
    auth = login(client)
    draft = create(client, auth, body())
    assert draft["private_deliveries"] == []
    enable(engine)
    sent = send(client, auth, draft)
    assert {d["user_id"] for d in sent["private_deliveries"]} == {1, 2}
    assert sent["excluded_count"] == 0


def test_migration_preserves_legacy_works_and_protects_schedules(tmp_path, monkeypatch):
    from pathlib import Path

    from alembic import command
    from alembic.autogenerate import compare_metadata
    from alembic.config import Config
    from alembic.migration import MigrationContext
    from app.database.models import Base, StaffUser
    from sqlalchemy import create_engine, text

    url = "sqlite:///" + (tmp_path / "works.db").as_posix()
    monkeypatch.setenv("DATABASE_URL", url.replace("sqlite:///", "sqlite+aiosqlite:///"))
    config = Config(str(Path(__file__).resolve().parents[1] / "alembic.ini"))
    command.upgrade(config, "0017")
    engine = create_engine(url)
    try:
        with engine.begin() as connection:
            connection.execute(
                text(
                    "INSERT INTO houses (id,address,entrances_count,floors_count,"
                    "apartments_per_floor) VALUES (1,'house',2,5,4)"
                )
            )
            connection.execute(
                text(
                    "INSERT INTO house_works (id,house_id,title,starts_at,ends_at,location) "
                    "VALUES (1,1,'Legacy work','2030-01-01 10:00:00',"
                    "'2030-01-01 12:00:00','Yard')"
                )
            )
        command.upgrade(config, "head")
        with engine.connect() as connection:
            assert compare_metadata(MigrationContext.configure(connection), Base.metadata) == []
            assert (
                connection.scalar(text("SELECT title FROM house_works WHERE id=1")) == "Legacy work"
            )
        command.downgrade(config, "0017")
        command.upgrade(config, "head")
        with engine.begin() as connection:
            connection.execute(text("UPDATE house_works SET ends_at=NULL WHERE id=1"))
        with pytest.raises(RuntimeError, match="Keep open-ended works"):
            command.downgrade(config, "0018")
        with engine.begin() as connection:
            connection.execute(
                text("UPDATE house_works SET ends_at='2030-01-01 12:00:00' WHERE id=1")
            )
        with Session(engine) as session:
            employee = StaffUser(login="test", name="Test", password_hash="test-only")
            session.add(employee)
            session.flush()
            session.add(
                Announcement(
                    staff_id=employee.id,
                    title="Work",
                    text="Details",
                    topic="works",
                    work={**body()["work"], "ends_at": None},
                )
            )
            session.commit()
        with pytest.raises(RuntimeError, match="Keep open-ended work schedules"):
            command.downgrade(config, "0018")
        with Session(engine) as session:
            session.scalar(select(Announcement)).work = body()["work"]
            session.commit()
        with pytest.raises(RuntimeError, match="Keep planned work"):
            command.downgrade(config, "0017")
    finally:
        engine.dispose()


def test_disconnected_group_and_stale_draft_do_not_partially_publish(staff_api):
    client, engine, _ = staff_api
    auth = login(client)
    data = body(channels=["groups"])
    draft = create(client, auth, data)
    path = ROOT + f"/announcements/{draft['id']}"
    assert client.post(path + "/send", json={"version": 1}, headers=auth).status_code == 409
    with Session(engine) as session:
        assert session.scalar(select(func.count()).select_from(HouseWork)) == 0
        assert session.scalar(select(AnnouncementDelivery)).status == "draft"
    connect(engine)
    changed = client.put(
        path, json={**data, "version": 1, "title": "Новый заголовок"}, headers=auth
    ).json()
    assert client.post(path + "/send", json={"version": 1}, headers=auth).status_code == 409
    send(client, auth, changed)
    assert client.put(path, json={**data, "version": 2}, headers=auth).status_code == 409


@pytest.mark.parametrize(
    "changes",
    [
        {"ends_at": "2000-01-01T00:00:00Z"},
        {"starts_at": "2030-01-01T10:00:00"},
        {"location": "  "},
        {"location": "Двор\x00"},
    ],
)
def test_invalid_schedule_is_rejected(staff_api, changes):
    client, _, _ = staff_api
    auth = login(client)
    data = body()
    data["work"].update(changes)
    assert client.post(ROOT + "/announcements", json=data, headers=auth).status_code == 422


def test_scope_and_past_dates_are_checked_and_regular_announcements_do_not_create_work(staff_api):
    client, engine, _ = staff_api
    auth = login(client)
    for data, status in [
        (body(house_ids=[2]), 404),
        (body(topic="other"), 422),
        (body(audience="residents", resident_ids=[1]), 422),
    ]:
        assert client.post(ROOT + "/announcements", json=data, headers=auth).status_code == status
    data = body()
    data["work"]["starts_at"] = "2000-01-01T10:00:00Z"
    data["work"]["ends_at"] = "2000-01-01T12:00:00Z"
    past = create(client, auth, data)
    assert (
        client.post(
            ROOT + f"/announcements/{past['id']}/send", json={"version": 1}, headers=auth
        ).status_code
        == 422
    )
    connect(engine)
    send(client, auth, create(client, auth, BODY))
    with Session(engine) as session:
        assert session.scalar(select(func.count()).select_from(HouseWork)) == 0


def test_ended_works_are_hidden_and_legacy_cards_survive(staff_api):
    client, engine, _ = staff_api
    now = datetime.now(UTC)
    with Session(engine) as session:
        session.add_all(
            [
                HouseWork(
                    house_id=1,
                    title="Завершена",
                    location="Двор",
                    starts_at=now - timedelta(days=2),
                    ends_at=now - timedelta(days=1),
                ),
                HouseWork(
                    house_id=1,
                    title="Идёт",
                    location="Подъезд 1",
                    starts_at=now - timedelta(hours=1),
                    ends_at=now + timedelta(hours=1),
                ),
            ]
        )
        session.commit()
    works = client.get("/api/v1/houses/1/works", headers=headers()).json()
    assert [w["title"] for w in works] == ["Идёт"]
    assert works[0]["description"] == ""
