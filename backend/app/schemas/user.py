from pydantic import BaseModel, EmailStr
from datetime import datetime
from typing import Optional


class UserBase(BaseModel):
    email: EmailStr
    name: str
    avatar_url: Optional[str] = None


class UserCreate(UserBase):
    google_id: str


class User(UserBase):
    id: int
    google_id: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class UserResponse(BaseModel):
    id: int
    email: str
    name: str
    avatar_url: Optional[str] = None
