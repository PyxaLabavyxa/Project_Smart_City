from maxapi.utils.inline_keyboard import InlineKeyboardBuilder, AttachmentType
from maxapi.types import CallbackButton

from app.lexicon.lexicon import LEXICON_INLINE_MENU, LEXICON


def inl_menu() -> AttachmentType.INLINE_KEYBOARD:
    builder = InlineKeyboardBuilder()

    buttons = [
        CallbackButton(text=text, payload=payload)
        for payload, text in LEXICON_INLINE_MENU.items()
    ]

    for button in buttons:
        builder.add(button)

    return builder.as_markup()


def inl_confirm() -> AttachmentType.INLINE_KEYBOARD:
    builder = InlineKeyboardBuilder()

    builder.row(
        CallbackButton(text=LEXICON["yes"], payload="yes"),
        CallbackButton(text=LEXICON["no"], payload="no")
    )

    return builder.as_markup()
