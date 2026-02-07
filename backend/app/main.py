from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import get_settings
from .routers import auth_router, tabs_router, tasks_router, sync_router

settings = get_settings()

app = FastAPI(
    title=settings.app_name,
    description="Personal Task Manager API with offline-first sync support",
    version="1.0.0",
    docs_url="/docs" if settings.debug else None,
    redoc_url="/redoc" if settings.debug else None,
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth_router)
app.include_router(tabs_router)
app.include_router(tasks_router)
app.include_router(sync_router)


@app.get("/")
async def root():
    """Root endpoint - health check."""
    return {
        "name": settings.app_name,
        "status": "running",
        "version": "1.0.0",
    }


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=settings.debug,
    )
