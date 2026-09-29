import re
from typing import Literal
from urllib.parse import urlsplit

from pydantic import BaseModel, ConfigDict, Field, model_validator


class ContactInput(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    label: str = Field(min_length=1, max_length=100)
    kind: Literal["phone", "email", "address", "website"]
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
