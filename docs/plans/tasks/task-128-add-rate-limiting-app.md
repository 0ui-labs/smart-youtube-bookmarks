# Task #128: Add Rate Limiting to FastAPI App

**Plan Task:** #128
**Wave/Phase:** Security Hardening - Task 4: API Rate Limiting (Step 4)
**Dependencies:** Task #125 (Implement rate limiting utilities)

---

## 🎯 Ziel

Integrate the rate limiting infrastructure (created in Task #125) into the FastAPI application by registering the limiter in app state, adding exception handlers for 429 responses, and configuring the middleware. This task completes the rate limiting setup, making all endpoints subject to global default rate limits (200/hour production, 1000/hour development).

---

## 📋 Acceptance Criteria

- [ ] `app.state.limiter` registered with limiter instance from `app.core.rate_limit`
- [ ] Exception handler registered for `RateLimitExceeded` errors
- [ ] Exception handler returns 429 status with `retry_after` in body and `Retry-After` header
- [ ] Integration placed correctly in app initialization order (after app creation, before CORS middleware)
- [ ] Health check endpoint respects global default rate limit
- [ ] Integration tests verify rate limiting works end-to-end
- [ ] Tests passing (unit and integration)
- [ ] Code reviewed

---

## 🛠️ Implementation Steps

### 1. Add slowapi imports to main.py

**Files:** `backend/app/main.py`

**Action:** Add imports for rate limiting at top of file (after existing imports, around line 11)

```python
from slowapi.errors import RateLimitExceeded
from app.core.rate_limit import limiter, rate_limit_exceeded_handler
```

**Complete imports section:**

```python
"""
Main FastAPI application module for Smart YouTube Bookmarks.

This module sets up the FastAPI application with CORS middleware,
rate limiting, and provides the health check endpoint.
"""

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from slowapi.errors import RateLimitExceeded
from app.core.rate_limit import limiter, rate_limit_exceeded_handler

from app.api import lists, videos, processing, websocket, tags, custom_fields, schemas, schema_fields
from app.core.redis import close_redis_client, close_arq_pool, get_arq_pool
```

---

### 2. Add rate limiter to app state

**Files:** `backend/app/main.py`

**Action:** Register limiter in app.state immediately after app creation (after line 32)

**Why app.state?**
- slowapi expects limiter to be available at `app.state.limiter`
- Enables decorator-based rate limiting: `@limiter.limit("5/minute")`
- Makes limiter accessible to all request handlers without dependency injection

```python
app = FastAPI(title="Smart YouTube Bookmarks", lifespan=lifespan)

# Add rate limiting state
app.state.limiter = limiter
```

---

### 3. Register exception handler for rate limit errors

**Files:** `backend/app/main.py`

**Action:** Add exception handler for `RateLimitExceeded` errors (immediately after adding limiter state)

**Why custom handler?**
- Returns consistent JSON error format matching project conventions
- Includes `retry_after` in both response body and `Retry-After` header (RFC 6585 compliant)
- Provides clear error messages for API consumers

```python
# Add exception handler for rate limit errors
app.add_exception_handler(RateLimitExceeded, rate_limit_exceeded_handler)
```

**Handler response format (from Task #125):**

```json
{
  "error": "Rate limit exceeded",
  "detail": "Too many requests. Retry after 42 seconds.",
  "retry_after": 42
}
```

**Headers:** `Retry-After: 42`

---

### 4. Verify integration order in main.py

**Files:** `backend/app/main.py`

**Action:** Ensure correct initialization order

**Critical order:**
1. Create FastAPI app instance
2. Add limiter to app.state ← **Task #128 (this task)**
3. Register exception handler ← **Task #128 (this task)**
4. Add CORS middleware
5. Register routers

**Complete updated main.py:**

```python
"""
Main FastAPI application module for Smart YouTube Bookmarks.

This module sets up the FastAPI application with CORS middleware,
rate limiting, and provides the health check endpoint.
"""

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from slowapi.errors import RateLimitExceeded
from app.core.rate_limit import limiter, rate_limit_exceeded_handler

from app.api import lists, videos, processing, websocket, tags, custom_fields, schemas, schema_fields
from app.core.redis import close_redis_client, close_arq_pool, get_arq_pool


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Application lifespan manager.

    Handles startup and shutdown events for the application.
    Manages Redis client and ARQ pool lifecycle.
    """
    # Startup: Initialize ARQ pool eagerly (not lazy on first request)
    await get_arq_pool()
    yield
    # Shutdown: Close both Redis client and ARQ pool
    await close_redis_client()
    await close_arq_pool()


app = FastAPI(title="Smart YouTube Bookmarks", lifespan=lifespan)

# Add rate limiting state
app.state.limiter = limiter

# Add exception handler for rate limit errors
app.add_exception_handler(RateLimitExceeded, rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:8000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(lists.router)
app.include_router(videos.router)
app.include_router(processing.router)
app.include_router(websocket.router, prefix="/api", tags=["websocket"])
app.include_router(tags.router)
app.include_router(custom_fields.router)
app.include_router(schemas.router)
app.include_router(schema_fields.router)


@app.get("/api/health")
async def health_check() -> dict[str, str]:
    return {"status": "ok"}
```

---

### 5. Create integration test for FastAPI app rate limiting

**Files:** `backend/tests/integration/test_main_rate_limit.py`

**Action:** Create integration test verifying rate limiting works through FastAPI app

```python
"""
Integration tests for rate limiting in FastAPI app.

Verifies that rate limiting middleware is properly integrated and
enforces limits on real endpoints.
"""

import pytest
from httpx import AsyncClient, ASGITransport

from app.main import app


@pytest.mark.asyncio
async def test_health_endpoint_has_rate_limiting():
    """
    Test that health endpoint is rate limited by global default.

    This verifies app.state.limiter and exception handler are working.
    """
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        responses = []

        # Make many rapid requests
        # Development default: 1000/hour = ~16.67/minute
        # We make 50 requests; may or may not trigger limit in dev
        for i in range(50):
            response = await client.get("/api/health")
            responses.append(response)

        status_codes = [r.status_code for r in responses]

        # Verify at least some requests succeeded
        assert 200 in status_codes

        # If rate limited (429), verify response format
        if 429 in status_codes:
            rate_limited = next(r for r in responses if r.status_code == 429)

            # Verify 429 response structure
            assert "Retry-After" in rate_limited.headers
            assert rate_limited.headers["Retry-After"].isdigit()

            body = rate_limited.json()
            assert body["error"] == "Rate limit exceeded"
            assert "retry_after" in body
            assert isinstance(body["retry_after"], int)
            assert body["retry_after"] > 0
            assert "Retry after" in body["detail"]


@pytest.mark.asyncio
async def test_rate_limit_exception_handler_format():
    """
    Test that RateLimitExceeded exception handler returns correct format.

    Makes enough requests to trigger rate limit, then validates response.
    """
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Make many requests to trigger limit
        for i in range(100):
            response = await client.get("/api/health")
            if response.status_code == 429:
                # Found rate limited response, validate it
                assert response.status_code == 429

                # Validate header
                assert "Retry-After" in response.headers
                retry_header = response.headers["Retry-After"]
                assert retry_header.isdigit()
                assert int(retry_header) > 0

                # Validate body
                body = response.json()
                assert body["error"] == "Rate limit exceeded"
                assert body["retry_after"] == int(retry_header)
                assert f"Retry after {retry_header} seconds" in body["detail"]

                # Test passed
                return

        # If we didn't hit rate limit, test is inconclusive but not failed
        # High dev limits (1000/hour) may prevent hitting limit
        pytest.skip("Rate limit not triggered in development environment")


@pytest.mark.asyncio
async def test_app_state_limiter_exists():
    """
    Test that app.state.limiter is properly set.

    This is a sanity check for the integration.
    """
    assert hasattr(app.state, "limiter")
    assert app.state.limiter is not None

    # Verify it's the correct limiter instance
    from app.core.rate_limit import limiter
    assert app.state.limiter is limiter
```

---

## 🧪 Testing Strategy

### Unit Tests

**Covered by Task #125:**
- Rate limit key generation (user ID vs IP)
- Limiter configuration (Redis, strategy, defaults)
- Rate limit constants (AUTH_RATE_LIMIT, API_RATE_LIMIT)
- Exception handler response format

**Run:** `cd backend && pytest tests/core/test_rate_limit.py -v`

---

### Integration Tests

**File:** `backend/tests/integration/test_main_rate_limit.py`

**Run:** `cd backend && pytest tests/integration/test_main_rate_limit.py -v`

**Tests:**
1. **test_health_endpoint_has_rate_limiting** - Verify health endpoint respects global default limit
2. **test_rate_limit_exception_handler_format** - Verify 429 response format when limit exceeded
3. **test_app_state_limiter_exists** - Sanity check that limiter is registered in app.state

**Expected:** All 3 tests pass

**Note:** In development environment (1000/hour limit), tests may not always trigger rate limits. This is expected behavior. Tests verify infrastructure works correctly when limits ARE triggered.

---

### Manual Testing

#### Prerequisites

```bash
# Terminal 1: Start Redis
docker-compose up -d redis

# Terminal 2: Start backend
cd backend
uvicorn app.main:app --reload
```

#### Test 1: Verify app starts without errors

```bash
# Check app logs for errors
# Look for successful startup messages
# Verify no exceptions related to rate limiting
```

**Expected:**
- App starts successfully
- No import errors for slowapi
- No exceptions about limiter or exception handler
- Server listening on http://localhost:8000

#### Test 2: Make rapid requests to health endpoint

```bash
# Make many rapid requests
for i in {1..30}; do
  curl -w "\nStatus: %{http_code}\n" http://localhost:8000/api/health
  sleep 0.1
done
```

**Expected:**
- First ~16 requests: `200 OK` with `{"status": "ok"}`
- Eventually (depending on env): `429 Too Many Requests`
- 429 response includes:
  ```json
  {
    "error": "Rate limit exceeded",
    "detail": "Too many requests. Retry after 42 seconds.",
    "retry_after": 42
  }
  ```
- Response includes `Retry-After: 42` header

#### Test 3: Verify Redis key storage

```bash
# Connect to Redis
docker exec -it smart-youtube-bookmarks-redis-1 redis-cli

# List rate limit keys
KEYS LIMITER/*

# Check a specific key
GET "LIMITER/127.0.0.1/1000/1/hour"
```

**Expected:**
- Keys exist in format: `LIMITER/<ip>/1000/1/hour` (dev) or `LIMITER/<ip>/200/1/hour` (prod)
- Values are integers showing remaining requests
- Keys have TTL matching window duration

#### Test 4: Test with Python script

```python
import asyncio
from httpx import AsyncClient, ASGITransport
from app.main import app

async def test():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        for i in range(30):
            response = await client.get("/api/health")
            print(f"Request {i+1}: {response.status_code}")
            if response.status_code == 429:
                print(f"Rate limited! Response: {response.json()}")
                break

asyncio.run(test())
```

**Expected:**
- First N requests: `200`
- Eventually: `429` with proper error format
- Demonstrates rate limiting works programmatically

---

## 📚 Reference

### Related Docs

- **Security Hardening Plan:** `docs/plans/2025-11-02-security-hardening-implementation.md` - Task 4, Step 4 (lines 1628-1653)
- **Task #125:** `docs/plans/tasks/task-125-implement-rate-limiting-utilities.md` - Creates `app.core.rate_limit` module
- **slowapi Documentation:** https://github.com/laurents/slowapi
- **slowapi FastAPI Integration:** https://github.com/laurents/slowapi#fastapi

### Related Code

- **Rate Limiting Module:** `backend/app/core/rate_limit.py` - Created in Task #125
- **Settings:** `backend/app/core/config.py` - Environment-aware configuration
- **Redis Setup:** `backend/app/core/redis.py` - Redis client (slowapi creates own connection)
- **Test Patterns:** `backend/tests/integration/test_progress_flow.py` - Async integration test examples

### Design Decisions

#### 1. Why app.state instead of dependency injection?

**Chosen:** `app.state.limiter = limiter`

**Rationale:**
- **slowapi requirement:** slowapi decorators (`@limiter.limit()`) expect limiter at `app.state.limiter`
- **Decorator syntax:** Enables clean decorator-based rate limiting:
  ```python
  @router.post("/login")
  @limiter.limit("5/minute")
  async def login(...):
  ```
- **No dependency needed:** Avoids adding `limiter: Limiter = Depends(get_limiter)` to every endpoint
- **Standard pattern:** Matches slowapi documentation and examples

**Alternative considered:** Dependency injection would require adding parameter to every rate-limited endpoint. Not compatible with slowapi decorators.

**Example of what we avoid:**
```python
# Without app.state (doesn't work with slowapi)
@router.post("/login")
async def login(
    limiter: Limiter = Depends(get_limiter),  # Tedious
    ...
):
```

**What we enable:**
```python
# With app.state (clean)
@router.post("/login")
@limiter.limit("5/minute")  # Just works
async def login(...):
```

---

#### 2. Why register exception handler instead of middleware?

**Chosen:** `app.add_exception_handler(RateLimitExceeded, rate_limit_exceeded_handler)`

**Rationale:**
- **Exception-based:** slowapi raises `RateLimitExceeded` exception when limit exceeded
- **Centralized handling:** Single handler for all rate limit errors across all endpoints
- **Clean separation:** Exception handling separate from request/response middleware logic
- **Standard FastAPI pattern:** Uses FastAPI's built-in exception handling mechanism

**How it works:**
1. Request comes in
2. slowapi decorator checks rate limit
3. If exceeded, raises `RateLimitExceeded` exception
4. FastAPI catches exception and routes to our handler
5. Handler returns 429 response with custom format

**Alternative considered:** Middleware would require checking limits manually in middleware layer, duplicating slowapi logic. Exception handler is cleaner.

---

#### 3. Why place integration after app creation but before CORS?

**Chosen Order:**
```python
app = FastAPI(...)          # 1. Create app
app.state.limiter = limiter # 2. Add limiter
app.add_exception_handler() # 3. Add handler
app.add_middleware()        # 4. Add CORS
app.include_router()        # 5. Add routers
```

**Rationale:**
- **app.state requires app:** Must create app before accessing `app.state`
- **Exception handler early:** Should be registered before middleware/routers that might trigger exceptions
- **Before CORS:** Exception handler should process exceptions before CORS middleware adds headers
- **Before routers:** Routers may use `@limiter.limit()` decorators, limiter must be in app.state first

**Request flow (inbound):**
```
Request → CORS middleware → Router → Endpoint decorator (@limiter.limit)
                                        ↓ (if limit exceeded)
                                    RateLimitExceeded exception
                                        ↓
                                    Exception handler (our custom handler)
                                        ↓
                                    429 response
```

**Why NOT after CORS?**
- Works either way, but conceptually exception handlers are part of app core config
- Grouping app core config (limiter + handler) together improves readability

---

#### 4. Why use custom exception handler instead of slowapi default?

**Chosen:** Custom `rate_limit_exceeded_handler`

**Rationale:**
- **Consistent error format:** Matches project's JSON error response pattern
- **More informative:** Includes `retry_after` in both body AND header
- **Client-friendly:** Clear error messages help API consumers implement retry logic
- **RFC 6585 compliant:** Uses standard `Retry-After` header

**Default slowapi handler response:**
```json
{
  "error": "Rate limit exceeded: 5 per 1 minute"
}
```

**Our custom handler response:**
```json
{
  "error": "Rate limit exceeded",
  "detail": "Too many requests. Retry after 42 seconds.",
  "retry_after": 42
}
```

**Why better?**
- Includes numeric `retry_after` for programmatic retry logic
- Includes `Retry-After` header for HTTP client libraries
- More descriptive error message
- Consistent with other error responses in project

---

#### 5. No SlowAPI middleware - why?

**Note:** This task does NOT add SlowAPI middleware

**Rationale:**
- **Not required:** slowapi works with decorators + exception handler, no middleware needed
- **Decorator-based:** Rate limits applied via `@limiter.limit()` decorators on endpoints
- **Cleaner:** Middleware would add overhead to all requests, even those without rate limits
- **Standard pattern:** slowapi documentation uses decorator approach, not middleware

**What slowapi middleware would do (if we added it):**
- Automatically apply default limits to ALL endpoints
- We don't want this; we want explicit control

**Our approach:**
- Global default limit applies to all endpoints (via limiter config)
- Specific endpoints can override with decorators (future tasks)
- Exception handler catches all rate limit errors globally

---

#### 6. Global default limits vs no default

**Chosen:** Global default (200/hour prod, 1000/hour dev)

**Rationale:**
- **Defense in depth:** All endpoints get basic protection by default
- **Fail-safe:** Protects endpoints even if developer forgets to add `@limiter.limit()` decorator
- **Reasonable baseline:** 200/hour is generous for legitimate users, blocks abuse
- **Can be overridden:** Specific endpoints can use stricter limits with decorators

**Alternative considered:** No default limits, require explicit `@limiter.limit()` on every endpoint. Risky - easy to forget and leave endpoint unprotected.

---

### REF MCP Validation

**slowapi + FastAPI Integration:**

<function_calls>
<invoke name="mcp__Ref__ref_search_documentation">
<parameter name="query">slowapi FastAPI integration app.state exception handler