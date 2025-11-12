# Task 139: Replace String-Based Logging with Structured Events

**Task ID:** 139  
**Parent Plan:** Security Hardening Implementation (P2 - Operational Excellence)  
**Priority:** P2  
**Status:** Not Started  
**Created:** 2025-11-10

## Goal

Replace all string-based f-string logging with structured event logging across the backend codebase to enable:
- Efficient log parsing and analysis
- Better debugging with structured context
- Production-ready observability
- Consistent event naming conventions

## Current State

**Total String-Based Logs:** 34 occurrences across 6 files

| File | Count | Priority |
|------|-------|----------|
| `app/api/websocket.py` | 9 | HIGH (API) |
| `app/workers/video_processor.py` | 10 | HIGH (Core Worker) |
| `app/clients/youtube.py` | 6 | MEDIUM (Client) |
| `app/workers/settings.py` | 4 | LOW (Worker Config) |
| `app/api/processing.py` | 2 | HIGH (API) |
| `app/api/videos.py` | 3 | HIGH (API) |

**Pattern Detected:**
```python
# Current pattern (34 occurrences):
logger.info(f"WebSocket connected for user {user.id}")
logger.error(f"Failed to enqueue jobs for list {list_id}: {e}")
logger.warning(f"Parent job {job_id} not found for progress update")
logger.debug(f"Cache HIT for video metadata: {video_id}")
```

**Additional Files Without Logging:**
- `app/api/lists.py` - No logging (needs baseline logging added)
- `app/api/tags.py` - No logging (needs baseline logging added)

## Acceptance Criteria

- [ ] All 34 f-string log statements replaced with structured events
- [ ] Event naming follows snake_case convention (e.g., `websocket_connected`, `video_processing_failed`)
- [ ] All events include relevant context fields (user_id, video_id, job_id, etc.)
- [ ] Error events include `error`, `error_type`, and `error_context` fields
- [ ] UUIDs converted to strings for structured logging compatibility
- [ ] Structured logging helper created in `app/core/logging.py`
- [ ] At least 3 high-priority API files fully migrated
- [ ] Smoke tests verify structured logs appear in console output
- [ ] Event naming convention documented

## Implementation Plan

### Phase 1: Foundation (30 mins)

#### Step 1.1: Create Structured Logging Module

**File:** `backend/app/core/logging.py`

Create helper function for consistent structured logging:

```python
"""Structured logging utilities for Smart YouTube Bookmarks."""
import logging
from typing import Any


def get_logger(name: str) -> logging.Logger:
    """
    Get logger instance with consistent configuration.
    
    In future, this can be extended to use structlog.
    For now, returns standard logger that accepts kwargs.
    """
    return logging.getLogger(name)


def log_event(
    logger: logging.Logger,
    level: str,
    event: str,
    **context: Any
) -> None:
    """
    Log structured event with context.
    
    Args:
        logger: Logger instance
        level: Log level (info, error, warning, debug)
        event: Event name (snake_case, e.g., 'video_queued')
        **context: Additional context fields (user_id, video_id, etc.)
    
    Example:
        log_event(
            logger, 'info', 'video_queued',
            video_id=str(video.id),
            user_id=str(user.id)
        )
    """
    log_fn = getattr(logger, level.lower())
    # Format: "event_name key1=value1 key2=value2"
    context_str = " ".join(f"{k}={v}" for k, v in context.items())
    log_fn(f"{event} {context_str}")
```

**Rationale:** Start with simple implementation compatible with standard `logging` module. Can migrate to `structlog` later without changing call sites.

#### Step 1.2: Document Event Naming Convention

**File:** `backend/app/core/logging.py` (docstring)

Add convention guide:

```python
"""
Event Naming Convention
=======================

Format: {subject}_{action}_{status}
- subject: Resource/component (video, websocket, job, cache)
- action: Operation (queue, process, connect, fetch)
- status: Outcome (started, completed, failed) - optional

Examples:
✅ video_queued
✅ websocket_connected
✅ websocket_disconnected
✅ video_processing_failed
✅ cache_hit
✅ job_progress_updated
✅ youtube_metadata_fetched

Context Fields:
- Always include primary resource ID (video_id, user_id, job_id)
- For errors: error, error_type, error_context
- For timing: duration_ms (if relevant)
- For batches: count, total (if relevant)
"""
```

### Phase 2: High-Priority API Endpoints (60 mins)

#### Step 2.1: Migrate `app/api/websocket.py` (9 occurrences)

**Current Patterns:**

| Line | Current | Event Name | Context |
|------|---------|------------|---------|
| 47 | `f"WebSocket connected for user {user.id}"` | `websocket_connected` | `user_id` |
| 56 | `f"Subscribed to Redis channel: {channel}"` | `redis_channel_subscribed` | `channel`, `user_id` |
| 67 | `f"Failed to parse progress message: {e}"` | `websocket_message_parse_failed` | `error`, `error_type` |
| 71 | `f"WebSocket disconnected while sending..."` | `websocket_send_interrupted` | `user_id` |
| 75 | `f"Error forwarding message: {e}"` | `websocket_forward_failed` | `error`, `error_type`, `user_id` |
| 79 | `f"WebSocket disconnected for user {user.id}"` | `websocket_disconnected` | `user_id` |
| 81 | `f"WebSocket error for user {user.id}: {e}"` | `websocket_error` | `user_id`, `error`, `error_type` |
| 87 | `f"Cleaned up WebSocket for user {user.id}"` | `websocket_cleanup_completed` | `user_id` |
| 89 | `f"Error during WebSocket cleanup: {e}"` | `websocket_cleanup_failed` | `error`, `error_type` |

**Migration Pattern:**

```python
# BEFORE:
logger.info(f"WebSocket connected for user {user.id}")

# AFTER:
logger.info(
    "websocket_connected",
    user_id=str(user.id)
)

# BEFORE (error):
logger.error(f"Error forwarding message: {e}")

# AFTER (error):
logger.error(
    "websocket_forward_failed",
    error=str(e),
    error_type=type(e).__name__,
    user_id=str(user.id) if user else None
)
```

#### Step 2.2: Migrate `app/api/processing.py` (2 occurrences)

| Line | Current | Event Name | Context |
|------|---------|------------|---------|
| 96 | `f"Enqueued {len(pending_videos)} videos..."` | `videos_enqueued` | `job_id`, `video_count`, `list_id` |
| 99 | `f"Failed to enqueue jobs for list {list_id}: {e}"` | `video_enqueue_failed` | `list_id`, `error`, `error_type` |

**Migration Pattern:**

```python
# BEFORE:
logger.info(f"Enqueued {len(pending_videos)} videos for processing (job {job.id})")

# AFTER:
logger.info(
    "videos_enqueued",
    job_id=str(job.id),
    video_count=len(pending_videos),
    list_id=str(list_id)
)
```

#### Step 2.3: Migrate `app/api/videos.py` (3 occurrences)

| Line | Current | Event Name | Context |
|------|---------|------------|---------|
| 69 | `f"Invalid duration format '{iso_duration}': {e}"` | `duration_parse_failed` | `duration_input`, `error` |
| 80 | `f"Invalid timestamp format '{timestamp}': {e}"` | `timestamp_parse_failed` | `timestamp_input`, `error` |
| 270 | `f"Failed to fetch YouTube metadata for {youtube_id}: {e}"` | `youtube_metadata_fetch_failed` | `youtube_id`, `error`, `error_type` |

**Migration Pattern:**

```python
# BEFORE:
logger.debug(f"Invalid duration format '{iso_duration}': {e}")

# AFTER:
logger.debug(
    "duration_parse_failed",
    duration_input=iso_duration,
    error=str(e)
)
```

### Phase 3: Core Worker Migration (45 mins)

#### Step 3.1: Migrate `app/workers/video_processor.py` (10 occurrences)

**Priority Events:**

| Line | Event Name | Context |
|------|------------|---------|
| 72 | `video_not_found` | `video_id` |
| 77 | `video_already_processed` | `video_id` |
| 118 | `websocket_publish_skipped` | `video_id`, `reason="missing_user_id"` |
| 133 | `video_processing_failed` | `video_id`, `error`, `error_type` |
| 171 | `video_list_processing_started` | `job_id`, `video_count` |
| 239 | `websocket_update_published` | `video_id`, `channel` |
| 262 | `parent_job_not_found` | `job_id` |
| 286 | `job_progress_update_failed` | `job_id`, `error`, `error_type` |

**Key Example:**

```python
# BEFORE:
logger.info(f"Processing video list job {job_id} with {len(video_ids)} videos")

# AFTER:
logger.info(
    "video_list_processing_started",
    job_id=str(job_id),
    video_count=len(video_ids)
)
```

#### Step 3.2: Migrate `app/workers/settings.py` (4 occurrences)

| Line | Event Name | Context |
|------|------------|---------|
| 34 | `arq_job_started` | `job_id` |
| 57 | `arq_job_committed` | `job_id` |
| 60 | `arq_job_rolled_back` | `job_id` |
| 63 | `arq_after_job_error` | `job_id`, `error`, `error_type` |

### Phase 4: Client Layer (30 mins)

#### Step 4.1: Migrate `app/clients/youtube.py` (6 occurrences)

**Cache Events:**

| Line | Event Name | Context |
|------|------------|---------|
| 83 | `cache_hit` | `resource="video_metadata"`, `video_id` |
| 85 | `cache_miss` | `resource="video_metadata"`, `video_id` |
| 173 | `cache_hit` | `resource="transcript"`, `video_id` |
| 175 | `cache_miss` | `resource="transcript"`, `video_id` |
| 259 | `cache_hit` | `resource="video_batch"`, `video_id` |
| 336 | `youtube_api_batch_failed` | `error`, `error_type` |

**Migration Pattern:**

```python
# BEFORE:
logger.debug(f"Cache HIT for video metadata: {video_id}")

# AFTER:
logger.debug(
    "cache_hit",
    resource="video_metadata",
    video_id=video_id
)
```

### Phase 5: Add Baseline Logging (30 mins)

#### Step 5.1: Add Logging to `app/api/lists.py`

Add structured logs for:
- `list_created` (POST /lists)
- `list_fetched` (GET /lists/{id})
- `list_updated` (PUT /lists/{id})
- `list_deleted` (DELETE /lists/{id})

**Example:**

```python
from app.core.logging import get_logger

logger = get_logger(__name__)

@router.post("/", response_model=ListResponse)
async def create_list(list_data: ListCreate, db: AsyncSession = Depends(get_db)):
    new_list = BookmarkList(**list_data.dict())
    db.add(new_list)
    await db.commit()
    await db.refresh(new_list)
    
    logger.info(
        "list_created",
        list_id=str(new_list.id),
        list_name=new_list.name
    )
    
    return new_list
```

#### Step 5.2: Add Logging to `app/api/tags.py`

Add structured logs for:
- `tag_created`
- `tag_assigned_to_video`
- `tag_removed_from_video`
- `tags_bulk_assigned`

### Phase 6: Testing & Validation (30 mins)

#### Step 6.1: Smoke Test Script

**File:** `backend/tests/manual/test_structured_logging.py`

```python
"""Manual smoke test for structured logging.

Run with: python -m backend.tests.manual.test_structured_logging
"""
import logging
from app.core.logging import get_logger

logging.basicConfig(level=logging.DEBUG)

logger = get_logger("smoke_test")

# Test all log levels
logger.info(
    "test_event_info",
    user_id="test-user-123",
    action="login"
)

logger.error(
    "test_event_error",
    error="Connection timeout",
    error_type="TimeoutError",
    retries=3
)

logger.warning(
    "test_event_warning",
    resource="cache",
    status="degraded"
)

logger.debug(
    "test_event_debug",
    cache_hit=True,
    latency_ms=15
)

print("\n✅ All structured log events emitted. Check console output above.")
```

#### Step 6.2: Integration Test

**File:** `backend/tests/integration/test_structured_logging_integration.py`

```python
"""Integration test for structured logging in API endpoints."""
import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_websocket_logs_structured_events(
    client: AsyncClient,
    caplog
):
    """Verify WebSocket endpoints emit structured logs."""
    with caplog.at_level("INFO"):
        # Connect to WebSocket (will fail auth, but should log connection attempt)
        async with client.websocket_connect("/api/ws/progress") as ws:
            pass
    
    # Check for structured log format
    assert any(
        "websocket_connected" in record.message
        for record in caplog.records
    )


@pytest.mark.asyncio
async def test_video_processing_logs_structured_events(
    client: AsyncClient,
    db_session,
    caplog
):
    """Verify video processing emits structured logs."""
    with caplog.at_level("INFO"):
        response = await client.post(
            "/api/lists/1/videos",
            json={"youtube_id": "dQw4w9WgXcQ"}
        )
    
    assert response.status_code == 200
    
    # Check for structured log format
    assert any(
        "video_queued" in record.message and "video_id=" in record.message
        for record in caplog.records
    )
```

#### Step 6.3: Validation Checklist

**Manual Review:**

1. **Event Naming Consistency:**
   - [ ] All events use snake_case
   - [ ] Events follow {subject}_{action}_{status} pattern
   - [ ] No duplicate event names with different meanings

2. **Context Fields:**
   - [ ] All events include primary resource ID
   - [ ] Error events include `error`, `error_type`
   - [ ] UUIDs converted to strings
   - [ ] No sensitive data in logs (passwords, tokens)

3. **Log Levels:**
   - [ ] `INFO`: Business events (video_queued, user_login)
   - [ ] `ERROR`: Failures requiring attention (api_call_failed)
   - [ ] `WARNING`: Degraded state (cache_miss, retry_attempted)
   - [ ] `DEBUG`: Development info (cache_hit, query_executed)

**Automated Check:**

```bash
# Verify no f-string logs remain
cd backend
grep -r "logger\.(info|error|warning|debug)(f[\"']" app/

# Should return: no matches
```

## Design Decisions

### Decision 1: Simple Structured Format vs. structlog

**Chosen:** Start with simple structured format

**Rationale:**
- Minimal code change (compatible with existing `logging.getLogger`)
- No new dependencies
- Easy to migrate to `structlog` later without changing call sites
- Structured format still parseable: `event_name key1=value1 key2=value2`

**Future Migration Path:**
```python
# Phase 1 (now): Simple structured format
logger.info("video_queued", video_id=id, user_id=uid)
# Output: "video_queued video_id=123 user_id=456"

# Phase 2 (later): Migrate to structlog
import structlog
logger = structlog.get_logger()
logger.info("video_queued", video_id=id, user_id=uid)
# Output: {"event": "video_queued", "video_id": "123", "user_id": "456", "timestamp": "..."}
```

### Decision 2: Event Naming Convention

**Chosen:** `{subject}_{action}_{status}` pattern

**Examples:**
- ✅ `video_queued` (subject=video, action=queued)
- ✅ `websocket_connected` (subject=websocket, action=connected)
- ✅ `video_processing_failed` (subject=video, action=processing, status=failed)
- ❌ `queue_video` (verb-first, harder to group)
- ❌ `VideoQueued` (PascalCase, inconsistent)

**Rationale:**
- Groups related events together (all `video_*` events)
- Easy to search and filter logs
- Consistent with Python naming conventions

### Decision 3: UUID String Conversion

**Chosen:** Always convert UUIDs to strings in log context

**Pattern:**
```python
logger.info(
    "video_queued",
    video_id=str(video.id),  # ✅ Convert to string
    user_id=str(user.id)     # ✅ Convert to string
)
```

**Rationale:**
- Structured log parsers expect string values
- Prevents serialization errors with JSON log formatters
- Consistent format across all logs

### Decision 4: Error Context Fields

**Chosen:** Standardized error fields

**Required Fields:**
- `error`: Human-readable error message (str(e))
- `error_type`: Exception class name (type(e).__name__)

**Optional Fields:**
- `error_context`: Additional context (e.g., `resource_type`, `operation`)
- `retry_count`: For retry scenarios
- `user_id`: If error is user-specific

**Example:**
```python
try:
    await fetch_youtube_metadata(video_id)
except Exception as e:
    logger.error(
        "youtube_metadata_fetch_failed",
        video_id=video_id,
        error=str(e),
        error_type=type(e).__name__,
        retry_count=retry_attempt
    )
```

## Testing Strategy

### Unit Tests

**Not required** - Structured logging is a formatting change, not business logic.

### Integration Tests

**File:** `backend/tests/integration/test_structured_logging_integration.py`

Test that:
1. API endpoints emit structured logs
2. WebSocket connections log structured events
3. Worker tasks log processing events
4. Error scenarios include proper context

### Manual Smoke Tests

**File:** `backend/tests/manual/test_structured_logging.py`

Run script and verify console output shows structured format.

### Production Validation

**After deployment:**

1. **Check Log Aggregator:** Verify structured logs are parseable
2. **Search by Event:** Test queries like `event:video_queued`
3. **Filter by Context:** Test queries like `user_id:123 AND event:websocket_connected`
4. **Error Monitoring:** Verify errors include `error_type` field

## Rollout Plan

### Phase 1: Foundation (Deploy Day 1)
- Create `app/core/logging.py` module
- Deploy without changes to existing logs (no risk)

### Phase 2: High-Priority APIs (Deploy Day 2)
- Migrate `websocket.py`, `processing.py`, `videos.py`
- Deploy and verify WebSocket logs work
- Monitor for errors

### Phase 3: Workers (Deploy Day 3)
- Migrate `video_processor.py`, `settings.py`
- Deploy and verify job processing logs work

### Phase 4: Clients (Deploy Day 4)
- Migrate `youtube.py`
- Add baseline logging to `lists.py`, `tags.py`

## Migration Checklist

### Pre-Migration
- [ ] Create `app/core/logging.py` module
- [ ] Document event naming convention
- [ ] Create smoke test script

### Per-File Migration
- [ ] Replace `logger = logging.getLogger(__name__)` with `from app.core.logging import get_logger; logger = get_logger(__name__)`
- [ ] Find all f-string logs: `grep "logger\.(info|error|warning|debug)(f[\"']" filename.py`
- [ ] For each log:
  - [ ] Choose event name (snake_case)
  - [ ] Extract variables from f-string
  - [ ] Add to context dict
  - [ ] Convert UUIDs to strings
  - [ ] Add error context for error logs
- [ ] Run tests: `pytest tests/ -v`
- [ ] Manual smoke test: verify logs appear in console

### Post-Migration
- [ ] Verify no f-string logs remain: `grep -r "logger\.(info|error|warning)(f[\"']" app/`
- [ ] Run full test suite: `pytest`
- [ ] Deploy to staging
- [ ] Verify structured logs in log aggregator
- [ ] Deploy to production

## Success Metrics

### Code Quality
- **Target:** 0 f-string log statements in `app/api/` and `app/workers/`
- **Measurement:** `grep -r "logger\.(info|error|warning)(f[\"']" app/ | wc -l`

### Log Parsing
- **Target:** 100% of logs parseable by structured log parser
- **Measurement:** Run logs through JSON parser, verify 0 parse errors

### Development Experience
- **Target:** Developers can filter logs by event name
- **Measurement:** Test queries in log aggregator (e.g., `event:video_queued`)

## Related Tasks

- **Task 136:** Add structlog dependency (P2)
- **Task 137:** Configure JSON log formatter for production (P2)
- **Task 138:** Add request ID tracing (P2)

## References

- Security Hardening Plan: `docs/plans/2025-11-02-security-hardening-implementation.md` (lines 2454-2483)
- Logging Best Practices: https://www.structlog.org/en/stable/why.html
- Python Logging Cookbook: https://docs.python.org/3/howto/logging-cookbook.html

## Notes

- **No Breaking Changes:** This is a logging format change only, no API changes
- **Backward Compatible:** Logs still readable by humans and existing parsers
- **Future-Proof:** Easy migration path to structlog when needed
- **Performance:** No measurable performance impact (logging is I/O bound)

---

**Estimated Time:** 3-4 hours total (across 6 files, 34 log statements)

**Risk Level:** LOW (no business logic changes, easy to rollback)

**Dependencies:** None (can start immediately)
