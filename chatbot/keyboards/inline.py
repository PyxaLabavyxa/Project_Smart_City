from maxapi.utils.inline_keyboard import InlineKeyboardBuilder, AttachmentType
from maxapi.types import CallbackButton, OpenAppButton

from chatbot.lexicon.lexicon import LEXICON_INLINE_MENU, LEXICON


def mini_app_button() -> OpenAppButton:
    return OpenAppButton(text="🏙️ Открыть миниапп")


def inl_mini_app():
    builder = InlineKeyboardBuilder()
    builder.row(mini_app_button())
    return builder.as_markup()


def inl_menu() -> AttachmentType.INLINE_KEYBOARD:
    builder = InlineKeyboardBuilder()

    buttons = [
        CallbackButton(text=text, payload=payload)
        for payload, text in LEXICON_INLINE_MENU.items()
    ]

    for button in buttons:
        builder.add(button)

    builder.row(mini_app_button())
    return builder.as_markup()


def inl_confirm() -> AttachmentType.INLINE_KEYBOARD:
    builder = InlineKeyboardBuilder()

    builder.row(
        CallbackButton(text=LEXICON["yes"], payload="yes"),
        CallbackButton(text=LEXICON["no"], payload="no")
    )

    builder.row(mini_app_button())
    return builder.as_markup()


def inl_houses(houses: list[tuple[int, str, int]]) -> AttachmentType.INLINE_KEYBOARD:

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

    builder.row(mini_app_button())
    return builder.as_markup()


def inl_back_to_menu():
    builder = InlineKeyboardBuilder()

    builder.add(
        CallbackButton(text=LEXICON["back_to_menu"], payload="back_to_menu")
    )

    builder.row(mini_app_button())
    return builder.as_markup()
