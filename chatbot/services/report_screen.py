from maxapi.types.errors import Error


async def update_report_screen(event, context, text: str, *, attachments=None):
    """Keep the draft in one bot message, including after residents type a reply."""
    data = await context.get_data()
    message_id = data.get("message_id")
    if message_id is None and getattr(event, "callback", None) is not None:
        message_id = str(event.message.body.mid)
    attachments = attachments or []
    content = {
        "message_id": message_id,
        "text": text,
        "attachments": [item.model_dump(mode="json") for item in attachments],
    }
    if message_id and data.get("report_screen") == content:
        return

    if message_id:
        result = await event.bot.edit_message(
            message_id=message_id, text=text, attachments=attachments, notify=False
        )
        if isinstance(result, Error):
            if result.code != 404:
                raise RuntimeError(f"Could not update report screen: {result.code}")
            message_id = None
    if message_id is None:
        # A missing/deleted message is the only reason to create a replacement.
        result = await event.message.answer(
            text=text, attachments=attachments, notify=False
        )
        if isinstance(result, Error):
            raise RuntimeError(f"Could not create report screen: {result.code}")
        message_id = str(result.message.body.mid)

    current = await context.get_data()
    identity = ("report_analysis_token", "house_id", "apartment_id", "message_id")
    if all(current.get(key) == data.get(key) for key in identity):
        content["message_id"] = message_id
        await context.update_data(message_id=message_id, report_screen=content)
