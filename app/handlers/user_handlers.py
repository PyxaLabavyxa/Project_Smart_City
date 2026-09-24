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
from app.keyboards.inline import inl_menu, inl_confirm, inl_houses
from app.states.states import FSMReport
from app.filters.message_filters import has_photo_or_text
from app.database.requests import create_user_if_exist
from app.database.session import session_factory
from app.services.issues import submit_issue


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


@router.message_created(Command("help"))
async def process_command_help(event: MessageCreated, context: MemoryContext):
    await event.message.answer(text=LEXICON["help"])


@router.message_callback(F.callback.payload == "send_report")
async def process_start_report(event: MessageCallback, context: MemoryContext):
    async with session_factory() as session:
        keyboard = await inl_houses(
            session,
            event.callback.user.user_id
        )

    if keyboard is None:
        await event.message.edit(
            text=LEXICON["send_report"],
            attachments=[]
        )

        await context.set_state(FSMReport.waiting)
    else:
        await event.message.edit(
            text=LEXICON["choose_house"],
            attachments=[keyboard]
        )

        await context.set_state(FSMReport.choose_house)


@router.message_callback(FSMReport.choose_house, F.callback.payload.startswith("house_"))
async def process_start_report_after_choice(event: MessageCallback, context: MemoryContext):
    house_id = int(event.callback.payload.split("_")[1])

    await event.message.edit(
        text=LEXICON["send_report"],
        attachments=[]
    )

    await context.update_data(house_id=house_id)
    await context.set_state(FSMReport.waiting)


@router.message_created(
    FSMReport.waiting,
    F.func(has_photo_or_text)
)
async def process_get_report(event: MessageCreated, context: MemoryContext):
    await event.message.answer(
        text=LEXICON["confirm_report"],
        attachments=[inl_confirm()]
    )

    await context.update_data(description=event.message.body.text)
    await context.set_state(FSMReport.confirm)


@router.message_created(FSMReport.waiting)
async def process_invalid_report(event: MessageCreated):
    await event.message.answer(LEXICON["invalid_report"])


@router.message_callback(FSMReport.confirm, F.callback.payload == "no")
async def process_cancel_report(event: MessageCallback, context: MemoryContext):
    await event.message.edit(
        text=LEXICON["report_cancelled"],
        attachments=[]
    )

    await context.set_state(FSMReport.waiting)


@router.message_callback(FSMReport.confirm, F.callback.payload == "yes")
async def process_confirm_report(
    event: MessageCallback, context: MemoryContext, report_model: AsyncGPTModel
):
    data = await context.get_data()

    await submit_issue(
        max_user_id=event.callback.user.user_id,
        house_id=data["house_id"],
        description=data["description"],
        report_model=report_model
    )
    
    # async with session_factory.begin() as session:
    #     await create_issue(
    #         session=session,
    #         max_user_id=event.callback.user.user_id,
    #         house_id=data["house_id"],
    #         description=data["description"]
    #     )

    await event.message.edit(
        text=LEXICON["report_sent"],
        attachments=[]
    )

    await context.clear()
