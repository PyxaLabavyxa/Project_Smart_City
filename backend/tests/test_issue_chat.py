from datetime import UTC, datetime
from uuid import uuid4

import pytest
from app.database.models import Issue, IssueMessage, StaffNotification, UserApartment
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from tests.test_api import headers
from tests.test_staff import ROOT, login

pytest_plugins = ["tests.test_staff"]
CHAT = "/api/v1/issues/1/messages"


def body(text="Когда придёт мастер?", **changes):
    return {"text": text, "request_id": str(uuid4()), **changes}


def test_author_starts_chat_and_staff_answers_in_shared_history(staff_api):
    client, engine, _ = staff_api
    question = body("  Подскажите, когда придёт мастер?  ")
    response = client.post(CHAT, json=question, headers=headers())
    assert response.status_code == 200, response.text
    sent = response.json()
    assert sent["direction"] == "resident" and sent["author"] == "Первый"
    assert sent["text"] == question["text"].strip()
    assert sent["created_at"].endswith("Z")
    assert client.post(CHAT, json=question, headers=headers()).json() == sent
    csrf = login(client)
    staff_messages = client.get(ROOT + "/issues/1").json()["messages"]
    assert staff_messages[0]["id"] == sent["id"]
    reply = client.post(
        ROOT + "/issues/1/messages", json=body("Мастер придёт завтра"), headers=csrf
    )
    assert reply.status_code == 200, reply.text
    messages = client.get(CHAT, headers=headers()).json()["items"]
    assert [message["direction"] for message in messages] == ["resident", "staff"]
    assert messages[1]["author"] == "Анна Соколова"
    assert messages[1]["text"] == "Мастер придёт завтра"
    with Session(engine) as session:
        assert session.scalar(select(func.count()).select_from(IssueMessage)) == 2
        # Only the staff answer needs a notification to the resident.
        assert session.scalar(select(func.count()).select_from(StaffNotification)) == 1


def test_chat_is_author_only_even_for_same_apartment(staff_api):
    client, engine, _ = staff_api
    with Session(engine) as session:
        session.add(UserApartment(user_id=2, apartment_id=1))
        session.commit()
    for user_id in (102, 103, 104):
        assert client.get(CHAT, headers=headers(user_id)).status_code == 404
        assert client.post(CHAT, json=body(), headers=headers(user_id)).status_code == 404
    for issue_id in (2, 3, 999):
        path = f"/api/v1/issues/{issue_id}/messages"
        assert client.get(path, headers=headers()).status_code == 404
        assert client.post(path, json=body(), headers=headers()).status_code == 404
    assert client.get(CHAT).status_code == 401
    assert client.post(CHAT, json=body()).status_code == 401


def test_chat_requires_current_house_access_and_hides_rejected_issue(staff_api):
    client, engine, _ = staff_api
    with Session(engine) as session:
        session.get(Issue, 1).rejected_at = datetime.now(UTC)
        session.commit()
    assert client.get(CHAT, headers=headers()).status_code == 404
    assert client.post(CHAT, json=body(), headers=headers()).status_code == 404
    with Session(engine) as session:
        session.get(Issue, 1).rejected_at = None
        link = session.scalar(select(UserApartment).where(UserApartment.user_id == 1))
        session.delete(link)
        session.commit()
    assert client.get(CHAT, headers=headers()).status_code == 404
    assert client.post(CHAT, json=body(), headers=headers()).status_code == 404


@pytest.mark.parametrize("changes", [
    {"text": "  "}, {"text": "a" * 1501}, {"user_id": 2}, {"staff_id": 1},
    {"request_id": "invalid"}, {"created_at": "2026-01-01"},
])
def test_message_validation(staff_api, changes):
    client, _, _ = staff_api
    response = client.post(CHAT, json=body(**changes), headers=headers())
    assert response.status_code == 422, response.text


def test_changed_retry_payload_conflicts_without_overwriting(staff_api):
    client, _, _ = staff_api
    request = body("Первый текст")
    assert client.post(CHAT, json=request, headers=headers()).status_code == 200
    response = client.post(CHAT, json={**request, "text": "Другой текст"}, headers=headers())
    assert response.status_code == 409
    messages = client.get(CHAT, headers=headers()).json()["items"]
    assert [m["text"] for m in messages] == ["Первый текст"]


def test_cursor_history_includes_legacy_bot_messages(staff_api):
    client, engine, _ = staff_api
    with Session(engine) as session:
        session.add_all([
            IssueMessage(issue_id=1, user_id=1, text=f"Сообщение {i}", request_id=f"max:101:{i}")
            for i in range(103)
        ])
        session.commit()
    page = client.get(CHAT, headers=headers()).json()
    assert len(page["items"]) == 100 and page["next_cursor"] == page["items"][-1]["id"]
    tail = client.get(CHAT, params={"cursor": page["next_cursor"]}, headers=headers()).json()
    assert len(tail["items"]) == 3 and tail["next_cursor"] is None
    assert tail["items"][-1]["text"] == "Сообщение 102"
    assert client.get(CHAT, params={"limit": 0}, headers=headers()).status_code == 422
    assert client.get(CHAT, params={"cursor": -1}, headers=headers()).status_code == 422


def test_resolved_issue_allows_follow_up_and_cookie_posts_require_origin(staff_api):
    client, _, _ = staff_api
    path = "/api/v1/issues/2/messages"
    assert client.post(path, json=body(), headers=headers(102)).status_code == 200
    allowed = client.app.state.settings.cors_origins[0]
    response = client.post(
        "/api/v1/auth/max", json={"init_data": headers()["Authorization"][7:]},
        headers={"Origin": allowed},
    )
    assert response.status_code == 204, response.text
    assert client.post(CHAT, json=body()).status_code == 403
    assert client.post(CHAT, json=body(), headers={"Origin": allowed}).status_code == 200
