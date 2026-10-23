import asyncio
import json
from concurrent.futures import ThreadPoolExecutor
from threading import Barrier
from unittest.mock import AsyncMock

import httpx
import pytest
from app.database.enums import IssuePriority
from app.database.models import Issue, IssuePhoto, UserApartment
from pydantic import SecretStr
from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from smart_city_api.schemas.app import CreateIssue
from smart_city_api.services import issue_priority
from tests.test_api import headers, issue_body
from tests.test_resident_photos import image, upload
from tests.test_staff import ROOT, login

pytest_plugins = ["tests.test_staff"]
ISSUES = "/api/v1/houses/1/issues"


def completion(text='{"priority":1}', status="ALTERNATIVE_STATUS_FINAL"):
    return {"result": {"alternatives": [{"status": status, "message": {"text": text}}]}}


def ai_mock(client, monkeypatch, *, payload=None, status=200, error=None):
    settings = client.app.state.settings
    settings.yandex_api_key = SecretStr("isolated-yandex-key")
    settings.yandex_folder_id = "isolated-folder"
    response = httpx.Response(
        status,
        json=completion() if payload is None else payload,
        request=httpx.Request("POST", issue_priority.COMPLETION_URL),
    )
    post = AsyncMock(return_value=response, side_effect=error)
    monkeypatch.setattr(client.app.state.issue_priority.client, "post", post)
    return post


@pytest.mark.parametrize("priority", [1, 2, 3])
@pytest.mark.parametrize(
    "place",
    [
        {"zone": "courtyard"},
        {"zone": "corridor", "entrance": 1, "floor": 3},
        {"zone": "apartment", "entrance": 1, "floor": 1, "apartment_id": 1},
    ],
)
def test_ai_changes_only_priority_and_retries_keep_it(api, monkeypatch, priority, place):
    client, engine, _ = api
    post = ai_mock(client, monkeypatch, payload=completion(json.dumps({"priority": priority})))
    body = issue_body(place=place)
    response = client.post(ISSUES, json=body, headers=headers())
    assert response.status_code == 201, response.text
    saved = response.json()
    assert saved["priority"] == priority
    assert saved["title"] == body["title"]
    assert saved["description"] == body["description"]
    assert saved["category"] == body["category"]
    assert {key: saved["place"][key] for key in place} == place
    sent = post.call_args.kwargs["json"]
    context = json.loads(sent["messages"][1]["text"])
    assert context == {
        "title": body["title"],
        "description": body["description"],
        "category": body["category"],
        "scope": "courtyard"
        if place["zone"] == "courtyard"
        else "apartment"
        if place["zone"] == "apartment"
        else "entrance",
        "place": {key: value for key, value in place.items() if key != "apartment_id"},
    }
    assert sent["modelUri"] == "gpt://isolated-folder/aliceai-llm"
    assert sent["jsonSchema"]["schema"]["required"] == ["priority"]
    assert set(sent["jsonSchema"]["schema"]["properties"]) == {"priority"}
    assert sent["jsonSchema"]["schema"]["additionalProperties"] is False
    assert post.call_args.kwargs["headers"]["Authorization"] == "Api-Key isolated-yandex-key"
    # A retry must return the persisted priority, even if AI is now unavailable.
    post.side_effect = AssertionError("AI must not run on a retry")
    assert client.post(ISSUES, json=body, headers=headers()).json() == saved
    assert (
        client.post(
            ISSUES, json={**body, "title": "Другой заголовок"}, headers=headers()
        ).status_code
        == 409
    )
    post.assert_awaited_once()
    with Session(engine) as session:
        assert session.scalar(select(func.count()).select_from(Issue)) == 1
        issue = session.get(Issue, saved["id"])
        assert issue.priority == IssuePriority(priority)
        assert issue.user_id == 1
        assert issue.apartment_id == place.get("apartment_id")


@pytest.mark.parametrize(
    "payload,status,error",
    [
        (None, 200, httpx.ReadTimeout("isolated timeout")),
        (None, 200, httpx.ConnectError("isolated connection error")),
        (None, 401, None),
        (None, 429, None),
        (None, 503, None),
        ({}, 200, None),
        ({"result": {"alternatives": []}}, 200, None),
        (completion("not JSON"), 200, None),
        (completion('{"priority":0}'), 200, None),
        (completion('{"priority":4}'), 200, None),
        (completion('{"priority":"1"}'), 200, None),
        (completion('{"priority":true}'), 200, None),
        (completion('{"priority":1.0}'), 200, None),
        (completion('{"priority":1,"category":"security"}'), 200, None),
        (completion('{"priority":1}', "ALTERNATIVE_STATUS_TRUNCATED_FINAL"), 200, None),
    ],
)
def test_failure_keeps_report_and_photos(
    api, tmp_path, monkeypatch, caplog, payload, status, error
):
    client, engine, _ = api
    client.app.state.settings.media_root = tmp_path / "media"
    ai_mock(client, monkeypatch, payload=payload, status=status, error=error)
    body = issue_body()
    with caplog.at_level("WARNING", logger=issue_priority.__name__):
        response = upload(client, body, [image()])
    assert response.status_code == 201, response.text
    saved = response.json()
    assert saved["priority"] == 2
    assert saved["title"] == body["title"]
    assert saved["description"] == body["description"]
    assert saved["category"] == body["category"]
    assert len(saved["photo_ids"]) == 1
    photo_url = f"/api/v1/issues/{saved['id']}/photos/{saved['photo_ids'][0]}"
    assert client.get(photo_url, headers=headers()).status_code == 200
    assert "using medium priority" in caplog.text
    assert body["description"] not in caplog.text
    assert "isolated-yandex-key" not in caplog.text
    with Session(engine) as session:
        assert session.get(Issue, saved["id"]).priority == IssuePriority.MEDIUM
        assert session.scalar(select(func.count()).select_from(IssuePhoto)) == 1


@pytest.mark.parametrize("key,folder", [(None, None), ("", ""), ("key", ""), ("", "folder")])
def test_optional_credentials_do_not_block_reports(api, monkeypatch, key, folder):
    client, _, _ = api
    post = ai_mock(client, monkeypatch, error=AssertionError("No provider call expected"))
    client.app.state.settings.yandex_api_key = None if key is None else SecretStr(key)
    client.app.state.settings.yandex_folder_id = folder
    response = client.post(ISSUES, json=issue_body(), headers=headers())
    assert response.status_code == 201, response.text
    assert response.json()["priority"] == 2
    post.assert_not_awaited()


def test_overall_deadline_includes_hanging_provider(api, monkeypatch):
    client, _, _ = api
    monkeypatch.setattr(issue_priority, "PRIORITY_TIMEOUT_SECONDS", 0.01)

    async def hang(*args, **kwargs):
        await asyncio.Future()

    post = ai_mock(client, monkeypatch, error=hang)
    response = client.post(ISSUES, json=issue_body(), headers=headers())
    assert response.status_code == 201, response.text
    assert response.json()["priority"] == 2
    post.assert_awaited_once()


def test_invalid_or_unauthorized_report_does_not_call_ai(api, monkeypatch):
    client, _, _ = api
    post = ai_mock(client, monkeypatch)
    for changes in [
        {"category": "yard"},
        {"place": {"zone": "corridor", "entrance": 99, "floor": 1}},
        {"priority": 1},
    ]:
        assert client.post(ISSUES, json=issue_body(**changes), headers=headers()).status_code == 422
    assert client.post(ISSUES, json=issue_body(), headers=headers(103)).status_code == 404
    assert client.post(ISSUES, json=issue_body()).status_code == 401
    post.assert_not_awaited()


def test_priority_reaches_staff_and_successful_photo_retries(staff_api, tmp_path, monkeypatch):
    client, engine, _ = staff_api
    client.app.state.settings.media_root = tmp_path / "media"
    post = ai_mock(client, monkeypatch)
    body = issue_body()
    response = upload(client, body, [image()])
    assert response.status_code == 201, response.text
    saved = response.json()
    assert saved["priority"] == 1
    assert upload(client, body, [image()]).json() == saved
    post.assert_awaited_once()
    login(client)
    detail = client.get(f"{ROOT}/issues/{saved['id']}")
    assert detail.status_code == 200, detail.text
    assert detail.json()["priority"] == 1
    assert detail.json()["title"] == body["title"]
    assert any(
        row["id"] == saved["id"] for row in client.get(ROOT + "/issues?priority=1").json()["items"]
    )
    with Session(engine) as session:
        assert (
            session.scalar(
                select(func.count())
                .select_from(IssuePhoto)
                .where(IssuePhoto.issue_id == saved["id"])
            )
            == 1
        )


def test_access_is_rechecked_after_ai_and_unretained_photos_are_removed(api, tmp_path, monkeypatch):
    client, engine, _ = api
    client.app.state.settings.media_root = tmp_path / "media"
    post = ai_mock(client, monkeypatch)
    response = post.return_value

    async def unlink_while_ai_runs(*args, **kwargs):
        # This write must work while the external service is awaited: no open DB read.
        with Session(engine) as session:
            session.execute(delete(UserApartment).where(UserApartment.user_id == 1))
            session.commit()
        return response

    post.side_effect = unlink_while_ai_runs
    result = upload(client, issue_body(), [image()])
    assert result.status_code == 404, result.text
    assert not list((tmp_path / "media/issues").glob("*"))
    with Session(engine) as session:
        assert session.scalar(select(func.count()).select_from(Issue)) == 0


def test_simultaneous_retries_create_one_issue(api, monkeypatch):
    client, engine, _ = api
    post = ai_mock(client, monkeypatch)
    response = post.return_value
    barrier = Barrier(2)

    async def simultaneous(*args, **kwargs):
        await asyncio.to_thread(barrier.wait, timeout=5)
        return response

    post.side_effect = simultaneous
    body = issue_body()
    with ThreadPoolExecutor(max_workers=2) as executor:
        responses = list(
            executor.map(lambda _: client.post(ISSUES, json=body, headers=headers()), range(2))
        )
    assert [result.status_code for result in responses] == [201, 201]
    assert responses[0].json() == responses[1].json()
    with Session(engine) as session:
        assert session.scalar(select(func.count()).select_from(Issue)) == 1


def test_task_cancellation_is_not_mistaken_for_provider_failure(api, monkeypatch):
    client, _, _ = api
    ai_mock(client, monkeypatch, error=asyncio.CancelledError())
    data = CreateIssue.model_validate(issue_body())

    async def check_cancellation():
        # Assert inside the event loop; the thread portal translates cancellation.
        with pytest.raises(asyncio.CancelledError):
            await client.app.state.issue_priority.classify(data)

    client.portal.call(check_cancellation)
