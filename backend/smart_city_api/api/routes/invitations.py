import asyncio

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import Response
from pydantic import BaseModel

from smart_city_api.api.dependencies import Resident, Session
from smart_city_api.services.access import require_house
from smart_city_api.services.invitations import (
    invitation_house,
    invitation_url,
    poster_bytes,
    qr_png,
)

router = APIRouter(prefix="/api/v1", tags=["invitations"])


class InvitationOutput(BaseModel):
    house_id: int
    address: str
    url: str
    qr_path: str
    poster_path: str
    pdf_path: str


@router.get("/houses/{house_id}/invitation", response_model=InvitationOutput)
async def invitation(house_id: int, request: Request, session: Session, user: Resident):
    house = await require_house(session, user.id, house_id)
    await invitation_house(session, house_id)
    base = f"/invitations/houses/{house.id}"
    return InvitationOutput(
        house_id=house.id,
        address=house.address,
        url=invitation_url(request.app.state.settings.mini_app_bot_username, house.id),
        qr_path=base + "/qr.png",
        poster_path=base + "/poster.png",
        pdf_path=base + "/poster.pdf",
    )


@router.get("/invitations/houses/{house_id}/{filename}", response_class=Response)
async def invitation_file(house_id: int, filename: str, request: Request, session: Session):
    # Public printable material: no account token, apartment number or personal data.
    # MAX's native downloader fetches the HTTPS URL without the webview's cookies.
    if filename not in ("qr.png", "poster.png", "poster.pdf"):
        raise HTTPException(404, "Файл приглашения не найден")
    house = await invitation_house(session, house_id)
    url = invitation_url(request.app.state.settings.mini_app_bot_username, house.id)
    if filename == "qr.png":
        content = await asyncio.to_thread(qr_png, url)
    else:
        content = await asyncio.to_thread(
            poster_bytes, url, house.address, filename.rsplit(".", 1)[1]
        )
    kind = "application/pdf" if filename.endswith(".pdf") else "image/png"
    return Response(
        content,
        media_type=kind,
        headers={
            "Content-Disposition": f'inline; filename="domoved-house-{house.id}-{filename}"',
            "X-Content-Type-Options": "nosniff",
        },
    )
