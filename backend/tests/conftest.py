import asyncio
from datetime import UTC
from unittest.mock import AsyncMock, patch

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from app.core.config import settings
from app.core.database import get_db
from app.main import app
from app.models import Base
from app.models.list import BookmarkList
from app.models.user import User
from app.models.video import Video

# Test database URL
# Replace the database name in the URL with _test suffix
TEST_DATABASE_URL = settings.database_url.rsplit("/", 1)[0] + "/youtube_bookmarks_test"


@pytest.fixture(scope="session")
def event_loop():
    """
    Create an event loop for the test session.

    This fixture overrides the default pytest-asyncio event loop fixture
    to use session scope, allowing session-scoped async fixtures.
    """
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest.fixture(scope="session")
async def test_engine():
    """Create test database engine."""
    engine = create_async_engine(TEST_DATABASE_URL, echo=False, poolclass=NullPool)

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    yield engine

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)

    await engine.dispose()


@pytest.fixture
async def test_db(test_engine):
    """Create a test database session with cleanup after each test."""
    TestSessionLocal = async_sessionmaker(
        test_engine, class_=AsyncSession, expire_on_commit=False
    )

    async with TestSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            # Clean up all data after each test to ensure isolation
            # Disable foreign key checks, truncate all tables, re-enable
            await session.execute(text("SET session_replication_role = 'replica'"))
            for table in reversed(Base.metadata.sorted_tables):
                await session.execute(text(f'TRUNCATE TABLE "{table.name}" CASCADE'))
            await session.execute(text("SET session_replication_role = 'origin'"))
            await session.commit()
            await session.close()


@pytest.fixture
async def mock_arq_pool():
    """Mock ARQ pool to avoid Redis connection in tests."""
    mock_pool = AsyncMock()
    mock_pool.enqueue_job = AsyncMock(return_value=None)
    return mock_pool


@pytest.fixture
async def mock_redis_client():
    """Mock Redis client to avoid Redis connection in tests."""
    mock_redis = AsyncMock()
    mock_pubsub = AsyncMock()
    mock_pubsub.subscribe = AsyncMock()
    mock_pubsub.unsubscribe = AsyncMock()
    mock_pubsub.listen = AsyncMock(return_value=[])
    mock_redis.pubsub = AsyncMock(return_value=mock_pubsub)
    return mock_redis


@pytest.fixture
async def client(test_db, mock_arq_pool, mock_redis_client):
    """Create test client with database override and mocked ARQ/Redis."""

    async def override_get_db():
        yield test_db

    app.dependency_overrides[get_db] = override_get_db

    # Mock both get_arq_pool and get_redis_client to avoid Redis connection
    # Patch for both videos and processing APIs
    with (
        patch("app.api.videos.get_arq_pool", return_value=mock_arq_pool),
        patch("app.api.processing.get_arq_pool", return_value=mock_arq_pool),
        patch("app.core.redis.get_redis_client", return_value=mock_redis_client),
    ):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            yield ac

    app.dependency_overrides.clear()


@pytest.fixture
async def test_user(test_db: AsyncSession) -> User:
    """Create a test user for each test."""
    import uuid

    # Use unique email per test to avoid conflicts
    user = User(
        email=f"test-{uuid.uuid4()}@example.com",
        hashed_password="$2b$12$placeholder_hash",
        is_active=True,
    )
    test_db.add(user)
    await test_db.commit()
    await test_db.refresh(user)
    return user


@pytest.fixture
async def test_list(test_db: AsyncSession, test_user: User) -> BookmarkList:
    """Create a test bookmark list."""
    bookmark_list = BookmarkList(
        name="Test List", description="A test bookmark list", user_id=test_user.id
    )
    test_db.add(bookmark_list)
    await test_db.commit()
    await test_db.refresh(bookmark_list)
    return bookmark_list


@pytest.fixture
async def test_video(test_db: AsyncSession, test_list: BookmarkList) -> Video:
    """Create a test video."""
    video = Video(
        list_id=test_list.id, youtube_id="dQw4w9WgXcQ", processing_status="pending"
    )
    test_db.add(video)
    await test_db.commit()
    await test_db.refresh(video)
    return video


@pytest.fixture
async def mock_redis():
    """Mock Redis client for testing."""
    from unittest.mock import AsyncMock

    redis_mock = AsyncMock()
    redis_mock.publish = AsyncMock(return_value=1)
    return redis_mock


@pytest.fixture
async def mock_session_factory(test_engine):
    """Mock AsyncSessionLocal factory to use test database."""
    from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

    return async_sessionmaker(test_engine, class_=AsyncSession, expire_on_commit=False)


@pytest.fixture
async def test_schema(test_db: AsyncSession, test_list: BookmarkList):
    """Create a test field schema."""
    from app.models.field_schema import FieldSchema

    schema = FieldSchema(
        list_id=test_list.id,
        name="Test Schema",
        description="Test schema for integration tests",
    )
    test_db.add(schema)
    await test_db.commit()
    await test_db.refresh(schema)
    return schema


@pytest.fixture
async def user_factory(test_db: AsyncSession):
    """
    Factory fixture for creating multiple test users.

    Usage:
        async def test_example(user_factory):
            alice = await user_factory("alice")
            bob = await user_factory("bob")
    """
    created_users = []

    async def _create_user(name_prefix: str = "test"):
        """Create a test user with unique email."""
        import uuid

        user = User(
            email=f"{name_prefix}-{uuid.uuid4()}@example.com",
            hashed_password="$2b$12$placeholder_hash",
            is_active=True,
        )
        test_db.add(user)
        await test_db.commit()
        await test_db.refresh(user)
        created_users.append(user)
        return user

    yield _create_user

    # Cleanup not needed - test_db rollback handles it


@pytest.fixture
async def arq_context(test_db: AsyncSession):
    """Create ARQ worker context for testing."""
    from datetime import datetime
    from unittest.mock import AsyncMock

    # Create mock Redis client that mimics ArqRedis
    mock_redis = AsyncMock()
    mock_redis.enqueue_job = AsyncMock(return_value=None)

    return {
        "db": test_db,
        "redis": mock_redis,  # Required for job enqueuing in workers
        "job_id": "test-job-123",
        "job_try": 1,
        "enqueue_time": datetime.now(UTC),
        "score": 1,
    }


@pytest.fixture(autouse=True)
async def reset_redis_singleton():
    """
    Reset Redis singleton instances between tests to prevent event loop issues.

    The Redis client singleton can get attached and fail when connection state
    is invalid. This fixture ensures clean state between tests.
    """
    # Import here to avoid circular dependency
    import app.core.redis as redis_module

    # Clean up before test
    if redis_module._redis_client is not None:
        try:
            await redis_module._redis_client.aclose()
        except Exception:
            pass  # Ignore errors during cleanup
        redis_module._redis_client = None

    if redis_module._arq_pool is not None:
        try:
            await redis_module._arq_pool.close(close_connection_pool=True)
        except Exception:
            pass  # Ignore errors during cleanup
        redis_module._arq_pool = None

    yield

    # Clean up after test
    if redis_module._redis_client is not None:
        try:
            await redis_module._redis_client.aclose()
        except Exception:
            pass
        redis_module._redis_client = None

    if redis_module._arq_pool is not None:
        try:
            await redis_module._arq_pool.close(close_connection_pool=True)
        except Exception:
            pass
        redis_module._arq_pool = None
