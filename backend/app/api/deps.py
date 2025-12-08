"""
API dependencies for authentication and database access.

Provides dependency injection functions for FastAPI routes.
"""

from fastapi import HTTPException, WebSocket, status
from jose import JWTError, jwt
from sqlalchemy import select

from app.core.config import settings
from app.core.database import AsyncSessionLocal
from app.models.user import User


async def get_current_ws_user(websocket: WebSocket, token: str) -> User:
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
        detail="Could not validate credentials",
    )

    try:
        # Decode JWT token
        payload = jwt.decode(
            token, settings.secret_key, algorithms=[settings.algorithm]
        )
        user_id: str | None = payload.get("sub")
        if user_id is None:
            await websocket.close(code=1008)  # Policy Violation
            raise credentials_exception
    except JWTError:
        await websocket.close(code=1008)
        raise credentials_exception

    # Query user from database using context manager
    async with AsyncSessionLocal() as db:
        stmt = select(User).where(User.id == user_id)
        result = await db.execute(stmt)
        user = result.scalar_one_or_none()

        if user is None or not user.is_active:
            await websocket.close(code=1008)
            raise credentials_exception

        return user
