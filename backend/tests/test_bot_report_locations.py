import asyncio
import json
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import pytest
from app.ai.schemas import ReportAnalysis
from app.database.enums import IssueCategory
from app.database.models import Issue, UserApartment
from app.services import issues
from app.services.report_locations import ReportHome, ReportPlace, suggest_place
from sqlalchemy import select
from sqlalchemy.orm import Session

from smart_city_api.db.session import Database
from smart_city_api.runtime import loop_factory
from tests.test_api import headers
from tests.test_staff import ROOT, login, status_body

pytest_plugins = ["tests.test_issue_visibility"]


def analysis(**changes):
    return {"title": "Протечка трубы", "category": "water", "priority": 2, **changes}


def send(client, payload, *, apartment_id=1, place=None, prepared=False):
    model = SimpleNamespace(run=AsyncMock(return_value=[SimpleNamespace(text=json.dumps(payload))]))
    storage = SimpleNamespace(
        save_many=AsyncMock(return_value=["issues/" + "a" * 32 + ".png"]),
        delete_many=AsyncMock(),
    )

    async def run():
        database = Database(client.app.state.database.engine.url)
        try:
            with patch.object(issues, "session_factory", database.sessions):
                return await issues.submit_issue(
                    max_user_id=101,
                    house_id=1,
                    description="Описание жителя и фото",
                    report_model=model,
                    photo_storage=storage,
                    photo_urls=["https://example.test/photo.png"],
                    apartment_id=apartment_id,
                    place=place,
                    analysis=ReportAnalysis.model_validate(payload) if prepared else None,
                )
        finally:
            await database.close()

    issue_id = asyncio.run(run(), loop_factory=loop_factory)
    if prepared:
        model.run.assert_not_awaited()
    else:
        model.run.assert_awaited_once()
    storage.delete_many.assert_not_awaited()
    return issue_id


@pytest.mark.parametrize(
    "metadata,visible,expected",
    [
        (analysis(scope="apartment", entrance=2, floor=3), {101}, ("apartment", 1, 1, 1)),
        (
            analysis(scope="entrance", floor=2, zone="stairs"),
            {101, 104, 105},
            ("stairs", 1, 2, None),
        ),
        (
            analysis(scope="courtyard", entrance=2, floor=3),
            {101, 102, 104, 105},
            ("courtyard", None, None, None),
        ),
        (analysis(scope="unknown"), {101}, (None, None, None, None)),
    ],
)
def test_bot_scopes_control_list_detail_photos_and_staff_access(
    visibility_api, metadata, visible, expected
):
    client, engine, _ = visibility_api
    issue_id = send(client, metadata)
    with Session(engine) as session:
        row = session.get(Issue, issue_id)
        assert (row.zone, row.entrance, row.floor, row.apartment_id) == expected
    detail = client.get(f"/api/v1/issues/{issue_id}", headers=headers()).json()
    photo = f"/api/v1/issues/{issue_id}/photos/{detail['photo_ids'][0]}"
    for user in (101, 102, 103, 104, 105):
        listed = client.get("/api/v1/houses/1/issues", headers=headers(user))
        if user != 103:
            assert (issue_id in {item["id"] for item in listed.json()["items"]}) == (
                user in visible
            )
        assert client.get(f"/api/v1/issues/{issue_id}", headers=headers(user)).status_code == (
            200 if user in visible else 404
        )
        assert client.get(photo, headers=headers(user)).status_code == (
            200 if user in visible else 404
        )
    login(client)
    assert client.get(f"{ROOT}/issues/{issue_id}").status_code == 200
    assert (
        client.post(
            f"{ROOT}/issues/{issue_id}/status", json=status_body(), headers=login(client)
        ).status_code
        == 200
    )
    assert (
        client.get(f"/api/v1/issues/{issue_id}", headers=headers()).json()["status"]
        == "in_progress"
    )


@pytest.mark.parametrize(
    "scope,category", [("apartment", "elevator"), ("courtyard", "heating"), ("entrance", "yard")]
)
def test_incompatible_ai_subcategories_are_normalized(visibility_api, scope, category):
    client, engine, _ = visibility_api
    issue_id = send(client, analysis(scope=scope, category=category, floor=1))
    with Session(engine) as session:
        assert session.get(Issue, issue_id).category == IssueCategory.OTHER


@pytest.mark.parametrize(
    "coordinates", [{"entrance": 99, "floor": 2}, {"entrance": 1, "floor": 99}, {}]
)
def test_unresolved_indoor_location_is_never_published_by_legacy_caller(
    visibility_api, coordinates
):
    client, _, _ = visibility_api
    issue_id = send(client, analysis(scope="entrance", **coordinates))
    assert client.get(f"/api/v1/issues/{issue_id}", headers=headers()).json()["place"] is None
    assert client.get(f"/api/v1/issues/{issue_id}", headers=headers(104)).status_code == 404


def test_second_apartment_in_same_house_is_selected_by_id_not_first_row(visibility_api):
    client, engine, _ = visibility_api
    with Session(engine) as session:
        session.add(UserApartment(user_id=1, apartment_id=2))
        session.commit()
    issue_id = send(client, analysis(scope="apartment"), apartment_id=2)
    place = client.get(f"/api/v1/issues/{issue_id}", headers=headers()).json()["place"]
    assert place == {"zone": "apartment", "apartment_id": 2, "entrance": 2, "floor": 3}
    assert client.get(f"/api/v1/issues/{issue_id}", headers=headers(102)).status_code == 404
    ambiguous = send(client, analysis(scope="apartment"), apartment_id=None)
    assert client.get(f"/api/v1/issues/{ambiguous}", headers=headers()).json()["place"] is None


def test_prepared_confirmation_is_saved_without_calling_ai_again(visibility_api):
    client, _, _ = visibility_api
    issue_id = send(
        client,
        analysis(scope="unknown", category="garbage"),
        place=ReportPlace(scope="courtyard", zone="courtyard"),
        prepared=True,
    )
    assert client.get(f"/api/v1/issues/{issue_id}", headers=headers(102)).status_code == 200


@pytest.mark.parametrize("apartment_id", [2, 3, 999])
def test_foreign_or_missing_apartment_is_rejected_before_an_issue_is_created(
    visibility_api, apartment_id
):
    client, engine, _ = visibility_api
    with Session(engine) as session:
        before = list(session.scalars(select(Issue.id)))
    with pytest.raises(ValueError, match="Квартира больше не связана"):
        send(client, analysis(scope="apartment"), apartment_id=apartment_id)
    with Session(engine) as session:
        assert list(session.scalars(select(Issue.id))) == before


def test_ai_does_not_get_to_supply_apartment_ids():
    from pydantic import ValidationError

    with pytest.raises(ValidationError):
        ReportAnalysis.model_validate(analysis(scope="apartment", apartment_id=2))
    home = ReportHome(
        apartment_id=17,
        house_id=1,
        address="Дом",
        number=8,
        entrance=2,
        floor=5,
        entrances=3,
        floors=9,
    )
    place = suggest_place(
        home, ReportAnalysis.model_validate(analysis(scope="apartment", entrance=1, floor=1))
    )
    assert (place.apartment_id, place.entrance, place.floor) == (17, 2, 5)


def test_yandex_wire_schema_requires_every_field_but_accepts_unknown_coordinates():
    from app.ai.client import report_response_format
    from jsonschema import Draft202012Validator, ValidationError
    from yandex_ai_studio_sdk._types.schemas import make_response_format_kwargs

    wire = make_response_format_kwargs(report_response_format())
    schema = wire["json_schema"]["schema"]
    validator = Draft202012Validator(schema)
    complete = analysis(scope="unknown", entrance=None, floor=None, zone=None)
    validator.validate(complete)
    for field in complete:
        incomplete = {key: value for key, value in complete.items() if key != field}
        with pytest.raises(ValidationError):
            validator.validate(incomplete)
    assert ReportAnalysis.model_validate(analysis()).scope == "unknown"


def test_dispatcher_flow_rejects_old_confirmation_after_audience_changes(api):
    from uuid import uuid4

    from chatbot.handlers import other_handlers, user_handlers
    from chatbot.middlewares import registration
    from chatbot.middlewares.ai import AIMiddleware
    from chatbot.middlewares.photos import PhotoMiddleware
    from chatbot.states.states import FSMReport
    from maxapi import Dispatcher

    client, engine, _ = api
    model = SimpleNamespace(
        run=AsyncMock(
            return_value=[
                SimpleNamespace(
                    text=json.dumps(analysis(scope="apartment")),
                )
            ]
        )
    )
    storage = SimpleNamespace(save_many=AsyncMock(return_value=[]), delete_many=AsyncMock())
    bot = SimpleNamespace(edit_message=AsyncMock(), send_callback=AsyncMock())
    answer = AsyncMock()

    def event(*, text=None, payload=None):
        user = SimpleNamespace(user_id=101, full_name="Житель")
        return SimpleNamespace(
            update_type="message_callback" if payload is not None else "message_created",
            from_user=user,
            get_ids=lambda: (101, 101),
            callback=SimpleNamespace(payload=payload, user=user, callback_id=uuid4().hex)
            if payload is not None
            else None,
            bot=bot,
            message=SimpleNamespace(
                body=SimpleNamespace(text=text, mid=uuid4().hex, attachments=[]),
                answer=answer,
                edit=AsyncMock(),
            ),
        )

    async def run():
        database = Database(client.app.state.database.engine.url)
        dispatcher = Dispatcher()
        dispatcher.middlewares.extend([AIMiddleware(model), PhotoMiddleware(storage)])
        dispatcher.include_routers(user_handlers.router, other_handlers.router)
        try:
            with (
                patch.object(user_handlers, "session_factory", database.sessions),
                patch.object(issues, "session_factory", database.sessions),
                patch.object(registration, "session_factory", database.sessions),
            ):
                await dispatcher.handle(event(payload="send_report"))
                await dispatcher.handle(event(text="В моей квартире течёт кран"))
                context = dispatcher.contexts[0]
                screen_id = (await context.get_data())["message_id"]
                assert await context.get_state() == FSMReport.confirm
                old = (await context.get_data())["report_confirmation_token"]
                await dispatcher.handle(event(payload="report_edit_place"))
                await dispatcher.handle(event(payload="report_scope_courtyard"))
                current = (await context.get_data())["report_confirmation_token"]
                assert current != old
                await dispatcher.handle(event(payload="report_send_" + old))
                await dispatcher.handle(event(payload="report_cancel_" + old))
                storage.save_many.assert_not_awaited()
                assert (await context.get_data())["report_confirmation_token"] == current
                await dispatcher.handle(event(payload="report_send_" + current))
                assert await context.get_data() == {}
                answer.assert_not_awaited()
                assert {call.kwargs["message_id"] for call in bot.edit_message.await_args_list} == {
                    screen_id
                }
                assert bot.send_callback.await_count == 2
        finally:
            for context in dispatcher.contexts:
                await context.clear()
            await database.close()

    asyncio.run(run(), loop_factory=loop_factory)
    model.run.assert_awaited_once()
    storage.save_many.assert_awaited_once()
    with Session(engine) as session:
        rows = list(session.scalars(select(Issue)))
        assert len(rows) == 1
        assert rows[0].zone == "courtyard" and rows[0].apartment_id is None
