"""Private source storage and the sole API-to-media-worker boundary."""

import asyncio
import base64
import json
import os
import tempfile
from pathlib import Path

import httpx
from cryptography.fernet import Fernet, InvalidToken
from fastapi import HTTPException

from smart_city_api.core.camera_source import CameraSource


def cipher(settings, *, create=True):
    # Persist with the media volume. Never derive this key from a rotating bot/session token.
    path: Path = settings.media_root / "camera-source.key"
    path.parent.mkdir(parents=True, exist_ok=True)
    if path.exists():
        return Fernet(path.read_bytes())
    if not create:
        raise FileNotFoundError("Camera encryption key is missing")
    key = Fernet.generate_key()
    descriptor, temporary = tempfile.mkstemp(prefix=".camera-key-", dir=path.parent)
    try:
        with os.fdopen(descriptor, "wb") as output:
            output.write(key)
            output.flush()
            os.fsync(output.fileno())
        try:
            os.link(temporary, path)
        except FileExistsError:
            key = path.read_bytes()
    finally:
        os.unlink(temporary)
    return Fernet(key)


def encode(source: CameraSource, settings):
    return cipher(settings).encrypt(json.dumps(source.private_dict()).encode()).decode()


def decode(value: str, settings):
    try:
        return CameraSource.model_validate_json(
            cipher(settings, create=False).decrypt(value.encode())
        )
    except (InvalidToken, ValueError, OSError) as error:
        raise HTTPException(
            503, "Не удалось открыть подключение камеры. Обратитесь в поддержку"
        ) from error


def worker_url(settings, path):
    if not settings.camera_worker_url:
        raise HTTPException(503, "Сервис подключения камер не настроен")
    return settings.camera_worker_url.rstrip("/") + path


async def frame(source, settings):
    try:
        async with httpx.AsyncClient(timeout=22, trust_env=False) as client:
            async with client.stream(
                "POST", worker_url(settings, "/frame"), json=source.private_dict()
            ) as response:
                if response.status_code == 429:
                    raise HTTPException(429, "Слишком много подключений к камерам. Повторите позже")
                response.raise_for_status()
                kind = response.headers.get("X-Camera-Source-Type")
                if kind in {"snapshot", "mjpeg", "hls", "rtsp", "rtmp", "onvif", "http_video"}:
                    source.source_type = kind
                data = bytearray()
                async for chunk in response.aiter_bytes():
                    data.extend(chunk)
                    if len(data) > 5 * 1024 * 1024:
                        raise ValueError("Image too large")
        if not data.startswith(b"\xff\xd8"):
            raise ValueError("Not a JPEG")
        return bytes(data)
    except (httpx.HTTPError, ValueError) as error:
        # Never forward a worker error body or exception containing a private URL/password.
        raise HTTPException(
            503,
            "Не удалось получить кадр. Проверьте адрес камеры, доступ с сервера, логин и пароль",
        ) from error


async def live_chunks(source, settings):
    try:
        async with httpx.AsyncClient(
            timeout=httpx.Timeout(50, connect=5), trust_env=False
        ) as client:
            async with client.stream(
                "POST", worker_url(settings, "/live"), json=source.private_dict()
            ) as response:
                response.raise_for_status()
                async with asyncio.timeout(45):
                    async for chunk in response.aiter_bytes():
                        yield chunk
    except (httpx.HTTPError, TimeoutError):
        return


def data_url(data):
    return "data:image/jpeg;base64," + base64.b64encode(data).decode()


async def probe(source: CameraSource, settings):
    data = await frame(source, settings)
    return {"source_type": source.source_type, "src": data_url(data)}
