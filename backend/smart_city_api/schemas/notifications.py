from pydantic import BaseModel, ConfigDict, StrictBool


class NotificationPreferences(BaseModel):
    model_config = ConfigDict(extra="forbid")

    personal_messages: StrictBool
    issue_messages: StrictBool
    issue_statuses: StrictBool
    announcements: StrictBool
