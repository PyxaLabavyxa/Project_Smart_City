import asyncio
import json
from contextlib import asynccontextmanager

from app.database.models import ChatPhoto
from app.paths import project_path
from fastapi import HTTPException
from fastapi.responses import FileResponse
from pydantic import ValidationError
from sqlalchemy import select
from starlette.datastructures import UploadFile

from smart_city_api.services.photos import MAX_BYTES, MAX_PHOTOS, photo_path, save_photo

MULTIPART = {
    "requestBody": {
        "required": True,
        "content": {
            "multipart/form-data": {
                "schema": {
                    "type": "object",
                    "required": ["data", "photos"],
                    "properties": {
                        "data": {
                            "type": "string",
                            "description": (
                                "JSON: text, request_id; для соседей также recipient_id. "
                                "Текст может быть пустым при наличии фото."
                            ),
                        },
                        "photos": {
                            "type": "array",
                            "minItems": 1,
                            "maxItems": MAX_PHOTOS,
                            "items": {"type": "string", "format": "binary"},
                        },
                    },
                }
            }
        },
    },
}


async def outputs(session, message_id: int, *, issue: bool = False, staff: bool = False):
    column = ChatPhoto.issue_message_id if issue else ChatPhoto.apartment_message_id
    rows = await session.scalars(
        select(ChatPhoto).where(column == message_id).order_by(ChatPhoto.id)
    )
    prefix = "/api/v1/staff" if staff else "/api/v1"
    return [{"id": row.id, "url": f"{prefix}/chat-photos/{row.id}"} for row in rows]


async def check_photos(session, message_id: int, photos, *, issue: bool = False):
    column = ChatPhoto.issue_message_id if issue else ChatPhoto.apartment_message_id
    hashes = list(
        await session.scalars(
            select(ChatPhoto.content_hash).where(column == message_id).order_by(ChatPhoto.id)
        )
    )
    if hashes != [digest for _, digest in photos]:
        raise HTTPException(409, "Этот запрос уже использован для другого сообщения")


def attach(session, message_id: int, photos, *, issue: bool = False):
    field = "issue_message_id" if issue else "apartment_message_id"
    session.add_all(
        [
            ChatPhoto(**{field: message_id}, file_path=key, content_hash=digest)
            for key, digest in photos
        ]
    )


@asynccontextmanager
async def upload(request, schema):
    """Validate/re-encode outside the event loop; remove failed or duplicate uploads."""
    root = project_path(request.app.state.settings.media_root)
    photos = []
    try:
        async with request.form(max_files=MAX_PHOTOS, max_fields=1, max_part_size=16_384) as form:
            try:
                raw = json.loads(form.get("data", ""))
                if not isinstance(raw, dict):
                    raise ValueError
                # Photo-only messages still have a useful inbox/notification preview.
                if not str(raw.get("text", "")).strip():
                    raw["text"] = "📷 Фотография"
                data = schema.model_validate(raw)
            except (ValidationError, ValueError, TypeError):
                raise HTTPException(422, "Проверьте поля сообщения") from None
            files = form.getlist("photos")
            if not 1 <= len(files) <= MAX_PHOTOS or any(
                not isinstance(f, UploadFile) for f in files
            ):
                raise HTTPException(422, "Выберите от 1 до 10 фотографий")
            for file in files:
                if file.size is not None and file.size > MAX_BYTES:
                    raise HTTPException(422, "Размер фотографии не должен превышать 10 МБ")
                content = await file.read(MAX_BYTES + 1)
                photos.append(await asyncio.to_thread(save_photo, root, content, "chat"))
            yield data, photos
    finally:
        if photos:
            async with request.app.state.database.sessions() as cleanup:
                retained = set(
                    await cleanup.scalars(
                        select(ChatPhoto.file_path).where(
                            ChatPhoto.file_path.in_([key for key, _ in photos])
                        )
                    )
                )
            for key, _ in photos:
                if key not in retained:
                    await asyncio.to_thread((root / key).unlink, missing_ok=True)


async def response(request, record):
    try:
        path = await asyncio.to_thread(
            photo_path, project_path(request.app.state.settings.media_root), record.file_path
        )
    except (OSError, ValueError):
        raise HTTPException(404, "Фотография недоступна") from None
    return FileResponse(
        path, headers={"Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff"}
    )
