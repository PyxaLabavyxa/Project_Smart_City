from pathlib import Path

import pytest

from app.services.announcement_format import (
    ANNOUNCEMENT_TOPICS,
    announcement_html,
    announcement_message,
)


@pytest.mark.parametrize("topic,label", ANNOUNCEMENT_TOPICS.items())
def test_announcement_includes_selected_topic_and_readable_structure(topic, label):
    result = announcement_html(topic, "Плановые работы", "Завтра с 10 до 12.\nВторой абзац.")
    assert (
        result == f"<b>🔔 Уведомление от УК</b>\n{label}\n\n<b>Плановые работы</b>\n\n"
        "Завтра с 10 до 12.\nВторой абзац."
    )


def test_staff_text_cannot_inject_formatting_links_or_mentions():
    result = announcement_html(
        "other", "<b>Вода & свет</b>", '<a href="max://user/1">Имя</a>\n5 < 10'
    )
    assert "&lt;b&gt;Вода &amp; свет&lt;/b&gt;" in result
    assert "&lt;a href=&quot;max://user/1&quot;&gt;Имя&lt;/a&gt;\n5 &lt; 10" in result
    assert "<a href=" not in result


def test_unknown_legacy_topic_uses_general_announcement():
    assert "📌 Информация для жителей" in announcement_html("legacy", "Тема", "Текст")


def test_staff_preview_topic_labels_match_delivered_messages():
    web = Path(__file__).parents[1] / "smart_city_api" / "staff_web"
    script = (web / "chat-management.js").read_text(encoding="utf-8")
    page = (web / "index.html").read_text(encoding="utf-8")
    for key, label in ANNOUNCEMENT_TOPICS.items():
        assert f'{key}: "{label}"' in script
    assert page.count("🔔 Уведомление от УК") == 2
    assert 'id="announcement-live-topic"' in page
    assert 'id="announcement-final-topic"' in page


def test_long_escaped_text_keeps_all_content_within_max_limit():
    description = "<&>" * 1000
    text, mode = announcement_message("outage", "Вода и свет", description)
    assert mode is None
    assert len(text) <= 4000
    assert text.endswith(description)
    assert "⚠️ Отключение коммунальных услуг" in text


def test_regular_announcement_uses_html_format():
    text, mode = announcement_message("works", "Работы", "Завтра утром.")
    assert mode == "html"
    assert text == announcement_html("works", "Работы", "Завтра утром.")
