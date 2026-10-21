"""Validated camera connection data, shared by the API and isolated media worker."""

import asyncio
import ipaddress
import socket
from typing import Literal
from urllib.parse import urlsplit

from pydantic import BaseModel, ConfigDict, Field, SecretStr, model_validator


def detect_source_type(value: str):
    url = urlsplit(value.strip())
    if url.scheme in {"rtsp", "rtsps"}:
        return "rtsp"
    if url.scheme in {"rtmp", "rtmps"}:
        return "rtmp"
    path = url.path.lower()
    if "/onvif" in path:
        return "onvif"
    if path.endswith(".m3u8"):
        return "hls"
    if path.endswith((".mjpg", ".mjpeg")):
        return "mjpeg"
    if path.endswith((".jpg", ".jpeg", ".png", ".webp")):
        return "snapshot"
    if path.endswith((".mp4", ".flv", ".ts", ".webm")):
        return "http_video"
    return "auto"


CameraConnectionType = Literal["snapshot", "mjpeg", "hls", "rtsp", "rtmp", "onvif", "http_video"]
CameraSourceType = Literal[
    "auto", "snapshot", "mjpeg", "hls", "rtsp", "rtmp", "onvif", "http_video"
]


class CameraSource(BaseModel):
    model_config = ConfigDict(extra="forbid")
    source_type: CameraSourceType = "snapshot"
    source_url: str = Field(min_length=1, max_length=2000)
    username: str = Field(default="", max_length=200)
    password: SecretStr = Field(default=SecretStr(""), max_length=500)
    auth_type: Literal["digest", "basic"] = "digest"
    profile: str = Field(default="", max_length=128, pattern=r"^[\w.\-]*$")
    rtsp_port: int | None = Field(default=None, ge=1, le=65535)

    @model_validator(mode="after")
    def validate_url(self):
        self.source_url = self.source_url.strip()
        try:
            if self.source_type == "auto":
                self.source_type = detect_source_type(self.source_url)
            url = urlsplit(self.source_url)
            allowed = (
                {"rtsp", "rtsps"}
                if self.source_type == "rtsp"
                else ({"rtmp", "rtmps"} if self.source_type == "rtmp" else {"http", "https"})
            )
            if (
                url.scheme not in allowed
                or not url.hostname
                or url.username is not None
                or url.password is not None
                or url.fragment
                or (url.port is not None and not 1 <= url.port <= 65535)
                or any(ord(c) < 33 or ord(c) == 127 for c in self.source_url)
                or "\\" in self.source_url
            ):
                raise ValueError
            if url.hostname.lower() == "localhost" or url.hostname.endswith(".localhost"):
                raise ValueError
            try:
                address = ipaddress.ip_address(url.hostname)
            except ValueError:
                address = None
            if address is not None and not address.is_global:
                raise ValueError
        except ValueError as error:
            raise ValueError(
                "Укажите публичный адрес камеры нужного протокола; "
                "логин и пароль — в отдельных полях"
            ) from error
        return self

    def private_dict(self):
        return {**self.model_dump(mode="json"), "password": self.password.get_secret_value()}


async def require_public_address(value: str):
    """Early feedback; worker firewall is the authority, including redirects and DNS rebinding."""
    host = urlsplit(value).hostname
    try:
        addresses = await asyncio.wait_for(
            asyncio.get_running_loop().getaddrinfo(host, None, type=socket.SOCK_STREAM), 5
        )
    except (OSError, TimeoutError) as error:
        raise ValueError("Адрес камеры не найден") from error
    if not addresses or any(not ipaddress.ip_address(row[4][0]).is_global for row in addresses):
        raise ValueError("Камера должна быть доступна по публичному адресу")
