from maxapi.utils.inline_keyboard import InlineKeyboardBuilder, AttachmentType
from maxapi.types import CallbackButton, OpenAppButton, LinkButton

from chatbot.lexicon.lexicon import LEXICON_INLINE_MENU, LEXICON_APP_SECTIONS, LEXICON
from app.config_data.config import read_environment


def mini_app_username() -> str:
    username = read_environment().str("MINI_APP_BOT_USERNAME", "t282_hakaton_max_bot").strip().lstrip("@")
    if not username:
        raise ValueError("MINI_APP_BOT_USERNAME не должен быть пустым")
    return username


def mini_app_button() -> OpenAppButton:
    return OpenAppButton(text=LEXICON["open_mini_app"], web_app=mini_app_username())


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

    username = mini_app_username()
    sections = [
        LinkButton(text=text, url=f"https://max.ru/{username}?startapp={section}")
        for section, text in LEXICON_APP_SECTIONS.items()
    ]
    for index in range(0, len(sections), 2):
        builder.row(*sections[index:index + 2])

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

    builder.row(CallbackButton(text=LEXICON["back_to_menu"], payload="back_to_menu"))
    builder.row(mini_app_button())
    return builder.as_markup()


def inl_back_to_menu():
    builder = InlineKeyboardBuilder()

    builder.add(
        CallbackButton(text=LEXICON["back_to_menu"], payload="back_to_menu")
    )

    builder.row(mini_app_button())
    return builder.as_markup()
