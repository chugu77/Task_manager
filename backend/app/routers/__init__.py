from .auth import router as auth_router
from .tabs import router as tabs_router
from .tasks import router as tasks_router
from .sync import router as sync_router

__all__ = ["auth_router", "tabs_router", "tasks_router", "sync_router"]
