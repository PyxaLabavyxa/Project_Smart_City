import logging
import re
from uuid import uuid4

from maxapi import F, Router
from maxapi.context import MemoryContext
from maxapi.types import (
    BotStarted,
    Command,
    CommandStart,
    MessageCallback,
    MessageCreated,
)
from yandex_ai_studio_sdk._models.completions.model import AsyncGPTModel

from app.ai.schemas import ReportAnalysis
from app.database.enums import ISSUE_CATEGORIES_BY_SCOPE, IssueCategory, IssueScope
from app.database.requests import get_user_houses
from app.database.session import session_factory
from app.services.issues import analyze_report, submit_issue
from app.services.report_locations import (
    ReportHome,
    ReportPlace,
    category_for_place,
    get_report_homes,
    suggest_place,
    validate_report_place,
)
from app.storage.photos import LocalPhotoStorage, PhotoError
from chatbot.filters.message_filters import has_photo_or_text
from chatbot.handlers.registration import initial_prompt
from chatbot.keyboards.inline import (
    inl_back_to_menu,
    inl_confirm,
    inl_houses,
    inl_menu,
    inl_mini_app,
    inl_report_categories,
    inl_report_homes,
    inl_report_place_back,
    inl_report_scopes,
)
from chatbot.lexicon.lexicon import LEXICON
from chatbot.middlewares.registration import RegistrationRequiredMiddleware
from chatbot.services.issue_information import get_issue_information
from chatbot.services.report_draft import collect_report
from chatbot.services.report_preview import report_preview
from chatbot.services.report_screen import update_report_screen
from chatbot.states.states import FSMReport, FSMViewingReports

router = Router()
router.middlewares.append(RegistrationRequiredMiddleware())
start_router = Router()
logger = logging.getLogger(__name__)


@start_router.bot_started()
async def process_bot_start(event: BotStarted):
    text, buttons = await initial_prompt(
        event.from_user.user_id, event.from_user.full_name
    )
    await event.bot.send_message(
        chat_id=event.chat_id, text=text, attachments=[buttons]
    )


@start_router.message_created(CommandStart())
async def process_command_start(event: MessageCreated, context: MemoryContext):
    await context.clear()
    text, buttons = await initial_prompt(
        event.from_user.user_id, event.from_user.full_name
    )
    await event.message.answer(text=text, attachments=[buttons])


@router.message_callback(F.callback.payload == "back_to_menu")
async def process_main_menu(event: MessageCreated, context: MemoryContext):
    await context.clear()

    await event.message.edit(text=LEXICON["bot_start"], attachments=[inl_menu()])


@router.message_created(Command("help"))
async def process_command_help(event: MessageCreated):
    await event.message.answer(text=LEXICON["help"], attachments=[inl_menu()])


@router.message_callback(F.callback.payload == "send_report")
async def process_start_report(event: MessageCallback, context: MemoryContext):
    await context.clear()

    max_user_id = event.callback.user.user_id

    async with session_factory() as session:
        homes = await get_report_homes(session, max_user_id)

        if len(homes) == 0:
            await update_report_screen(
                event,
                context,
                text=LEXICON["report_no_house"],
                attachments=[inl_mini_app()],
            )
            return

    if len(homes) == 1:
        await context.update_data(
            house_id=homes[0].house_id, apartment_id=homes[0].apartment_id
        )

        await update_report_screen(
            event,
            context,
            text=LEXICON["send_report"],
            attachments=[inl_back_to_menu()],
        )

        await context.set_state(FSMReport.waiting)
    else:
        keyboard = inl_report_homes(homes)

        await update_report_screen(
            event, context, text=LEXICON["choose_house_send"], attachments=[keyboard]
        )

        await context.set_state(FSMReport.choose_house)


@router.message_callback(
    FSMReport.choose_house, F.callback.payload.startswith("house_")
)
async def process_start_report_after_choice(
    event: MessageCallback, context: MemoryContext
):
    # Cached keyboards used house IDs. Resolve them without picking a random apartment.
    raw = event.callback.payload.removeprefix("house_")
    async with session_factory() as session:
        homes = await get_report_homes(session, event.callback.user.user_id)
    matching = [home for home in homes if raw == str(home.house_id)]
    if len(matching) != 1:
        await update_report_screen(
            event,
            context,
            LEXICON["choose_house_send"],
            attachments=[inl_report_homes(matching or homes)],
        )
        return
    await start_report_home(event, context, matching[0])


@router.message_callback(
    FSMReport.choose_house, F.callback.payload.startswith("report_home_")
)
async def process_report_home(event: MessageCallback, context: MemoryContext):
    raw = event.callback.payload.removeprefix("report_home_")
    async with session_factory() as session:
        homes = await get_report_homes(session, event.callback.user.user_id)
    home = next((home for home in homes if str(home.apartment_id) == raw), None)
    if home is None:
        await update_report_screen(
            event,
            context,
            LEXICON["report_home_unavailable"],
            attachments=[inl_report_homes(homes)],
        )
        return
    await start_report_home(event, context, home)


async def start_report_home(event, context: MemoryContext, home: ReportHome):
    await context.update_data(house_id=home.house_id, apartment_id=home.apartment_id)
    data = await context.get_data()
    if data.get("report_analysis") and data.get("description"):
        analysis = ReportAnalysis.model_validate(data["report_analysis"])
        await context.update_data(
            report_place=suggest_place(home, analysis).model_dump(mode="json")
        )
        await show_report_step(event, context)
        return

    await update_report_screen(
        event, context, text=LEXICON["send_report"], attachments=[inl_back_to_menu()]
    )

    await context.set_state(FSMReport.waiting)


@router.message_created(FSMReport.waiting, F.func(has_photo_or_text))
async def process_get_report(
    event: MessageCreated, context: MemoryContext, report_model: AsyncGPTModel
):
    data = await context.get_data()

    try:
        new_data = collect_report(data, event.message)
    except PhotoError as exc:
        await update_report_screen(
            event, context, str(exc), attachments=[inl_back_to_menu()]
        )
        return

    await context.update_data(**new_data)

    if not new_data["description"]:
        await update_report_screen(
            event,
            context,
            text=LEXICON["report_need_text"],
            attachments=[inl_back_to_menu()],
        )
        await context.set_state(FSMReport.get_description)
    else:
        await prepare_report_confirmation(event, context, report_model)


@router.message_created(FSMReport.waiting)
async def process_invalid_report(event: MessageCreated, context: MemoryContext):
    await update_report_screen(
        event, context, LEXICON["invalid_report"], attachments=[inl_back_to_menu()]
    )


@router.message_created(FSMReport.get_description, F.message.body.text)
async def process_get_description(
    event: MessageCreated, context: MemoryContext, report_model: AsyncGPTModel
):
    data = await context.get_data()

    try:
        new_data = collect_report(data, event.message)
    except PhotoError as exc:
        await update_report_screen(
            event, context, str(exc), attachments=[inl_back_to_menu()]
        )
        return

    if not new_data["description"]:
        await update_report_screen(
            event,
            context,
            LEXICON["report_invalid_description"],
            attachments=[inl_back_to_menu()],
        )
        return

    await context.update_data(**new_data)

    await prepare_report_confirmation(event, context, report_model)


async def draft_home(event, context):
    data = await context.get_data()
    user = event.callback.user if getattr(event, "callback", None) else event.from_user
    async with session_factory() as session:
        homes = await get_report_homes(session, user.user_id)
    current = await context.get_data()
    identity = ("house_id", "apartment_id", "report_analysis_token")
    if any(current.get(key) != data.get(key) for key in identity):
        return None, homes
    matching = [home for home in homes if home.house_id == data.get("house_id")]
    home = next(
        (home for home in matching if home.apartment_id == data.get("apartment_id")),
        None,
    )
    if home is None and data.get("apartment_id") is None and len(matching) == 1:
        home = matching[0]
        await context.update_data(apartment_id=home.apartment_id)
    return home, homes


async def prepare_report_confirmation(event, context, report_model):
    data = await context.get_data()
    token = uuid4().hex
    await context.update_data(report_analysis_token=token)
    await context.set_state(FSMReport.analyzing)
    await update_report_screen(
        event, context, LEXICON["report_analyzing"], attachments=[inl_back_to_menu()]
    )
    analysis = await analyze_report(data["description"], report_model)
    current = await context.get_data()
    if current.get("report_analysis_token") != token:
        return  # The resident cancelled or started another report while the model was running.
    await context.update_data(
        report_analysis=analysis.model_dump(mode="json"),
        report_description=data["description"],
    )
    home, _ = await draft_home(event, context)
    if (await context.get_data()).get("report_analysis_token") != token:
        return
    place = suggest_place(home, analysis) if home else ReportPlace()
    await context.update_data(report_place=place.model_dump(mode="json"))
    await show_report_step(event, context)


async def show_report_step(event, context, *, notice: str | None = None):
    async def render(text, *, attachments):
        await update_report_screen(
            event,
            context,
            f"{notice}\n\n{text}" if notice else text,
            attachments=attachments,
        )

    initial = await context.get_data()
    if not initial.get("report_analysis"):
        return
    home, homes = await draft_home(event, context)
    data = await context.get_data()
    if not data.get("report_analysis") or data.get(
        "report_analysis_token"
    ) != initial.get("report_analysis_token"):
        return
    if home is None:
        await context.set_state(FSMReport.choose_house)
        await render(
            LEXICON["report_home_unavailable"], attachments=[inl_report_homes(homes)]
        )
        return
    place = ReportPlace.model_validate(data.get("report_place", {}))
    if place.scope == IssueScope.UNKNOWN:
        await context.set_state(FSMReport.choose_scope)
        await render(LEXICON["report_choose_scope"], attachments=[inl_report_scopes()])
    elif place.scope == IssueScope.ENTRANCE and place.entrance is None:
        await context.set_state(FSMReport.choose_entrance)
        await render(
            LEXICON["report_choose_entrance"].format(maximum=home.entrances),
            attachments=[inl_report_place_back(entrance=home.entrance)],
        )
    elif place.scope == IssueScope.ENTRANCE and place.floor is None:
        await context.set_state(FSMReport.choose_floor)
        await render(
            LEXICON["report_choose_floor"].format(
                entrance=place.entrance, maximum=home.floors
            ),
            attachments=[inl_report_place_back()],
        )
    else:
        place = validate_report_place(home, place)
        analysis = ReportAnalysis.model_validate(data["report_analysis"])
        analysis = analysis.model_copy(
            update={"category": category_for_place(analysis.category, place)}
        )
        await context.update_data(report_place=place.model_dump(mode="json"))
        confirmation_token = uuid4().hex[:16]
        await context.update_data(report_confirmation_token=confirmation_token)
        await context.set_state(FSMReport.confirm)
        await render(
            report_preview(home, analysis, place, len(data.get("photos", []))),
            attachments=[inl_confirm(confirmation_token)],
        )


@router.message_created(FSMReport.analyzing)
async def process_analysis_wait(event: MessageCreated, context: MemoryContext):
    await update_report_screen(
        event,
        context,
        LEXICON["report_analysis_wait"],
        attachments=[inl_back_to_menu()],
    )


@router.message_callback(F.callback.payload == "report_edit_place")
async def process_edit_report_place(event: MessageCallback, context: MemoryContext):
    if await context.get_state() not in (
        FSMReport.confirm,
        FSMReport.choose_scope,
        FSMReport.choose_entrance,
        FSMReport.choose_floor,
        FSMReport.choose_category,
    ):
        return
    await context.set_state(FSMReport.choose_scope)
    await update_report_screen(
        event,
        context,
        text=LEXICON["report_choose_scope"],
        attachments=[inl_report_scopes()],
    )


@router.message_callback(
    FSMReport.choose_scope, F.callback.payload.startswith("report_scope_")
)
async def process_report_scope(event: MessageCallback, context: MemoryContext):
    raw = event.callback.payload.removeprefix("report_scope_")
    if raw not in {"apartment", "entrance", "courtyard"}:
        return
    home, _ = await draft_home(event, context)
    if home is None:
        await show_report_step(event, context)
        return
    data = await context.get_data()
    analysis = ReportAnalysis.model_validate(data["report_analysis"])
    # A manual change starts with actual profile data, not old AI coordinates.
    edited = analysis.model_copy(
        update={
            "scope": IssueScope(raw),
            "entrance": None,
            "floor": None,
            "zone": analysis.zone if raw == analysis.scope else None,
        }
    )
    place = suggest_place(home, edited)
    if place.scope == IssueScope.ENTRANCE and home.entrances > 1:
        place.entrance = None
    await context.update_data(report_place=place.model_dump(mode="json"))
    await show_report_step(event, context)


async def set_report_number(event, context, raw, field):
    home, _ = await draft_home(event, context)
    if home is None:
        await show_report_step(event, context)
        return
    maximum = home.entrances if field == "entrance" else home.floors
    if not re.fullmatch(r"[0-9]{1,3}", raw) or not 1 <= int(raw) <= maximum:
        await show_report_step(
            event,
            context,
            notice=LEXICON["report_invalid_number"].format(maximum=maximum),
        )
        return
    data = await context.get_data()
    place = ReportPlace.model_validate(data["report_place"])
    setattr(place, field, int(raw))
    if place.zone == "entrance" and place.floor not in (None, 1):
        place.zone = "corridor"
    await context.update_data(report_place=place.model_dump(mode="json"))
    await show_report_step(event, context)


@router.message_created(FSMReport.choose_entrance)
async def process_report_entrance(event: MessageCreated, context: MemoryContext):
    await set_report_number(
        event, context, (event.message.body.text or "").strip(), "entrance"
    )


@router.message_callback(
    FSMReport.choose_entrance, F.callback.payload.startswith("report_entrance_")
)
async def process_report_own_entrance(event: MessageCallback, context: MemoryContext):
    await set_report_number(
        event,
        context,
        event.callback.payload.removeprefix("report_entrance_"),
        "entrance",
    )


@router.message_created(FSMReport.choose_floor)
async def process_report_floor(event: MessageCreated, context: MemoryContext):
    await set_report_number(
        event, context, (event.message.body.text or "").strip(), "floor"
    )


@router.message_callback(
    FSMReport.confirm, F.callback.payload == "report_edit_category"
)
async def process_edit_report_category(event: MessageCallback, context: MemoryContext):
    data = await context.get_data()
    place = ReportPlace.model_validate(data["report_place"])
    await context.set_state(FSMReport.choose_category)
    await update_report_screen(
        event,
        context,
        text=LEXICON["report_choose_category"],
        attachments=[inl_report_categories(place.scope)],
    )


@router.message_callback(
    FSMReport.choose_category, F.callback.payload.startswith("report_category_")
)
async def process_report_category(event: MessageCallback, context: MemoryContext):
    data = await context.get_data()
    place = ReportPlace.model_validate(data["report_place"])
    code = event.callback.payload.removeprefix("report_category_")
    if code not in ISSUE_CATEGORIES_BY_SCOPE.get(place.scope, set()):
        return
    analysis = ReportAnalysis.model_validate(data["report_analysis"])
    analysis.category = IssueCategory(code)
    await context.update_data(report_analysis=analysis.model_dump(mode="json"))
    await show_report_step(event, context)


@router.message_created(FSMReport.get_description)
async def process_invalid_description(event: MessageCreated, context: MemoryContext):
    await update_report_screen(
        event,
        context,
        LEXICON["report_invalid_description"],
        attachments=[inl_back_to_menu()],
    )


@router.message_callback(
    FSMReport.confirm,
    (F.callback.payload == "no") | F.callback.payload.startswith("report_cancel_"),
)
async def process_cancel_report(event: MessageCallback, context: MemoryContext):
    data = await context.get_data()
    if (
        event.callback.payload
        != f"report_cancel_{data.get('report_confirmation_token')}"
    ):
        await event.bot.send_callback(
            callback_id=event.callback.callback_id,
            notification=LEXICON["report_stale_confirmation"],
        )
        return
    await context.clear()

    if "house_id" in data:
        await context.update_data(
            house_id=data["house_id"], apartment_id=data.get("apartment_id")
        )

    await context.update_data(
        message_id=data.get("message_id") or event.message.body.mid
    )
    await update_report_screen(
        event,
        context,
        text=LEXICON["report_cancelled"],
        attachments=[inl_back_to_menu()],
    )

    await context.set_state(FSMReport.waiting)


@router.message_callback(
    FSMReport.confirm,
    (F.callback.payload == "yes") | F.callback.payload.startswith("report_send_"),
)
async def process_confirm_report(
    event: MessageCallback,
    context: MemoryContext,
    report_model: AsyncGPTModel,
    photo_storage: LocalPhotoStorage,
):
    if await context.get_state() != FSMReport.confirm:
        return
    data = await context.get_data()

    if not data.get("report_analysis") or data.get("report_description") != data.get(
        "description"
    ):
        await prepare_report_confirmation(event, context, report_model)
        return
    if event.callback.payload == "yes":
        await show_report_step(event, context)
        return
    if event.callback.payload != f"report_send_{data.get('report_confirmation_token')}":
        await event.bot.send_callback(
            callback_id=event.callback.callback_id,
            notification=LEXICON["report_stale_confirmation"],
        )
        return

    await context.set_state(FSMReport.submitting)
    try:
        home, _ = await draft_home(event, context)
        place = ReportPlace.model_validate(data.get("report_place", {}))
        if home is None or not place.ready:
            await show_report_step(event, context)
            return
        place = validate_report_place(home, place)
        analysis = ReportAnalysis.model_validate(data["report_analysis"])
        await update_report_screen(event, context, LEXICON["report_sending"])
        issue_id = await submit_issue(
            max_user_id=event.callback.user.user_id,
            house_id=data["house_id"],
            description=data.get("description", ""),
            report_model=report_model,
            photo_storage=photo_storage,
            photo_urls=[photo["url"] for photo in data.get("photos", [])],
            analysis=analysis,
            apartment_id=home.apartment_id,
            place=place,
        )

    except PhotoError as exc:
        if (await context.get_data()).get("report_analysis_token") == data.get(
            "report_analysis_token"
        ):
            await show_report_step(event, context, notice=str(exc))
        return

    except Exception as exc:  # noqa: BLE001 -- Keep the draft for retries on storage/DB failures.
        if (await context.get_data()).get("report_analysis_token") == data.get(
            "report_analysis_token"
        ):
            await show_report_step(event, context, notice=LEXICON["report_save_error"])
        logger.error("Issue submission failed: %s", type(exc).__name__)
        return

    if (await context.get_data()).get("report_analysis_token") != data.get(
        "report_analysis_token"
    ):
        await event.message.answer(
            LEXICON["report_sent"], attachments=[inl_back_to_menu(issue_id=issue_id)]
        )
        return
    await update_report_screen(
        event,
        context,
        text=LEXICON["report_sent"],
        attachments=[inl_back_to_menu(issue_id=issue_id)],
    )
    if (await context.get_data()).get("report_analysis_token") == data.get(
        "report_analysis_token"
    ):
        await context.clear()


@router.message_created(FSMReport.submitting)
async def process_submission_wait(event: MessageCreated, context: MemoryContext):
    await update_report_screen(event, context, LEXICON["report_sending"])


@router.message_callback(F.callback.payload == "my_issues")
async def process_my_issues(event: MessageCallback, context: MemoryContext):
    await context.clear()

    max_user_id = event.callback.user.user_id

    async with session_factory() as session:
        houses = await get_user_houses(session, max_user_id)

    if len(houses) == 0:
        await event.message.answer(
            text=LEXICON["report_no_house"], attachments=[inl_mini_app()]
        )
        return

    if len(houses) == 1:
        await context.update_data(house_id=houses[0][0])

        async with session_factory() as session:
            text, issue_id = await get_issue_information(
                session=session, max_user_id=max_user_id, house_id=houses[0][0]
            )

        await event.message.edit(
            text=text, attachments=[inl_back_to_menu(issue_id=issue_id)]
        )

        await context.set_state(FSMViewingReports.viewing)
    else:
        keyboard = inl_houses(houses)

        await event.message.edit(
            text=LEXICON["choose_house_view"], attachments=[keyboard]
        )

        await context.set_state(FSMViewingReports.choose_house)


@router.message_callback(
    FSMViewingReports.choose_house, F.callback.payload.startswith("house_")
)
async def process_my_issues_after_choice(
    event: MessageCallback, context: MemoryContext
):
    house_id = int(event.callback.payload.removeprefix("house_"))

    async with session_factory() as session:
        text, issue_id = await get_issue_information(
            session=session, max_user_id=event.callback.user.user_id, house_id=house_id
        )

    await event.message.edit(
        text=text, attachments=[inl_back_to_menu(issue_id=issue_id)]
    )

    await context.set_state(FSMViewingReports.viewing)
