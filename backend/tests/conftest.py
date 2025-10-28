import pytest
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.pool import NullPool

from app.main import app
from app.core.database import get_db
from app.models import Base
from app.models.list import BookmarkList
from app.models.video import Video
from app.core.config import settings


# Test database URL
# Replace the database name in the URL with _test suffix
TEST_DATABASE_URL = settings.database_url.rsplit('/', 1)[0] + '/youtube_bookmarks_test'


@pytest.fixture(scope="session")
async def test_engine():
    """Create test database engine."""
    engine = create_async_engine(
        TEST_DATABASE_URL,
        echo=False,
        poolclass=NullPool
    )

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    yield engine

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)

    await engine.dispose()


@pytest.fixture
async def test_db(test_engine):
    """Create a test database session."""
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
            await session.close()


@pytest.fixture
async def client(test_db):
    """Create test client with database override."""
    async def override_get_db():
        yield test_db

    app.dependency_overrides[get_db] = override_get_db

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac

    app.dependency_overrides.clear()


@pytest.fixture
async def test_list(test_db: AsyncSession) -> BookmarkList:
    """Create a test bookmark list."""
    bookmark_list = BookmarkList(
        name="Test List",
        description="A test bookmark list"
    )
    test_db.add(bookmark_list)
    await test_db.commit()
    await test_db.refresh(bookmark_list)
    return bookmark_list


@pytest.fixture
async def test_video(test_db: AsyncSession, test_list: BookmarkList) -> Video:
    """Create a test video."""
    video = Video(
        list_id=test_list.id,
        youtube_id="dQw4w9WgXcQ",
        processing_status="pending"
    )
    test_db.add(video)
    await test_db.commit()
    await test_db.refresh(video)
    return video
