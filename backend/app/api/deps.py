"""
API dependencies for authentication and database access.

Provides dependency injection functions for FastAPI routes.
"""

from typing import Optional
from fastapi import WebSocket, HTTPException, status
from jose import jwt, JWTError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.models.user import User


async def get_current_ws_user(
    websocket: WebSocket,
    token: str
) -> User:
    """
    Authenticate WebSocket connection via query parameter token.

    Args:
        websocket: WebSocket connection
        token: JWT token from query parameter

    Returns:
        Authenticated User object

    Raises:
        HTTPException: If authentication fails (closes WebSocket with code 1008)
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials"
    )

    try:
        # Decode JWT token
        payload = jwt.decode(
            token,
            settings.secret_key,
            algorithms=[settings.algorithm]
        )
        user_id: Optional[str] = payload.get("sub")
        if user_id is None:
            await websocket.close(code=1008)  # Policy Violation
            raise credentials_exception
    except JWTError:
        await websocket.close(code=1008)
        raise credentials_exception

    # Query user from database
    async for db in get_db():
        stmt = select(User).where(User.id == user_id)
        result = await db.execute(stmt)
        user = result.scalar_one_or_none()

        if user is None or not user.is_active:
            await websocket.close(code=1008)
            raise credentials_exception

        return user

    # Should never reach here, but satisfy type checker
    await websocket.close(code=1008)
    raise credentials_exception
