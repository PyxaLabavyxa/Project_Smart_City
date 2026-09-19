from maxapi import Router
from maxapi.types import BotStarted, MessageCreated, CommandStart

from app.lexicon.lexicon import LEXICON


router = Router()

@router.bot_started()
async def process_bot_start(event: BotStarted):
    await event.bot.send_message(
        chat_id=event.chat_id,
        text=LEXICON["bot_start"]
    )


@router.message_created(CommandStart())
async def process_command_start(event: MessageCreated):
    await event.message.answer(
        text=LEXICON["c_start"]
    )
