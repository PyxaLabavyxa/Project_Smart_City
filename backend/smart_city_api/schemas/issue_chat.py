from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class IssueMessageInput(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    text: str = Field(min_length=1, max_length=1500)
    request_id: UUID


class IssueMessageOutput(BaseModel):
    id: int
    direction: Literal["staff", "resident"]
    author: str
    text: str
    created_at: datetime


class IssueMessagePage(BaseModel):
    items: list[IssueMessageOutput]
    next_cursor: int | None


class IssueChatPresenceInput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    client_id: UUID
    sequence: int = Field(ge=1, le=2147483647)
    active: bool
    last_message_id: int | None = Field(default=None, gt=0)
