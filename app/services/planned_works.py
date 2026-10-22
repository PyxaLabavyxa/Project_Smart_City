"""Schedule and message formatting shared by staff publishing and bot delivery."""

from datetime import UTC
from zoneinfo import ZoneInfo

from pydantic import (
    AwareDatetime,
    BaseModel,
    ConfigDict,
    Field,
    field_validator,
    model_validator,
)


class WorkSchedule(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    starts_at: AwareDatetime
    ends_at: AwareDatetime | None = None
    location: str = Field(min_length=1, max_length=300)

    @field_validator("location")
    @classmethod
    def clean_location(cls, value):
        if any(ord(c) < 32 or ord(c) == 127 for c in value):
            raise ValueError("Укажите место работ без управляющих символов")
        return value

    @model_validator(mode="after")
    def valid_period(self):
        if self.ends_at is not None and self.ends_at <= self.starts_at:
            raise ValueError("Окончание работ должно быть позже начала")
        self.starts_at = self.starts_at.astimezone(UTC)
        if self.ends_at is not None:
            self.ends_at = self.ends_at.astimezone(UTC)
        return self


TOPICS = {
    "outage": "⚠️ Отключение коммунальных услуг",
    "works": "🔧 Ремонт и обслуживание дома",
    "meeting": "👥 Собрание жителей",
    "other": "ℹ️ Информация для жителей",
}


def announcement_topic(announcement):
    return "🔧 Запланированные работы" if announcement.work else TOPICS[announcement.topic]


def announcement_body(announcement):
    if not announcement.work:
        return announcement.text
    work = WorkSchedule.model_validate(announcement.work)
    zone = ZoneInfo("Europe/Moscow")
    start = work.starts_at.astimezone(zone).strftime("%d.%m.%Y %H:%M")
    if work.ends_at is None:
        period = f"📅 Начало: {start} (МСК)\nСрок окончания уточняется"
    else:
        end = work.ends_at.astimezone(zone).strftime("%d.%m.%Y %H:%M")
        period = f"📅 {start} — {end} (МСК)"
    return f"{period}\n📍 {work.location}\n\n{announcement.text}"


def announcement_message(announcement):
    return (
        f"🔔 Уведомление от УК\n{announcement_topic(announcement)}\n\n"
        f"{announcement.title}\n\n{announcement_body(announcement)}\n\nУправляющая компания"
    )
