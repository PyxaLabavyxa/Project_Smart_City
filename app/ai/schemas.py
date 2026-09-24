from pydantic import BaseModel, ConfigDict, Field

from app.database.enums import IssueCategory, IssuePriority


class ReportAnalysis(BaseModel):
    model_config = ConfigDict(
        extra="forbid",
        str_strip_whitespace=True,
    )

    title: str = Field(min_length=1, max_length=150)
    category: IssueCategory
    priority: IssuePriority
