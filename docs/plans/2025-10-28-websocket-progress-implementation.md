# WebSocket Progress Updates - Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement real-time progress updates for video processing jobs via WebSockets with persistent history for reconnection scenarios.

**Architecture:** Redis Pub/Sub for real-time delivery + PostgreSQL for persistent history (dual-write pattern). User-based WebSocket endpoint (`/api/ws/progress`) subscribes to `progress:user:{user_id}` channels. ARQ worker publishes progress after each video processed.

**Tech Stack:** FastAPI WebSockets, Redis Pub/Sub, PostgreSQL JSONB, SQLAlchemy async, React hooks, TypeScript

---

## Task 1: Database Migration - job_progress_events Table

**Files:**
- Create: `backend/alembic/versions/<timestamp>_add_job_progress_events.py`

**Step 1: Generate Alembic migration**

```bash
cd backend
alembic revision --autogenerate -m "add job progress events table"
```

Expected: New migration file created in `backend/alembic/versions/`

**Step 2: Edit migration to create table with indexes**

Find the generated migration file and update the `upgrade()` function:

```python
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB

def upgrade():
    op.create_table(
        'job_progress_events',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('job_id', UUID(as_uuid=True), sa.ForeignKey('processing_jobs.id', ondelete='CASCADE'), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('progress_data', JSONB, nullable=False)
    )

    # Index for chronological queries by job
    op.create_index(
        'idx_job_progress_job_created',
        'job_progress_events',
        ['job_id', sa.text('created_at DESC')]
    )

def downgrade():
    op.drop_index('idx_job_progress_job_created', table_name='job_progress_events')
    op.drop_table('job_progress_events')
```

**Step 3: Run migration**

```bash
alembic upgrade head
```

Expected: Output shows migration applied successfully

**Step 4: Verify table and indexes created**

```bash
docker exec youtube-bookmarks-db psql -U user -d youtube_bookmarks -c "\d job_progress_events"
docker exec youtube-bookmarks-db psql -U user -d youtube_bookmarks -c "\di job_progress_events"
```

Expected: Table with 4 columns (id, job_id, created_at, progress_data) and index `idx_job_progress_job_created`

**Step 5: Commit**

```bash
git add backend/alembic/versions/
git commit -m "feat: add job_progress_events table migration

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 2: Backend Model + Schema

**Files:**
- Create: `backend/app/models/job_progress.py`
- Create: `backend/app/schemas/job_progress.py`
- Modify: `backend/app/models/__init__.py` (add import)

**Step 1: Write failing model test**

Create: `backend/tests/models/test_job_progress.py`

```python
import pytest
from datetime import datetime
from uuid import uuid4
from app.models.job_progress import JobProgressEvent
from app.models.processing import ProcessingJob

@pytest.mark.asyncio
async def test_create_job_progress_event(async_session):
    """Test creating a job progress event with JSONB data"""
    # Create a job first (simplified - adjust based on your fixtures)
    job_id = uuid4()

    progress_data = {
        "job_id": str(job_id),
        "status": "processing",
        "progress": 50,
        "current_video": 5,
        "total_videos": 10,
        "message": "Processing video 5/10"
    }

    event = JobProgressEvent(
        job_id=job_id,
        progress_data=progress_data
    )

    async_session.add(event)
    await async_session.commit()
    await async_session.refresh(event)

    assert event.id is not None
    assert event.job_id == job_id
    assert event.progress_data["progress"] == 50
    assert event.created_at is not None

@pytest.mark.asyncio
async def test_query_events_chronologically(async_session):
    """Test querying events in chronological order"""
    job_id = uuid4()

    # Create multiple events
    for i in range(3):
        event = JobProgressEvent(
            job_id=job_id,
            progress_data={"progress": i * 30, "current_video": i + 1}
        )
        async_session.add(event)

    await async_session.commit()

    # Query events ordered by created_at
    from sqlalchemy import select
    stmt = select(JobProgressEvent).where(
        JobProgressEvent.job_id == job_id
    ).order_by(JobProgressEvent.created_at)

    result = await async_session.execute(stmt)
    events = result.scalars().all()

    assert len(events) == 3
    assert events[0].progress_data["progress"] == 0
    assert events[1].progress_data["progress"] == 30
    assert events[2].progress_data["progress"] == 60
```

**Step 2: Run test to verify it fails**

```bash
pytest backend/tests/models/test_job_progress.py -v
```

Expected: FAIL with "No module named 'app.models.job_progress'"

**Step 3: Create model file**

Create: `backend/app/models/job_progress.py`

```python
from datetime import datetime
from uuid import uuid4, UUID
from sqlalchemy import Column, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID as PG_UUID, JSONB
from sqlalchemy.orm import relationship
from app.db.base_class import Base

class JobProgressEvent(Base):
    """Stores progress updates for video processing jobs"""
    __tablename__ = "job_progress_events"

    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    job_id = Column(
        PG_UUID(as_uuid=True),
        ForeignKey("processing_jobs.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    created_at = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)
    progress_data = Column(JSONB, nullable=False)

    # Relationship to ProcessingJob (optional, for eager loading)
    job = relationship("ProcessingJob", back_populates="progress_events")

    def __repr__(self):
        return f"<JobProgressEvent(id={self.id}, job_id={self.job_id}, progress={self.progress_data.get('progress')}%)>"
```

**Step 4: Update ProcessingJob model to add relationship**

Modify: `backend/app/models/processing.py`

Find the `ProcessingJob` class and add this line inside the class:

```python
# Add this to ProcessingJob class
progress_events = relationship("JobProgressEvent", back_populates="job", cascade="all, delete-orphan")
```

**Step 5: Update models __init__.py**

Modify: `backend/app/models/__init__.py`

Add import:

```python
from app.models.job_progress import JobProgressEvent
```

**Step 6: Create schema file**

Create: `backend/app/schemas/job_progress.py`

```python
from datetime import datetime
from uuid import UUID
from pydantic import BaseModel, Field
from typing import Optional

class ProgressData(BaseModel):
    """Schema for progress_data JSONB field"""
    job_id: UUID
    status: str = Field(..., pattern="^(pending|processing|completed|failed)$")
    progress: int = Field(..., ge=0, le=100)
    current_video: int = Field(..., ge=0)
    total_videos: int = Field(..., gt=0)
    message: str
    video_id: Optional[UUID] = None
    error: Optional[str] = None

class JobProgressEventCreate(BaseModel):
    """Schema for creating a progress event"""
    job_id: UUID
    progress_data: ProgressData

class JobProgressEventRead(BaseModel):
    """Schema for reading a progress event"""
    id: UUID
    job_id: UUID
    created_at: datetime
    progress_data: dict  # JSONB returns as dict

    class Config:
        from_attributes = True
```

**Step 7: Run tests to verify they pass**

```bash
pytest backend/tests/models/test_job_progress.py -v
```

Expected: 2 tests PASS

**Step 8: Commit**

```bash
git add backend/app/models/job_progress.py backend/app/schemas/job_progress.py backend/app/models/processing.py backend/app/models/__init__.py backend/tests/models/test_job_progress.py
git commit -m "feat: add JobProgressEvent model and schemas

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 3: WebSocket Endpoint

**Files:**
- Create: `backend/app/api/websocket.py`
- Modify: `backend/app/main.py` (add router)
- Create: `backend/tests/api/test_websocket.py`

**Step 1: Write failing WebSocket test**

Create: `backend/tests/api/test_websocket.py`

```python
import pytest
import json
from fastapi.testclient import TestClient
from app.main import app

@pytest.mark.asyncio
async def test_websocket_requires_authentication():
    """Test that WebSocket connection requires valid token"""
    client = TestClient(app)

    with pytest.raises(Exception):
        with client.websocket_connect("/api/ws/progress"):
            pass  # Should fail before connecting

@pytest.mark.asyncio
async def test_websocket_receives_progress_updates(test_user, auth_headers):
    """Test WebSocket receives progress updates from Redis"""
    # This test requires mocking Redis pub/sub
    # Simplified version - expand based on your test infrastructure
    client = TestClient(app)
    token = auth_headers["Authorization"].split(" ")[1]

    with client.websocket_connect(f"/api/ws/progress?token={token}") as websocket:
        # Mock: Publish to Redis channel
        # In real test, inject mock Redis client

        # Expect to receive message
        data = websocket.receive_json()
        assert "job_id" in data
        assert "progress" in data
```

**Step 2: Run test to verify it fails**

```bash
pytest backend/tests/api/test_websocket.py -v
```

Expected: FAIL with "404 Not Found" (endpoint doesn't exist)

**Step 3: Create WebSocket dependency for authentication**

Create: `backend/app/api/deps.py` (if not exists, or add to existing)

```python
from fastapi import WebSocket, HTTPException, status, Depends
from jose import jwt, JWTError
from app.core.config import settings
from app.models.user import User
from app.db.session import AsyncSessionLocal
from sqlalchemy import select

async def get_current_ws_user(
    websocket: WebSocket,
    token: str
) -> User:
    """Authenticate WebSocket connection via query parameter token"""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials"
    )

    try:
        payload = jwt.decode(
            token,
            settings.SECRET_KEY,
            algorithms=[settings.ALGORITHM]
        )
        user_id: str = payload.get("sub")
        if user_id is None:
            await websocket.close(code=1008)  # Policy Violation
            raise credentials_exception
    except JWTError:
        await websocket.close(code=1008)
        raise credentials_exception

    async with AsyncSessionLocal() as db:
        stmt = select(User).where(User.id == user_id)
        result = await db.execute(stmt)
        user = result.scalar_one_or_none()

        if user is None:
            await websocket.close(code=1008)
            raise credentials_exception

        return user
```

**Step 4: Create WebSocket endpoint**

Create: `backend/app/api/websocket.py`

```python
import json
import asyncio
import logging
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends
from app.api.deps import get_current_ws_user
from app.models.user import User
from app.core.redis import get_redis_client

router = APIRouter()
logger = logging.getLogger(__name__)

@router.websocket("/ws/progress")
async def websocket_progress_endpoint(
    websocket: WebSocket,
    token: str,
):
    """
    WebSocket endpoint for real-time progress updates.

    Authenticates via token query parameter, subscribes to user-specific
    Redis channel, and forwards progress messages.
    """
    # Authenticate first (before accepting connection)
    user = await get_current_ws_user(websocket, token)

    # Accept connection after authentication
    await websocket.accept()
    logger.info(f"WebSocket connected for user {user.id}")

    # Setup Redis Pub/Sub
    redis = await get_redis_client()
    pubsub = redis.pubsub()
    channel = f"progress:user:{user.id}"

    try:
        await pubsub.subscribe(channel)
        logger.info(f"Subscribed to Redis channel: {channel}")

        # Listen for messages
        async for message in pubsub.listen():
            if message["type"] == "message":
                try:
                    # Parse and forward message
                    progress_data = json.loads(message["data"])
                    await websocket.send_json(progress_data)
                except json.JSONDecodeError as e:
                    logger.error(f"Failed to parse progress message: {e}")
                except Exception as e:
                    logger.error(f"Error forwarding message: {e}")
                    break

    except WebSocketDisconnect:
        logger.info(f"WebSocket disconnected for user {user.id}")
    except Exception as e:
        logger.error(f"WebSocket error for user {user.id}: {e}")
    finally:
        # Cleanup
        await pubsub.unsubscribe(channel)
        await pubsub.close()
        logger.info(f"Cleaned up WebSocket for user {user.id}")
```

**Step 5: Add Redis helper (if not exists)**

Create or modify: `backend/app/core/redis.py`

```python
import redis.asyncio as redis
from app.core.config import settings

_redis_client = None

async def get_redis_client() -> redis.Redis:
    """Get or create Redis client (singleton)"""
    global _redis_client
    if _redis_client is None:
        _redis_client = redis.from_url(
            settings.REDIS_URL,
            encoding="utf-8",
            decode_responses=True
        )
    return _redis_client

async def close_redis_client():
    """Close Redis connection"""
    global _redis_client
    if _redis_client:
        await _redis_client.close()
        _redis_client = None
```

**Step 6: Register WebSocket router in main.py**

Modify: `backend/app/main.py`

Add import and include router:

```python
from app.api import websocket

# Add this with other router includes
app.include_router(websocket.router, prefix="/api", tags=["websocket"])
```

**Step 7: Run tests to verify they pass**

```bash
pytest backend/tests/api/test_websocket.py -v
```

Expected: Tests pass (may need to adjust mocking based on your test setup)

**Step 8: Manual test WebSocket connection**

Start backend:
```bash
cd backend
uvicorn app.main:app --reload
```

Test with a WebSocket client (wscat or browser console):
```javascript
const ws = new WebSocket('ws://localhost:8000/api/ws/progress?token=YOUR_TOKEN');
ws.onmessage = (event) => console.log(JSON.parse(event.data));
```

**Step 9: Commit**

```bash
git add backend/app/api/websocket.py backend/app/api/deps.py backend/app/core/redis.py backend/app/main.py backend/tests/api/test_websocket.py
git commit -m "feat: add WebSocket endpoint for progress updates

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 4: Progress History API

**Files:**
- Modify: `backend/app/api/processing.py`
- Modify: `backend/tests/api/test_processing.py`

**Step 1: Write failing test for history API**

Add to: `backend/tests/api/test_processing.py`

```python
@pytest.mark.asyncio
async def test_get_progress_history(async_client, test_user, auth_headers):
    """Test retrieving progress history for a job"""
    # Create a job
    job_id = uuid4()
    # ... create job in DB (adjust based on your fixtures)

    # Create progress events
    from app.models.job_progress import JobProgressEvent
    async with async_session() as db:
        for i in range(3):
            event = JobProgressEvent(
                job_id=job_id,
                progress_data={
                    "job_id": str(job_id),
                    "status": "processing",
                    "progress": i * 30,
                    "current_video": i + 1,
                    "total_videos": 10,
                    "message": f"Processing video {i+1}/10"
                }
            )
            db.add(event)
        await db.commit()

    # Request history
    response = await async_client.get(
        f"/api/jobs/{job_id}/progress-history",
        headers=auth_headers
    )

    assert response.status_code == 200
    data = response.json()
    assert len(data) == 3
    assert data[0]["progress"] == 0
    assert data[1]["progress"] == 30
    assert data[2]["progress"] == 60

@pytest.mark.asyncio
async def test_get_progress_history_with_since_filter(async_client, test_user, auth_headers):
    """Test filtering progress history by timestamp"""
    # Similar to above but test 'since' parameter
    pass  # Implement based on your test patterns
```

**Step 2: Run test to verify it fails**

```bash
pytest backend/tests/api/test_processing.py::test_get_progress_history -v
```

Expected: FAIL with "404 Not Found"

**Step 3: Add history endpoint to processing.py**

Modify: `backend/app/api/processing.py`

Add this endpoint:

```python
from datetime import datetime
from typing import Optional, List
from app.models.job_progress import JobProgressEvent
from app.schemas.job_progress import JobProgressEventRead

@router.get("/{job_id}/progress-history", response_model=List[dict])
async def get_progress_history(
    job_id: UUID,
    since: Optional[datetime] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get progress history for a job.

    Supports filtering by 'since' timestamp for efficient reconnection.
    """
    # Verify job exists and user owns it
    stmt = select(ProcessingJob).where(
        ProcessingJob.id == job_id
    )
    result = await db.execute(stmt)
    job = result.scalar_one_or_none()

    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    # Check ownership via job -> list -> user relationship
    if job.list.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")

    # Query progress events
    query = select(JobProgressEvent).where(
        JobProgressEvent.job_id == job_id
    )

    if since:
        query = query.where(JobProgressEvent.created_at > since)

    query = query.order_by(JobProgressEvent.created_at)

    result = await db.execute(query)
    events = result.scalars().all()

    # Return just the progress_data (JSONB content)
    return [event.progress_data for event in events]
```

**Step 4: Run tests to verify they pass**

```bash
pytest backend/tests/api/test_processing.py::test_get_progress_history -v
```

Expected: Test passes

**Step 5: Test manually with curl**

```bash
curl http://localhost:8000/api/jobs/{job_id}/progress-history \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Step 6: Commit**

```bash
git add backend/app/api/processing.py backend/tests/api/test_processing.py
git commit -m "feat: add progress history API endpoint

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 5: ARQ Worker Extension

**Files:**
- Modify: `backend/app/workers/video_processor.py`
- Modify: `backend/tests/workers/test_video_processor.py`

**Step 1: Write failing test for progress publishing**

Add to: `backend/tests/workers/test_video_processor.py`

```python
@pytest.mark.asyncio
async def test_worker_publishes_progress_events(mock_redis, async_session):
    """Test that worker publishes progress to Redis and DB"""
    job_id = uuid4()
    video_ids = [uuid4() for _ in range(3)]

    # Mock Redis publish
    mock_redis.publish = AsyncMock()

    # Run worker
    ctx = {"redis": mock_redis}
    await process_video_list(ctx, str(job_id), video_ids)

    # Verify Redis publish was called
    assert mock_redis.publish.call_count >= 3  # At least once per video

    # Verify DB events created
    from sqlalchemy import select
    from app.models.job_progress import JobProgressEvent
    stmt = select(JobProgressEvent).where(JobProgressEvent.job_id == job_id)
    result = await async_session.execute(stmt)
    events = result.scalars().all()

    assert len(events) >= 3
    assert events[0].progress_data["status"] in ["pending", "processing"]
    assert events[-1].progress_data["status"] == "completed"

@pytest.mark.asyncio
async def test_worker_continues_on_db_write_failure(mock_redis, async_session):
    """Test that worker continues processing if DB write fails"""
    # Mock DB session to raise exception on commit
    # Verify worker doesn't crash and Redis publish still happens
    pass  # Implement based on your mocking patterns
```

**Step 2: Run test to verify it fails**

```bash
pytest backend/tests/workers/test_video_processor.py::test_worker_publishes_progress_events -v
```

Expected: FAIL (publish_progress doesn't exist yet)

**Step 3: Add publish_progress helper to worker**

Modify: `backend/app/workers/video_processor.py`

Add these imports at top:

```python
import json
import logging
from app.models.job_progress import JobProgressEvent
from app.db.session import AsyncSessionLocal

logger = logging.getLogger(__name__)
```

Add helper function:

```python
async def publish_progress(
    ctx: dict,
    job_id: str,
    progress_data: dict
) -> None:
    """
    Dual-write pattern: Publish progress to Redis (real-time) and PostgreSQL (persistence).

    Redis publish is critical - raises exception on failure.
    DB write is best-effort - logs error but continues processing.
    """
    # Get job to find owner user_id
    async with AsyncSessionLocal() as db:
        from sqlalchemy import select
        from app.models.processing import ProcessingJob

        stmt = select(ProcessingJob).where(ProcessingJob.id == job_id)
        result = await db.execute(stmt)
        job = result.scalar_one_or_none()

        if not job:
            logger.error(f"Job {job_id} not found for progress update")
            return

        # Get user_id from job -> list relationship
        user_id = job.list.user_id

    # 1. Redis Pub/Sub (critical path - must succeed)
    redis = ctx["redis"]
    channel = f"progress:user:{user_id}"

    try:
        await redis.publish(channel, json.dumps(progress_data))
        logger.debug(f"Published progress to {channel}: {progress_data.get('progress')}%")
    except Exception as e:
        logger.error(f"Failed to publish progress to Redis: {e}")
        raise  # Critical - re-raise to alert monitoring

    # 2. PostgreSQL (best-effort persistence)
    try:
        async with AsyncSessionLocal() as db:
            event = JobProgressEvent(
                job_id=job_id,
                progress_data=progress_data
            )
            db.add(event)
            await db.commit()
    except Exception as e:
        logger.error(f"Failed to persist progress event to DB: {e}")
        # Don't raise - DB failure shouldn't stop processing
```

**Step 4: Modify process_video_list to call publish_progress**

In the same file, modify `process_video_list` function:

```python
async def process_video_list(
    ctx: dict,
    job_id: str,
    list_id: str,
    video_ids: list[str]
) -> dict:
    """Process multiple videos with progress updates"""
    total = len(video_ids)

    # Initial "pending" event
    await publish_progress(ctx, job_id, {
        "job_id": job_id,
        "status": "pending",
        "progress": 0,
        "current_video": 0,
        "total_videos": total,
        "message": "Starting processing..."
    })

    processed = 0
    failed = 0

    for idx, video_id in enumerate(video_ids, start=1):
        try:
            # Existing processing logic
            result = await process_single_video(ctx, video_id, list_id)
            processed += 1

            # Publish progress after successful video
            await publish_progress(ctx, job_id, {
                "job_id": job_id,
                "status": "processing",
                "progress": int((idx / total) * 100),
                "current_video": idx,
                "total_videos": total,
                "message": f"Processing video {idx}/{total}",
                "video_id": video_id
            })

        except Exception as e:
            failed += 1
            logger.error(f"Failed to process video {video_id}: {e}")

            # Publish error progress
            await publish_progress(ctx, job_id, {
                "job_id": job_id,
                "status": "processing",  # Still processing others
                "progress": int((idx / total) * 100),
                "current_video": idx,
                "total_videos": total,
                "message": f"Error on video {idx}/{total}: {str(e)[:100]}",
                "video_id": video_id,
                "error": str(e)
            })
            # Continue with next video

    # Final completion event
    final_status = "completed" if failed == 0 else "completed_with_errors"
    await publish_progress(ctx, job_id, {
        "job_id": job_id,
        "status": final_status,
        "progress": 100,
        "current_video": total,
        "total_videos": total,
        "message": f"Completed: {processed} succeeded, {failed} failed"
    })

    return {
        "job_id": job_id,
        "processed": processed,
        "failed": failed
    }
```

**Step 5: Run tests to verify they pass**

```bash
pytest backend/tests/workers/test_video_processor.py -v
```

Expected: Tests pass

**Step 6: Test with actual Redis**

```bash
# Terminal 1: Monitor Redis pub/sub
docker exec -it youtube-bookmarks-redis redis-cli MONITOR

# Terminal 2: Run worker with test job
cd backend
python -m pytest backend/tests/workers/test_video_processor.py -v -s
```

**Step 7: Commit**

```bash
git add backend/app/workers/video_processor.py backend/tests/workers/test_video_processor.py
git commit -m "feat: add progress publishing to ARQ worker

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 6: Frontend useWebSocket Hook

**Files:**
- Create: `frontend/src/hooks/useWebSocket.ts`
- Create: `frontend/src/hooks/useWebSocket.test.ts`

**Step 1: Write failing test for hook**

Create: `frontend/src/hooks/useWebSocket.test.ts`

```typescript
import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useWebSocket } from './useWebSocket';

// Mock WebSocket
class MockWebSocket {
  onopen: (() => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: ((event: Event) => void) | null = null;

  constructor(public url: string) {
    setTimeout(() => this.onopen?.(), 0);
  }

  send(data: string) {}
  close() {}
}

global.WebSocket = MockWebSocket as any;

describe('useWebSocket', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.setItem('token', 'test-token');
  });

  it('establishes connection on mount', async () => {
    const { result } = renderHook(() => useWebSocket());

    await waitFor(() => {
      expect(result.current.isConnected).toBe(true);
    });
  });

  it('updates jobProgress when receiving messages', async () => {
    const { result } = renderHook(() => useWebSocket());

    await waitFor(() => expect(result.current.isConnected).toBe(true));

    // Simulate receiving a message
    const mockMessage = {
      job_id: 'job-123',
      status: 'processing',
      progress: 50,
      current_video: 5,
      total_videos: 10,
      message: 'Processing video 5/10'
    };

    // Trigger onmessage
    // ... (implementation depends on your test setup)

    await waitFor(() => {
      const progress = result.current.jobProgress.get('job-123');
      expect(progress?.progress).toBe(50);
    });
  });

  it('reconnects on disconnect with backoff', async () => {
    // Test reconnection logic
    // ... implement based on your patterns
  });
});
```

**Step 2: Run test to verify it fails**

```bash
cd frontend
npm run test useWebSocket
```

Expected: FAIL (hook doesn't exist)

**Step 3: Create useWebSocket hook**

Create: `frontend/src/hooks/useWebSocket.ts`

```typescript
import { useState, useEffect, useRef } from 'react';

export interface ProgressUpdate {
  job_id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'completed_with_errors';
  progress: number;
  current_video: number;
  total_videos: number;
  message: string;
  video_id?: string;
  error?: string;
  timestamp?: number;  // Added on frontend for cleanup logic
}

export interface UseWebSocketReturn {
  jobProgress: Map<string, ProgressUpdate>;
  isConnected: boolean;
  reconnecting: boolean;
}

const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:8000/api/ws/progress';
const MAX_BACKOFF = 30000; // 30 seconds
const INITIAL_BACKOFF = 3000; // 3 seconds
const CLEANUP_INTERVAL = 60000; // 1 minute
const COMPLETED_JOB_TTL = 5 * 60 * 1000; // 5 minutes

export function useWebSocket(): UseWebSocketReturn {
  const [jobProgress, setJobProgress] = useState<Map<string, ProgressUpdate>>(new Map());
  const [isConnected, setIsConnected] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const retryCountRef = useRef(0);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    const connect = () => {
      // Get auth token from localStorage
      const token = localStorage.getItem('token');
      if (!token) {
        console.error('No auth token found for WebSocket connection');
        return;
      }

      const ws = new WebSocket(`${WS_URL}?token=${token}`);

      ws.onopen = () => {
        console.log('WebSocket connected');
        setIsConnected(true);
        setReconnecting(false);
        retryCountRef.current = 0;
      };

      ws.onmessage = (event) => {
        try {
          const update: ProgressUpdate = JSON.parse(event.data);

          // Add timestamp for cleanup logic
          update.timestamp = Date.now();

          setJobProgress(prev => {
            const next = new Map(prev);
            next.set(update.job_id, update);
            return next;
          });
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };

      ws.onclose = () => {
        console.log('WebSocket disconnected');
        setIsConnected(false);

        // Don't reconnect if this was intentional close (component unmount)
        if (wsRef.current === ws) {
          setReconnecting(true);

          // Exponential backoff: 3s, 6s, 12s, 24s, max 30s
          const backoff = Math.min(
            INITIAL_BACKOFF * Math.pow(2, retryCountRef.current),
            MAX_BACKOFF
          );
          retryCountRef.current++;

          console.log(`Reconnecting in ${backoff}ms (attempt ${retryCountRef.current})`);
          reconnectTimeoutRef.current = setTimeout(connect, backoff);
        }
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
      };

      wsRef.current = ws;
    };

    connect();

    return () => {
      // Cleanup on unmount
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        const ws = wsRef.current;
        wsRef.current = null; // Prevent reconnection
        ws.close();
      }
    };
  }, []);

  // Cleanup completed/failed jobs after TTL
  useEffect(() => {
    const cleanup = setInterval(() => {
      setJobProgress(prev => {
        const now = Date.now();
        const filtered = new Map<string, ProgressUpdate>();

        for (const [id, progress] of prev) {
          const isActive = progress.status === 'pending' || progress.status === 'processing';
          const isRecent = progress.timestamp && (now - progress.timestamp) < COMPLETED_JOB_TTL;

          if (isActive || isRecent) {
            filtered.set(id, progress);
          }
        }

        return filtered;
      });
    }, CLEANUP_INTERVAL);

    return () => clearInterval(cleanup);
  }, []);

  return { jobProgress, isConnected, reconnecting };
}
```

**Step 4: Run tests to verify they pass**

```bash
npm run test useWebSocket
```

Expected: Tests pass

**Step 5: Test hook integration**

Create a simple test component:

```bash
npm run dev
```

Open browser console and verify WebSocket connection.

**Step 6: Commit**

```bash
git add frontend/src/hooks/useWebSocket.ts frontend/src/hooks/useWebSocket.test.ts
git commit -m "feat: add useWebSocket hook for progress updates

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 7: Frontend ProgressBar Component

**Files:**
- Create: `frontend/src/components/ProgressBar.tsx`
- Create: `frontend/src/components/ProgressBar.test.tsx`

**Step 1: Write failing test for component**

Create: `frontend/src/components/ProgressBar.test.tsx`

```typescript
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { ProgressBar } from './ProgressBar';
import { ProgressUpdate } from '../hooks/useWebSocket';

describe('ProgressBar', () => {
  it('renders progress percentage', () => {
    const progress: ProgressUpdate = {
      job_id: 'job-123',
      status: 'processing',
      progress: 50,
      current_video: 5,
      total_videos: 10,
      message: 'Processing video 5/10'
    };

    render(<ProgressBar progress={progress} />);

    expect(screen.getByText('50%')).toBeInTheDocument();
    expect(screen.getByText('Processing video 5/10')).toBeInTheDocument();
    expect(screen.getByText('5/10 videos')).toBeInTheDocument();
  });

  it('displays error message when status is failed', () => {
    const progress: ProgressUpdate = {
      job_id: 'job-123',
      status: 'failed',
      progress: 30,
      current_video: 3,
      total_videos: 10,
      message: 'Processing failed',
      error: 'API rate limit exceeded'
    };

    render(<ProgressBar progress={progress} />);

    expect(screen.getByText(/API rate limit exceeded/)).toBeInTheDocument();
  });

  it('shows green color for completed status', () => {
    const progress: ProgressUpdate = {
      job_id: 'job-123',
      status: 'completed',
      progress: 100,
      current_video: 10,
      total_videos: 10,
      message: 'Completed'
    };

    const { container } = render(<ProgressBar progress={progress} />);
    const progressBar = container.querySelector('.bg-green-500');

    expect(progressBar).toBeInTheDocument();
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npm run test ProgressBar
```

Expected: FAIL (component doesn't exist)

**Step 3: Create ProgressBar component**

Create: `frontend/src/components/ProgressBar.tsx`

```typescript
import React from 'react';
import { ProgressUpdate } from '../hooks/useWebSocket';

export interface ProgressBarProps {
  progress: ProgressUpdate;
}

const statusColors = {
  pending: 'bg-gray-400',
  processing: 'bg-blue-500',
  completed: 'bg-green-500',
  failed: 'bg-red-500',
  completed_with_errors: 'bg-yellow-500',
};

const statusLabels = {
  pending: 'Pending',
  processing: 'Processing',
  completed: 'Completed',
  failed: 'Failed',
  completed_with_errors: 'Completed with errors',
};

export function ProgressBar({ progress }: ProgressBarProps) {
  const colorClass = statusColors[progress.status];
  const statusLabel = statusLabels[progress.status];

  return (
    <div className="progress-bar-container bg-white rounded-lg shadow p-4 mb-4">
      {/* Header: Message and Percentage */}
      <div className="flex justify-between items-center mb-2">
        <span className="text-sm font-medium text-gray-700">
          {progress.message}
        </span>
        <span className="text-sm font-bold text-gray-900">
          {progress.progress}%
        </span>
      </div>

      {/* Progress Track and Fill */}
      <div className="progress-track w-full bg-gray-200 rounded-full h-3 mb-2">
        <div
          className={`progress-fill ${colorClass} h-full rounded-full transition-all duration-300`}
          style={{ width: `${progress.progress}%` }}
        />
      </div>

      {/* Footer: Video Counter and Status Badge */}
      <div className="flex justify-between items-center">
        <span className="text-xs text-gray-600">
          {progress.current_video}/{progress.total_videos} videos
        </span>
        <span
          className={`status-badge px-2 py-1 text-xs font-semibold rounded ${
            progress.status === 'completed'
              ? 'bg-green-100 text-green-800'
              : progress.status === 'failed'
              ? 'bg-red-100 text-red-800'
              : progress.status === 'processing'
              ? 'bg-blue-100 text-blue-800'
              : 'bg-gray-100 text-gray-800'
          }`}
        >
          {statusLabel}
        </span>
      </div>

      {/* Error Message (if present) */}
      {progress.error && (
        <div className="error-message mt-3 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-600">
          <strong>Error:</strong> {progress.error}
        </div>
      )}
    </div>
  );
}
```

**Step 4: Run tests to verify they pass**

```bash
npm run test ProgressBar
```

Expected: Tests pass

**Step 5: Visual test in Storybook (optional) or browser**

```bash
npm run dev
```

Create a test page to render ProgressBar with mock data.

**Step 6: Commit**

```bash
git add frontend/src/components/ProgressBar.tsx frontend/src/components/ProgressBar.test.tsx
git commit -m "feat: add ProgressBar component for job visualization

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 8: Integrate Progress in VideosPage

**Files:**
- Modify: `frontend/src/components/VideosPage.tsx`

**Step 1: Add useWebSocket hook to VideosPage**

Modify: `frontend/src/components/VideosPage.tsx`

Add import at top:

```typescript
import { useWebSocket } from '../hooks/useWebSocket';
import { ProgressBar } from './ProgressBar';
```

Add hook usage inside component:

```typescript
export function VideosPage() {
  // Existing hooks
  const { listId } = useParams();
  const { videos, isLoading } = useVideos(listId);

  // Add WebSocket hook
  const { jobProgress, isConnected, reconnecting } = useWebSocket();

  // ... rest of component
```

**Step 2: Add progress dashboard UI**

In the return JSX, add progress section above the table:

```typescript
return (
  <div className="videos-page container mx-auto px-4 py-8">
    <h1 className="text-3xl font-bold mb-6">Videos</h1>

    {/* Connection Status Banner */}
    {reconnecting && (
      <div className="alert alert-warning bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded mb-4">
        <span className="font-semibold">Reconnecting to progress updates...</span>
      </div>
    )}

    {/* Progress Dashboard */}
    {jobProgress.size > 0 && (
      <div className="progress-dashboard mb-8">
        <h2 className="text-xl font-semibold mb-4 text-gray-800">
          Active Jobs ({jobProgress.size})
        </h2>
        <div className="space-y-4">
          {Array.from(jobProgress.values()).map((progress) => (
            <ProgressBar key={progress.job_id} progress={progress} />
          ))}
        </div>
      </div>
    )}

    {/* Existing Video Table */}
    {isLoading ? (
      <div>Loading videos...</div>
    ) : (
      <VideoTable videos={videos} />
    )}
  </div>
);
```

**Step 3: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: No TypeScript errors

**Step 4: Build check**

```bash
npm run build
```

Expected: Build succeeds

**Step 5: Visual test**

```bash
npm run dev
```

Open http://localhost:5173, navigate to videos page, and verify:
- Progress dashboard section exists
- WebSocket connection indicator works
- Ready for real progress updates

**Step 6: Commit**

```bash
git add frontend/src/components/VideosPage.tsx
git commit -m "feat: integrate WebSocket progress in VideosPage

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 9: Backend Integration Tests

**Files:**
- Create: `backend/tests/integration/test_progress_flow.py`

**Step 1: Write E2E integration test**

Create: `backend/tests/integration/test_progress_flow.py`

```python
import pytest
import asyncio
import json
from uuid import uuid4
from fastapi.testclient import TestClient
from app.main import app

@pytest.mark.asyncio
async def test_end_to_end_progress_flow(async_client, test_user, auth_headers, mock_redis):
    """
    E2E test: Upload CSV -> Worker processes -> WebSocket updates -> History API
    """
    # 1. Create a list
    list_response = await async_client.post(
        "/api/lists",
        json={"name": "Test List"},
        headers=auth_headers
    )
    list_id = list_response.json()["id"]

    # 2. Upload CSV (triggers job)
    csv_content = "video_id,title\nvid1,Video 1\nvid2,Video 2\nvid3,Video 3"
    files = {"file": ("test.csv", csv_content, "text/csv")}

    job_response = await async_client.post(
        f"/api/lists/{list_id}/videos/bulk",
        files=files,
        headers=auth_headers
    )

    assert job_response.status_code == 200
    job_id = job_response.json()["job_id"]

    # 3. Simulate WebSocket connection (mocked)
    # In real test, use websocket test client

    # 4. Verify progress events were created in DB
    from sqlalchemy import select
    from app.models.job_progress import JobProgressEvent

    async with async_session() as db:
        stmt = select(JobProgressEvent).where(
            JobProgressEvent.job_id == job_id
        ).order_by(JobProgressEvent.created_at)

        result = await db.execute(stmt)
        events = result.scalars().all()

        assert len(events) >= 3  # At least one per video

        # Verify progression
        assert events[0].progress_data["progress"] == 0  # Start
        assert events[-1].progress_data["status"] == "completed"  # End
        assert events[-1].progress_data["progress"] == 100

    # 5. Test history API
    history_response = await async_client.get(
        f"/api/jobs/{job_id}/progress-history",
        headers=auth_headers
    )

    assert history_response.status_code == 200
    history = history_response.json()
    assert len(history) >= 3

    # Verify chronological order
    for i in range(len(history) - 1):
        assert history[i]["progress"] <= history[i + 1]["progress"]

@pytest.mark.asyncio
async def test_user_isolation_in_progress_channels(async_client, mock_redis):
    """Test that users only receive their own progress updates"""
    # Create two users with jobs
    # Verify user A doesn't receive user B's updates
    pass  # Implement based on your auth fixtures
```

**Step 2: Run integration tests**

```bash
pytest backend/tests/integration/test_progress_flow.py -v
```

Expected: Tests pass

**Step 3: Commit**

```bash
git add backend/tests/integration/test_progress_flow.py
git commit -m "test: add E2E integration tests for progress flow

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 10: Manual Testing & Documentation

**Files:**
- Create: `docs/testing/websocket-progress-manual-tests.md`

**Step 1: Create manual testing checklist**

Create: `docs/testing/websocket-progress-manual-tests.md`

```markdown
# WebSocket Progress Updates - Manual Testing Checklist

## Prerequisites

- Backend running: `cd backend && uvicorn app.main:app --reload`
- Frontend running: `cd frontend && npm run dev`
- Docker services: `docker-compose up -d postgres redis`
- Redis monitor (optional): `docker exec -it youtube-bookmarks-redis redis-cli MONITOR`

---

## Test Cases

### TC1: Happy Path - Small Batch (10 videos)

**Steps:**
1. Navigate to Videos page
2. Click "Upload CSV" button
3. Upload CSV with 10 videos
4. Observe progress dashboard

**Expected Results:**
- ✅ Progress bar appears immediately
- ✅ Progress updates smoothly (0% → 10% → 20% → ... → 100%)
- ✅ Video counter increments (1/10 → 2/10 → ... → 10/10)
- ✅ Status badge shows "Processing" (blue)
- ✅ Final status shows "Completed" (green)
- ✅ Progress bar disappears after 5 minutes

**Actual Results:** _[Fill during testing]_

---

### TC2: Reconnection - Tab Close During Processing

**Steps:**
1. Start CSV upload (20 videos)
2. Wait for progress to reach ~30%
3. Close browser tab
4. Wait 10 seconds
5. Reopen tab and navigate back to Videos page

**Expected Results:**
- ✅ Progress bar reappears with last known state (~50-60%)
- ✅ Live updates resume from current state
- ✅ No duplicate progress bars
- ✅ History API called (check Network tab)

**Actual Results:** _[Fill during testing]_

---

### TC3: Multiple Tabs - Same User

**Steps:**
1. Open Videos page in 2 browser tabs
2. Start CSV upload from Tab 1
3. Observe both tabs

**Expected Results:**
- ✅ Both tabs show same progress bar
- ✅ Both tabs update in sync
- ✅ Progress percentages match

**Actual Results:** _[Fill during testing]_

---

### TC4: Error Handling - Failed Video

**Steps:**
1. Upload CSV with invalid video ID
2. Observe progress when worker hits failed video

**Expected Results:**
- ✅ Progress bar shows error message
- ✅ Status remains "Processing" (continues with next video)
- ✅ Final status shows "Completed with errors" (yellow)
- ✅ Error details visible in progress message

**Actual Results:** _[Fill during testing]_

---

### TC5: Large Batch - Throttling

**Steps:**
1. Upload CSV with 200+ videos
2. Monitor Redis pub/sub activity
3. Observe progress update frequency

**Expected Results:**
- ✅ Progress updates throttled (not every single video)
- ✅ UI still feels responsive
- ✅ Final completion event received

**Actual Results:** _[Fill during testing]_

---

### TC6: WebSocket Debugging

**Steps:**
1. Open Browser DevTools → Network → WS tab
2. Start CSV upload
3. Observe WebSocket messages

**Expected Results:**
- ✅ Connection established to `ws://localhost:8000/api/ws/progress?token=...`
- ✅ Messages received with progress data
- ✅ No connection errors
- ✅ Messages are valid JSON

**Actual Results:** _[Fill during testing]_

---

### TC7: Redis Restart Scenario

**Steps:**
1. Start CSV upload
2. During processing: `docker-compose restart redis`
3. Observe frontend behavior

**Expected Results:**
- ✅ WebSocket disconnects
- ✅ "Reconnecting..." banner appears
- ✅ After Redis restarts, WebSocket reconnects
- ✅ History API provides last state

**Actual Results:** _[Fill during testing]_

---

### TC8: Database Query Performance

**Steps:**
1. Create multiple jobs with progress history
2. Query history API: `GET /api/jobs/{id}/progress-history`
3. Check query execution time in logs

**Expected Results:**
- ✅ Query uses index (check `EXPLAIN ANALYZE`)
- ✅ Response time < 100ms for typical job
- ✅ Pagination with `since` parameter works

**Actual Results:** _[Fill during testing]_

---

### TC9: Cleanup - Completed Jobs Disappear

**Steps:**
1. Start CSV upload, wait for completion
2. Wait 5+ minutes
3. Observe progress dashboard

**Expected Results:**
- ✅ Completed job disappears after 5 minutes
- ✅ No memory leak (check browser memory usage)

**Actual Results:** _[Fill during testing]_

---

### TC10: Multi-User Isolation

**Steps:**
1. Login as User A in Browser 1
2. Login as User B in Browser 2
3. User A starts CSV upload
4. Observe User B's Videos page

**Expected Results:**
- ✅ User B sees NO progress bar for User A's job
- ✅ User isolation maintained

**Actual Results:** _[Fill during testing]_

---

## Performance Metrics

| Metric | Target | Actual |
|--------|--------|--------|
| WebSocket connection time | < 500ms | _[Fill]_ |
| Progress update latency | < 200ms | _[Fill]_ |
| History API response time | < 100ms | _[Fill]_ |
| Browser memory usage (10 jobs) | < 50MB | _[Fill]_ |
| Redis pub/sub throughput | 100+ msg/sec | _[Fill]_ |

---

## Sign-Off

**Tested By:** _[Your Name]_
**Date:** _[Date]_
**Environment:** Development
**Result:** ✅ PASS / ❌ FAIL

**Notes:** _[Any observations, bugs found, etc.]_
```

**Step 2: Execute manual tests**

Go through each test case systematically and fill in results.

**Step 3: Fix any bugs found during manual testing**

Create separate commits for bug fixes:

```bash
git add [fixed-files]
git commit -m "fix: [description of bug]

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

**Step 4: Update documentation**

If needed, update:
- README.md (feature documentation)
- API documentation (WebSocket endpoint)

**Step 5: Final commit**

```bash
git add docs/testing/
git commit -m "docs: add manual testing checklist for WebSocket progress

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Final Verification

**Before merging to main:**

**Step 1: Run all tests**

```bash
# Backend
cd backend
pytest -v
pytest --cov=app --cov-report=term-missing

# Frontend
cd frontend
npm run test
npx tsc --noEmit
npm run build
```

**Step 2: Multi-tool reviews**

Run code quality checks:

```bash
# CodeRabbit CLI
coderabbit review --plain --base-commit <BASE_SHA> --type committed

# Semgrep
semgrep --config=auto backend/app/ frontend/src/ --json
```

**Step 3: Fix ALL issues (Option C approach)**

Address every issue found in reviews, no matter how minor.

**Step 4: Final merge**

```bash
git checkout main
git merge feature/websocket-progress-updates
git push origin main
```

---

## Success Criteria

✅ All 10 tasks completed
✅ All tests passing (backend + frontend)
✅ TypeScript compiles with no errors
✅ Manual testing checklist: 10/10 passed
✅ CodeRabbit: 0 critical issues
✅ Semgrep: 0 security findings
✅ Code review: All issues addressed
✅ Documentation complete

---

**Plan Version:** 1.0
**Created:** 2025-10-28
**Estimated Time:** 3-4 hours
**Architecture:** Dual-write (Redis + PostgreSQL)
**Deployment:** Feature branch → Main (after reviews)
