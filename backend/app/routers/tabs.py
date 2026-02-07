from fastapi import APIRouter, HTTPException, Header
from typing import List, Optional

from ..schemas import TabCreate, TabUpdate, TabResponse
from ..database import execute_sp_fetchone, execute_sp_fetchall
from .auth import get_current_user

router = APIRouter(prefix="/tabs", tags=["Tabs"])


async def get_user_from_header(authorization: Optional[str] = Header(None)) -> dict:
    """Get current user from authorization header."""
    return await get_current_user(authorization)


@router.get("", response_model=List[TabResponse])
async def get_tabs(authorization: Optional[str] = Header(None)):
    """Get all tabs for current user."""
    user = await get_user_from_header(authorization)
    
    tabs = execute_sp_fetchall("sp_GetUserTabs", {"user_id": user["id"]})
    
    return [TabResponse(
        id=tab["id"],
        client_id=tab["client_id"],
        name=tab["name"],
        order_index=tab["order_index"],
        is_system=tab["is_system"],
        tab_type=tab["tab_type"],
        created_at=tab["created_at"],
        updated_at=tab["updated_at"],
    ) for tab in tabs]


@router.post("", response_model=TabResponse)
async def create_tab(tab: TabCreate, authorization: Optional[str] = Header(None)):
    """Create a new custom tab."""
    user = await get_user_from_header(authorization)
    
    result = execute_sp_fetchone("sp_CreateTab", {
        "client_id": tab.client_id,
        "user_id": user["id"],
        "name": tab.name,
        "order_index": tab.order_index,
    })
    
    if not result:
        raise HTTPException(status_code=500, detail="Failed to create tab")
    
    return TabResponse(
        id=result["id"],
        client_id=result["client_id"],
        name=result["name"],
        order_index=result["order_index"],
        is_system=result["is_system"],
        tab_type=result["tab_type"],
        created_at=result["created_at"],
        updated_at=result["updated_at"],
    )


@router.put("/{tab_id}", response_model=TabResponse)
async def update_tab(tab_id: int, tab: TabUpdate, authorization: Optional[str] = Header(None)):
    """Update an existing tab."""
    user = await get_user_from_header(authorization)
    
    result = execute_sp_fetchone("sp_UpdateTab", {
        "tab_id": tab_id,
        "user_id": user["id"],
        "name": tab.name,
        "order_index": tab.order_index,
    })
    
    if not result:
        raise HTTPException(status_code=404, detail="Tab not found")
    
    return TabResponse(
        id=result["id"],
        client_id=result["client_id"],
        name=result["name"],
        order_index=result["order_index"],
        is_system=result["is_system"],
        tab_type=result["tab_type"],
        created_at=result["created_at"],
        updated_at=result["updated_at"],
    )


@router.delete("/{tab_id}")
async def delete_tab(tab_id: int, authorization: Optional[str] = Header(None)):
    """Delete a custom tab (soft delete)."""
    user = await get_user_from_header(authorization)
    
    result = execute_sp_fetchone("sp_DeleteTab", {
        "tab_id": tab_id,
        "user_id": user["id"],
    })
    
    if not result or result.get("affected_rows", 0) == 0:
        raise HTTPException(status_code=404, detail="Tab not found or cannot be deleted")
    
    return {"message": "Tab deleted successfully"}
