import asyncio
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import pytest
from app.database.enums import IssueCategory, IssuePriority
from app.database.models import Issue, IssuePhoto
from app.services import issues
from app.storage.photos import PhotoError
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from smart_city_api.db.session import Database
from smart_city_api.runtime import loop_factory

pytest_plugins = ["tests.test_api"]


def model_with_result(result):
    return SimpleNamespace(
        run=AsyncMock(
            side_effect=result if isinstance(result, BaseException) else None,
            return_value=result,
        )
    )


def photo_storage():
    return SimpleNamespace(
        save_many=AsyncMock(return_value=["issues/" + "a" * 32 + ".png"]),
        delete_many=AsyncMock(),
    )


async def submit(client, model, storage):
    database = Database(client.app.state.database.engine.url)
    try:
        with patch.object(issues, "session_factory", database.sessions):
            return await issues.submit_issue(
                max_user_id=101,
                house_id=1,
                description="  В подъезде протекает труба  ",
                report_model=model,
                photo_storage=storage,
                photo_urls=["https://photos.example/leak.png"],
            )
    finally:
        await database.close()


@pytest.mark.parametrize(
    "ai_result",
    [
        TimeoutError(),
        ConnectionError("AI unavailable"),
        [SimpleNamespace(text="not JSON")],
        [],
        [SimpleNamespace(text='{"title":"Протечка","category":"unknown","priority":999}')],
    ],
)
def test_ai_failure_preserves_description_and_photo_links(api, ai_result, caplog):
    client, engine, _ = api
    storage = photo_storage()
    with caplog.at_level("WARNING", logger="app.services.issues"):
        issue_id = asyncio.run(
            submit(client, model_with_result(ai_result), storage), loop_factory=loop_factory
        )
    with Session(engine) as session:
        issue = session.get(Issue, issue_id)
        assert issue.title == "Обращение жителя"
        assert issue.category == IssueCategory.OTHER
        assert issue.priority == IssuePriority.MEDIUM
        assert issue.description == "В подъезде протекает труба"
        assert list(
            session.scalars(
                select(IssuePhoto.file_path).where(
                    IssuePhoto.issue_id == issue_id,
                )
            )
        ) == ["issues/" + "a" * 32 + ".png"]
    storage.save_many.assert_awaited_once_with(["https://photos.example/leak.png"])
    storage.delete_many.assert_not_awaited()
    assert "using default metadata" in caplog.text
    assert "В подъезде" not in caplog.text


def test_valid_ai_analysis_is_used(api):
    client, engine, _ = api
    model = model_with_result(
        [
            SimpleNamespace(
                text='{"title":"Протечка трубы","category":"water","priority":1}',
            )
        ]
    )
    issue_id = asyncio.run(submit(client, model, photo_storage()), loop_factory=loop_factory)
    with Session(engine) as session:
        issue = session.get(Issue, issue_id)
        assert (issue.title, issue.category, issue.priority) == (
            "Протечка трубы",
            IssueCategory.WATER,
            IssuePriority.HIGH,
        )


def test_hanging_ai_call_has_an_overall_deadline(api, monkeypatch):
    client, engine, _ = api
    monkeypatch.setattr(issues, "AI_ANALYSIS_TIMEOUT_SECONDS", 0.01)

    async def hang(*args, **kwargs):
        await asyncio.Future()

    async def run():
        return await asyncio.wait_for(
            submit(
                client,
                SimpleNamespace(run=AsyncMock(side_effect=hang)),
                photo_storage(),
            ),
            timeout=5,
        )

    issue_id = asyncio.run(run(), loop_factory=loop_factory)
    with Session(engine) as session:
        assert session.get(Issue, issue_id).category == IssueCategory.OTHER


def test_task_cancellation_does_not_save_an_issue(api):
    client, engine, _ = api
    storage = photo_storage()
    with pytest.raises(asyncio.CancelledError):
        asyncio.run(
            submit(client, model_with_result(asyncio.CancelledError()), storage),
            loop_factory=loop_factory,
        )
    storage.save_many.assert_not_awaited()
    with Session(engine) as session:
        assert session.scalar(select(func.count()).select_from(Issue)) == 0


def test_database_failure_still_propagates_and_cleans_saved_photos(api):
    client, engine, _ = api
    storage = photo_storage()
    with patch.object(
        issues, "create_issue", AsyncMock(side_effect=RuntimeError("DB unavailable"))
    ):
        with pytest.raises(RuntimeError, match="DB unavailable"):
            asyncio.run(
                submit(client, model_with_result(ConnectionError()), storage),
                loop_factory=loop_factory,
            )
    storage.delete_many.assert_awaited_once_with(["issues/" + "a" * 32 + ".png"])
    with Session(engine) as session:
        assert session.scalar(select(func.count()).select_from(Issue)) == 0


def test_photo_failure_is_not_hidden_by_ai_fallback(api):
    client, engine, _ = api
    storage = photo_storage()
    storage.save_many.side_effect = PhotoError("Photo unavailable")
    with pytest.raises(PhotoError, match="Photo unavailable"):
        asyncio.run(
            submit(client, model_with_result(ConnectionError()), storage), loop_factory=loop_factory
        )
    with Session(engine) as session:
        assert session.scalar(select(func.count()).select_from(Issue)) == 0
