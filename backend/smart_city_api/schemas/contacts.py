import re
from typing import Literal
from urllib.parse import urlsplit

from pydantic import BaseModel, ConfigDict, Field, model_validator


class ContactInput(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    label: str = Field(min_length=1, max_length=100)
    kind: Literal["phone", "email", "address", "website", "schedule"]
    value: str = Field(min_length=1, max_length=300)
    note: str = Field(default="", max_length=200)

    @model_validator(mode="after")
    def check_value(self):
        if any(ord(char) < 32 for char in self.value):
            raise ValueError("Контакт не должен содержать управляющие символы")
        if self.kind == "phone":
            digits = re.sub(r"\D", "", self.value)
            if not re.fullmatch(r"\+?[0-9 ()-]+", self.value) or not 3 <= len(digits) <= 15:
                raise ValueError("Укажите корректный номер телефона")
        elif self.kind == "email":
            if not re.fullmatch(r"[^\s@?&#]+@[^\s@?&#]+\.[^\s@?&#]+", self.value):
                raise ValueError("Укажите корректный адрес электронной почты")
        elif self.kind == "website":
            try:
                url = urlsplit(self.value)
                valid = (
                    url.scheme in ("http", "https")
                    and url.hostname
                    and not url.username
                    and not url.password
                    and not any(char.isspace() for char in self.value)
                    and url.port != 0
                )
            except ValueError:
                valid = False
            if not valid:
                raise ValueError("Укажите ссылку на сайт, начинающуюся с https:// или http://")
        return self


class ContactsInput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    items: list[ContactInput] = Field(max_length=12)


class ContactsOutput(BaseModel):
    company_name: str
    items: list[ContactInput]


class ContactHouseTargets(BaseModel):
    model_config = ConfigDict(extra="forbid")
    house_ids: list[int] = Field(min_length=1, max_length=500)

    @model_validator(mode="after")
    def unique_houses(self):
        if any(house_id < 1 for house_id in self.house_ids) or len(set(self.house_ids)) != len(
            self.house_ids
        ):
            raise ValueError("Укажите разные дома с корректными идентификаторами")
        return self


class BulkContactsInput(ContactHouseTargets):
    items: list[ContactInput] = Field(max_length=12)


ContactField = Literal[
    "dispatcher", "email", "website", "office", "hours", "reception", "emergency"
]


class ContactFieldPatch(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    value: str = Field(default="", max_length=300)
    note: str = Field(default="", max_length=200)

    @model_validator(mode="after")
    def require_change(self):
        if not self.model_fields_set:
            raise ValueError("Укажите изменённое поле контакта")
        return self


class ExtraContactPatch(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    label: str = Field(min_length=1, max_length=100)
    kind: Literal["phone", "email", "address", "website", "schedule"]
    contact: ContactInput | None

    @model_validator(mode="after")
    def same_identity(self):
        if self.contact and (self.contact.label != self.label or self.contact.kind != self.kind):
            raise ValueError("Название и тип дополнительного контакта должны совпадать")
        return self


class BulkContactsPatchInput(ContactHouseTargets):
    changes: dict[ContactField, ContactFieldPatch] = Field(default_factory=dict, max_length=7)
    extra_changes: list[ExtraContactPatch] = Field(default_factory=list, max_length=24)

    @model_validator(mode="after")
    def require_changes(self):
        if not self.changes and not self.extra_changes:
            raise ValueError("Нет изменённых контактов")
        identities = [(item.kind, item.label) for item in self.extra_changes]
        if len(identities) != len(set(identities)):
            raise ValueError("Дополнительный контакт указан несколько раз")
        return self


class BulkContactsOutput(BaseModel):
    house_ids: list[int]
    updated_count: int
