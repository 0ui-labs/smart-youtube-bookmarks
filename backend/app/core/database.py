"""
Database connection and session management.

This module provides the async database engine, session factory, and
the FastAPI dependency for getting database sessions in route handlers.
"""

from collections.abc import AsyncGenerator

from fastapi import Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.clerk import get_verified_subject

from .config import settings

# Create async engine
engine = create_async_engine(
    settings.database_url, echo=settings.env == "development", future=True
)

# Create async session factory
AsyncSessionLocal = async_sessionmaker(
    engine, class_=AsyncSession, expire_on_commit=False
)


async def get_public_db() -> AsyncGenerator[AsyncSession, None]:
    """
    FastAPI dependency for getting database sessions.

    Yields an async database session and handles commit/rollback automatically.
    Session is automatically closed by the context manager.
    """
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


async def get_db(
    request: Request, subject: str = Depends(get_verified_subject)
) -> AsyncGenerator[AsyncSession, None]:
    from app.services.access_service import validate_request_references
    from app.services.identity_service import resolve_local_user

    async with AsyncSessionLocal() as session:
        try:
            user = await resolve_local_user(session, subject)
            await session.commit()
            session.info["user"] = user
            await validate_request_references(request, session)
            yield session
            await session.commit()
        except BaseException:
            await session.rollback()
            raise


async def require_api_session(db: AsyncSession = Depends(get_db)) -> None:
    from app.services.access_service import authenticated_user

    authenticated_user(db)
