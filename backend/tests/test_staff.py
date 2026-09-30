import asyncio
from datetime import UTC, datetime, timedelta
from uuid import uuid4

import pytest
from app.database.enums import IssueCategory, IssuePriority, IssueStatus
from app.database.models import (
    Issue,
    IssueEvent,
    IssueMessage,
    IssuePhoto,
    StaffHouse,
    StaffNotification,
    StaffSession,
    StaffUser,
)
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from smart_city_api.core.staff_auth import hash_password, token_hash, verify_password
from tests.test_api import headers

pytest_plugins = ["tests.test_api"]
PASSWORD = "test-password-not-for-production"
ORIGIN = {"Origin": "https://testserver"}
ROOT = "/api/v1/staff"


@pytest.fixture(scope="session")
def password_hash():
    return hash_password(PASSWORD)


@pytest.fixture
def staff_api(api, password_hash, tmp_path):
    client, engine, _ = api
    client.base_url = "https://testserver"
    client.app.state.settings.media_root = tmp_path / "media"
    path = tmp_path / "media" / "issues"
    path.mkdir(parents=True)
    (path / ("a" * 32 + ".png")).write_bytes(b"image-content-for-test")
    with Session(engine) as session:
        session.add_all(
            [
                StaffUser(login="manager", name="Анна Соколова", password_hash=password_hash),
                StaffUser(login="other", name="Другой сотрудник", password_hash=password_hash),
            ]
        )
        session.flush()
        session.add_all([StaffHouse(staff_id=1, house_id=1), StaffHouse(staff_id=2, house_id=2)])
        session.add_all(
            [
                Issue(
                    id=1,
                    user_id=1,
                    house_id=1,
                    title="Не горит свет",
                    description="Лампа у лифта",
                    category=IssueCategory.ELECTRICITY,
                    priority=IssuePriority.HIGH,
                ),
                Issue(
                    id=2,
                    user_id=2,
                    house_id=1,
                    title="Шум в подъезде",
                    description="Громкий звук",
                    category=IssueCategory.OTHER,
                    priority=IssuePriority.LOW,
                    status=IssueStatus.RESOLVED,
                ),
                Issue(
                    id=3,
                    user_id=3,
                    house_id=2,
                    title="Чужой дом",
                    description="Частное обращение",
                    category=IssueCategory.WATER,
                    priority=IssuePriority.MEDIUM,
                ),
            ]
        )
        session.flush()
        session.add_all(
            [
                IssuePhoto(id=1, issue_id=1, file_path="issues/" + "a" * 32 + ".png"),
                IssuePhoto(id=2, issue_id=3, file_path="issues/" + "a" * 32 + ".png"),
            ]
        )
        session.commit()
    return api


def login(client, name="manager"):
    response = client.post(
        ROOT + "/auth/login", json={"login": name, "password": PASSWORD}, headers=ORIGIN
    )
    assert response.status_code == 204, response.text
    profile = client.get(ROOT + "/me")
    assert profile.status_code == 200, profile.text
    return {**ORIGIN, "X-CSRF-Token": profile.json()["csrf_token"]}


def status_body(**changes):
    return {
        "status": "in_progress",
        "expected_status": "new",
        "request_id": str(uuid4()),
        **changes,
    }


def issue_token(client, name="manager"):
    response = client.post(
        ROOT + "/auth/token", json={"login": name, "password": PASSWORD}, headers=ORIGIN
    )
    assert response.status_code == 200, response.text
    assert "set-cookie" not in response.headers
    return response


def test_staff_token_supports_swagger_reads_writes_and_revocation(staff_api):
    client, engine, _ = staff_api
    response = issue_token(client)
    token = response.json()["access_token"]
    assert response.json()["token_type"] == "bearer"
    assert response.json()["expires_in"] == client.app.state.settings.staff_session_hours * 3600
    assert response.headers["cache-control"] == "no-store"
    assert not client.cookies.get("dompulse_staff")
    authorization = {"Authorization": "Bearer " + token}
    with Session(engine) as session:
        stored = session.scalar(select(StaffSession))
        assert stored.token_hash == token_hash(token)
        assert stored.token_hash != token
    profile = client.get(ROOT + "/me", headers=authorization)
    assert profile.status_code == 200
    assert [house["id"] for house in profile.json()["houses"]] == [1]
    assert client.get(ROOT + "/issues", headers=authorization).status_code == 200
    assert client.get(ROOT + "/issues/3", headers=authorization).status_code == 404
    assert client.get("/api/v1/me", headers=authorization).status_code == 401
    assert client.get(ROOT + "/photos/1", headers=authorization).status_code == 200
    updated = client.post(ROOT + "/issues/1/status", json=status_body(), headers=authorization)
    assert updated.status_code == 200, updated.text
    assert client.post(ROOT + "/auth/logout", headers=authorization).status_code == 204
    assert client.get(ROOT + "/me", headers=authorization).status_code == 401


def test_bearer_never_falls_back_to_cookie_or_bypasses_cookie_csrf(staff_api):
    client, _, _ = staff_api
    login(client)
    assert client.get(ROOT + "/me", headers={"Authorization": "Bearer invalid"}).status_code == 401
    assert (
        client.post(ROOT + "/issues/1/status", json=status_body(), headers=ORIGIN).status_code
        == 403
    )
    assert client.get(ROOT + "/me", headers=headers()).status_code == 401
    other_token = issue_token(client, "other").json()["access_token"]
    authorization = {"Authorization": "Bearer " + other_token}
    profile = client.get(ROOT + "/me", headers=authorization)
    assert [house["id"] for house in profile.json()["houses"]] == [2]
    assert client.get(ROOT + "/issues/1", headers=authorization).status_code == 404
    assert client.post(ROOT + "/auth/logout", headers=authorization).status_code == 204
    assert client.get(ROOT + "/me").status_code == 200


def test_staff_token_checks_credentials_origin_expiry_and_active_account(staff_api):
    client, engine, _ = staff_api
    body = {"login": "manager", "password": PASSWORD}
    assert client.post(ROOT + "/auth/token", json=body).status_code == 403
    assert (
        client.post(
            ROOT + "/auth/token", json={**body, "password": "wrong"}, headers=ORIGIN
        ).status_code
        == 401
    )
    token = issue_token(client).json()["access_token"]
    authorization = {"Authorization": "Bearer " + token}
    with Session(engine) as session:
        session.scalar(select(StaffSession)).expires_at = datetime.now(UTC) - timedelta(seconds=1)
        session.commit()
    assert client.get(ROOT + "/me", headers=authorization).status_code == 401
    token = issue_token(client).json()["access_token"]
    with Session(engine) as session:
        session.get(StaffUser, 1).active = False
        session.commit()
    assert client.get(ROOT + "/me", headers={"Authorization": "Bearer " + token}).status_code == 401
    assert client.post(ROOT + "/auth/token", json=body, headers=ORIGIN).status_code == 401


def test_authentication_is_separate_secure_revocable_and_expiring(staff_api):
    client, engine, _ = staff_api
    assert client.get(ROOT + "/me").status_code == 401
    assert client.get(ROOT + "/issues", headers=headers()).status_code == 401
    for name in ("manager", "unknown"):
        response = client.post(
            ROOT + "/auth/login", json={"login": name, "password": "wrong"}, headers=ORIGIN
        )
        assert response.status_code == 401
        assert response.json()["detail"] == "Неверный логин или пароль"
    assert (
        client.post(
            ROOT + "/auth/login",
            json={"login": "manager", "password": PASSWORD},
            headers={"Origin": "https://foreign.invalid"},
        ).status_code
        == 403
    )
    csrf = login(client, " MANAGER ")
    cookie = client.cookies.get("dompulse_staff")
    profile = client.get(ROOT + "/me").json()
    assert [h["id"] for h in profile["houses"]] == [1]
    assert "password_hash" not in profile
    with Session(engine) as session:
        stored = session.scalar(select(StaffSession))
        assert stored.token_hash != cookie
    assert client.post(ROOT + "/auth/logout", headers=ORIGIN).status_code == 403
    assert client.post(ROOT + "/auth/logout", headers=csrf).status_code == 204
    client.cookies.set("dompulse_staff", cookie, path=ROOT)
    assert client.get(ROOT + "/me").status_code == 401
    client.cookies.clear()
    login(client)
    with Session(engine) as session:
        session.scalar(select(StaffSession)).expires_at = datetime.now(UTC) - timedelta(seconds=1)
        session.commit()
    assert client.get(ROOT + "/me").status_code == 401
    login(client)
    with Session(engine) as session:
        session.get(StaffUser, 1).active = False
        session.commit()
    assert client.get(ROOT + "/issues").status_code == 401


def test_cookie_attributes_and_login_throttling(staff_api):
    client, _, _ = staff_api
    response = client.post(
        ROOT + "/auth/login", json={"login": "manager", "password": PASSWORD}, headers=ORIGIN
    )
    cookie = response.headers["set-cookie"]
    for required in ("HttpOnly", "Secure", "SameSite=strict", "Path=/api/v1/staff"):
        assert required in cookie
    for _ in range(10):
        response = client.post(
            ROOT + "/auth/login", json={"login": "nobody", "password": "wrong"}, headers=ORIGIN
        )
        assert response.status_code == 401
    limited = client.post(
        ROOT + "/auth/login", json={"login": "nobody", "password": "wrong"}, headers=ORIGIN
    )
    assert limited.status_code == 429 and int(limited.headers["retry-after"]) > 0


def test_scope_filters_pagination_and_authenticated_photos(staff_api):
    client, _, _ = staff_api
    assert client.get(ROOT + "/photos/1").status_code == 401
    csrf = login(client)
    listing = client.get(ROOT + "/issues?page_size=1").json()
    assert listing["total"] == 2 and len(listing["items"]) == 1
    assert listing["counts"] == {"new": 1, "in_progress": 0, "resolved": 1}
    first = listing["items"][0]["id"]
    assert client.get(ROOT + "/issues?page_size=1&page=2").json()["items"][0]["id"] != first
    assert client.get(ROOT + "/issues?house_id=2").json()["items"] == []
    assert client.get(ROOT + "/issues?status=resolved").json()["items"][0]["id"] == 2
    assert client.get(ROOT + "/issues?priority=1").json()["items"][0]["id"] == 1
    assert client.get(ROOT + "/issues?q=%231").json()["total"] == 1
    assert client.get(ROOT + "/issues?q=%25").json()["total"] == 0
    assert client.get(ROOT + "/issues?page_size=0").status_code == 422
    assert client.get(ROOT + "/issues/3").status_code == 404
    assert (
        client.post(ROOT + "/issues/3/status", json=status_body(), headers=csrf).status_code == 404
    )
    assert (
        client.post(
            ROOT + "/issues/3/messages",
            json={"text": "test", "request_id": str(uuid4())},
            headers=csrf,
        ).status_code
        == 404
    )
    assert client.get(ROOT + "/photos/2").status_code == 404
    photo = client.get(ROOT + "/photos/1")
    assert photo.content == b"image-content-for-test"
    assert photo.headers["content-type"] == "image/png"
    assert photo.headers["cache-control"] == "no-store"
    assert photo.headers["x-content-type-options"] == "nosniff"
    assert "file_path" not in client.get(ROOT + "/issues/1").text


def test_status_is_atomic_idempotent_and_detects_stale_edit(staff_api):
    client, engine, _ = staff_api
    csrf = login(client)
    body = status_body()
    path = ROOT + "/issues/1/status"
    assert client.post(path, json=body, headers=ORIGIN).status_code == 403
    assert (
        client.post(
            path, json=body, headers={**csrf, "Origin": "https://foreign.invalid"}
        ).status_code
        == 403
    )
    first = client.post(path, json=body, headers=csrf)
    assert first.status_code == 200, first.text
    assert client.post(path, json=body, headers=csrf).json() == first.json()
    assert client.post(path, json=status_body(status="resolved"), headers=csrf).status_code == 409
    assert client.post(path, json={**body, "status": "resolved"}, headers=csrf).status_code == 409
    same = client.post(path, json=status_body(expected_status="in_progress"), headers=csrf)
    assert same.json()["changed"] is False
    with Session(engine) as session:
        assert session.get(Issue, 1).status == IssueStatus.IN_PROGRESS
        assert session.scalar(select(func.count()).select_from(IssueEvent)) == 1
        notice = session.scalar(select(StaffNotification))
        assert notice.max_user_id == 101 and notice.sent_at is None
        assert "взято в работу" in notice.text
    assert (
        client.get("/api/v1/issues/1", headers=headers()).json()["history"][-1]["status"]
        == "in_progress"
    )
    assert (
        client.post(
            path, json=status_body(expected_status="in_progress", status="resolved"), headers=csrf
        ).status_code
        == 200
    )


def test_messages_validate_persist_and_queue_only_once(staff_api):
    client, engine, _ = staff_api
    csrf = login(client)
    path = ROOT + "/issues/1/messages"
    body = {"text": "  Уточните этаж, пожалуйста  ", "request_id": str(uuid4())}
    first = client.post(path, json=body, headers=csrf)
    assert first.status_code == 200, first.text
    assert client.post(path, json=body, headers=csrf).json() == first.json()
    assert client.post(path, json={**body, "text": "другое"}, headers=csrf).status_code == 409
    for text in ("   ", "x" * 1501):
        assert client.post(path, json={**body, "text": text}, headers=csrf).status_code == 422
    with Session(engine) as session:
        assert session.scalar(select(func.count()).select_from(IssueMessage)) == 1
        notice = session.scalar(select(StaffNotification))
        assert notice.kind == "message" and notice.message_id is not None
        assert "Уточните этаж, пожалуйста" in notice.text
    detail = client.get(ROOT + "/issues/1").json()
    assert detail["messages"][0]["text"] == "Уточните этаж, пожалуйста"
    assert detail["notifications"][0]["delivery"] == "pending"


def test_bad_photo_path_cannot_expose_other_files(staff_api):
    client, engine, _ = staff_api
    login(client)
    for key in (
        "../../.env",
        "C:/Windows/win.ini",
        "issues/not-an-image.svg",
        "issues/" + "b" * 32 + ".png",
    ):
        with Session(engine) as session:
            session.get(IssuePhoto, 1).file_path = key
            session.commit()
        assert client.get(ROOT + "/photos/1").status_code == 404


def test_password_hashes_are_salted_and_verified(password_hash):
    assert verify_password(PASSWORD, password_hash)
    assert not verify_password("wrong", password_hash)
    assert not verify_password(PASSWORD, "malformed")
    assert hash_password(PASSWORD) != password_hash


def test_assign_revoke_sessions_and_change_visible_houses(staff_api):
    from scripts.manage_staff import manage
    from smart_city_api.db.session import Database
    from smart_city_api.runtime import loop_factory

    client, _, _ = staff_api
    login(client)

    async def assign():
        database = Database(client.app.state.database.engine.url)
        try:
            async with database.sessions.begin() as session:
                await manage(session, "assign", "manager", houses=[2])
        finally:
            await database.close()

    asyncio.run(assign(), loop_factory=loop_factory)
    assert client.get(ROOT + "/me").status_code == 401
    login(client)
    assert [h["id"] for h in client.get(ROOT + "/me").json()["houses"]] == [2]
    assert client.get(ROOT + "/issues/1").status_code == 404
    assert client.get(ROOT + "/issues/3").status_code == 200


def test_account_creation_reset_disable_enable(staff_api):
    from scripts.manage_staff import manage
    from smart_city_api.db.session import Database
    from smart_city_api.runtime import loop_factory

    client, _, _ = staff_api
    new_password = "another-test-password-long-enough"

    def command(action, login_name="manager", **kwargs):
        async def run():
            database = Database(client.app.state.database.engine.url)
            try:
                async with database.sessions.begin() as session:
                    await manage(session, action, login_name, **kwargs)
            finally:
                await database.close()

        asyncio.run(run(), loop_factory=loop_factory)

    with pytest.raises(ValueError, match="существующий"):
        command("create", "new-staff", name="Сотрудник", houses=[999], password=PASSWORD)
    command("create", "new-staff", name="Сотрудник", houses=[1, 2], password=PASSWORD)
    login(client, "new-staff")
    assert len(client.get(ROOT + "/me").json()["houses"]) == 2
    command("password", "new-staff", password=new_password)
    assert client.get(ROOT + "/me").status_code == 401
    body = {"login": "new-staff", "password": PASSWORD}
    assert client.post(ROOT + "/auth/login", json=body, headers=ORIGIN).status_code == 401
    body["password"] = new_password
    assert client.post(ROOT + "/auth/login", json=body, headers=ORIGIN).status_code == 204
    command("disable", "new-staff")
    assert client.get(ROOT + "/me").status_code == 401
    assert client.post(ROOT + "/auth/login", json=body, headers=ORIGIN).status_code == 401
    command("enable", "new-staff")
    assert client.post(ROOT + "/auth/login", json=body, headers=ORIGIN).status_code == 204


def test_static_portal_has_no_sensitive_bootstrap_data(staff_api):
    client, _, _ = staff_api
    response = client.get("/staff/")
    assert response.status_code == 200
    assert "Кабинет сотрудника" in response.text
    assert PASSWORD not in response.text
    assert "frame-ancestors 'none'" in response.headers["content-security-policy"]
    assert client.get("/staff/app.js").status_code == 200
    assert client.get("/staff/../.env").status_code == 404


def test_login_behind_tls_proxy_requires_configured_origin_and_matching_host(staff_api):
    client, _, _ = staff_api
    client.base_url = "http://testserver"
    body = {"login": "manager", "password": PASSWORD}
    assert client.post(ROOT + "/auth/login", json=body, headers=ORIGIN).status_code == 403
    client.app.state.settings.cors_origins = ["https://testserver", "https://different.invalid"]
    assert client.post(ROOT + "/auth/login", json=body, headers=ORIGIN).status_code == 204
    assert (
        client.post(
            ROOT + "/auth/login", json=body, headers={"Origin": "https://different.invalid"}
        ).status_code
        == 403
    )
