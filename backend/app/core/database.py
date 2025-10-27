"""
Database connection and session management.

This module provides the async database engine, session factory, and
the FastAPI dependency for getting database sessions in route handlers.
"""

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from .config import settings

# Create async engine
engine = create_async_engine(
    settings.database_url,
    echo=settings.env == "development",
    future=True
)

# Create async session factory
AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False
)


async def get_db():
    """
    FastAPI dependency for getting database sessions.

    Yields an async database session and handles commit/rollback automatically.
    Always closes the session after use.
    """
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
