from pydantic import BaseModel


class ChatPhotoOutput(BaseModel):
    id: int
    url: str
