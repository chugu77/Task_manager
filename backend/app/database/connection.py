import pyodbc
from contextlib import contextmanager
from typing import Any, Generator
from ..config import get_settings


def get_connection_string() -> str:
    """Build MSSQL connection string for domain server with trusted certificate."""
    settings = get_settings()
    
    # Windows/Domain Authentication (Trusted Connection)
    if not settings.db_user:
        return (
            f"DRIVER={{{settings.db_driver}}};"
            f"SERVER={settings.db_server};"
            f"DATABASE={settings.db_name};"
            f"Trusted_Connection=yes;"
            f"TrustServerCertificate=yes;"
            f"Encrypt=yes;"
        )
    
    # SQL Server Authentication
    return (
        f"DRIVER={{{settings.db_driver}}};"
        f"SERVER={settings.db_server};"
        f"DATABASE={settings.db_name};"
        f"UID={settings.db_user};"
        f"PWD={settings.db_password};"
        f"TrustServerCertificate=yes;"
        f"Encrypt=yes;"
    )


@contextmanager
def get_db_connection() -> Generator[pyodbc.Connection, None, None]:
    """Get database connection as context manager."""
    conn = pyodbc.connect(get_connection_string())
    try:
        yield conn
    finally:
        conn.close()


def execute_sp(sp_name: str, params: dict[str, Any] = None) -> None:
    """Execute stored procedure without returning results."""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        try:
            if params:
                param_placeholders = ", ".join([f"@{k}=?" for k in params.keys()])
                cursor.execute(f"EXEC {sp_name} {param_placeholders}", list(params.values()))
            else:
                cursor.execute(f"EXEC {sp_name}")
            conn.commit()
        finally:
            cursor.close()


def execute_sp_fetchone(sp_name: str, params: dict[str, Any] = None) -> dict | None:
    """Execute stored procedure and fetch one result."""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        try:
            if params:
                param_placeholders = ", ".join([f"@{k}=?" for k in params.keys()])
                cursor.execute(f"EXEC {sp_name} {param_placeholders}", list(params.values()))
            else:
                cursor.execute(f"EXEC {sp_name}")
            
            row = cursor.fetchone()
            if row:
                columns = [column[0] for column in cursor.description]
                return dict(zip(columns, row))
            return None
        finally:
            cursor.close()


def execute_sp_fetchall(sp_name: str, params: dict[str, Any] = None) -> list[dict]:
    """Execute stored procedure and fetch all results."""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        try:
            if params:
                param_placeholders = ", ".join([f"@{k}=?" for k in params.keys()])
                cursor.execute(f"EXEC {sp_name} {param_placeholders}", list(params.values()))
            else:
                cursor.execute(f"EXEC {sp_name}")
            
            rows = cursor.fetchall()
            if rows:
                columns = [column[0] for column in cursor.description]
                return [dict(zip(columns, row)) for row in rows]
            return []
        finally:
            cursor.close()


def execute_sp_multiple_results(sp_name: str, params: dict[str, Any] = None) -> list[list[dict]]:
    """Execute stored procedure that returns multiple result sets."""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        try:
            if params:
                param_placeholders = ", ".join([f"@{k}=?" for k in params.keys()])
                cursor.execute(f"EXEC {sp_name} {param_placeholders}", list(params.values()))
            else:
                cursor.execute(f"EXEC {sp_name}")
            
            results = []
            while True:
                rows = cursor.fetchall()
                if rows:
                    columns = [column[0] for column in cursor.description]
                    results.append([dict(zip(columns, row)) for row in rows])
                else:
                    results.append([])
                
                if not cursor.nextset():
                    break
            
            return results
        finally:
            cursor.close()
