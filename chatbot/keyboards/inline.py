from maxapi.types import CallbackButton, LinkButton, OpenAppButton
from maxapi.utils.inline_keyboard import AttachmentType, InlineKeyboardBuilder

from app.config_data.config import read_environment
from app.database.enums import ISSUE_CATEGORIES_BY_SCOPE, IssueScope
from app.services.report_locations import ReportHome
from chatbot.lexicon.lexicon import (
    LEXICON,
    LEXICON_APP_SECTIONS,
    LEXICON_INLINE_MENU,
    REPORT_CATEGORY_LABELS,
    REPORT_SCOPE_LABELS,
)


def mini_app_username() -> str:
    username = (
        read_environment()
        .str("MINI_APP_BOT_USERNAME", "t282_hakaton_max_bot")
        .strip()
        .lstrip("@")
    )
    if not username:
        raise ValueError("MINI_APP_BOT_USERNAME не должен быть пустым")
    return username


def mini_app_button() -> OpenAppButton:
    return OpenAppButton(text=LEXICON["open_mini_app"], web_app=mini_app_username())


def issue_app_button(issue_id: int) -> LinkButton:
    return LinkButton(
        text=LEXICON["write_to_staff"],
        url=f"https://max.ru/{mini_app_username()}?startapp=issue_{issue_id}",
    )


def inl_mini_app():
    builder = InlineKeyboardBuilder()
    builder.row(mini_app_button())
    return builder.as_markup()


def inl_notification(*, issue_id: int | None = None):
    builder = InlineKeyboardBuilder()
    if issue_id is not None:
        builder.add(issue_app_button(issue_id))
        builder.row(mini_app_button())
    else:
        builder.add(mini_app_button())
    builder.row(
        CallbackButton(text=LEXICON["back_to_menu"], payload="open_main_menu")
    )
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
        builder.row(*sections[index : index + 2])

    builder.row(mini_app_button())
    return builder.as_markup()


def inl_confirm(confirmation_token: str) -> AttachmentType.INLINE_KEYBOARD:
    return _report_markup(
        [
            [
                CallbackButton(
                    text=LEXICON["yes"], payload=f"report_send_{confirmation_token}"
                ),
                CallbackButton(
                    text=LEXICON["no"], payload=f"report_cancel_{confirmation_token}"
                ),
            ],
            [
                CallbackButton(
                    text=LEXICON["report_change_place"], payload="report_edit_place"
                ),
                CallbackButton(
                    text=LEXICON["report_change_category"],
                    payload="report_edit_category",
                ),
            ],
            [mini_app_button()],
        ]
    )


def _report_markup(rows):
    builder = InlineKeyboardBuilder()
    for index, row in enumerate(rows):
        if index == 0:
            for button in row:
                builder.add(button)
        else:
            builder.row(*row)
    return builder.as_markup()


def inl_report_homes(homes: list[ReportHome]):
    rows = []
    for home in homes:
        address = home.address if len(home.address) <= 90 else home.address[:87] + "…"
        rows.append(
            [
                CallbackButton(
                    text=f"{address}, кв. {home.number}",
                    payload=f"report_home_{home.apartment_id}",
                )
            ]
        )
    rows.extend(
        [
            [CallbackButton(text=LEXICON["back_to_menu"], payload="back_to_menu")],
            [mini_app_button()],
        ]
    )
    return _report_markup(rows)


def inl_report_scopes():
    rows = [
        [CallbackButton(text=label, payload=f"report_scope_{scope}")]
        for scope, label in REPORT_SCOPE_LABELS.items()
    ]
    rows.append([CallbackButton(text=LEXICON["back_to_menu"], payload="back_to_menu")])
    return _report_markup(rows)


def inl_report_place_back(*, entrance: int | None = None):
    rows = []
    if entrance is not None:
        rows.append(
            [
                CallbackButton(
                    text=f"Мой подъезд · {entrance}",
                    payload=f"report_entrance_{entrance}",
                )
            ]
        )
    rows.extend(
        [
            [
                CallbackButton(
                    text=LEXICON["report_change_place"], payload="report_edit_place"
                )
            ],
            [CallbackButton(text=LEXICON["back_to_menu"], payload="back_to_menu")],
        ]
    )
    return _report_markup(rows)


def inl_report_categories(scope: IssueScope):
    buttons = [
        CallbackButton(text=label, payload=f"report_category_{code}")
        for code, label in REPORT_CATEGORY_LABELS.items()
        if code in ISSUE_CATEGORIES_BY_SCOPE[scope]
    ]
    rows = [buttons[index : index + 2] for index in range(0, len(buttons), 2)]
    rows.extend(
        [
            [
                CallbackButton(
                    text=LEXICON["report_change_place"], payload="report_edit_place"
                )
            ],
            [CallbackButton(text=LEXICON["back_to_menu"], payload="back_to_menu")],
        ]
    )
    return _report_markup(rows)


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


def inl_back_to_menu(*, issue_id: int | None = None):
    builder = InlineKeyboardBuilder()
    back_button = CallbackButton(text=LEXICON["back_to_menu"], payload="back_to_menu")

    if issue_id is not None:
        builder.add(issue_app_button(issue_id))
        builder.row(back_button)
    else:
        builder.add(back_button)

    builder.row(mini_app_button())
    return builder.as_markup()
