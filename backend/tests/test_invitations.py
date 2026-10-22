from io import BytesIO

import zxingcpp
from PIL import Image
from smart_city_api.services.invitations import invitation_url, poster_bytes
from sqlalchemy import func, select
from sqlalchemy.orm import Session
from tests.test_api import headers
from tests.test_registration import BODY, install_catalog

from app.database.models import Apartment, RegistrationRequest, UserApartment

pytest_plugins = ["tests.test_api"]


def test_invitation_is_stable_and_limited_to_a_residents_houses(api):
    client, engine, _ = api
    install_catalog(engine)
    path = "/api/v1/houses/1/invitation"
    assert client.get(path).status_code == 401
    assert client.get(path, headers=headers(103)).status_code == 404
    assert client.get(path, headers=headers(104)).status_code == 404
    first = client.get(path, headers=headers()).json()
    assert first["url"] == "https://max.ru/t282_hakaton_max_bot?startapp=home_house_1"
    assert first == client.get(path, headers=headers()).json()
    second = client.get("/api/v1/houses/2/invitation", headers=headers(103)).json()
    assert second["url"] != first["url"]


def test_public_qr_decodes_to_house_link_without_auth_or_granting_membership(api):
    client, engine, _ = api
    install_catalog(engine)
    with Session(engine) as session:
        before = session.scalar(select(func.count()).select_from(UserApartment))
    response = client.get("/api/v1/invitations/houses/1/qr.png")
    assert response.status_code == 200
    assert response.headers["content-type"] == "image/png"
    image = Image.open(BytesIO(response.content))
    assert image.getpixel((0, 0)) == (255, 255, 255)
    assert zxingcpp.read_barcode(image).text == invitation_url("t282_hakaton_max_bot", 1)
    with Session(engine) as session:
        assert session.scalar(select(func.count()).select_from(UserApartment)) == before
    assert client.get("/api/v1/invitations/houses/999/qr.png").status_code == 404
    assert client.get("/api/v1/invitations/houses/1/unknown.png").status_code == 404


def test_a4_poster_keeps_a_readable_qr_and_downloadable_pdf(api):
    client, engine, _ = api
    install_catalog(engine)
    response = client.get("/api/v1/invitations/houses/1/poster.png")
    assert response.status_code == 200
    poster = Image.open(BytesIO(response.content))
    assert poster.size == (2480, 3508)
    assert zxingcpp.read_barcode(poster).text == invitation_url("t282_hakaton_max_bot", 1)
    pdf = client.get("/api/v1/invitations/houses/1/poster.pdf")
    assert pdf.status_code == 200 and pdf.content.startswith(b"%PDF")
    assert "filename=" in pdf.headers["content-disposition"]


def test_long_bot_name_does_not_overlap_poster_captions():
    url = invitation_url("b" * 64, 2147483647)
    poster = Image.open(BytesIO(poster_bytes(url, "г. Казань, ул. Солнечная, 123", "png")))
    assert zxingcpp.read_barcode(poster).text == url


def test_registration_completion_and_pending_state_are_for_the_requested_house(api):
    client, engine, _ = api
    install_catalog(engine)
    assert client.get("/api/v1/registration", headers=headers()).json()["complete"]
    assert client.get("/api/v1/registration/houses/1", headers=headers()).json()["complete"]
    target = client.get("/api/v1/registration/houses/2", headers=headers()).json()
    assert target["complete"] is False and target["status"] is None
    assert client.get("/api/v1/registration/houses/999", headers=headers()).status_code == 404
    assert client.get("/api/v1/registration/houses/-1", headers=headers()).status_code == 422
    response = client.post(
        "/api/v1/registration", headers=headers(), json={**BODY, "house_id": 2, "additional": True}
    )
    assert response.json()["application_status"] == "pending"
    assert (
        client.get("/api/v1/registration/houses/2", headers=headers()).json()["complete"] is False
    )
    assert client.get("/api/v1/registration/houses/1", headers=headers()).json()["status"] is None
    with Session(engine) as session:
        application = session.scalar(
            select(RegistrationRequest).where(RegistrationRequest.user_id == 1)
        )
        application.status = "approved"
        apartment = session.scalar(select(Apartment).where(Apartment.house_id == 2))
        session.add(UserApartment(user_id=1, apartment_id=apartment.id))
        session.commit()
    assert client.get("/api/v1/registration/houses/2", headers=headers()).json()["complete"]
    assert len(client.get("/api/v1/me", headers=headers()).json()["apartments"]) == 2


def test_pending_request_for_another_house_does_not_select_it_for_new_resident(api):
    client, engine, _ = api
    install_catalog(engine)
    client.post("/api/v1/registration", headers=headers(104), json=BODY)
    assert (
        client.get("/api/v1/registration/houses/1", headers=headers(104)).json()["status"]
        == "pending"
    )
    assert (
        client.get("/api/v1/registration/houses/2", headers=headers(104)).json()["status"] is None
    )
    response = client.post(
        "/api/v1/registration",
        headers=headers(104),
        json={**BODY, "house_id": 2, "additional": True},
    )
    assert response.json()["application_status"] == "pending"
    assert client.get("/api/v1/me", headers=headers(104)).json()["apartments"] == []
