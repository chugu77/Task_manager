from pydantic import BaseModel
from datetime import datetime
from typing import Optional, List, Any
from enum import Enum


class SyncStatus(str, Enum):
    SYNCED = "synced"
    PENDING = "pending"
    CONFLICT = "conflict"


class SyncPullRequest(BaseModel):
    device_id: str
    last_sync_at: Optional[datetime] = None


class SyncPushRequest(BaseModel):
    device_id: str
    client_id: str
    entity_type: str  # "tab" or "task"
    data: dict[str, Any]
    client_updated_at: datetime


class ConflictData(BaseModel):
    has_conflict: bool
    entity_id: Optional[int]
    client_id: str
    entity_type: str
    server_updated_at: Optional[datetime]
    client_updated_at: datetime
    server_data: Optional[dict[str, Any]] = None
    client_data: Optional[dict[str, Any]] = None


class ConflictResolution(BaseModel):
    client_id: str
    entity_type: str
    resolution: str  # "keep_server" or "keep_client"
    client_data: Optional[dict[str, Any]] = None


class SyncedTab(BaseModel):
    id: int
    client_id: str
    name: str
    order_index: int
    is_system: bool
    tab_type: str
    created_at: datetime
    updated_at: datetime
    is_deleted: bool


class SyncedTask(BaseModel):
    id: int
    client_id: str
    tab_id: Optional[int]
    parent_task_id: Optional[int]
    title: str
    description: Optional[str]
    is_completed: bool
    due_date: Optional[str]
    due_time: Optional[str]
    depth: int
    order_index: int
    created_at: datetime
    updated_at: datetime
    completed_at: Optional[datetime]
    is_deleted: bool


class SyncResponse(BaseModel):
    tabs: List[SyncedTab]
    tasks: List[SyncedTask]
    sync_timestamp: datetime
    conflicts: List[ConflictData] = []
