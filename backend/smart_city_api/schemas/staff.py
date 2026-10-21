import re
from datetime import datetime
from typing import Literal
from uuid import UUID

from app.database.enums import IssueCategory, IssuePriority, IssueStatus
from pydantic import BaseModel, ConfigDict, Field, SecretStr, field_validator, model_validator

from smart_city_api.schemas.app import CreateIssue
from smart_city_api.schemas.chat_photo import ChatPhotoOutput


class LoginInput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    login: str = Field(min_length=1, max_length=80)
    password: SecretStr = Field(min_length=1, max_length=256)

    @field_validator("login")
    @classmethod
    def normalize_login(cls, value: str) -> str:
        return value.strip().lower()


class StaffTokenOutput(BaseModel):
    access_token: str
    token_type: Literal["bearer"] = "bearer"
    expires_in: int


class HouseOutput(BaseModel):
    id: int
    address: str
    entrances_count: int | None = None
    floors_count: int | None = None


class ProfileOutput(BaseModel):
    name: str
    houses: list[HouseOutput]
    contact_houses: list[HouseOutput]
    csrf_token: str


class StatusInput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    status: IssueStatus
    expected_status: IssueStatus
    request_id: UUID


class RejectInput(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    reason: str = Field(min_length=3, max_length=1500)
    expected_status: IssueStatus
    request_id: UUID


class MessageInput(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    text: str = Field(min_length=1, max_length=1500)
    request_id: UUID


class IssueRow(BaseModel):
    id: int
    title: str
    description: str
    category: IssueCategory
    priority: IssuePriority
    status: IssueStatus
    created_at: datetime
    house_id: int
    address: str
    author: str
    entrance: int | None
    floor: int | None
    zone: str | None
    apartment: int | None
    photo_count: int


class StaffIssuePage(BaseModel):
    items: list[IssueRow]
    total: int
    page: int
    page_size: int
    counts: dict[str, int]


class PhotoOutput(BaseModel):
    id: int
    url: str


class EventOutput(BaseModel):
    status: str
    created_at: datetime


class MessageOutput(BaseModel):
    photos: list[ChatPhotoOutput] = Field(default_factory=list)
    id: int
    direction: Literal["staff", "resident"]
    author: str
    text: str
    created_at: datetime


class DeliveryOutput(BaseModel):
    id: int
    kind: str
    status: str | None
    message_id: int | None
    author: str
    delivery: Literal["sent", "pending", "retrying", "read", "not_required"]
    created_at: datetime


class IssueDetail(IssueRow):
    resident_id: int | None = None
    reporter_phone: str | None = None
    reporter_apartment: int | None = None
    created_by: str | None = None
    photos: list[PhotoOutput]
    history: list[EventOutput]
    messages: list[MessageOutput]
    notifications: list[DeliveryOutput]


class ActionOutput(BaseModel):
    notification_id: int | None
    changed: bool = True


class StaffCreateIssue(CreateIssue):
    house_id: int = Field(gt=0)
    resident_id: int | None = Field(default=None, gt=0)
    reporter_name: str | None = Field(default=None, min_length=1, max_length=200)
    reporter_phone: str | None = Field(default=None, min_length=3, max_length=40)
    reporter_apartment_id: int | None = Field(default=None, gt=0)

    @model_validator(mode="after")
    def check_reporter(self):
        if self.resident_id is None and (not self.reporter_name or not self.reporter_phone):
            raise ValueError("Укажите имя и телефон заявителя")
        if self.resident_id is not None and self.reporter_name is not None:
            raise ValueError("Имя зарегистрированного жителя определяется по аккаунту")
        if self.reporter_phone and (
            not re.fullmatch(r"\+?[0-9 ()-]+", self.reporter_phone)
            or not 3 <= len(re.sub(r"\D", "", self.reporter_phone)) <= 15
        ):
            raise ValueError("Укажите корректный номер телефона")
        return self


class ReportApartment(BaseModel):
    id: int
    number: int
    entrance: int
    floor: int


class StaffIssueOptions(BaseModel):
    apartments: list[ReportApartment]
    categories: dict[str, list[IssueCategory]]


class ReportResident(BaseModel):
    id: int
    name: str
    apartments: list[ReportApartment]


class ReportResidentPage(BaseModel):
    items: list[ReportResident]
    total: int
