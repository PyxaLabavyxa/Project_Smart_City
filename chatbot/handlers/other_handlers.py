from maxapi import Router
from maxapi.types import MessageCreated

from chatbot.lexicon.lexicon import LEXICON
from chatbot.keyboards.inline import inl_menu

router = Router()

@router.message_created()
async def process_other_answer(event: MessageCreated):
    await event.message.answer(LEXICON["unknown_message"], attachments=[inl_menu()])
