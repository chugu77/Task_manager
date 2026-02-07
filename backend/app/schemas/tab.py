from pydantic import BaseModel
from datetime import datetime
from typing import Optional
from enum import Enum


class TabType(str, Enum):
    TODAY = "today"
    ALL_TASKS = "all_tasks"
    CUSTOM = "custom"


class TabBase(BaseModel):
    name: str


class TabCreate(TabBase):
    client_id: str
    order_index: Optional[int] = None


class TabUpdate(BaseModel):
    name: Optional[str] = None
    order_index: Optional[int] = None


class Tab(TabBase):
    id: int
    client_id: str
    user_id: int
    order_index: int
    is_system: bool
    tab_type: TabType
    created_at: datetime
    updated_at: datetime
    is_deleted: bool

    class Config:
        from_attributes = True


class TabResponse(BaseModel):
    id: int
    client_id: str
    name: str
    order_index: int
    is_system: bool
    tab_type: str
    created_at: datetime
    updated_at: datetime
