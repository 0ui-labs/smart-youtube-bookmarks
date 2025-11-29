"""
Database connection and session management.

This module provides the async database engine, session factory, and
the FastAPI dependency for getting database sessions in route handlers.
"""

from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from .config import settings

# Create async engine
engine = create_async_engine(
    settings.database_url, echo=settings.env == "development", future=True
)

# Create async session factory
AsyncSessionLocal = async_sessionmaker(
    engine, class_=AsyncSession, expire_on_commit=False
)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
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
