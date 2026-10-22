"""Display staff text literally inside the bot's announcement layout."""

from html import escape

ANNOUNCEMENT_HEADING = "🔔 Уведомление от УК"
ANNOUNCEMENT_TOPICS = {
    "outage": "⚠️ Отключение коммунальных услуг",
    "works": "🔧 Ремонт и обслуживание дома",
    "meeting": "👥 Собрание жителей",
    "other": "📌 Информация для жителей",
}


def announcement_topic(topic: str, *, planned_work: bool = False) -> str:
    return "🔧 Запланированные работы" if planned_work else ANNOUNCEMENT_TOPICS.get(
        topic, ANNOUNCEMENT_TOPICS["other"]
    )


def announcement_html(topic: str, title: str, text: str, *, planned_work: bool = False) -> str:
    label = announcement_topic(topic, planned_work=planned_work)
    return f"<b>{ANNOUNCEMENT_HEADING}</b>\n{label}\n\n<b>{escape(title)}</b>\n\n{escape(text)}"


def announcement_message(
    topic: str, title: str, text: str, *, planned_work: bool = False
) -> tuple[str, str | None]:
    formatted = announcement_html(topic, title, text, planned_work=planned_work)
    if len(formatted) <= 4000:
        return formatted, "html"
    # HTML entities can expand a valid 3000-character announcement past MAX's limit.
    label = announcement_topic(topic, planned_work=planned_work)
    return f"{ANNOUNCEMENT_HEADING}\n{label}\n\n{title}\n\n{text}", None
