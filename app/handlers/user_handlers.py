from maxapi import Router, F
from maxapi.types import (
    BotStarted,
    MessageCreated,
    CommandStart,
    Command,
    MessageCallback
)
from maxapi.context import MemoryContext

from app.lexicon.lexicon import LEXICON
from app.keyboards.inline import inl_menu, inl_confirm
from app.states.states import FSMReport
from app.filters.message_filters import has_photo_or_text


router = Router()

@router.bot_started()
async def process_bot_start(event: BotStarted):
    await event.bot.send_message(
        chat_id=event.chat_id,
        text=LEXICON["bot_start"],
        attachments=[inl_menu()]
    )


@router.message_created(CommandStart())
async def process_command_start(event: MessageCreated, context: MemoryContext):
    await event.message.answer(
        text=LEXICON["bot_start"],
        attachments=[inl_menu()]
    )

    await context.clear()


@router.message_created(Command("help"))
async def process_command_start(event: MessageCreated, context: MemoryContext):
    await event.message.answer(text=LEXICON["help"])


@router.message_callback(F.callback.payload == "send_report")
async def process_start_report(event: MessageCallback, context: MemoryContext):
    await event.message.edit(
        text=LEXICON["send_report"],
        attachments=[]
    )

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

    await context.set_state(FSMReport.confirm)


@router.message_created(FSMReport.waiting)
async def process_invalid_report(event: MessageCreated,):
    await event.message.answer(LEXICON["invalid_report"])


@router.message_callback(FSMReport.confirm, F.callback.payload == "no")
async def process_cancel_report(event: MessageCallback, context: MemoryContext):
    await event.message.edit(
        text=LEXICON["report_cancelled"],
        attachments=[]
    )

    await context.set_state(FSMReport.waiting)


@router.message_callback(FSMReport.confirm, F.callback.payload == "yes")
async def process_confirm_report(event: MessageCallback, context: MemoryContext):
    await event.message.edit(
        text=LEXICON["report_sent"],
        attachments=[]
    )

    await context.clear()
