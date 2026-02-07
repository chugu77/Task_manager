from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # App settings
    app_name: str = "Task Manager API"
    debug: bool = False
    
    # Database settings (MSSQL)
    db_server: str = "localhost"
    db_name: str = "TaskManager"
    db_user: str = ""
    db_password: str = ""
    db_driver: str = "ODBC Driver 17 for SQL Server"
    
    # Google OAuth settings
    google_client_id: str = ""
    google_client_secret: str = ""
    
    # JWT settings
    jwt_secret_key: str = "your-secret-key-change-in-production"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 60 * 24 * 7  # 7 days
    
    # CORS settings
    cors_origins: list[str] = ["http://localhost:3000", "http://localhost:19006"]
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


@lru_cache()
def get_settings() -> Settings:
    return Settings()
