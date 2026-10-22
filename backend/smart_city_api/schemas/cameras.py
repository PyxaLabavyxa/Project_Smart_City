from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from smart_city_api.core.camera_source import CameraConnectionType, CameraSource, CameraSourceType
from smart_city_api.schemas.app import CameraResponse, Location


class CameraDetails(BaseModel):
    model_config = ConfigDict(extra="forbid")
    name: str = Field(min_length=1, max_length=200)
    note: str = Field(default="", max_length=1000)
    is_public: bool = Field(default=False, strict=True)

    @field_validator("name", "note", mode="before")
    @classmethod
    def trim_text(cls, value):
        return value.strip() if isinstance(value, str) else value


class CameraInput(CameraSource, CameraDetails):
    source_type: CameraConnectionType = "snapshot"

    def connection(self):
        return CameraSource.model_validate(
            {key: getattr(self, key) for key in CameraSource.model_fields}
        )


class CreateCamera(CameraInput):
    place: Location
    request_id: UUID


class StaffCreateCamera(CreateCamera):
    house_id: int = Field(gt=0)
    is_public: Literal[True] = True


class ProbeCamera(CameraSource):
    source_type: CameraSourceType = "auto"
    camera_id: int | None = Field(default=None, gt=0)
    keep_password: bool = Field(default=False, strict=True)

    def connection(self):
        return CameraSource.model_validate(
            {key: getattr(self, key) for key in CameraSource.model_fields}
        )


class StaffProbeCamera(ProbeCamera):
    house_id: int = Field(gt=0)


class CameraProbeResult(BaseModel):
    source_type: CameraConnectionType
    src: str


class UpdateCameraDetails(CameraDetails):
    expected_version: str = Field(pattern=r"^[a-f0-9]{64}$")


class UpdateCamera(CameraInput, UpdateCameraDetails):
    keep_password: bool = Field(default=True, strict=True)


class CameraSettings(BaseModel):
    id: str
    house_id: int
    name: str
    note: str
    source_type: str
    source_url: str
    username: str
    auth_type: str
    profile: str
    rtsp_port: int | None
    password_set: bool
    is_public: bool
    version: str


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
    connection_available: bool = False


class StaffCameraPage(BaseModel):
    items: list[StaffCameraResponse]
    total: int
