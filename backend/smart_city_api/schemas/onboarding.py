from typing import Literal

from pydantic import BaseModel, ConfigDict


class OnboardingInput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    status: Literal["completed", "skipped"]


class OnboardingOutput(BaseModel):
    status: Literal["not_started", "completed", "skipped"]
