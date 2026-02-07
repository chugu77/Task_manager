from fastapi import APIRouter, Header
from typing import Optional
from datetime import datetime

from ..schemas import (
    SyncPullRequest, SyncPushRequest, SyncResponse, 
    ConflictData, ConflictResolution, SyncedTab, SyncedTask
)
from ..database import execute_sp_fetchone, execute_sp_fetchall
from ..database.connection import execute_sp_multiple_results
from .auth import get_current_user

router = APIRouter(prefix="/sync", tags=["Sync"])


async def get_user_from_header(authorization: Optional[str] = Header(None)) -> dict:
    """Get current user from authorization header."""
    return await get_current_user(authorization)


@router.post("/pull", response_model=SyncResponse)
async def sync_pull(request: SyncPullRequest, authorization: Optional[str] = Header(None)):
    """
    Pull changes from server since last sync.
    Returns all tabs and tasks modified after last_sync_at.
    """
    user = await get_user_from_header(authorization)
    
    # Execute stored procedure that returns multiple result sets
    results = execute_sp_multiple_results("sp_SyncPull", {
        "user_id": user["id"],
        "device_id": request.device_id,
        "last_sync_at": request.last_sync_at,
    })
    
    # First result set: tabs
    tabs = []
    if len(results) > 0:
        for tab in results[0]:
            tabs.append(SyncedTab(
                id=tab["id"],
                client_id=tab["client_id"],
                name=tab["name"],
                order_index=tab["order_index"],
                is_system=tab["is_system"],
                tab_type=tab["tab_type"],
                created_at=tab["created_at"],
                updated_at=tab["updated_at"],
                is_deleted=tab["is_deleted"],
            ))
    
    # Second result set: tasks
    tasks = []
    if len(results) > 1:
        for task in results[1]:
            tasks.append(SyncedTask(
                id=task["id"],
                client_id=task["client_id"],
                tab_id=task.get("tab_id"),
                parent_task_id=task.get("parent_task_id"),
                title=task["title"],
                description=task.get("description"),
                is_completed=task["is_completed"],
                due_date=str(task["due_date"]) if task.get("due_date") else None,
                due_time=str(task["due_time"]) if task.get("due_time") else None,
                depth=task["depth"],
                order_index=task["order_index"],
                created_at=task["created_at"],
                updated_at=task["updated_at"],
                completed_at=task.get("completed_at"),
                is_deleted=task["is_deleted"],
            ))
    
    return SyncResponse(
        tabs=tabs,
        tasks=tasks,
        sync_timestamp=datetime.utcnow(),
        conflicts=[],
    )


@router.post("/push", response_model=ConflictData)
async def sync_push(request: SyncPushRequest, authorization: Optional[str] = Header(None)):
    """
    Push local changes to server.
    Returns conflict data if there's a conflict.
    """
    user = await get_user_from_header(authorization)
    
    result = execute_sp_fetchone("sp_SyncPush", {
        "user_id": user["id"],
        "device_id": request.device_id,
        "client_id": request.client_id,
        "entity_type": request.entity_type,
        "data": str(request.data),  # JSON string
        "client_updated_at": request.client_updated_at,
    })
    
    if not result:
        # No conflict, item is new - create it
        return ConflictData(
            has_conflict=False,
            entity_id=None,
            client_id=request.client_id,
            entity_type=request.entity_type,
            server_updated_at=None,
            client_updated_at=request.client_updated_at,
        )
    
    return ConflictData(
        has_conflict=result["has_conflict"],
        entity_id=result.get("entity_id"),
        client_id=result["client_id"],
        entity_type=result["entity_type"],
        server_updated_at=result.get("server_updated_at"),
        client_updated_at=result["client_updated_at"],
    )


@router.post("/resolve")
async def resolve_conflict(resolution: ConflictResolution, authorization: Optional[str] = Header(None)):
    """
    Resolve a sync conflict with user's choice.
    """
    user = await get_user_from_header(authorization)
    
    result = execute_sp_fetchone("sp_ResolveConflict", {
        "user_id": user["id"],
        "client_id": resolution.client_id,
        "entity_type": resolution.entity_type,
        "resolution": resolution.resolution,
        "client_data": str(resolution.client_data) if resolution.client_data else None,
    })
    
    return {
        "success": result.get("success", False) if result else False,
        "applied_resolution": result.get("applied_resolution") if result else None,
    }


@router.post("/batch-push")
async def sync_batch_push(
    items: list[SyncPushRequest],
    authorization: Optional[str] = Header(None)
):
    """
    Push multiple changes at once.
    Returns list of conflicts if any.
    """
    user = await get_user_from_header(authorization)
    
    conflicts = []
    synced = []
    
    for item in items:
        result = execute_sp_fetchone("sp_SyncPush", {
            "user_id": user["id"],
            "device_id": item.device_id,
            "client_id": item.client_id,
            "entity_type": item.entity_type,
            "data": str(item.data),
            "client_updated_at": item.client_updated_at,
        })
        
        if result and result.get("has_conflict"):
            conflicts.append(ConflictData(
                has_conflict=True,
                entity_id=result.get("entity_id"),
                client_id=result["client_id"],
                entity_type=result["entity_type"],
                server_updated_at=result.get("server_updated_at"),
                client_updated_at=result["client_updated_at"],
            ))
        else:
            synced.append(item.client_id)
    
    return {
        "synced_count": len(synced),
        "synced_ids": synced,
        "conflicts": conflicts,
    }
