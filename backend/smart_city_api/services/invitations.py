"""Public house invitations carry an address, never membership or resident data."""

from functools import lru_cache
from io import BytesIO
from pathlib import Path
from urllib.parse import urlencode

import qrcode
from fastapi import HTTPException
from PIL import Image, ImageDraw, ImageFont
from sqlalchemy import select

from app.database.models import CompanyHouse, House

ASSETS = Path(__file__).resolve().parents[1] / "staff_web" / "assets"
INK = "#073448"


async def invitation_house(session, house_id: int) -> House:
    house = await session.scalar(
        select(House)
        .join(CompanyHouse, CompanyHouse.house_id == House.id)
        .where(House.id == house_id)
    )
    if house is None:
        raise HTTPException(404, "Приглашение для этого дома больше недоступно")
    return house


def invitation_url(username: str, house_id: int) -> str:
    return (
        f"https://max.ru/{username.lstrip('@')}?{urlencode({'startapp': f'home_house_{house_id}'})}"
    )


def qr_image(url: str, box_size: int = 12) -> Image.Image:
    qr = qrcode.QRCode(
        error_correction=qrcode.constants.ERROR_CORRECT_M, border=4, box_size=box_size
    )
    qr.add_data(url)
    qr.make(fit=True)
    return qr.make_image(fill_color="black", back_color="white").convert("RGB")


@lru_cache(maxsize=32)
def qr_png(url: str) -> bytes:
    stream = BytesIO()
    qr_image(url).save(stream, format="PNG")
    return stream.getvalue()


def font(size: int, bold: bool = False):
    return ImageFont.truetype(str(ASSETS / f"onest-{'semibold' if bold else 'regular'}.ttf"), size)


def wrapped(draw, text: str, face, width: int) -> list[str]:
    lines = [""]
    for word in text.split():
        candidate = (lines[-1] + " " + word).strip()
        if draw.textlength(candidate, font=face) > width and lines[-1]:
            lines.append(word)
        else:
            lines[-1] = candidate
    return lines


def poster_image(url: str, address: str) -> Image.Image:
    # A4 at 300 dpi; QR modules remain whole pixels with an untouched quiet zone.
    page = Image.new("RGB", (2480, 3508), "white")
    draw = ImageDraw.Draw(page)
    with Image.open(ASSETS / "domoved-wordmark.png") as logo:
        logo = logo.convert("RGBA")
        logo.thumbnail((730, 250), Image.Resampling.LANCZOS)
        page.paste(logo, (170, 155), logo)
    draw.multiline_text(
        (170, 520), "Ваш дом\nв Домоведе", font=font(125, True), fill=INK, spacing=18
    )
    draw.multiline_text(
        (175, 910),
        "Сообщайте о проблемах,\nчитайте объявления УК\nи общайтесь с соседями.",
        font=font(46),
        fill="#375b74",
        spacing=24,
    )
    with Image.open(ASSETS / "zhorik-invitation.png") as art:
        art = art.convert("RGBA")
        art.thumbnail((1090, 1090), Image.Resampling.LANCZOS)
        page.paste(art, (1260, 340), art)
    face = font(63, True)
    while (
        any(draw.textlength(line, font=face) > 2040 for line in wrapped(draw, address, face, 2040))
        and face.size > 28
    ):
        face = font(face.size - 2, True)
    lines = wrapped(draw, address, face, 2040)
    while len(lines) > 2 and face.size > 28:
        face = font(face.size - 2, True)
        lines = wrapped(draw, address, face, 2040)
    draw.rounded_rectangle((130, 1535, 2350, 1785), radius=40, fill=INK)
    for index, line in enumerate(lines[:2]):
        draw.text(
            (1240, 1660 + (index - (len(lines[:2]) - 1) / 2) * 82),
            line,
            font=face,
            fill="white",
            anchor="mm",
        )
    draw.text((1240, 1910), "Наведите камеру на QR-код", font=font(63, True), fill=INK, anchor="mm")
    qr = qr_image(url, box_size=1)
    size = qr.width * max(1, 1050 // qr.width)
    qr = qr.resize((size, size), Image.Resampling.NEAREST)
    page.paste(qr, ((2480 - qr.width) // 2, 2015))
    draw.text((1240, 3160), "Домовед откроется в MAX", font=font(53, True), fill=INK, anchor="mm")
    draw.text(
        (1240, 3250),
        "Дом уже выбран. Останется добавить вашу квартиру.",
        font=font(39),
        fill="#536b94",
        anchor="mm",
    )
    return page


@lru_cache(maxsize=8)
def poster_bytes(url: str, address: str, kind: str) -> bytes:
    stream = BytesIO()
    image = poster_image(url, address)
    if kind == "pdf":
        image.save(stream, format="PDF", resolution=300.0, quality=97)
    else:
        image.save(stream, format="PNG", dpi=(300, 300))
    return stream.getvalue()
