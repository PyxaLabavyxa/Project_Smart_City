from maxapi import Router, F
from maxapi.types import (
    BotStarted,
    MessageCreated,
    CommandStart,
    Command,
    MessageCallback
)
from maxapi.context import MemoryContext

from yandex_ai_studio_sdk._models.completions.model import AsyncGPTModel

from app.lexicon.lexicon import LEXICON
from app.keyboards.inline import inl_menu, inl_confirm, inl_houses, inl_back_to_menu
from app.states.states import FSMReport, FSMViewingReports
from app.filters.message_filters import has_photo_or_text
from app.database.requests import create_user_if_exist, get_user_houses, get_issue_information
from app.database.session import session_factory
from app.services.issues import submit_issue
from app.services.report_draft import collect_report
from app.storage.photos import LocalPhotoStorage, PhotoError


router = Router()

@router.bot_started()
async def process_bot_start(event: BotStarted):
    from_user = event.from_user

    async with session_factory.begin() as session:
        await create_user_if_exist(
            session=session,
            max_user_id=from_user.user_id,
            name=from_user.full_name
        )

    await event.bot.send_message(
        chat_id=event.chat_id,
        text=LEXICON["bot_start"],
        attachments=[inl_menu()]
    )


@router.message_created(CommandStart())
async def process_command_start(event: MessageCreated, context: MemoryContext):
    from_user = event.from_user

    async with session_factory.begin() as session:
        await create_user_if_exist(
            session=session,
            max_user_id=from_user.user_id,
            name=from_user.full_name
        )

    await event.message.answer(
        text=LEXICON["bot_start"],
        attachments=[inl_menu()]
    )

    await context.clear()


@router.message_callback(
        FSMReport.waiting,
        FSMViewingReports.viewing,
        F.callback.payload == "back_to_menu"
)
async def process_main_menu(event: MessageCreated, context: MemoryContext):
    await context.clear()
    
    await event.message.edit(
        text=LEXICON["bot_start"],
        attachments=[inl_menu()]
    )


@router.message_created(Command("help"))
async def process_command_help(event: MessageCreated):
    await event.message.answer(text=LEXICON["help"])


# начало реализации отправки жалобы
@router.message_callback(F.callback.payload == "send_report")
async def process_start_report(event: MessageCallback, context: MemoryContext):
    await context.clear()

    max_user_id = event.callback.user.user_id

    async with session_factory() as session:
        houses = await get_user_houses(session, max_user_id)

        if len(houses) == 0:
            await event.message.edit(
                text=LEXICON["report_no_house"],
                attachments=[]
            )
            return

    if len(houses) == 1:
        await context.update_data(house_id=houses[0][0])
        
        await event.message.edit(
            text=LEXICON["send_report"],
            attachments=[inl_back_to_menu()]
        )

        await context.update_data(message_id=event.message.body.mid)
        await context.set_state(FSMReport.waiting)
    else:
        keyboard = await inl_houses(
            session,
            max_user_id
        )

        await event.message.edit(
            text=LEXICON["choose_house_send"],
            attachments=[keyboard]
        )

        await context.set_state(FSMReport.choose_house)


@router.message_callback(FSMReport.choose_house, F.callback.payload.startswith("house_"))
async def process_start_report_after_choice(event: MessageCallback, context: MemoryContext):
    house_id = int(event.callback.payload.removeprefix("house_"))

    await event.message.edit(
        text=LEXICON["send_report"],
        attachments=[]
    )

    await context.update_data(house_id=house_id)
    await context.set_state(FSMReport.waiting)


@router.message_created(FSMReport.waiting, F.func(has_photo_or_text))
async def process_get_report(event: MessageCreated, context: MemoryContext):
    data = await context.get_data()

    try:
        new_data = collect_report(data, event.message)
    except PhotoError as exc:
        await event.message.answer(str(exc))
        return

    await event.bot.edit_message(
        message_id=data["message_id"],
        attachments=[]
    )

    if not new_data["description"]:
        await event.message.answer(LEXICON["report_need_text"])
        await context.set_state(FSMReport.get_description)
    else:
        await context.update_data(**new_data)
        await context.set_state(FSMReport.confirm)
       
        await event.message.answer(
            text=LEXICON["confirm_report"],
            attachments=[inl_confirm()]
        )


@router.message_created(FSMReport.waiting)
async def process_invalid_report(event: MessageCreated):
    await event.message.answer(LEXICON["invalid_report"])


@router.message_created(FSMReport.get_description, F.message.body.text)
async def process_get_description(event: MessageCreated, context: MemoryContext):
    await event.message.answer(
        text=LEXICON["confirm_report"],
        attachments=[inl_confirm()]
    )

    await context.set_state(FSMReport.confirm)


@router.message_created(FSMReport.get_description)
async def process_invalid_description(event: MessageCreated):
    await event.message.answer(text=LEXICON["report_invalid_description"])


@router.message_callback(FSMReport.confirm, F.callback.payload == "no")
async def process_cancel_report(event: MessageCallback, context: MemoryContext):
    data = await context.get_data()
    await context.clear()

    if "house_id" in data:
        await context.update_data(house_id=data["house_id"])

    await event.message.edit(
        text=LEXICON["report_cancelled"],
        attachments=[inl_back_to_menu()]
    )

    await context.update_data(message_id=event.message.body.mid)
    await context.set_state(FSMReport.waiting)


@router.message_callback(FSMReport.confirm, F.callback.payload == "yes")
async def process_confirm_report(
    event: MessageCallback, context: MemoryContext, report_model: AsyncGPTModel,
    photo_storage: LocalPhotoStorage,
):
    data = await context.get_data()

    try:
        issue_id = await submit_issue(
            max_user_id=event.callback.user.user_id,
            house_id=data["house_id"],
            description=data.get("description", ""),
            report_model=report_model,
            photo_storage=photo_storage,
            photo_urls=[photo["url"] for photo in data.get("photos", [])],
        )
    
    except PhotoError as exc:
        await event.message.answer(str(exc))
        return
    
    except Exception as exc:
        await event.message.answer(LEXICON["report_save_error"])
        return

    await context.clear()

    await event.message.edit(
        text=LEXICON["report_sent"],
        attachments=[]
    )


# начало реализации просмотра жалоб
@router.message_callback(F.callback.payload == "my_issues")
async def process_my_issues(event: MessageCallback, context: MemoryContext):
    await context.clear()

    max_user_id = event.callback.user.user_id

    async with session_factory() as session:
        houses = await get_user_houses(session, max_user_id)

    if len(houses) == 0:
        await event.message.answer(
            text=LEXICON["report_no_house"],
            attachments=[]
        )
        return

    if len(houses) == 1:
        await context.update_data(house_id=houses[0][0])

        async with session_factory() as session:
            await event.message.edit(
                text=await get_issue_information(
                    session=session,
                    max_user_id=max_user_id,
                    house_id=houses[0][0]
                ),
                attachments=[inl_back_to_menu()]
            )

        await context.set_state(FSMViewingReports.viewing)
    else:
        keyboard = await inl_houses(
            session,
            max_user_id
        )

        await event.message.edit(
            text=LEXICON["choose_house_send"],
            attachments=[keyboard]
        )

        await context.set_state(FSMViewingReports.choose_house)


@router.message_callback(FSMViewingReports.choose_house, F.callback.payload.startswith("house_"))
async def process_my_issues_after_choice(event: MessageCallback, context: MemoryContext):
    house_id = int(event.callback.payload.removeprefix("house_"))

    async with session_factory() as session:
        await event.message.edit(
            text=await get_issue_information(
                session=session,
                max_user_id=event.callback.user.user_id,
                house_id=house_id
            ),
            attachments=[inl_back_to_menu()]
        )

    await context.set_state(FSMViewingReports.viewing)
