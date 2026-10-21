from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from app.database.enums import IssueCategory, IssuePriority, IssueScope


class ReportAnalysis(BaseModel):
    model_config = ConfigDict(
        extra="forbid",
        str_strip_whitespace=True,
    )

    title: str = Field(min_length=1, max_length=150)
    category: IssueCategory
    priority: IssuePriority
    scope: IssueScope = IssueScope.UNKNOWN
    entrance: int | None = Field(default=None, ge=1, le=100)
    floor: int | None = Field(default=None, ge=1, le=200)
    zone: Literal["corridor", "stairs", "elevator", "technical", "entrance"] | None = (
        None
    )
