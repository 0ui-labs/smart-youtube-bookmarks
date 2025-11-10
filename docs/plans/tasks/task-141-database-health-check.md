# Task #141: Implement Database Connectivity Check

**Plan Task:** #141
**Wave/Phase:** Security Hardening P2 - Operational Excellence (Task 8: Comprehensive Health Checks)
**Dependencies:** None

---

## 🎯 Ziel

Implement robust database connectivity check for health endpoint that verifies database responsiveness using async SQLAlchemy patterns with timeout handling. The check should return structured status information including response time metrics for monitoring and handle failures gracefully without crashing.

This is the foundation for Task #140 (comprehensive health checks) and provides production-grade observability for database availability.

## 📋 Acceptance Criteria

- [ ] `check_database()` async helper function in `backend/app/api/health.py`
- [ ] Executes `SELECT 1` query to verify database connectivity
- [ ] Returns dict with `status` ("healthy"/"unhealthy"), `response_time_ms`, and optional `error` message
- [ ] Uses `asyncio.wait_for()` with 5-second timeout to prevent hanging connections
- [ ] Handles all exceptions gracefully (SQLAlchemyError, TimeoutError, generic Exception)
- [ ] Never crashes the health endpoint - always returns structured response
- [ ] Unit tests (4+): successful check, database unavailable, query timeout, connection error
- [ ] Integration test with real database connection
- [ ] Documented in CLAUDE.md (Health Checks section)

---

## 🛠️ Implementation Steps

### 1. Create test file with failing tests (TDD approach)

**Files:** `/Users/philippbriese/Documents/dev/projects/by IDE/Claude Code/Smart Youtube Bookmarks/backend/tests/api/test_health.py`

**Action:** Write comprehensive test suite covering all database check scenarios before implementation.

```python
"""
Tests for health check endpoints.

Tests database connectivity checks with various failure scenarios
including timeouts, connection errors, and successful checks.
"""

import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from sqlalchemy.exc import OperationalError, TimeoutError as SQLAlchemyTimeoutError

from app.api.health import check_database


@pytest.mark.asyncio
async def test_check_database_success():
    """Test successful database connectivity check."""
    result = await check_database()
    
    assert result["status"] == "healthy"
    assert "response_time_ms" in result
    assert isinstance(result["response_time_ms"], (int, float))
    assert result["response_time_ms"] >= 0
    assert "error" not in result


@pytest.mark.asyncio
async def test_check_database_connection_failure():
    """Test database check when connection fails."""
    with patch("app.api.health.AsyncSessionLocal") as mock_session:
        mock_session.return_value.__aenter__.side_effect = OperationalError(
            "connection refused", None, None
        )
        
        result = await check_database()
        
        assert result["status"] == "unhealthy"
        assert "error" in result
        assert "connection refused" in result["error"].lower()
        assert "response_time_ms" in result


@pytest.mark.asyncio
async def test_check_database_query_timeout():
    """Test database check when query times out."""
    with patch("app.api.health.AsyncSessionLocal") as mock_session:
        # Mock session that hangs on execute
        mock_db = AsyncMock()
        mock_db.execute = AsyncMock(side_effect=asyncio.TimeoutError())
        mock_session.return_value.__aenter__.return_value = mock_db
        
        result = await check_database()
        
        assert result["status"] == "unhealthy"
        assert "error" in result
        assert "timeout" in result["error"].lower()
        assert "response_time_ms" in result


@pytest.mark.asyncio
async def test_check_database_generic_error():
    """Test database check handles unexpected errors gracefully."""
    with patch("app.api.health.AsyncSessionLocal") as mock_session:
        mock_session.return_value.__aenter__.side_effect = RuntimeError(
            "Unexpected database error"
        )
        
        result = await check_database()
        
        assert result["status"] == "unhealthy"
        assert "error" in result
        assert result["error"] == "Unexpected database error"


@pytest.mark.asyncio
async def test_check_database_response_time_measured():
    """Test that response time is actually measured."""
    result = await check_database()
    
    # Response time should be reasonable for SELECT 1 query
    assert result["response_time_ms"] < 1000  # Less than 1 second
    assert result["response_time_ms"] > 0  # But greater than 0
```

**Run:** `cd backend && pytest tests/api/test_health.py -v`

**Expected:** FAIL - Module `app.api.health` not found

**Why:** TDD approach ensures we write tests that actually verify the behavior we want. Writing tests first helps clarify the API contract before implementation.

---

### 2. Create health.py module with check_database() implementation

**Files:** `/Users/philippbriese/Documents/dev/projects/by IDE/Claude Code/Smart Youtube Bookmarks/backend/app/api/health.py`

**Action:** Implement async database connectivity check with timeout, error handling, and response time measurement.

```python
"""
Health check endpoints for monitoring application status.

Provides database connectivity checks with timeout handling,
response time metrics, and graceful error handling.
"""

import asyncio
import time
from typing import Dict, Any

from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from app.core.database import AsyncSessionLocal


async def check_database() -> Dict[str, Any]:
    """
    Check database connectivity and responsiveness.
    
    Executes a simple SELECT 1 query with 5-second timeout to verify
    the database is reachable and responsive. Measures response time
    for monitoring purposes.
    
    Returns:
        Dict with:
            - status: "healthy" or "unhealthy"
            - response_time_ms: Query execution time in milliseconds
            - error: Error message (only present if unhealthy)
    
    Examples:
        Success: {"status": "healthy", "response_time_ms": 12.34}
        Failure: {"status": "unhealthy", "response_time_ms": 5000, 
                  "error": "connection timeout"}
    """
    start_time = time.time()
    
    try:
        async with AsyncSessionLocal() as db:
            # Execute simple query with 5-second timeout
            # Using asyncio.wait_for prevents hanging connections
            await asyncio.wait_for(
                db.execute(text("SELECT 1")),
                timeout=5.0
            )
            
            response_time_ms = (time.time() - start_time) * 1000
            
            return {
                "status": "healthy",
                "response_time_ms": round(response_time_ms, 2)
            }
            
    except asyncio.TimeoutError:
        response_time_ms = (time.time() - start_time) * 1000
        return {
            "status": "unhealthy",
            "response_time_ms": round(response_time_ms, 2),
            "error": "Database query timeout (>5s)"
        }
        
    except SQLAlchemyError as e:
        response_time_ms = (time.time() - start_time) * 1000
        return {
            "status": "unhealthy",
            "response_time_ms": round(response_time_ms, 2),
            "error": f"Database error: {str(e)}"
        }
        
    except Exception as e:
        response_time_ms = (time.time() - start_time) * 1000
        return {
            "status": "unhealthy",
            "response_time_ms": round(response_time_ms, 2),
            "error": str(e)
        }
```

**Why:** 
- **5-second timeout**: Balances between giving slow databases time to respond vs. keeping health checks fast
- **asyncio.wait_for()**: Python's recommended pattern for async timeout handling (REF: Python asyncio docs)
- **Three-tier exception handling**: Specific errors first (TimeoutError, SQLAlchemyError), then catch-all
- **Always return structured dict**: Never raises exceptions, making it safe to use in health endpoints
- **Response time measurement**: Provides observability even for failures (shows how long before timeout)
- **SELECT 1**: Minimal query that works across all SQL databases (PostgreSQL, MySQL, SQLite)

**Alternative considered:** Using SQLAlchemy's `pool_pre_ping=True` - rejected because pre_ping is for connection pool management, not health checks. Health checks need explicit control over timeouts and error messages.

---

### 3. Run tests to verify implementation

**Files:** N/A (testing phase)

**Action:** Run pytest to verify all tests pass with the new implementation.

```bash
cd backend && pytest tests/api/test_health.py -v
```

**Expected:** All 5 tests PASS

**Why:** Validates that implementation meets all test scenarios including edge cases (timeout, connection failure, generic errors).

---

### 4. Add integration test with real database

**Files:** `/Users/philippbriese/Documents/dev/projects/by IDE/Claude Code/Smart Youtube Bookmarks/backend/tests/integration/test_health_integration.py`

**Action:** Create integration test that uses actual database connection from test fixtures.

```python
"""
Integration tests for health check endpoints with real database.

Uses pytest fixtures to test against actual PostgreSQL database.
"""

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.health import check_database


@pytest.mark.asyncio
async def test_database_check_with_real_connection(db: AsyncSession):
    """
    Test database health check with real database connection.
    
    This integration test verifies that check_database() works correctly
    with an actual PostgreSQL database, not mocked connections.
    """
    result = await check_database()
    
    # Should be healthy since test database is running
    assert result["status"] == "healthy"
    
    # Response time should be reasonable
    assert 0 < result["response_time_ms"] < 1000  # Less than 1 second
    
    # Should not have error field
    assert "error" not in result
    
    # Verify response time is actually measured
    assert isinstance(result["response_time_ms"], float)
```

**Run:** `cd backend && pytest tests/integration/test_health_integration.py -v`

**Expected:** PASS (requires test database to be running)

**Why:** Integration tests verify behavior with real dependencies. This catches issues that unit tests with mocks might miss (e.g., incorrect SQL syntax, connection pool issues).

---

### 5. Create basic health endpoint using check_database()

**Files:** `/Users/philippbriese/Documents/dev/projects/by IDE/Claude Code/Smart Youtube Bookmarks/backend/app/api/health.py`

**Action:** Add simple health endpoint that uses check_database() and replaces the current basic health check.

```python
# Add to health.py after check_database() function

from fastapi import APIRouter, status
from datetime import datetime, timezone

router = APIRouter(prefix="/api/health", tags=["health"])


@router.get("")
async def health_check() -> Dict[str, Any]:
    """
    Basic health check endpoint with database connectivity verification.
    
    Checks:
    - Application is running
    - Database is reachable and responsive
    
    Returns 200 if healthy, includes database check status.
    Note: This does NOT return 503 on database failure to maintain
    compatibility with simple uptime monitors. Use /health/detailed
    for dependency-aware status codes.
    
    Returns:
        Basic health status with database check
    """
    db_check = await check_database()
    
    return {
        "status": "healthy" if db_check["status"] == "healthy" else "degraded",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "database": db_check
    }
```

**Why:** 
- Returns 200 even if database is down (degraded state) - many monitoring tools expect health endpoints to always return 200 unless the app itself is crashed
- Provides immediate database visibility in basic health check
- Maintains backward compatibility with existing `/api/health` endpoint
- Foundation for more comprehensive checks in Task #140

---

### 6. Update main.py to use new health router

**Files:** `/Users/philippbriese/Documents/dev/projects/by IDE/Claude Code/Smart Youtube Bookmarks/backend/app/main.py`

**Action:** Replace simple health endpoint with new health router.

```python
# In main.py imports section, add:
from app.api import lists, videos, processing, websocket, tags, custom_fields, schemas, schema_fields, health

# Remove old health check endpoint (around line 53-55):
# @app.get("/api/health")
# async def health_check() -> dict[str, str]:
#     return {"status": "ok"}

# Add health router after other routers (around line 50):
app.include_router(health.router)
```

**Run:** 
```bash
cd backend
# Start the server
uvicorn app.main:app --reload

# In another terminal, test the endpoint
curl http://localhost:8000/api/health | jq
```

**Expected Output:**
```json
{
  "status": "healthy",
  "timestamp": "2025-11-10T15:30:45.123456+00:00",
  "database": {
    "status": "healthy",
    "response_time_ms": 12.34
  }
}
```

**Why:** Router pattern is more maintainable than standalone endpoint. Allows for easy addition of `/health/detailed`, `/health/live`, `/health/ready` in Task #140 without cluttering main.py.

---

### 7. Add test for health endpoint integration

**Files:** `/Users/philippbriese/Documents/dev/projects/by IDE/Claude Code/Smart Youtube Bookmarks/backend/tests/api/test_health.py`

**Action:** Add test that verifies the HTTP endpoint works correctly.

```python
# Add to test_health.py

from httpx import AsyncClient
from app.main import app


@pytest.mark.asyncio
async def test_health_endpoint_returns_200():
    """Test that /api/health endpoint returns 200 OK."""
    async with AsyncClient(app=app, base_url="http://test") as client:
        response = await client.get("/api/health")
    
    assert response.status_code == 200
    data = response.json()
    
    # Verify response structure
    assert "status" in data
    assert data["status"] in ["healthy", "degraded"]
    assert "timestamp" in data
    assert "database" in data
    
    # Verify database check is included
    assert "status" in data["database"]
    assert "response_time_ms" in data["database"]


@pytest.mark.asyncio
async def test_health_endpoint_with_database_down():
    """Test health endpoint returns degraded when database is down."""
    with patch("app.api.health.check_database") as mock_check:
        mock_check.return_value = {
            "status": "unhealthy",
            "response_time_ms": 5000.0,
            "error": "Connection refused"
        }
        
        async with AsyncClient(app=app, base_url="http://test") as client:
            response = await client.get("/api/health")
        
        # Should still return 200 (degraded, not failed)
        assert response.status_code == 200
        data = response.json()
        
        assert data["status"] == "degraded"
        assert data["database"]["status"] == "unhealthy"
        assert "error" in data["database"]
```

**Run:** `cd backend && pytest tests/api/test_health.py -v`

**Expected:** All 7 tests PASS

**Why:** End-to-end test verifies the full stack (FastAPI routing → health check function → response serialization). Tests both healthy and unhealthy database scenarios.

---

### 8. Manual testing checklist

**Action:** Verify health endpoint behavior in different scenarios.

**Test Scenarios:**

1. **Healthy database:**
   ```bash
   curl http://localhost:8000/api/health | jq
   # Expected: status "healthy", response_time_ms < 100
   ```

2. **Database stopped:**
   ```bash
   docker-compose stop postgres
   curl http://localhost:8000/api/health | jq
   # Expected: status "degraded", database.status "unhealthy", database.error present
   docker-compose start postgres
   ```

3. **Slow database (simulate with pg_sleep):**
   ```bash
   # In psql, run: SELECT pg_sleep(10);
   # Then immediately:
   curl http://localhost:8000/api/health | jq
   # Expected: Should return within 5 seconds with timeout error
   ```

4. **Response time measurement:**
   ```bash
   # Run multiple times and verify response_time_ms varies but is reasonable
   for i in {1..5}; do
     curl -s http://localhost:8000/api/health | jq '.database.response_time_ms'
   done
   # Expected: Values between 1-50ms typically
   ```

5. **OpenAPI docs:**
   - Visit http://localhost:8000/docs
   - Find `/api/health` endpoint
   - Click "Try it out" → "Execute"
   - Verify response matches schema

**Why:** Manual testing catches real-world issues that unit tests might miss (network timeouts, actual database behavior, OpenAPI schema generation).

---

### 9. Update CLAUDE.md documentation

**Files:** `/Users/philippbriese/Documents/dev/projects/by IDE/Claude Code/Smart Youtube Bookmarks/CLAUDE.md`

**Action:** Add Health Checks section documenting the new functionality.

```markdown
# Add after "## API Documentation" section (around line 395)

## Health Checks

**Basic Health Endpoint:** `GET /api/health`
- Returns application status and database connectivity
- Always returns 200 OK (degraded state if database is down)
- Includes response time metrics for monitoring

**Response Format:**
```json
{
  "status": "healthy",  // "healthy" or "degraded"
  "timestamp": "2025-11-10T15:30:45.123456+00:00",
  "database": {
    "status": "healthy",  // "healthy" or "unhealthy"
    "response_time_ms": 12.34,
    "error": "Connection refused"  // Only present if unhealthy
  }
}
```

**Implementation Details:**
- Database check uses `SELECT 1` query with 5-second timeout
- Uses `asyncio.wait_for()` to prevent hanging connections
- Measures response time even for failures
- Graceful error handling (never crashes)
- Safe for frequent polling by monitoring tools

**Testing:**
- Unit tests: `backend/tests/api/test_health.py`
- Integration tests: `backend/tests/integration/test_health_integration.py`
- Covers: success, timeout, connection failure, generic errors

**Future Enhancements (Task #140):**
- `/api/health/detailed` - Comprehensive checks (database, Redis, external APIs)
- `/api/health/live` - Kubernetes liveness probe
- `/api/health/ready` - Kubernetes readiness probe
```

**Why:** Documentation ensures future developers (and AI assistants) understand the health check system. Includes implementation details, testing info, and future roadmap.

---

### 10. Run full test suite to verify no regressions

**Files:** N/A (verification phase)

**Action:** Run all backend tests to ensure new code doesn't break existing functionality.

```bash
cd backend
pytest -v
```

**Expected:** All tests PASS, including new health check tests

**Why:** Regression testing ensures changes don't break existing functionality. New health check code should be isolated enough to not affect other modules, but verification is essential.

---

### 11. Verify TypeScript frontend compatibility

**Files:** N/A (verification phase)

**Action:** Ensure frontend has no TypeScript errors and health endpoint is accessible.

```bash
cd frontend
npx tsc --noEmit
npm run dev
```

**In browser console:**
```javascript
// Test that health endpoint is accessible from frontend
fetch('http://localhost:8000/api/health')
  .then(r => r.json())
  .then(console.log)
```

**Expected:** 
- No TypeScript compilation errors
- Health endpoint returns valid JSON
- CORS allows frontend to access endpoint

**Why:** Verifies that backend changes don't introduce CORS issues or break frontend builds. Health endpoints are often consumed by frontend monitoring dashboards.

---

### 12. Commit the implementation

**Action:** Commit all changes with descriptive message.

```bash
cd /Users/philippbriese/Documents/dev/projects/by\ IDE/Claude\ Code/Smart\ Youtube\ Bookmarks

git add backend/app/api/health.py \
        backend/app/main.py \
        backend/tests/api/test_health.py \
        backend/tests/integration/test_health_integration.py \
        CLAUDE.md

git commit -m "feat(health): implement database connectivity check with timeout

- Add check_database() async helper with 5s timeout using asyncio.wait_for()
- Execute SELECT 1 query to verify database responsiveness
- Return structured status: healthy/unhealthy with response_time_ms
- Graceful error handling: TimeoutError, SQLAlchemyError, generic Exception
- Replace simple /api/health endpoint with database-aware version
- Returns 'degraded' status if database is down (maintains 200 OK)
- Unit tests (7): success, timeout, connection failure, endpoint integration
- Integration test with real database connection
- Document in CLAUDE.md with implementation details and testing info

Foundation for Task #140 (comprehensive health checks with Redis, external APIs).

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

**Why:** 
- Descriptive commit message explains what, why, and how
- References Task #140 for context
- Groups related files in single atomic commit
- Follows conventional commits format (feat:)

---

## 🧪 Testing Strategy

### Unit Tests (7 tests in test_health.py)

1. **test_check_database_success**
   - Verify: Returns "healthy" status with measured response_time_ms
   - Mocks: None (uses real database from pytest fixture)

2. **test_check_database_connection_failure**
   - Verify: Returns "unhealthy" with error message when connection fails
   - Mocks: AsyncSessionLocal raises OperationalError

3. **test_check_database_query_timeout**
   - Verify: Returns "unhealthy" with timeout error after 5 seconds
   - Mocks: db.execute raises asyncio.TimeoutError

4. **test_check_database_generic_error**
   - Verify: Handles unexpected errors gracefully (never crashes)
   - Mocks: AsyncSessionLocal raises RuntimeError

5. **test_check_database_response_time_measured**
   - Verify: Response time is reasonable (0-1000ms for SELECT 1)
   - Mocks: None (real measurement)

6. **test_health_endpoint_returns_200**
   - Verify: HTTP endpoint returns 200 with correct JSON structure
   - Tests: Full FastAPI request/response cycle

7. **test_health_endpoint_with_database_down**
   - Verify: Returns "degraded" status (200 OK) when database is unhealthy
   - Mocks: check_database() returns unhealthy result

### Integration Tests (1 test in test_health_integration.py)

1. **test_database_check_with_real_connection**
   - Verify: Works with actual PostgreSQL database (not mocked)
   - Uses: pytest db fixture (AsyncSession)
   - Validates: Response structure, reasonable response time, no errors

### Manual Testing Checklist

1. **Healthy State**
   - Start: `docker-compose up -d postgres`
   - Test: `curl http://localhost:8000/api/health`
   - Verify: status "healthy", response_time_ms < 100

2. **Database Down**
   - Stop: `docker-compose stop postgres`
   - Test: `curl http://localhost:8000/api/health`
   - Verify: status "degraded", database.error present
   - Cleanup: `docker-compose start postgres`

3. **Timeout Scenario**
   - Simulate slow query (if possible)
   - Verify: Returns within 5 seconds with timeout error

4. **Response Time Variance**
   - Run: Multiple curl requests in loop
   - Verify: response_time_ms varies but stays reasonable (1-50ms)

5. **OpenAPI Documentation**
   - Visit: http://localhost:8000/docs
   - Test: Execute /api/health endpoint
   - Verify: Swagger UI shows correct response schema

---

## 📚 Reference

### REF MCP Findings

1. **SQLAlchemy Pool Pre-Ping Pattern** (https://docs.sqlalchemy.org/en/20/core/pooling.html#pool-disconnects-pessimistic)
   - Evidence: "Pessimistic disconnect handling tests the SQL connection at checkout... uses SELECT 1 to test the connection for liveness"
   - Application: We use SELECT 1 for health checks because it's the same query SQLAlchemy uses internally for connection validation
   - Note: pool_pre_ping is for connection pool management, NOT health checks. Health checks need explicit timeout control.

2. **Python asyncio.wait_for() Timeout Pattern** (https://docs.python.org/3/library/asyncio-task.html#timeouts)
   - Evidence: "Wait for the aw awaitable to complete with a timeout... If a timeout occurs, it cancels the task and raises TimeoutError"
   - Application: Using `asyncio.wait_for(db.execute(text("SELECT 1")), timeout=5.0)` prevents hanging connections
   - Best Practice: Always catch TimeoutError separately from other exceptions for clear error messages

3. **FastAPI Health Check Package Patterns** (https://kludex.github.io/fastapi-health/)
   - Evidence: "async def is_database_online(session: AsyncSession = Depends(get_session)): try: await asyncio.wait_for(session.execute('SELECT 1'), timeout=30)"
   - Application: Industry standard uses 30s timeout; we chose 5s for faster feedback in health checks
   - Pattern: Separate health check functions that return boolean/dict for flexibility

4. **Response Time Measurement Best Practice** (https://dev.to/lisan_al_gaib/building-a-health-check-microservice-with-fastapi-26jo)
   - Evidence: "response.headers['X-Response-Time'] = f'{(time.time() - start_time) * 1000:.2f}ms'"
   - Application: We measure response_time_ms using same pattern: `(time.time() - start_time) * 1000`
   - Benefit: Provides observability for monitoring systems (Prometheus, Datadog, etc.)

5. **Parallel Health Checks Pattern** (https://dev.to/lisan_al_gaib/building-a-health-check-microservice-with-fastapi-26jo)
   - Evidence: "Performs parallel health checks using asyncio.gather()"
   - Application: Will use in Task #140 for checking database + Redis simultaneously
   - Performance: Reduces total health check time from sum to max of individual checks

### Related Code Patterns

**Existing Database Session Pattern:**
- File: `backend/app/core/database.py`
- Pattern: `AsyncSessionLocal` context manager with try/except/rollback
- Usage: `async with AsyncSessionLocal() as session:` is the standard pattern

**Existing Error Handling Pattern:**
- Files: `backend/app/api/videos.py`, `backend/app/api/tags.py`
- Pattern: Try/except blocks with specific exception types first, then generic
- Consistency: check_database() follows same exception hierarchy pattern

**Existing Health Endpoint:**
- File: `backend/app/main.py` line 53-55
- Current: Simple `{"status": "ok"}` return
- Replacement: Enhanced version with database checks

### Design Decisions

**Decision 1: 5-second timeout (not 30s)**
- Rationale: Health checks should be fast. 30s is too long for monitoring tools that poll every 10-30s.
- Trade-off: Might timeout on very slow databases that are still functional
- Context: Production databases should respond to SELECT 1 in <100ms. If it takes >5s, it's effectively down for user requests.

**Decision 2: Always return 200 OK (degraded status)**
- Rationale: Many monitoring tools expect health endpoints to return 200 unless the app process is crashed
- Alternative: Return 503 on database failure (will implement in /health/detailed in Task #140)
- Context: Separates app-level health (process running) from dependency health (database available)

**Decision 3: Return dict instead of boolean**
- Rationale: Structured response enables monitoring (response_time_ms), debugging (error messages), and extensibility
- Alternative: Simple boolean return (rejected - insufficient information)
- Context: Enables Prometheus-style metrics: `health_check_response_time_ms{service="database"}`

**Decision 4: Measure response time even for failures**
- Rationale: Shows how long before timeout/failure occurred
- Use Case: If response_time_ms=5000, we know it was a timeout. If =50, it was a fast connection failure.
- Context: Debugging aid - helps distinguish "database refused connection" from "database is hanging"

**Decision 5: Three-tier exception handling**
- Order: TimeoutError → SQLAlchemyError → Exception
- Rationale: Most specific errors first, generic catch-all last
- Context: TimeoutError needs different message than SQLAlchemyError (connection vs. query timeout)

**Decision 6: Use text("SELECT 1") not raw string**
- Rationale: SQLAlchemy 2.0 requires text() for literal SQL
- Security: text() provides SQL injection protection
- Context: Following SQLAlchemy 2.0 best practices (CLAUDE.md documents we use SQLAlchemy 2.0 async)

---

## 🎓 Implementation Notes

### Why SELECT 1?
SELECT 1 is the universal database connectivity test because:
- Works on all SQL databases (PostgreSQL, MySQL, SQLite, Oracle, etc.)
- Minimal overhead (no table access, no data transfer)
- Same query SQLAlchemy uses for pool_pre_ping
- Returns single row/column - easy to verify success

### Why asyncio.wait_for()?
Python 3.11+ recommends `asyncio.timeout()` context manager, but `wait_for()` is:
- Compatible with Python 3.11+ and 3.10 (project uses 3.11)
- More explicit for function-level timeouts
- Returns awaitable result (doesn't require try/except inside context)

### Why Not Use pool_pre_ping?
pool_pre_ping is for connection pool management:
- Runs before checkout from pool
- Purpose: Detect stale connections, not health checks
- No timeout control
- No response time measurement

Health checks need:
- Explicit timeout (5s)
- Response time measurement
- Detailed error messages
- HTTP endpoint integration

### Testing Philosophy
Test pyramid for health checks:
1. **Unit tests (7)**: Fast, isolated, cover all code paths
2. **Integration test (1)**: Real database, verify actual behavior
3. **Manual tests (5)**: Real-world scenarios, edge cases

This gives confidence that code works in theory (unit), practice (integration), and production (manual).

---

## ⏱️ Estimated Time

**Total: 1-2 hours**

- Step 1-2 (Tests + Implementation): 30 min
- Step 3-4 (Unit + Integration): 15 min
- Step 5-6 (Endpoint + Router): 20 min
- Step 7-8 (Manual Testing): 15 min
- Step 9-11 (Documentation + Verification): 20 min
- Step 12 (Commit): 5 min

**Factors:**
- Fast: If familiar with asyncio and SQLAlchemy patterns
- Slow: If need to debug timeout behavior or mock issues
- Assumes: PostgreSQL already running in Docker

---

## 🔗 Related Tasks

**Depends On:** None (foundational task)

**Enables:**
- Task #140: Comprehensive Health Checks (will add Redis check, detailed endpoint)
- Task #142: Redis Connectivity Check (same pattern as database check)
- Task #143: Health Check Response Codes (503 for unhealthy dependencies)

**Related:**
- Security Hardening Plan: Task 8 (Comprehensive Health Checks)
- Kubernetes readiness/liveness probes (future deployment)
