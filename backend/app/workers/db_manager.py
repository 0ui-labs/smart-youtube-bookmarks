"""Database connection manager for ARQ workers.

Provides session-per-job isolation using SQLAlchemy's async_scoped_session
with ContextVar for job-level scoping.
"""

import logging
from contextvars import ContextVar

from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_scoped_session,
    async_sessionmaker,
    create_async_engine,
)

from app.core.config import settings

logger = logging.getLogger(__name__)

# Context variable for job-scoped sessions
db_session_context: ContextVar[str | None] = ContextVar(
    "db_session_context", default=None
)


class DatabaseConnectionManager:
    """Manages database connections for ARQ workers."""

    def __init__(self):
        self.engine: AsyncEngine | None = None
        self.scoped_session: async_scoped_session | None = None

    async def connect(self) -> None:
        """Initialize database connection pool (called on worker startup)."""
        logger.info("Initializing database connection pool for ARQ workers")

        self.engine = create_async_engine(
            settings.database_url,
            echo=settings.env == "development",
            pool_size=settings.db_pool_size,
            max_overflow=settings.db_max_overflow,
            pool_pre_ping=settings.db_pool_pre_ping,
        )

        # Create scoped session factory
        session_factory = async_sessionmaker(
            bind=self.engine,
            class_=AsyncSession,
            autoflush=False,
            autocommit=False,
            expire_on_commit=False,  # Important for async workers
        )

        # Scope sessions per job using context variable
        self.scoped_session = async_scoped_session(
            session_factory=session_factory,
            scopefunc=db_session_context.get,
        )

        logger.info("Database connection pool initialized successfully")

    async def disconnect(self) -> None:
        """Close database connections (called on worker shutdown)."""
        logger.info("Closing database connection pool")

        if self.scoped_session:
            await self.scoped_session.remove()
        if self.engine:
            await self.engine.dispose()

        logger.info("Database connection pool closed")

    def get_session(self) -> AsyncSession:
        """Get session for current job context."""
        if not self.scoped_session:
            raise RuntimeError(
                "DatabaseConnectionManager not initialized. Call connect() first."
            )
        return self.scoped_session()


# Global instance
sessionmanager = DatabaseConnectionManager()
