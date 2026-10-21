from typing import Annotated

from fastapi import APIRouter, HTTPException, Path, Request
from pydantic import BaseModel, Field

from app.services.registration import catalog, registration_state, submit_registration
from smart_city_api.api.dependencies import Resident, Session
from smart_city_api.services.invitations import invitation_house

router = APIRouter(prefix="/api/v1/registration", tags=["registration"])


class RegistrationInput(BaseModel):
    full_name: str = Field(min_length=2, max_length=200)
    company_id: int = Field(gt=0)
    house_id: int = Field(gt=0)
    apartment_number: int = Field(gt=0)
    additional: bool = False


async def registration_response(request, session, user, house_id=None):
    return {
        **await registration_state(session, user.id, house_id=house_id),
        "test_mode": request.app.state.settings.onboarding_test_mode,
        "companies": await catalog(session),
    }


@router.get("")
async def state(request: Request, session: Session, user: Resident):
    return await registration_response(request, session, user)


@router.get("/houses/{house_id}")
async def house_state(
    house_id: Annotated[int, Path(gt=0, le=2147483647)],
    request: Request,
    session: Session,
    user: Resident,
):
    await invitation_house(session, house_id)
    return await registration_response(request, session, user, house_id)


@router.post("")
async def submit(body: RegistrationInput, request: Request, session: Session, user: Resident):
    try:
        result = await submit_registration(
            session,
            user.id,
            **body.model_dump(),
            source="mini_app",
            auto_approve=request.app.state.settings.onboarding_test_mode,
        )
    except ValueError as error:
        raise HTTPException(422, str(error)) from error
    await session.commit()
    return result
