from pydantic import BaseModel, Field
from datetime import datetime, date, time
from typing import Optional, List


class TaskBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=1000)
    description: Optional[str] = None
    due_date: Optional[date] = None
    due_time: Optional[time] = None


class TaskCreate(TaskBase):
    client_id: str
    tab_id: Optional[int] = None
    parent_task_id: Optional[int] = None


class TaskUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=1000)
    description: Optional[str] = None
    due_date: Optional[date] = None
    due_time: Optional[time] = None
    tab_id: Optional[int] = None


class TaskComplete(BaseModel):
    is_completed: bool


class Task(TaskBase):
    id: int
    client_id: str
    user_id: int
    tab_id: Optional[int]
    parent_task_id: Optional[int]
    is_completed: bool
    depth: int
    order_index: int
    created_at: datetime
    updated_at: datetime
    completed_at: Optional[datetime]
    is_deleted: bool

    class Config:
        from_attributes = True


class TaskResponse(BaseModel):
    id: int
    client_id: str
    tab_id: Optional[int]
    parent_task_id: Optional[int]
    title: str
    description: Optional[str]
    is_completed: bool
    due_date: Optional[date]
    due_time: Optional[time]
    depth: int
    order_index: int
    created_at: datetime
    updated_at: datetime
    completed_at: Optional[datetime]
    has_incomplete_children: Optional[bool] = False


class TaskWithChildren(TaskResponse):
    children: List["TaskWithChildren"] = []


# Enable forward reference resolution
TaskWithChildren.model_rebuild()
