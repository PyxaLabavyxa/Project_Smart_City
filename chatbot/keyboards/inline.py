from maxapi.utils.inline_keyboard import InlineKeyboardBuilder, AttachmentType
from maxapi.types import CallbackButton

from sqlalchemy.ext.asyncio import AsyncSession

from chatbot.lexicon.lexicon import LEXICON_INLINE_MENU, LEXICON
from app.database.requests import get_user_houses


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


async def inl_houses(session: AsyncSession, max_user_id: int) -> AttachmentType.INLINE_KEYBOARD:
    houses = await get_user_houses(session, max_user_id)

    if len(houses) <= 1:
        return None

    builder = InlineKeyboardBuilder()

    for index, (id_, address, number) in enumerate(houses):
        button = CallbackButton(
            text=f"{address}, кв. {number}",
            payload=f"house_{id_}",
        )

        if index == 0:
            builder.add(button)
        else:
            builder.row(button)

    return builder.as_markup()


def inl_back_to_menu():
    builder = InlineKeyboardBuilder()

    builder.add(
        CallbackButton(text=LEXICON["back_to_menu"], payload="back_to_menu")
    )

    return builder.as_markup()
