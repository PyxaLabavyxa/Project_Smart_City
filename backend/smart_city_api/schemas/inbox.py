from datetime import datetime

from pydantic import BaseModel, Field


class InboxItem(BaseModel):
    id: int
    kind: str
    title: str
    body: str
    href: str | None
    house_id: int | None
    apartment_id: int | None
    address: str | None
    created_at: datetime
    read_at: datetime | None


class InboxPage(BaseModel):
    items: list[InboxItem]
    next_cursor: int | None
    unread_count: int
    snapshot_id: int


class InboxCount(BaseModel):
    unread_count: int


class InboxReadAll(BaseModel):
    through_id: int = Field(ge=1)


class InboxConversationRead(BaseModel):
    apartment_id: int = Field(ge=1)
    sender_number: int = Field(ge=1)
    through_message_id: int = Field(ge=1)
