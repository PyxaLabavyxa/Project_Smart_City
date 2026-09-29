import hashlib
import re
import warnings
from io import BytesIO
from pathlib import Path
from uuid import uuid4

from fastapi import HTTPException
from PIL import Image, ImageOps, UnidentifiedImageError

MAX_PHOTOS = 10
MAX_BYTES = 10 * 1024 * 1024


def photo_path(root: Path, key: str) -> Path:
    if not re.fullmatch(r"issues/[0-9a-f]{32}\.(jpg|png|webp)", key):
        raise FileNotFoundError
    root = root.resolve()
    path = (root / key).resolve()
    if not path.is_relative_to(root) or not path.is_file():
        raise FileNotFoundError
    return path


def save_photo(root: Path, content: bytes) -> tuple[str, str]:
    if not content or len(content) > MAX_BYTES:
        raise HTTPException(422, "Размер фотографии должен быть от 1 байта до 10 МБ")
    try:
        with warnings.catch_warnings():
            warnings.simplefilter("error", Image.DecompressionBombWarning)
            with Image.open(BytesIO(content)) as original:
                if original.format not in ("JPEG", "PNG", "WEBP"):
                    raise HTTPException(422, "Выберите фотографию JPEG, PNG или WebP")
                if original.width * original.height > 25_000_000:
                    raise HTTPException(422, "Фотография должна быть не больше 25 мегапикселей")
                original.load()
                photo = ImageOps.exif_transpose(original).convert("RGB")
                photo.info.clear()
    except (
        UnidentifiedImageError,
        OSError,
        SyntaxError,
        Image.DecompressionBombError,
        Image.DecompressionBombWarning,
    ):
        raise HTTPException(
            422, "Фотография повреждена или имеет неподдерживаемый размер"
        ) from None
    key = f"issues/{uuid4().hex}.jpg"
    path = root / key
    path.parent.mkdir(parents=True, exist_ok=True)
    try:
        photo.save(path, "JPEG", quality=90)
    except BaseException:
        path.unlink(missing_ok=True)
        raise
    finally:
        photo.close()
    return key, hashlib.sha256(content).hexdigest()
