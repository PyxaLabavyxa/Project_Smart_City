from maxapi import Router
from maxapi.types import MessageCreated


router = Router()

# хендлер для ответа на не обрабатываемые сообщения
@router.message_created()
async def process_other_answer(event: MessageCreated):
    # await event.bot.delete_message(event.message.body.mid)
    await event.message.answer("Игнорю")
