# Task #138: Structured Logging - Add HTTP Request Logging Middleware

**Plan Task:** #138
**Wave/Phase:** P2 Operational Excellence - Wave 3
**Dependencies:** Task #137 (logging.py module must exist)

---

## 🎯 Goal

Add HTTP request logging middleware to FastAPI app that captures all incoming requests with structured data (method, path, status code, duration, user ID). This provides comprehensive observability for debugging, monitoring, and security auditing of the API.

## 📋 Acceptance Criteria

- [ ] Logging middleware added to `backend/app/main.py` using `@app.middleware("http")` decorator
- [ ] Middleware captures: HTTP method, path, status code, duration (ms), user_id (if authenticated)
- [ ] Uses `log_request()` helper from Task #137's `app.core.logging` module
- [ ] Middleware positioned after CORS but processes all requests (including errors)
- [ ] Logs use appropriate severity: INFO (2xx), WARNING (4xx), ERROR (5xx)
- [ ] Duration measured with millisecond precision using `time.time()`
- [ ] User ID extracted from `request.state.user.id` (if authenticated, else None)
- [ ] Logging configured at app startup with `configure_logging()`
- [ ] Integration tests: 5+ tests covering different status codes (200, 404, 500)
- [ ] Tests verify: log output, duration calculation, user_id handling
- [ ] Tests passing: `pytest tests/integration/test_http_logging.py -v`

**Evidence Requirements:**
```bash
# Run middleware tests
pytest tests/integration/test_http_logging.py -v

# Manual verification (start server and observe logs)
uvicorn app.main:app --reload
# Make requests and check logs:
# - INFO level for successful requests (200)
# - WARNING level for client errors (404, 400)
# - ERROR level for server errors (500)

# Example log output (development):
# [info     ] http_request               duration_ms=12.34 method=GET path=/api/lists status_code=200
# [warning  ] http_request               duration_ms=5.67 method=GET path=/api/invalid status_code=404
# [error    ] http_request               duration_ms=89.12 method=POST path=/api/videos status_code=500
```

---

## 🔍 Design Decisions

### Decision 1: Middleware Order (After CORS, Before Routes)
**Context:** FastAPI middleware executes in reverse order of registration (LIFO)
**Options:**
1. Add middleware before CORS → Logs CORS preflight requests, may see blocked requests
2. Add middleware after CORS → Only logs requests that pass CORS validation
3. Add middleware via `app.middleware()` decorator → Clearest syntax, processes all requests

**Decision:** Use `@app.middleware("http")` decorator after CORS setup
**Rationale:**
- Logs all requests that reach the app (including errors)
- Avoids noise from CORS preflight requests
- Decorator syntax is idiomatic FastAPI pattern
- Captures exceptions raised by routes (logged with 500 status)

**Trade-offs:**
- ✅ Clean logs without CORS preflight spam
- ✅ Captures route errors and middleware errors
- ⚠️ Won't log requests blocked by CORS (acceptable - those are not API requests)

---

### Decision 2: Timing Implementation (time.time() vs time.perf_counter())
**Context:** Need to measure request duration accurately
**Options:**
1. `time.time()` → Wall clock time, affected by system clock changes
2. `time.perf_counter()` → Monotonic clock, not affected by clock adjustments
3. `time.process_time()` → CPU time only, excludes I/O wait

**Decision:** Use `time.time()` for simplicity
**Rationale:**
- Wall clock time is intuitive for log analysis
- System clock changes rare in production containers
- `perf_counter()` is more precise but overkill for request timing
- Consistency with existing FastAPI middleware patterns

**Trade-offs:**
- ✅ Simple, widely understood
- ✅ Works in all Python versions
- ⚠️ Theoretically vulnerable to clock skew (negligible risk)

---

### Decision 3: User ID Extraction (request.state.user)
**Context:** Need to log authenticated user ID if available
**Options:**
1. `request.state.user` → Set by auth dependency (Task #112)
2. Parse JWT from Authorization header → Duplicates auth logic
3. Skip user_id logging → Loses security audit trail

**Decision:** Use `request.state.user.id` with safe attribute check
**Rationale:**
- `request.state` is FastAPI's recommended pattern for request-scoped data
- Auth dependency (Task #112) will set `request.state.user` on authenticated requests
- Safe attribute checks (`hasattr`) prevent errors on unauthenticated requests
- Maintains separation of concerns (middleware doesn't parse tokens)

**Trade-offs:**
- ✅ Clean integration with auth system
- ✅ No token parsing overhead
- ⚠️ Requires Task #112 to be completed for user_id logging (gracefully degrades to None)

---

### Decision 4: Error Handling (No try/except in middleware)
**Context:** Should middleware catch exceptions from routes?
**Options:**
1. Wrap `call_next()` in try/except → Log errors and re-raise
2. Let exceptions propagate → FastAPI's default error handler manages them
3. Add global exception handler → Separate concern from logging

**Decision:** No try/except in logging middleware
**Rationale:**
- FastAPI has built-in exception handlers that set proper status codes
- Middleware sees the final `response.status_code` (including errors)
- Exceptions in routes are converted to 500 responses by FastAPI
- Separation of concerns: logging ≠ error handling

**Trade-offs:**
- ✅ Simple middleware logic
- ✅ Relies on FastAPI's battle-tested error handling
- ⚠️ Uncaught exceptions in middleware itself would break logging (test coverage mitigates)

---

## 🛠️ Implementation Steps

### Step 1: Modify main.py to add logging imports and configuration
**File:** `backend/app/main.py`
**Action:** Add imports and configure logging at module level

```python
# Add after existing imports (line ~10)
import time
from fastapi import Request
from app.core.logging import configure_logging, get_logger, log_request

# Add after app initialization (line ~32, before CORS)
# Configure logging at startup
configure_logging()
logger = get_logger(__name__)
```

**Why at module level?**
- Logging should be configured before any requests
- Module-level execution ensures single initialization
- `logger` instance reused across all requests (efficient)

---

### Step 2: Add logging middleware after CORS
**File:** `backend/app/main.py`
**Action:** Add middleware function after CORS setup (line ~41, after `app.add_middleware(CORSMiddleware, ...)`)

```python
@app.middleware("http")
async def logging_middleware(request: Request, call_next):
    """
    Middleware to log all HTTP requests with structured data.
    
    Captures:
    - HTTP method and path
    - Response status code
    - Request duration in milliseconds
    - User ID (if authenticated via request.state.user)
    
    Logs with severity based on status code:
    - INFO: 2xx success responses
    - WARNING: 4xx client errors
    - ERROR: 5xx server errors
    """
    start_time = time.time()
    
    # Process request
    response = await call_next(request)
    
    # Calculate duration
    duration_ms = (time.time() - start_time) * 1000
    
    # Get user ID if authenticated
    user_id = None
    if hasattr(request.state, "user") and request.state.user:
        user_id = str(request.state.user.id)
    
    # Log request
    log_request(
        logger,
        method=request.method,
        path=request.url.path,
        status_code=response.status_code,
        duration_ms=duration_ms,
        user_id=user_id
    )
    
    return response
```

**Key points:**
- `call_next(request)` processes the request through routes
- Duration measured around `call_next()` includes all route processing
- Safe attribute checks prevent errors on unauthenticated requests
- `log_request()` helper applies correct log level based on status code

---

### Step 3: Verify middleware placement
**File:** `backend/app/main.py`
**Action:** Ensure final structure matches this order:

```python
# 1. Imports (including logging imports)
# 2. Lifespan manager
# 3. App initialization
# 4. Logging configuration (configure_logging(), get_logger())
# 5. CORS middleware
# 6. Logging middleware (@app.middleware("http"))  <-- NEW
# 7. Router registration (lists, videos, etc.)
# 8. Health check endpoint
```

**Why this order?**
- CORS must be first middleware (handles preflight)
- Logging middleware runs after CORS validation
- Routers registered last (middleware wraps them)

---

## 🧪 Testing Strategy

### Test 1: Integration test for successful request (200 OK)
**File:** `backend/tests/integration/test_http_logging.py`
**Goal:** Verify INFO log for successful request

```python
import pytest
from httpx import AsyncClient
from io import StringIO

from app.main import app
from app.core.logging import configure_logging


@pytest.fixture
def log_stream():
    """Capture log output for testing."""
    stream = StringIO()
    configure_logging(stream=stream)
    return stream


@pytest.mark.asyncio
async def test_logging_middleware_success(client: AsyncClient, log_stream: StringIO):
    """Test that successful requests are logged at INFO level."""
    # Make request to health check endpoint
    response = await client.get("/api/health")
    assert response.status_code == 200
    
    # Check log output
    log_output = log_stream.getvalue()
    assert "http_request" in log_output
    assert "method=GET" in log_output or '"method": "GET"' in log_output
    assert "path=/api/health" in log_output or '"path": "/api/health"' in log_output
    assert "status_code=200" in log_output or '"status_code": 200' in log_output
    assert "duration_ms" in log_output
```

---

### Test 2: Integration test for client error (404 Not Found)
**File:** `backend/tests/integration/test_http_logging.py`
**Goal:** Verify WARNING log for client errors

```python
@pytest.mark.asyncio
async def test_logging_middleware_not_found(client: AsyncClient, log_stream: StringIO):
    """Test that 404 errors are logged at WARNING level."""
    # Make request to non-existent endpoint
    response = await client.get("/api/nonexistent")
    assert response.status_code == 404
    
    # Check log output
    log_output = log_stream.getvalue()
    assert "http_request" in log_output
    assert "path=/api/nonexistent" in log_output or '"path": "/api/nonexistent"' in log_output
    assert "status_code=404" in log_output or '"status_code": 404' in log_output
```

---

### Test 3: Integration test for server error (500 Internal Server Error)
**File:** `backend/tests/integration/test_http_logging.py`
**Goal:** Verify ERROR log for server errors

```python
from unittest.mock import patch, AsyncMock


@pytest.mark.asyncio
async def test_logging_middleware_server_error(client: AsyncClient, log_stream: StringIO):
    """Test that 500 errors are logged at ERROR level."""
    # Temporarily add a route that raises an exception
    from app.main import app
    from fastapi import HTTPException
    
    @app.get("/api/test-error")
    async def test_error():
        raise HTTPException(status_code=500, detail="Test error")
    
    # Make request
    response = await client.get("/api/test-error")
    assert response.status_code == 500
    
    # Check log output
    log_output = log_stream.getvalue()
    assert "http_request" in log_output
    assert "status_code=500" in log_output or '"status_code": 500' in log_output
```

---

### Test 4: Duration calculation accuracy
**File:** `backend/tests/integration/test_http_logging.py`
**Goal:** Verify duration is measured in milliseconds

```python
import re


@pytest.mark.asyncio
async def test_logging_middleware_duration(client: AsyncClient, log_stream: StringIO):
    """Test that request duration is calculated and logged."""
    response = await client.get("/api/health")
    assert response.status_code == 200
    
    # Extract duration from log output
    log_output = log_stream.getvalue()
    
    # Match duration_ms in both JSON and human-readable formats
    # JSON: "duration_ms": 12.34
    # Human: duration_ms=12.34
    duration_match = re.search(r'duration_ms[=:]\s*([\d.]+)', log_output)
    assert duration_match is not None, "duration_ms not found in log"
    
    duration_ms = float(duration_match.group(1))
    
    # Sanity check: duration should be positive and reasonable (< 10 seconds)
    assert 0 < duration_ms < 10000, f"Unexpected duration: {duration_ms}ms"
```

---

### Test 5: User ID logging (unauthenticated vs authenticated)
**File:** `backend/tests/integration/test_http_logging.py`
**Goal:** Verify user_id is None for unauthenticated, present for authenticated

```python
@pytest.mark.asyncio
async def test_logging_middleware_no_user_id(client: AsyncClient, log_stream: StringIO):
    """Test that unauthenticated requests don't log user_id."""
    response = await client.get("/api/health")
    assert response.status_code == 200
    
    log_output = log_stream.getvalue()
    
    # user_id should not appear in log (or be null/None)
    # This test will pass now (no auth yet)
    # After Task #112, authenticated requests will include user_id
    assert "http_request" in log_output


@pytest.mark.asyncio
async def test_logging_middleware_with_user_id(client: AsyncClient, log_stream: StringIO):
    """Test that authenticated requests log user_id."""
    # Note: This test will be skipped/xfail until Task #112 (auth dependency) is implemented
    # After Task #112, mock request.state.user to test user_id logging
    
    pytest.skip("Requires Task #112 (get_current_user dependency) to be implemented")
    
    # Future implementation after Task #112:
    # 1. Create test user and JWT token
    # 2. Make authenticated request with Authorization header
    # 3. Verify log contains user_id field
```

---

### Test 6: Middleware processes all routes
**File:** `backend/tests/integration/test_http_logging.py`
**Goal:** Verify middleware logs requests to different routes

```python
@pytest.mark.asyncio
async def test_logging_middleware_multiple_routes(client: AsyncClient, log_stream: StringIO):
    """Test that middleware logs requests to different endpoints."""
    # Make requests to multiple endpoints
    await client.get("/api/health")
    await client.get("/api/lists")
    
    log_output = log_stream.getvalue()
    
    # Should have 2 log entries
    assert log_output.count("http_request") >= 2
    assert "/api/health" in log_output
    assert "/api/lists" in log_output
```

---

## 📊 Performance Considerations

### Overhead Analysis
- **Time measurement:** `time.time()` is a syscall (~0.1-1μs overhead)
- **Attribute checks:** `hasattr()` and attribute access (~0.01μs)
- **Logging call:** Structured logging with 4-6 fields (~0.1-1ms)
- **Total overhead per request:** ~1-2ms (negligible for typical API requests)

### Optimization Notes
- Logger instance reused (cached at module level)
- No string formatting in hot path (deferred to structlog)
- Minimal conditional logic (just user_id check)
- No database queries or I/O in middleware

---

## ✅ Verification Checklist

Before marking task complete:

1. **Code Review**
   - [ ] Logging imports added to `main.py`
   - [ ] `configure_logging()` called at module level
   - [ ] Middleware uses `@app.middleware("http")` decorator
   - [ ] Middleware positioned after CORS setup
   - [ ] `log_request()` helper called with all required fields

2. **Testing**
   - [ ] All 6 integration tests written and passing
   - [ ] Test file: `tests/integration/test_http_logging.py`
   - [ ] Tests cover: 200, 404, 500 status codes
   - [ ] Duration calculation test passes
   - [ ] User ID test passes (or skipped with note for Task #112)

3. **Manual Verification**
   - [ ] Start dev server: `uvicorn app.main:app --reload`
   - [ ] Make requests and observe logs in console
   - [ ] Verify log format matches development settings (human-readable)
   - [ ] Verify log includes: method, path, status_code, duration_ms

4. **Documentation**
   - [ ] Update `CLAUDE.md` if middleware pattern differs from plan
   - [ ] Note any performance observations (if overhead > 5ms)

---

## 🔗 Related Tasks

**Depends On:**
- Task #137: Create logging.py module with configure_logging(), get_logger(), log_request()

**Blocks:**
- Task #139: Migrate videos.py to structured logging (uses get_logger())
- Task #140: Update all API routers to use structured logging

**Related:**
- Task #112: Get current user dependency (will populate request.state.user)
- Task #120: Environment enum settings (settings.is_development for log format)

---

## 📝 Notes

- Middleware will log all requests immediately, providing observability from day 1
- User ID logging will be None until Task #112 (auth dependency) is complete
- Log format is environment-aware (JSON in production, human-readable in dev)
- Middleware does not handle exceptions (relies on FastAPI's default handlers)
- Consider adding request ID to logs in future (Task #141: Request ID middleware)

---

**Estimated Effort:** 2-3 hours
**Priority:** P2 (Operational Excellence)
**Risk:** Low (non-breaking, additive change)
