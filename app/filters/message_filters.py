from maxapi.enums.attachment import AttachmentType
from maxapi.types import MessageCreated


def has_photo_or_text(event: MessageCreated) -> bool:
    body = event.message.body

    has_text = bool(body.text and body.text.strip())

    has_photo = any(
        getattr(attachment, "type", None) == AttachmentType.IMAGE
        for attachment in (body.attachments or [])
    )

    return has_photo or has_text
