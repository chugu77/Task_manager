from fastapi import APIRouter, HTTPException, Header, Query
from typing import List, Optional

from ..schemas import TaskCreate, TaskUpdate, TaskComplete, TaskResponse
from ..database import execute_sp_fetchone, execute_sp_fetchall
from .auth import get_current_user

router = APIRouter(prefix="/tasks", tags=["Tasks"])


async def get_user_from_header(authorization: Optional[str] = Header(None)) -> dict:
    """Get current user from authorization header."""
    return await get_current_user(authorization)


def build_task_response(task: dict) -> TaskResponse:
    """Build TaskResponse from database row."""
    return TaskResponse(
        id=task["id"],
        client_id=task["client_id"],
        tab_id=task.get("tab_id"),
        parent_task_id=task.get("parent_task_id"),
        title=task["title"],
        description=task.get("description"),
        is_completed=task["is_completed"],
        due_date=task.get("due_date"),
        due_time=task.get("due_time"),
        depth=task["depth"],
        order_index=task["order_index"],
        created_at=task["created_at"],
        updated_at=task["updated_at"],
        completed_at=task.get("completed_at"),
        has_incomplete_children=task.get("has_incomplete_children", False),
    )


@router.get("/today", response_model=List[TaskResponse])
async def get_today_tasks(authorization: Optional[str] = Header(None)):
    """Get tasks due today or overdue."""
    user = await get_user_from_header(authorization)
    
    tasks = execute_sp_fetchall("sp_GetTodayTasks", {"user_id": user["id"]})
    
    return [build_task_response(task) for task in tasks]


@router.get("/all", response_model=List[TaskResponse])
async def get_all_tasks(
    include_completed: bool = Query(True),
    authorization: Optional[str] = Header(None)
):
    """Get all tasks for AllTasks view."""
    user = await get_user_from_header(authorization)
    
    tasks = execute_sp_fetchall("sp_GetAllTasks", {
        "user_id": user["id"],
        "include_completed": include_completed,
    })
    
    return [build_task_response(task) for task in tasks]


@router.get("/tab/{tab_id}", response_model=List[TaskResponse])
async def get_tasks_by_tab(
    tab_id: int,
    include_completed: bool = Query(False),
    authorization: Optional[str] = Header(None)
):
    """Get tasks for a specific tab."""
    user = await get_user_from_header(authorization)
    
    tasks = execute_sp_fetchall("sp_GetTasksByTab", {
        "user_id": user["id"],
        "tab_id": tab_id,
        "include_completed": include_completed,
    })
    
    return [build_task_response(task) for task in tasks]


@router.post("", response_model=TaskResponse)
async def create_task(task: TaskCreate, authorization: Optional[str] = Header(None)):
    """Create a new task."""
    user = await get_user_from_header(authorization)
    
    try:
        result = execute_sp_fetchone("sp_CreateTask", {
            "client_id": task.client_id,
            "user_id": user["id"],
            "tab_id": task.tab_id,
            "parent_task_id": task.parent_task_id,
            "title": task.title,
            "description": task.description,
            "due_date": task.due_date,
            "due_time": task.due_time,
        })
    except Exception as e:
        # Check if it's a depth validation error
        if "მაქსიმალური სიღრმე" in str(e):
            raise HTTPException(status_code=400, detail="Maximum depth is 3 levels")
        raise HTTPException(status_code=500, detail=str(e))
    
    if not result:
        raise HTTPException(status_code=500, detail="Failed to create task")
    
    return build_task_response(result)


@router.put("/{task_id}", response_model=TaskResponse)
async def update_task(task_id: int, task: TaskUpdate, authorization: Optional[str] = Header(None)):
    """Update an existing task."""
    user = await get_user_from_header(authorization)
    
    result = execute_sp_fetchone("sp_UpdateTask", {
        "task_id": task_id,
        "user_id": user["id"],
        "title": task.title,
        "description": task.description,
        "due_date": task.due_date,
        "due_time": task.due_time,
        "tab_id": task.tab_id,
    })
    
    if not result:
        raise HTTPException(status_code=404, detail="Task not found")
    
    return build_task_response(result)


@router.put("/{task_id}/complete", response_model=TaskResponse)
async def complete_task(task_id: int, data: TaskComplete, authorization: Optional[str] = Header(None)):
    """Mark task as completed or uncompleted."""
    user = await get_user_from_header(authorization)
    
    result = execute_sp_fetchone("sp_CompleteTask", {
        "task_id": task_id,
        "user_id": user["id"],
        "is_completed": data.is_completed,
    })
    
    if not result:
        raise HTTPException(status_code=404, detail="Task not found")
    
    return build_task_response(result)


@router.delete("/{task_id}")
async def delete_task(task_id: int, authorization: Optional[str] = Header(None)):
    """Delete a task and all its children (soft delete)."""
    user = await get_user_from_header(authorization)
    
    result = execute_sp_fetchone("sp_DeleteTask", {
        "task_id": task_id,
        "user_id": user["id"],
    })
    
    if not result or result.get("affected_rows", 0) == 0:
        raise HTTPException(status_code=404, detail="Task not found")
    
    return {"message": "Task deleted successfully", "deleted_count": result["affected_rows"]}


@router.put("/{task_id}/move", response_model=TaskResponse)
async def move_task(task_id: int, new_tab_id: int, authorization: Optional[str] = Header(None)):
    """Move task to a different tab."""
    user = await get_user_from_header(authorization)
    
    result = execute_sp_fetchone("sp_MoveTask", {
        "task_id": task_id,
        "user_id": user["id"],
        "new_tab_id": new_tab_id,
    })
    
    if not result:
        raise HTTPException(status_code=404, detail="Task not found")
    
    return build_task_response(result)
