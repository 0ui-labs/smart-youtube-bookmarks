# WebSocket Progress Updates - Design Document

**Date:** 2025-10-28
**Status:** Approved
**Architecture:** Ansatz 1 (Redis Pub/Sub + DB Persistence)

---

## Overview

Real-time progress updates for video processing via WebSockets. Users see live updates for all their running jobs in a dashboard-style view, with persistent history for seamless reconnection after disconnects or page reloads.

## User Story

*As a user, I want to see live progress of my video processing jobs without refreshing the page, and I want to see the current status even if I close and reopen my browser.*

---

## Architecture

### High-Level Design

```
┌─────────────────────────────────────────────────────────────────┐
│                         User Browser                            │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  VideosPage Component                                     │  │
│  │    ├─ useWebSocket('/api/ws/progress')                   │  │
│  │    ├─ ProgressDashboard (alle Jobs)                      │  │
│  │    └─ Individual ProgressBars per Job                    │  │
│  └──────────────────────────────────────────────────────────┘  │
│                           ↕ WebSocket                            │
└─────────────────────────────────────────────────────────────────┘
                              ↕
┌─────────────────────────────────────────────────────────────────┐
│                      Backend (FastAPI)                          │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  WebSocket Endpoint: /api/ws/progress                    │  │
│  │    1. Authenticate User                                  │  │
│  │    2. Subscribe to Redis: progress:user:{user_id}        │  │
│  │    3. Forward messages to WebSocket                      │  │
│  │    4. On disconnect: Cleanup subscription                │  │
│  └──────────────────────────────────────────────────────────┘  │
│                              ↑                                   │
│                      Redis Pub/Sub                              │
│                      Channel: progress:user:{user_id}           │
│                              ↑                                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  ARQ Worker: process_video_list()                        │  │
│  │    For each video:                                       │  │
│  │      1. Process video                                    │  │
│  │      2. Redis PUBLISH + DB INSERT (dual-write)           │  │
│  │      3. Continue next video                              │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                    PostgreSQL Database                          │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Table: job_progress_events                              │  │
│  │    - id (UUID)                                           │  │
│  │    - job_id (FK → processing_jobs)                       │  │
│  │    - created_at (timestamp)                              │  │
│  │    - progress_data (JSONB)                               │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### Key Design Decisions

1. **User-basierte WebSocket:** `/api/ws/progress` (nicht job-basiert)
   - Ein WebSocket für alle User-Jobs (Dashboard-Ansatz)
   - Bessere UX: User sieht alle laufenden Jobs auf einen Blick

2. **Dual-Write Pattern:** ARQ Worker schreibt gleichzeitig in:
   - **Redis Pub/Sub:** Real-time delivery (fire-and-forget)
   - **PostgreSQL:** Persistent history (30-day retention)

3. **Redis Channel Naming:** `progress:user:{user_id}`
   - Natural user isolation
   - Worker published zu Owner-Channel basierend auf Job ownership

4. **Reconnection Strategy:**
   - Frontend holt History via REST API (`GET /api/jobs/{id}/progress-history`)
   - Dann reconnected WebSocket für neue Live-Updates
   - Nahtlose Übergänge ohne verpasste Events

---

## Components

### 1. Database Model: `JobProgressEvent`

**File:** `backend/app/models/job_progress.py`

```python
class JobProgressEvent(Base):
    """Stores progress updates for video processing jobs"""
    __tablename__ = "job_progress_events"

    id: UUID (primary key)
    job_id: UUID (foreign key → processing_jobs.id, indexed)
    created_at: DateTime (indexed, for chronological queries)
    progress_data: JSONB (flexible schema)
```

**Progress Data Schema:**
```json
{
  "job_id": "uuid",
  "status": "processing",      // pending|processing|completed|failed
  "progress": 45,               // 0-100
  "current_video": 5,
  "total_videos": 10,
  "message": "Processing video 5/10: 'Tutorial Title'",
  "video_id": "uuid-here",     // Optional: currently processing video
  "error": null                 // Optional: error message if failed
}
```

**Database Indexes:**
```sql
CREATE INDEX idx_job_progress_job_created
ON job_progress_events(job_id, created_at DESC);
```

**Migration:** Alembic migration to create table + indexes

---

### 2. WebSocket Endpoint: `/api/ws/progress`

**File:** `backend/app/api/websocket.py` (NEW)

**Responsibilities:**
- Accept WebSocket connections with token authentication
- Subscribe to user-specific Redis Pub/Sub channel
- Forward Redis messages to WebSocket
- Handle disconnect cleanup

**Authentication:**
- Token via query parameter: `ws://localhost:8000/api/ws/progress?token=xxx`
- Dependency: `get_current_ws_user` validates token
- Rejects invalid tokens with WebSocket close code 1008

**Pseudocode:**
```python
@router.websocket("/ws/progress")
async def websocket_progress(
    websocket: WebSocket,
    current_user: User = Depends(get_current_ws_user)
):
    await websocket.accept()

    # Setup Redis Pub/Sub
    redis = await get_redis_client()
    pubsub = redis.pubsub()
    channel = f"progress:user:{current_user.id}"
    await pubsub.subscribe(channel)

    try:
        # Listen loop
        async for message in pubsub.listen():
            if message["type"] == "message":
                await websocket.send_json(json.loads(message["data"]))
    finally:
        await pubsub.unsubscribe(channel)
        await websocket.close()
```

---

### 3. Progress History API: `GET /api/jobs/{job_id}/progress-history`

**File:** `backend/app/api/processing.py` (extend existing)

**Purpose:**
- Return historical progress events for reconnect scenario
- Supports pagination via `since` parameter

**Request:**
```
GET /api/jobs/{job_id}/progress-history?since=2025-10-28T10:00:00Z
```

**Response:**
```json
[
  {
    "job_id": "uuid",
    "status": "processing",
    "progress": 30,
    "current_video": 3,
    "total_videos": 10,
    "message": "Processing video 3/10",
    "created_at": "2025-10-28T10:01:00Z"
  },
  ...
]
```

**Pseudocode:**
```python
@router.get("/{job_id}/progress-history")
async def get_progress_history(
    job_id: UUID,
    since: Optional[datetime] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Verify user owns job
    query = select(JobProgressEvent).where(
        JobProgressEvent.job_id == job_id
    )
    if since:
        query = query.where(JobProgressEvent.created_at > since)

    events = await db.execute(
        query.order_by(JobProgressEvent.created_at)
    )
    return [event.progress_data for event in events.scalars()]
```

---

### 4. ARQ Worker Extension

**File:** `backend/app/workers/video_processor.py` (MODIFY existing)

**Changes:**
1. Add `publish_progress()` helper function
2. Call `publish_progress()` after each video processed
3. Implement dual-write pattern (Redis + DB)

**Pseudocode:**
```python
async def process_video_list(
    ctx: dict,
    job_id: str,
    list_id: str,
    video_ids: list[str]
):
    total = len(video_ids)

    # Initial "pending" event
    await publish_progress(ctx, job_id, {
        "status": "pending",
        "progress": 0,
        "current_video": 0,
        "total_videos": total,
        "message": "Starting processing..."
    })

    for idx, video_id in enumerate(video_ids, start=1):
        try:
            # Existing processing logic
            result = await process_single_video(video_id)

            # Publish progress
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
            # Error handling
            await publish_progress(ctx, job_id, {
                "status": "failed",
                "progress": int((idx / total) * 100),
                "message": f"Failed: {str(e)}",
                "error": str(e)
            })
            # Continue with next video

    # Final completion event
    await publish_progress(ctx, job_id, {
        "status": "completed",
        "progress": 100,
        "current_video": total,
        "total_videos": total,
        "message": "All videos processed"
    })

async def publish_progress(ctx: dict, job_id: str, progress_data: dict):
    """Dual-write: Redis Pub/Sub + PostgreSQL"""
    # Get job owner
    async with get_db_session() as db:
        job = await db.get(ProcessingJob, job_id)
        user_id = job.list.user_id  # Assuming FK relation

    # 1. Redis Pub/Sub (real-time, critical)
    redis = ctx["redis"]
    channel = f"progress:user:{user_id}"
    await redis.publish(channel, json.dumps(progress_data))

    # 2. PostgreSQL (persistence, best-effort)
    try:
        async with get_db_session() as db:
            event = JobProgressEvent(
                job_id=job_id,
                progress_data=progress_data
            )
            db.add(event)
            await db.commit()
    except Exception as e:
        logger.error(f"Failed to persist progress event: {e}")
        # Don't raise - continue processing
```

**Throttling Strategy:**
- For small batches (<100 videos): Publish every video
- For large batches (≥100 videos): Publish every 10 videos OR every 5 seconds

---

### 5. Frontend: `useWebSocket` Hook

**File:** `frontend/src/hooks/useWebSocket.ts` (NEW)

**Responsibilities:**
- Manage WebSocket connection lifecycle
- Handle reconnection with exponential backoff
- Maintain state of all job progress updates

**Interface:**
```typescript
interface ProgressUpdate {
  job_id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  current_video: number;
  total_videos: number;
  message: string;
  error?: string;
}

interface UseWebSocketReturn {
  jobProgress: Map<string, ProgressUpdate>;
  isConnected: boolean;
  reconnecting: boolean;
}

function useWebSocket(): UseWebSocketReturn
```

**Pseudocode:**
```typescript
export function useWebSocket() {
  const [jobProgress, setJobProgress] = useState<Map<string, ProgressUpdate>>(new Map());
  const [isConnected, setIsConnected] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const retryCountRef = useRef(0);

  useEffect(() => {
    const connect = () => {
      const token = getAuthToken();
      const ws = new WebSocket(`ws://localhost:8000/api/ws/progress?token=${token}`);

      ws.onopen = () => {
        setIsConnected(true);
        setReconnecting(false);
        retryCountRef.current = 0;
      };

      ws.onmessage = (event) => {
        const update: ProgressUpdate = JSON.parse(event.data);
        setJobProgress(prev => {
          const next = new Map(prev);
          next.set(update.job_id, update);
          return next;
        });
      };

      ws.onclose = () => {
        setIsConnected(false);
        setReconnecting(true);

        // Exponential backoff: 3s, 6s, 12s, max 30s
        const backoff = Math.min(
          3000 * Math.pow(2, retryCountRef.current),
          30000
        );
        retryCountRef.current++;

        setTimeout(connect, backoff);
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
      };

      wsRef.current = ws;
    };

    connect();

    return () => {
      wsRef.current?.close();
    };
  }, []);

  // Cleanup completed/failed jobs after 5 minutes
  useEffect(() => {
    const cleanup = setInterval(() => {
      setJobProgress(prev => {
        const filtered = new Map();
        for (const [id, progress] of prev) {
          if (progress.status === 'processing' ||
              Date.now() - (progress.timestamp || 0) < 5 * 60 * 1000) {
            filtered.set(id, progress);
          }
        }
        return filtered;
      });
    }, 60000); // Every minute

    return () => clearInterval(cleanup);
  }, []);

  return { jobProgress, isConnected, reconnecting };
}
```

---

### 6. Frontend: `ProgressBar` Component

**File:** `frontend/src/components/ProgressBar.tsx` (NEW)

**Purpose:** Visual representation of job progress

**Props:**
```typescript
interface ProgressBarProps {
  progress: ProgressUpdate;
}
```

**UI Elements:**
- Progress percentage (0-100%)
- Current/Total video counter
- Status message
- Visual progress bar (colored based on status)
- Error display (if failed)

**Pseudocode:**
```typescript
export function ProgressBar({ progress }: ProgressBarProps) {
  const statusColors = {
    pending: 'bg-gray-400',
    processing: 'bg-blue-500',
    completed: 'bg-green-500',
    failed: 'bg-red-500'
  };

  return (
    <div className="progress-bar-container">
      <div className="progress-header">
        <span className="progress-message">{progress.message}</span>
        <span className="progress-percentage">{progress.progress}%</span>
      </div>

      <div className="progress-track bg-gray-200">
        <div
          className={`progress-fill ${statusColors[progress.status]}`}
          style={{ width: `${progress.progress}%` }}
        />
      </div>

      <div className="progress-footer">
        <span className="video-counter">
          {progress.current_video}/{progress.total_videos} videos
        </span>
        <span className={`status-badge ${progress.status}`}>
          {progress.status}
        </span>
      </div>

      {progress.error && (
        <div className="error-message text-red-600">
          Error: {progress.error}
        </div>
      )}
    </div>
  );
}
```

---

### 7. Frontend: Integration in `VideosPage`

**File:** `frontend/src/components/VideosPage.tsx` (MODIFY)

**Changes:**
1. Use `useWebSocket()` hook
2. Display progress dashboard above video table
3. Show progress bars for all active jobs

**Pseudocode:**
```typescript
export function VideosPage() {
  const { jobProgress, isConnected, reconnecting } = useWebSocket();

  return (
    <div>
      {/* Connection Status */}
      {reconnecting && (
        <div className="alert alert-warning">Reconnecting...</div>
      )}

      {/* Progress Dashboard */}
      {jobProgress.size > 0 && (
        <div className="progress-dashboard">
          <h3>Active Jobs</h3>
          {Array.from(jobProgress.values()).map(progress => (
            <ProgressBar key={progress.job_id} progress={progress} />
          ))}
        </div>
      )}

      {/* Existing Video Table */}
      <VideoTable ... />
    </div>
  );
}
```

---

## Data Flow

### Scenario: User Imports 10 Videos

**1. Initial Upload:**
```
User → POST /api/lists/{id}/videos/bulk
     → Job created (job-123)
     → ARQ Worker enqueued
     → Response: { job_id: "job-123" }
```

**2. Frontend Connection:**
```
VideosPage mounts
  → useWebSocket() connects
  → WebSocket: ws://localhost:8000/api/ws/progress?token=xxx
  → Backend subscribes to: progress:user:alice-id
  → isConnected = true
```

**3. Worker Processes Videos:**
```
ARQ Worker starts job-123

Video 1:
  → process_single_video()
  → publish_progress({progress: 10, current_video: 1, ...})
    → Redis PUBLISH progress:user:alice-id
    → DB INSERT job_progress_events
  → WebSocket receives message
  → Frontend: jobProgress.set('job-123', {...})
  → UI updates: ProgressBar shows 10%

Video 2-10: (same flow)
  → Progressive updates: 20%, 30%, ..., 100%

Completion:
  → publish_progress({status: 'completed', progress: 100})
  → Frontend shows green status
```

**4. Reconnection Scenario:**

**User closes tab at Video 3, reopens at Video 7:**
```
Frontend reconnects:
  1. GET /api/jobs/job-123/progress-history
     → Returns events 3, 4, 5, 6 (missed during disconnect)
     → Frontend replays: jobProgress updated to Video 6

  2. WebSocket reconnects
     → Subscribe to progress:user:alice-id

  3. Video 7 event arrives
     → Seamless live update from 60% → 70%
```

---

## Error Handling

### 1. WebSocket Connection Failures

**Problem:** Network issues, server restart, connection dropped

**Solution:**
- Automatic reconnection with exponential backoff (3s, 6s, 12s, max 30s)
- UI shows "Reconnecting..." banner
- After reconnect: History API fetches missed events

### 2. Dual-Write Failures

**Problem:** Redis publish succeeds, DB write fails

**Solution:**
- Try-catch around DB write in `publish_progress()`
- Log error, but don't raise (don't block processing)
- User still receives live updates via Redis
- History may be incomplete (acceptable trade-off)

### 3. User Isolation

**Problem:** User A shouldn't see User B's progress

**Solution:**
- Redis channels: `progress:user:{user_id}` (per-user isolation)
- WebSocket authentication validates user
- Worker publishes to job owner's channel only

### 4. Redis Restart

**Problem:** Redis down = lost Pub/Sub messages

**Solution:**
- WebSocket disconnects (onclose triggers)
- Frontend reconnects after backoff
- History API provides last known state
- User sees: "Last update: Video 5/10" + reconnecting banner

### 5. Job Deletion During Processing

**Problem:** User deletes job while worker is processing

**Solution:**
- Worker checks job existence before each video
- If deleted: publish "cancelled" event + exit gracefully
- Frontend removes progress bar from dashboard

### 6. Browser Limits (Multiple Tabs)

**Problem:** User opens 5 tabs = 5 WebSocket connections

**Solution:**
- All tabs receive same updates (same Redis channel)
- No functional issue, slight overhead
- Future optimization: SharedWorker (single WS across tabs)

---

## Performance

### Scalability

| Metric | Current Design | Notes |
|--------|---------------|-------|
| **Concurrent WebSockets** | 1000+ | FastAPI async, no pooling needed for MVP |
| **Redis Pub/Sub Throughput** | ~100k msg/sec | Far exceeds needs (<1000 users) |
| **DB Write Load** | ~10 writes/job | Throttled for large batches |
| **Frontend State** | ~100 active jobs | Cleanup after 5 minutes |
| **Message Size** | ~200 bytes | Minimal network overhead |

### Optimizations

**1. Progress Throttling (Large Batches):**
```python
# For 1000 videos: Publish every 10 videos OR every 5 seconds
should_publish = (
    idx % 10 == 0 or
    time.time() - last_publish > 5 or
    idx == len(video_ids) - 1
)
```

**2. Database Indexing:**
```sql
CREATE INDEX idx_job_progress_job_created
ON job_progress_events(job_id, created_at DESC);
```

**3. Retention Policy:**
- Cleanup events older than 30 days (cron job)
- Prevents unbounded table growth

**4. Frontend Cleanup:**
- Remove completed/failed jobs from state after 5 minutes
- Prevents memory bloat with many historical jobs

---

## Testing Strategy

### Backend Tests (pytest)

**1. Model Tests** (`test_job_progress.py`):
- Create/query progress events
- JSONB schema validation
- Chronological ordering

**2. WebSocket Tests** (`test_websocket.py`):
- Connection with valid/invalid token
- Message forwarding (Redis → WebSocket)
- User isolation (users only receive their events)
- Reconnection handling

**3. History API Tests** (`test_processing.py`):
- Query all events for job
- Pagination with `since` parameter
- Authorization (user can only query their jobs)

**4. Worker Tests** (`test_video_processor.py`):
- Dual-write verification (Redis + DB)
- Progress calculation correctness
- Error handling (continue on single video failure)
- DB failure doesn't crash worker

### Frontend Tests (Vitest)

**1. Hook Tests** (`useWebSocket.test.ts`):
- Connection lifecycle
- Message parsing and state updates
- Reconnection logic
- Cleanup on unmount

**2. Component Tests** (`ProgressBar.test.tsx`):
- Render progress percentage
- Display video counters
- Show error states
- Color coding by status

### Integration Tests

**E2E Test Flow:**
1. Upload CSV (create job)
2. Connect WebSocket
3. Receive progress updates (assert order and values)
4. Disconnect and reconnect
5. Verify history API called
6. Assert final completion event

### Manual Testing Checklist

```
□ Start CSV import (10 videos)
□ Progress bar appears and updates every video
□ Close tab during processing
□ Reopen tab - history loaded correctly
□ Live updates continue after reconnect
□ Open 2 tabs - both show same progress
□ DevTools WebSocket tab: no errors
□ Network tab: history API called on reconnect
□ Completed job: 100% + green status
□ Failed video: error message displayed
```

---

## Production Considerations

### Monitoring

**Metrics:**
- Active WebSocket connections (gauge)
- Progress events published/sec (counter)
- DB write latency (histogram)
- WebSocket connection drop rate (%)

**Alerts:**
- Redis connection failures
- WebSocket drop rate > 10%
- DB write error rate > 5%

### Security

- ✅ WebSocket authentication via token query parameter
- ✅ User isolation via `progress:user:{user_id}` channels
- ✅ Rate limiting: Max 5 WebSocket connections per user
- ✅ Input validation: progress_data schema validation
- ✅ CORS configuration for WebSocket origins

### Deployment

**Environment Variables:**
```bash
# WebSocket
WEBSOCKET_PING_INTERVAL=30
WEBSOCKET_TIMEOUT=60

# Redis Pub/Sub
REDIS_PUBSUB_POOL_SIZE=10

# Retention
PROGRESS_HISTORY_RETENTION_DAYS=30
```

**Docker Compose:**
- Existing Redis service supports Pub/Sub (no changes needed)
- Redis persistence (AOF) already configured for ARQ

**Graceful Degradation:**
- Redis down: No live updates, DB-only persistence
- DB down: Live updates only, no history
- Both down: Worker logs errors, job marked as failed

---

## Migration Path

### Alembic Migration

**Create `job_progress_events` table:**
```python
# backend/alembic/versions/xxx_add_progress_events.py

def upgrade():
    op.create_table(
        'job_progress_events',
        sa.Column('id', UUID, primary_key=True),
        sa.Column('job_id', UUID, sa.ForeignKey('processing_jobs.id')),
        sa.Column('created_at', sa.DateTime, nullable=False),
        sa.Column('progress_data', JSONB, nullable=False)
    )

    op.create_index(
        'idx_job_progress_job_created',
        'job_progress_events',
        ['job_id', sa.desc('created_at')]
    )
```

### Rollout Strategy

1. **Deploy backend changes** (WebSocket endpoint, worker extension)
2. **Run database migration** (create table + indexes)
3. **Deploy frontend changes** (useWebSocket hook, ProgressBar)
4. **Monitor for 1 week** (metrics, error rates)
5. **Tune throttling** based on real usage patterns
6. **Enable retention cleanup** (cron job after 2 weeks)

---

## Future Enhancements

### Phase 2 (Post-MVP)

1. **Notifications:** Browser notifications for completed/failed jobs
2. **Batch Operations:** Cancel multiple running jobs
3. **Priority Queue:** High-priority jobs processed first
4. **SharedWorker:** Single WebSocket across multiple browser tabs
5. **Compression:** Gzip WebSocket messages for large progress data

### Scalability (10k+ Users)

1. **Horizontal Scaling:** Multiple backend instances + Load Balancer
2. **Redis Cluster:** Pub/Sub sharding across nodes
3. **Dedicated WebSocket Servers:** Separate from API servers
4. **Message Broker:** Replace Redis Pub/Sub with RabbitMQ/Kafka for reliability

---

## Appendix

### Technology Stack

- **Backend:** FastAPI 0.109.0 (native WebSocket support)
- **Database:** PostgreSQL 16 (JSONB support)
- **Cache/Queue:** Redis 7 (Pub/Sub + ARQ)
- **Frontend:** React 18.2.0 + TypeScript 5.3.3
- **Testing:** pytest (backend), Vitest (frontend)

### Redis Commands Reference

```bash
# Publish progress event
PUBLISH progress:user:alice-id '{"job_id":"123","progress":50}'

# Subscribe to channel (in WebSocket endpoint)
SUBSCRIBE progress:user:alice-id

# Monitor all pub/sub activity (debugging)
MONITOR
```

### Useful Resources

- [FastAPI WebSocket Docs](https://fastapi.tiangolo.com/advanced/websockets/)
- [Redis Pub/Sub](https://redis.io/docs/interact/pubsub/)
- [WebSocket Reconnection Pattern](https://javascript.info/websocket#reconnection)

---

**Document Version:** 1.0
**Last Updated:** 2025-10-28
**Approved By:** User
**Next Steps:** Create implementation plan using `superpowers:writing-plans` skill
