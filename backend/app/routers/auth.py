from fastapi import APIRouter, HTTPException, Depends
from google.oauth2 import id_token
from google.auth.transport import requests
from jose import jwt
from datetime import datetime, timedelta
from typing import Annotated

from ..config import get_settings
from ..schemas import GoogleAuthRequest, TokenResponse, UserResponse
from ..database import execute_sp_fetchone

router = APIRouter(prefix="/auth", tags=["Authentication"])


def create_access_token(user_id: int) -> tuple[str, int]:
    """Create JWT access token."""
    settings = get_settings()
    expire = datetime.utcnow() + timedelta(minutes=settings.jwt_expire_minutes)
    
    payload = {
        "sub": str(user_id),
        "exp": expire,
        "iat": datetime.utcnow(),
    }
    
    token = jwt.encode(payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)
    return token, settings.jwt_expire_minutes * 60


def verify_token(token: str) -> int:
    """Verify JWT token and return user_id."""
    settings = get_settings()
    try:
        payload = jwt.decode(token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm])
        user_id = int(payload.get("sub"))
        return user_id
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")


async def get_current_user(authorization: str = None) -> dict:
    """Dependency to get current user from token."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    token = authorization.replace("Bearer ", "")
    user_id = verify_token(token)
    
    # Get user from database (simplified - you might want to cache this)
    from ..database import get_db_connection
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id, google_id, email, name, avatar_url FROM Users WHERE id = ?", user_id)
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=401, detail="User not found")
        
        return {
            "id": row[0],
            "google_id": row[1],
            "email": row[2],
            "name": row[3],
            "avatar_url": row[4],
        }


# Type alias for dependency injection
CurrentUser = Annotated[dict, Depends(get_current_user)]


@router.post("/google", response_model=TokenResponse)
async def google_auth(request: GoogleAuthRequest):
    """Authenticate with Google ID token."""
    settings = get_settings()
    
    try:
        # Verify the Google ID token
        idinfo = id_token.verify_oauth2_token(
            request.id_token,
            requests.Request(),
            settings.google_client_id
        )
        
        # Extract user info
        google_id = idinfo["sub"]
        email = idinfo.get("email", "")
        name = idinfo.get("name", "")
        avatar_url = idinfo.get("picture", "")
        
    except ValueError as e:
        raise HTTPException(status_code=401, detail=f"Invalid Google token: {str(e)}")
    
    # Create or update user in database
    user = execute_sp_fetchone("sp_UpsertUser", {
        "google_id": google_id,
        "email": email,
        "name": name,
        "avatar_url": avatar_url,
    })
    
    if not user:
        raise HTTPException(status_code=500, detail="Failed to create user")
    
    # Create JWT token
    access_token, expires_in = create_access_token(user["id"])
    
    return TokenResponse(
        access_token=access_token,
        expires_in=expires_in,
        user={
            "id": user["id"],
            "email": user["email"],
            "name": user["name"],
            "avatar_url": user["avatar_url"],
        }
    )


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: CurrentUser):
    """Get current authenticated user."""
    return UserResponse(
        id=current_user["id"],
        email=current_user["email"],
        name=current_user["name"],
        avatar_url=current_user["avatar_url"],
    )
