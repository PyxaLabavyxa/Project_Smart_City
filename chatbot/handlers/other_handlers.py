from maxapi import Router
from maxapi.types import MessageCreated

from chatbot.lexicon.lexicon import LEXICON
from chatbot.keyboards.inline import inl_menu

router = Router()

# хендлер для ответа на не обрабатываемые сообщения
@router.message_created()
async def process_other_answer(event: MessageCreated):
    # await event.bot.delete_message(event.message.body.mid)
    await event.message.answer(LEXICON["unknown_message"], attachments=[inl_menu()])
