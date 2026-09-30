from datetime import datetime
from typing import Literal
from uuid import UUID

from app.database.enums import IssueCategory, IssuePriority, IssueStatus
from pydantic import BaseModel, ConfigDict, Field, SecretStr, field_validator


class LoginInput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    login: str = Field(min_length=1, max_length=80)
    password: SecretStr = Field(min_length=1, max_length=256)

    @field_validator("login")
    @classmethod
    def normalize_login(cls, value: str) -> str:
        return value.strip().lower()


class HouseOutput(BaseModel):
    id: int
    address: str


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
    delivery: Literal["sent", "pending", "retrying"]
    created_at: datetime


class IssueDetail(IssueRow):
    photos: list[PhotoOutput]
    history: list[EventOutput]
    messages: list[MessageOutput]
    notifications: list[DeliveryOutput]


class ActionOutput(BaseModel):
    notification_id: int | None
    changed: bool = True
