import asyncio
from datetime import UTC, datetime, timedelta
from unittest.mock import AsyncMock
from uuid import uuid4

from app.database.demo_contacts import seed_demo_contacts
from app.database.models import (
    ApartmentMessage,
    CompanyHouse,
    House,
    HouseCamera,
    HouseContact,
    Issue,
    IssueEvent,
    IssueMessage,
    IssuePhoto,
    ManagementCompany,
    MessageNotification,
    MeterReading,
    MiniAppPresence,
    RegistrationRequest,
    StaffNotification,
    User,
    UserApartment,
    UtilityAccount,
)
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from tests.test_api import headers
from tests.test_staff import ROOT, login

pytest_plugins = ["tests.test_staff"]


def rejection(**changes):
    return {
        "reason": "Обращение дублирует заявку №12",
        "expected_status": "new",
        "request_id": str(uuid4()),
        **changes,
    }


def test_rejection_requires_reason_scope_and_csrf(staff_api):
    client, _, _ = staff_api
    assert client.post(ROOT + "/issues/1/reject", json=rejection()).status_code == 401
    csrf = login(client)
    assert client.post(ROOT + "/issues/1/reject", json=rejection()).status_code == 403
    for reason in ("", "  ", "xx", "x" * 1501):
        assert (
            client.post(
                ROOT + "/issues/1/reject", json=rejection(reason=reason), headers=csrf
            ).status_code
            == 422
        )
    assert client.post(ROOT + "/issues/3/reject", json=rejection(), headers=csrf).status_code == 404
    assert (
        client.post(
            ROOT + "/issues/1/reject", json=rejection(expected_status="resolved"), headers=csrf
        ).status_code
        == 409
    )


def test_rejection_hides_issue_and_retries_only_once(staff_api):
    client, engine, _ = staff_api
    csrf, body = login(client), rejection()
    response = client.post(ROOT + "/issues/1/reject", json=body, headers=csrf)
    assert response.status_code == 200, response.text
    assert client.post(ROOT + "/issues/1/reject", json=body, headers=csrf).json() == response.json()
    assert (
        client.post(
            ROOT + "/issues/1/reject", json={**body, "reason": "Другая причина"}, headers=csrf
        ).status_code
        == 409
    )
    assert client.post(ROOT + "/issues/1/reject", json=rejection(), headers=csrf).status_code == 409
    assert client.get(ROOT + "/issues").json()["total"] == 1
    assert client.get(ROOT + "/issues/1").status_code == 404
    assert client.get(ROOT + "/photos/1").status_code == 404
    assert client.get("/api/v1/issues/1", headers=headers()).status_code == 404
    assert all(
        i["id"] != 1
        for i in client.get("/api/v1/houses/1/issues", headers=headers()).json()["items"]
    )
    assert (
        client.post(
            ROOT + "/issues/1/messages",
            json={"text": "Текст", "request_id": str(uuid4())},
            headers=csrf,
        ).status_code
        == 404
    )
    with Session(engine) as session:
        issue = session.get(Issue, 1)
        assert issue.rejected_at is not None and issue.rejection_reason == body["reason"]
        notice = session.scalar(select(StaffNotification))
        assert notice.max_user_id == 101 and body["reason"] in notice.text
        assert session.scalar(select(func.count()).select_from(StaffNotification)) == 1
    from app.database.repositories.repositories import IssueRepository
    from chatbot.services.staff_notifications import deliver_pending

    bot = AsyncMock()
    bot.send_message.return_value = object()

    async def verify():
        sessions = client.app.state.database.sessions
        assert await deliver_pending(bot, sessions) == 1
        async with sessions() as session:
            repository = IssueRepository(session)
            assert await repository.get_last_issue(101, 1) is None
            assert sum((await repository.get_issue_statuses(101, 1)).values()) == 0

    asyncio.run(verify())
    sent = bot.send_message.call_args.kwargs
    assert body["reason"] in sent["text"] and sent["user_id"] == 101
    assert "staff_reply" not in str(sent["attachments"])


def registration_rows(engine):
    with Session(engine) as session:
        company = ManagementCompany(name="Тестовая УК")
        session.add(company)
        session.flush()
        session.add(CompanyHouse(house_id=1, company_id=company.id))
        for uid in (1, 2, 3):
            session.add(
                RegistrationRequest(
                    id=uid,
                    user_id=uid,
                    company_id=company.id,
                    apartment_id=uid,
                    full_name=f"Житель {uid}",
                    source="mini_app",
                    status="approved",
                    auto_approved=True,
                )
            )
        session.commit()


def test_account_deletion_removes_dependencies_and_preserves_family(staff_api):
    client, engine, _ = staff_api
    registration_rows(engine)
    with Session(engine) as session:
        session.add(UserApartment(user_id=2, apartment_id=1))
        session.add_all(
            [
                IssueEvent(issue_id=1, status="new"),
                IssueMessage(id=1, issue_id=1, user_id=1, text="Ответ", request_id="reply1"),
                IssueMessage(id=2, issue_id=2, user_id=1, text="Ещё ответ", request_id="reply2"),
                ApartmentMessage(
                    id=1,
                    user_id=1,
                    sender_id=1,
                    recipient_id=2,
                    text="Привет",
                    request_id=str(uuid4()),
                ),
                MiniAppPresence(
                    user_id=1,
                    client_id=str(uuid4()),
                    sequence=1,
                    expires_at=datetime.now(UTC) + timedelta(minutes=1),
                ),
                MeterReading(meter_id=1, user_id=1, period="2026-09", value=11),
            ]
        )
        session.flush()
        session.add_all(
            [
                StaffNotification(
                    issue_id=1,
                    staff_id=1,
                    max_user_id=101,
                    kind="message",
                    message_id=1,
                    text="Текст",
                    request_id=str(uuid4()),
                    request_hash="a" * 64,
                ),
                StaffNotification(
                    issue_id=2,
                    staff_id=1,
                    max_user_id=102,
                    kind="message",
                    message_id=2,
                    text="Текст",
                    request_id=str(uuid4()),
                    request_hash="b" * 64,
                ),
                MessageNotification(message_id=1, max_user_id=102),
            ]
        )
        session.commit()
    assert client.delete(ROOT + "/registrations/1/user").status_code == 401
    csrf = login(client)
    assert client.delete(ROOT + "/registrations/1/user").status_code == 403
    assert client.delete(ROOT + "/registrations/3/user", headers=csrf).status_code == 404
    response = client.delete(ROOT + "/registrations/1/user", headers=csrf)
    assert response.status_code == 204, response.text
    with Session(engine) as session:
        assert session.get(User, 1) is None
        assert session.get(User, 2) is not None
        assert session.get(Issue, 1) is None and session.get(Issue, 2) is not None
        for model in (
            IssueEvent,
            IssueMessage,
            StaffNotification,
            MeterReading,
            MiniAppPresence,
            ApartmentMessage,
            MessageNotification,
        ):
            assert session.scalar(select(func.count()).select_from(model)) == 0
        assert session.get(IssuePhoto, 2) is not None
        assert session.scalar(
            select(UserApartment.id).where(
                UserApartment.user_id == 2, UserApartment.apartment_id == 1
            )
        )
        assert session.get(HouseCamera, 1) and session.get(UtilityAccount, 1)
        assert session.scalar(select(func.count()).select_from(RegistrationRequest)) == 2


def test_account_in_other_company_cannot_be_deleted(staff_api):
    client, engine, _ = staff_api
    registration_rows(engine)
    with Session(engine) as session:
        session.add(UserApartment(user_id=1, apartment_id=3))
        session.commit()
    response = client.delete(ROOT + "/registrations/1/user", headers=login(client))
    assert response.status_code == 409, response.text
    with Session(engine) as session:
        assert session.get(User, 1) and session.get(Issue, 1)


def test_contacts_only_list_company_houses_and_keep_existing_values(staff_api):
    client, engine, _ = staff_api
    registration_rows(engine)
    login(client)
    profile = client.get(ROOT + "/me").json()
    assert [h["id"] for h in profile["contact_houses"]] == [1]
    with Session(engine) as session:
        session.add(
            HouseContact(
                house_id=1,
                position=0,
                label="Свой контакт",
                kind="phone",
                value="12345",
                note="Не менять",
            )
        )
        session.commit()

    async def verify():
        async with client.app.state.database.sessions.begin() as session:
            houses = list(await session.scalars(select(House).order_by(House.id)))
            await seed_demo_contacts(session, houses)
            await seed_demo_contacts(session, houses)

    asyncio.run(verify())
    with Session(engine) as session:
        records = list(
            session.scalars(
                select(HouseContact).order_by(HouseContact.house_id, HouseContact.position)
            )
        )
        assert len(records) == 3 and records[0].value == "12345"
        assert all("(000)" in r.value and "Тестовый" in r.note for r in records[1:])
