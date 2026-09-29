from app.services.registration import catalog, registration_state, submit_registration
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

from smart_city_api.api.dependencies import Resident, Session

router = APIRouter(prefix="/api/v1/registration", tags=["registration"])


class RegistrationInput(BaseModel):
    full_name: str = Field(min_length=2, max_length=200)
    company_id: int = Field(gt=0)
    house_id: int = Field(gt=0)
    apartment_number: int = Field(gt=0)
    additional: bool = False


@router.get("")
async def state(request: Request, session: Session, user: Resident):
    return {
        **await registration_state(session, user.id),
        "test_mode": request.app.state.settings.onboarding_test_mode,
        "companies": await catalog(session),
    }


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
