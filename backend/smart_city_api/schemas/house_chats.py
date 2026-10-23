from datetime import datetime
from typing import Literal

from app.services.house_chats import normalize_chat_link
from app.services.planned_works import WorkSchedule
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


class ChatOutput(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    house_id: int
    address: str
    chat_id: int | None = None
    title: str = ""
    status: str = "disconnected"
    menu_status: str = "none"
    error: str = ""
    checked_at: datetime | None = None
    revision: int = 0
    join_url: str | None = None
    custom_join_url: str | None = None


class ChatLinkInput(BaseModel):
    chat_id: int
    revision: int = Field(ge=1)
    join_url: str | None = Field(default=None, max_length=1024)

    @field_validator("join_url")
    @classmethod
    def valid_link(cls, value):
        if value is None or not value.strip():
            return None
        link = normalize_chat_link(value)
        if not link:
            raise ValueError("Укажите ссылку на группу вида https://max.ru/join/… без параметров")
        return link


class ResidentChatOutput(BaseModel):
    status: Literal["available", "not_connected", "link_missing", "unavailable"]
    title: str = "Общий чат дома"
    join_url: str | None = None


class ConnectionCode(BaseModel):
    command: str
    expires_at: datetime


class AnnouncementInput(BaseModel):
    topic: Literal["outage", "works", "meeting", "other"]
    title: str = Field(min_length=1, max_length=150)
    text: str = Field(min_length=1, max_length=3000)
    house_ids: list[int] = Field(min_length=1, max_length=100)
    version: int = Field(default=1, ge=1)
    channels: list[Literal["groups", "private"]] = Field(
        default_factory=lambda: ["groups"], min_length=1, max_length=2
    )
    resident_ids: list[int] = Field(default_factory=list, max_length=100)
    audience: Literal["houses", "residents"] = "houses"
    work: WorkSchedule | None = None

    @model_validator(mode="after")
    def valid_audience(self):
        if self.work and (self.topic != "works" or self.audience != "houses"):
            raise ValueError("Запланированные работы публикуются для домов с темой «Работы»")
        if len(set(self.channels)) != len(self.channels):
            raise ValueError("Каналы не должны повторяться")
        if len(set(self.resident_ids)) != len(self.resident_ids) or any(
            i <= 0 for i in self.resident_ids
        ):
            raise ValueError("Выберите жителей без повторов")
        if self.audience == "residents" and (not self.resident_ids or self.channels != ["private"]):
            raise ValueError("Сообщение конкретным жителям можно отправить только лично")
        if self.audience == "houses" and self.resident_ids:
            raise ValueError("Для выбора жителей включите режим конкретных получателей")
        return self

    @field_validator("title", "text")
    @classmethod
    def clean_text(cls, value):
        value = value.strip()
        if not value or any(ord(c) < 32 and c not in "\n\t" for c in value):
            raise ValueError("Заполните текст без управляющих символов")
        return value

    @field_validator("house_ids")
    @classmethod
    def unique_houses(cls, value):
        if len(set(value)) != len(value) or any(i <= 0 for i in value):
            raise ValueError("Выберите дома без повторов")
        return value


class VersionInput(BaseModel):
    version: int = Field(ge=1)


class AnnouncementDeliveryOutput(BaseModel):
    house_id: int
    address: str
    chat_title: str
    status: str
    error: str
    sent_at: datetime | None


class ResidentChoice(BaseModel):
    id: int
    name: str
    max_user_id: int
    apartments: list[str]
    available: bool
    reason: str


class ResidentPage(BaseModel):
    items: list[ResidentChoice]
    total: int


class PrivateAnnouncementDeliveryOutput(BaseModel):
    user_id: int
    name: str
    max_user_id: int | None
    address: str
    available: bool
    status: str
    error: str
    sent_at: datetime | None


class AnnouncementOutput(BaseModel):
    id: int
    topic: str
    title: str
    text: str
    status: str
    version: int
    created_at: datetime
    sent_at: datetime | None
    deliveries: list[AnnouncementDeliveryOutput]
    house_ids: list[int]
    channels: list[str]
    resident_ids: list[int]
    private_deliveries: list[PrivateAnnouncementDeliveryOutput]
    excluded_count: int
    audience: str
    work: WorkSchedule | None = None
    message_body: str = ""
    message_topic: str = ""
    work_completed_at: datetime | None = None


class AnnouncementPage(BaseModel):
    items: list[AnnouncementOutput]
    total: int
