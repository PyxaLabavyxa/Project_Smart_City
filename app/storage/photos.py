import asyncio
import ipaddress
import re
import socket
import warnings
from pathlib import Path
from uuid import uuid4

import aiofiles
import aiohttp
from aiohttp.abc import AbstractResolver
from PIL import Image, UnidentifiedImageError
from yarl import URL

from app.integrations.tls import create_ssl_context

MAX_PHOTOS = 10
MAX_PHOTO_BYTES = 10 * 1024 * 1024
MAX_PIXELS = 25_000_000
FILE_PATTERN = re.compile(r"issues/[0-9a-f]{32}\.(jpg|png|webp)")


class PhotoError(ValueError):
    pass


class PublicResolver(AbstractResolver):

    def __init__(self):
        self.resolver = aiohttp.resolver.ThreadedResolver()

    async def resolve(self, host, port=0, family=socket.AF_INET):
        addresses = await self.resolver.resolve(host, port, family)
        if any(not ipaddress.ip_address(item["host"]).is_global for item in addresses):
            raise PhotoError("Недопустимый адрес фотографии")
        return addresses

    async def close(self):
        await self.resolver.close()


def validate_url(raw: str) -> URL:
    try:
        url = URL(raw, encoded=True)
        if (url.scheme != "https" or not url.host or url.user is not None
                or url.password is not None or url.port != 443 or url.fragment):
            raise ValueError
        try:
            address = ipaddress.ip_address(url.host)
        except ValueError:
            address = None
        if address is not None and not address.is_global:
            raise ValueError
    except (ValueError, TypeError):
        raise PhotoError("Недопустимый адрес фотографии") from None
    return url


def inspect_image(path: Path) -> str:
    try:
        with warnings.catch_warnings():
            warnings.simplefilter("error", Image.DecompressionBombWarning)
            with Image.open(path) as photo:
                extension = {"JPEG": "jpg", "PNG": "png", "WEBP": "webp"}.get(photo.format)
                if not extension or photo.width * photo.height > MAX_PIXELS:
                    raise PhotoError("Нужна фотография JPEG, PNG или WebP до 25 мегапикселей")
                photo.verify()

            with Image.open(path) as photo:
                photo.load()
        return extension
    except (UnidentifiedImageError, OSError, SyntaxError,
            Image.DecompressionBombError, Image.DecompressionBombWarning):
        raise PhotoError("Фотография повреждена или имеет неподдерживаемый размер") from None


class LocalPhotoStorage:
    def __init__(self, root: Path):
        self.root = root.resolve()

    def path_for(self, key: str) -> Path:
        if not FILE_PATTERN.fullmatch(key):
            raise PhotoError("Некорректный путь фотографии")
        return self.root / key

    async def get_path(self, key: str) -> Path:
        path = self.path_for(key)
        if not await asyncio.to_thread(path.is_file):
            raise FileNotFoundError(key)
        return path

    async def delete_many(self, keys: list[str]) -> None:
        for key in keys:
            await asyncio.to_thread(self.path_for(key).unlink, missing_ok=True)

    async def save_many(self, urls: list[str]) -> list[str]:
        if len(urls) > MAX_PHOTOS:
            raise PhotoError(f"Можно прикрепить не больше {MAX_PHOTOS} фотографий")
        if not urls:
            return []
        await asyncio.to_thread((self.root / "issues").mkdir, parents=True, exist_ok=True)
        keys = []
        resolver = PublicResolver()
        try:
            async with aiohttp.ClientSession(
                connector=aiohttp.TCPConnector(ssl=create_ssl_context(), resolver=resolver),
                cookie_jar=aiohttp.DummyCookieJar(),
                timeout=aiohttp.ClientTimeout(total=30),
                auto_decompress=False,
            ) as http:
                for url in urls:
                    keys.append(await self._save_one(http, url))
            return keys
        except BaseException:
            await self.delete_many(keys)
            raise
        finally:
            await resolver.close()

    async def _save_one(self, http, raw_url: str) -> str:
        name = uuid4().hex
        temporary = self.root / "issues" / f"{name}.part"
        destination = None
        try:
            url = validate_url(raw_url)
            for _ in range(4):
                async with http.get(url, allow_redirects=False) as response:
                    if response.status in (301, 302, 303, 307, 308):
                        location = response.headers.get("Location")
                        if not location:
                            raise PhotoError("Сервис фотографий вернул неверную ссылку")
                        url = validate_url(str(url.join(URL(location, encoded=True))))
                        continue
                    if response.status != 200:
                        raise PhotoError("Не удалось скачать фото. Отправьте его повторно")
                    if response.content_length and response.content_length > MAX_PHOTO_BYTES:
                        raise PhotoError("Размер одной фотографии не должен превышать 10 МБ")
                    size = 0
                    async with aiofiles.open(temporary, "xb") as output:
                        async for chunk in response.content.iter_chunked(64 * 1024):
                            size += len(chunk)
                            if size > MAX_PHOTO_BYTES:
                                raise PhotoError("Размер одной фотографии не должен превышать 10 МБ")
                            await output.write(chunk)
                    break
            else:
                raise PhotoError("Слишком много перенаправлений при скачивании фото")

            extension = await asyncio.to_thread(inspect_image, temporary)
            key = f"issues/{name}.{extension}"
            destination = self.path_for(key)
            await asyncio.to_thread(temporary.replace, destination)
            return key
        except (aiohttp.ClientError, TimeoutError):
            raise PhotoError("Не удалось скачать фото. Попробуйте отправить заявку ещё раз") from None
        except BaseException:
            if destination is not None:
                await asyncio.to_thread(destination.unlink, missing_ok=True)
            raise
        finally:
            await asyncio.to_thread(temporary.unlink, missing_ok=True)
