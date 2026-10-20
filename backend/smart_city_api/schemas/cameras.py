from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, HttpUrl, field_validator, model_validator

from smart_city_api.schemas.app import CameraResponse, Location


class CreateCamera(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    name: str = Field(min_length=1, max_length=200)
    note: str = Field(default="", max_length=1000)
    source_url: str = Field(min_length=1, max_length=2000)
    is_public: bool = Field(default=False, strict=True)
    place: Location
    request_id: UUID

    @field_validator("source_url")
    @classmethod
    def https_snapshot(cls, value: str) -> str:
        url = HttpUrl(value)
        if url.scheme != "https" or url.username or url.password or url.fragment:
            raise ValueError("Укажите HTTPS-ссылку на снимок без логина, пароля и фрагмента")
        normalized = str(url)
        if len(normalized) > 2000:
            raise ValueError("Ссылка слишком длинная")
        return normalized


class ModerateCamera(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    decision: Literal["approved", "rejected"]
    reason: str = Field(default="", max_length=1000)

    @model_validator(mode="after")
    def rejection_reason(self):
        if self.decision == "rejected" and not self.reason:
            raise ValueError("Укажите причину отклонения")
        return self


class StaffCameraResponse(CameraResponse):
    house_id: int
    address: str
    owner_name: str
    source_url: str | None = None


class StaffCameraPage(BaseModel):
    items: list[StaffCameraResponse]
    total: int
