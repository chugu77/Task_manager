from pydantic import BaseModel
from typing import Optional


class GoogleAuthRequest(BaseModel):
    id_token: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    user: dict
