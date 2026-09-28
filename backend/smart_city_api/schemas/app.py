from datetime import date, datetime
from decimal import Decimal
from typing import Literal
from uuid import UUID

from app.database.enums import IssueCategory, IssueStatus
from pydantic import BaseModel, ConfigDict, Field, model_validator

from smart_city_api.schemas.resident import ApartmentResponse, HouseResponse


class Location(BaseModel):
    model_config = ConfigDict(extra="forbid")
    entrance: int = Field(ge=1, le=100)
    floor: int = Field(ge=1, le=200)
    zone: Literal[
        "apartment",
        "corridor",
        "stairs",
        "elevator",
        "technical",
        "entrance",
        "house",
        "courtyard",
        "parking",
    ]
    apartment_id: int | None = Field(default=None, gt=0)

    @model_validator(mode="after")
    def check_apartment(self):
        if (self.zone == "apartment") != (self.apartment_id is not None):
            raise ValueError("Apartment ID is required only for an apartment location")
        return self


class CreateIssue(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    title: str = Field(min_length=1, max_length=300)
    description: str = Field(min_length=1, max_length=2000)
    category: IssueCategory
    place: Location
    request_id: UUID


class IssueHistory(BaseModel):
    status: IssueStatus
    at: datetime


class IssueResponse(BaseModel):
    id: int
    house_id: int
    title: str
    description: str
    category: IssueCategory
    status: IssueStatus
    priority: int
    created_at: datetime
    mine: bool
    address: str
    place: Location | None
    history: list[IssueHistory]


class IssuePage(BaseModel):
    items: list[IssueResponse]
    next_cursor: int | None


class Profile(BaseModel):
    id: int
    name: str
    apartments: list[ApartmentResponse]
    houses: list[HouseResponse]


class SendMessage(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    recipient_id: int = Field(gt=0)
    text: str = Field(min_length=1, max_length=4000)
    request_id: UUID


class MessageResponse(BaseModel):
    id: int
    apartment: int
    text: str
    direction: Literal["incoming", "outgoing"]
    createdAt: datetime


class MessagePage(BaseModel):
    items: list[MessageResponse]
    next_cursor: int | None


class ReadingInput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    value: Decimal = Field(ge=0, lt=10000000, max_digits=10, decimal_places=3)
    period: str = Field(pattern=r"^\d{4}-(0[1-9]|1[0-2])$")


class MeterResponse(BaseModel):
    id: str
    kind: Literal["cold", "hot", "electricity"]
    serial: str
    previous: Decimal
    current: Decimal | None


class Charge(BaseModel):
    title: str
    quantity: str
    tariff: str
    amount: int


class AccountResponse(BaseModel):
    number: str
    invoiceNumber: str | None
    area: Decimal
    residents: int
    period: str | None
    readingPeriod: str
    due: date | None
    charges: list[Charge]
    meters: list[MeterResponse]


class CameraResponse(BaseModel):
    id: str
    name: str
    status: Literal["online", "maintenance", "unavailable"]
    note: str


class CameraFrame(BaseModel):
    src: str
    capturedAt: datetime


class WorkResponse(BaseModel):
    id: int
    title: str
    starts_at: datetime
    ends_at: datetime
    location: str
