# Task #180: Implement Redis Connectivity Check

**Plan Task:** #180
**Wave/Phase:** Security Hardening P2 - Operational Excellence (Task 8: Comprehensive Health Checks)
**Dependencies:** None

---

## 🎯 Ziel

Implement Redis connectivity check for the health endpoint using the PING command to verify Redis responsiveness. The check should return structured status information (healthy/unhealthy) with error details and response time metrics for monitoring purposes.

## 📋 Acceptance Criteria

- [ ] `check_redis()` function implemented in `backend/app/api/health.py`
- [ ] Executes Redis PING command to verify connectivity
- [ ] Returns dict with status ('healthy'/'unhealthy') and optional error message
- [ ] Includes response_time_ms for performance monitoring
- [ ] Handles exceptions gracefully (connection refused, timeout, auth errors)
- [ ] Unit tests (3+): successful PING, Redis down, timeout scenario
- [ ] Integration test with real Redis instance from test fixtures
- [ ] Manual testing with Redis running/stopped documented
- [ ] CLAUDE.md updated with health check information

---

## 🛠️ Implementation Steps

### 1. Create test file with failing tests (TDD approach)

**Files:** `/Users/philippbriese/Documents/dev/projects/by IDE/Claude Code/Smart Youtube Bookmarks/backend/tests/api/test_health.py`

**Action:** Create comprehensive test file that covers all health check scenarios including Redis connectivity, following pytest async patterns from the codebase.

**Code:**

```python
"""Tests for health check endpoints."""

import pytest
from unittest.mock import AsyncMock, patch
from httpx import AsyncClient
from redis.exceptions import ConnectionError as RedisConnectionError, TimeoutError as RedisTimeoutError, AuthenticationError

from app.main import app


@pytest.mark.asyncio
async def test_basic_health_check():
    """Test basic health check endpoint returns 200 without dependency checks."""
    async with AsyncClient(app=app, base_url="http://test") as client:
        response = await client.get("/api/health")
    
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert "environment" in data
    assert "timestamp" in data


@pytest.mark.asyncio
async def test_detailed_health_check_all_healthy(client):
    """Test detailed health check when all dependencies are healthy."""
    response = await client.get("/api/health/detailed")
    
    assert response.status_code == 200
    data = response.json()
    
    # Check overall status
    assert data["status"] == "healthy"
    assert "environment" in data
    assert "timestamp" in data
    
    # Check database status
    assert "checks" in data
    assert "database" in data["checks"]
    assert data["checks"]["database"]["status"] == "healthy"
    assert "response_time_ms" in data["checks"]["database"]
    
    # Check Redis status
    assert "redis" in data["checks"]
    assert data["checks"]["redis"]["status"] == "healthy"
    assert "response_time_ms" in data["checks"]["redis"]


@pytest.mark.asyncio
async def test_check_redis_successful_ping():
    """Test check_redis() with successful PING command."""
    from app.api.health import check_redis
    
    # Mock get_redis_client to return mock that responds to ping()
    mock_redis = AsyncMock()
    mock_redis.ping = AsyncMock(return_value=True)
    
    with patch('app.api.health.get_redis_client', return_value=mock_redis):
        result = await check_redis()
    
    assert result["status"] == "healthy"
    assert "response_time_ms" in result
    assert isinstance(result["response_time_ms"], (int, float))
    assert "error" not in result
    mock_redis.ping.assert_called_once()


@pytest.mark.asyncio
async def test_check_redis_connection_refused():
    """Test check_redis() when Redis connection is refused."""
    from app.api.health import check_redis
    
    # Mock get_redis_client to raise ConnectionError
    with patch('app.api.health.get_redis_client', side_effect=RedisConnectionError("Connection refused")):
        result = await check_redis()
    
    assert result["status"] == "unhealthy"
    assert "error" in result
    assert "Connection refused" in result["error"]


@pytest.mark.asyncio
async def test_check_redis_timeout():
    """Test check_redis() when Redis PING times out."""
    from app.api.health import check_redis
    
    # Mock Redis client with timeout on ping()
    mock_redis = AsyncMock()
    mock_redis.ping = AsyncMock(side_effect=RedisTimeoutError("Timeout"))
    
    with patch('app.api.health.get_redis_client', return_value=mock_redis):
        result = await check_redis()
    
    assert result["status"] == "unhealthy"
    assert "error" in result
    assert "Timeout" in result["error"]


@pytest.mark.asyncio
async def test_check_redis_authentication_failure():
    """Test check_redis() when Redis authentication fails."""
    from app.api.health import check_redis
    
    # Mock get_redis_client to raise AuthenticationError
    with patch('app.api.health.get_redis_client', side_effect=AuthenticationError("WRONGPASS invalid password")):
        result = await check_redis()
    
    assert result["status"] == "unhealthy"
    assert "error" in result
    assert "WRONGPASS" in result["error"] or "password" in result["error"].lower()


@pytest.mark.asyncio
async def test_detailed_health_degraded_when_redis_down(client):
    """Test detailed health check returns degraded/unhealthy when Redis is down."""
    # Mock check_redis to return unhealthy
    with patch('app.api.health.check_redis', return_value={
        "status": "unhealthy",
        "error": "Connection refused"
    }):
        response = await client.get("/api/health/detailed")
    
    data = response.json()
    # Should be unhealthy when any dependency is down
    assert data["status"] == "unhealthy"
    assert data["checks"]["redis"]["status"] == "unhealthy"
```

**Why:** TDD approach ensures we design the API correctly before implementation. Tests define the contract: successful PING returns healthy status with response time, failures return unhealthy with error details. This follows redis-py production best practices for health checks.

**Run:** `cd backend && pytest tests/api/test_health.py -v`  
**Expected:** FAIL - Module/functions not found

---

### 2. Implement check_redis() helper function

**Files:** `/Users/philippbriese/Documents/dev/projects/by IDE/Claude Code/Smart Youtube Bookmarks/backend/app/api/health.py`

**Action:** Create health.py module with `check_redis()` function that executes PING command and measures response time.

**Code:**

```python
"""
Health check endpoints for monitoring application status.

Provides basic and detailed health checks for the application
and its dependencies (database, Redis).
"""

import time
from typing import Dict, Any
from datetime import datetime, timezone

from fastapi import APIRouter, status
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from redis.exceptions import RedisError

from app.core.database import AsyncSessionLocal
from app.core.redis import get_redis_client
from app.core.config import settings

router = APIRouter(prefix="/api/health", tags=["health"])


async def check_redis() -> Dict[str, Any]:
    """
    Check Redis connectivity and responsiveness using PING command.
    
    Follows redis-py production best practices:
    - Uses PING command to verify connection is alive
    - Measures response time for monitoring
    - Handles common exceptions (connection, timeout, auth)
    
    Returns:
        Dict with status ('healthy'/'unhealthy'), response_time_ms,
        and optional error message
        
    Reference:
        https://redis.io/docs/latest/develop/clients/redis-py/produsage/#health-checks
    """
    start_time = time.perf_counter()
    
    try:
        redis = await get_redis_client()
        
        # Execute PING command - returns True if successful
        # PING is O(1) fast command designed for health checks
        response = await redis.ping()
        
        response_time_ms = round((time.perf_counter() - start_time) * 1000, 2)
        
        if response:
            return {
                "status": "healthy",
                "response_time_ms": response_time_ms
            }
        else:
            # PING returned False (should never happen, but handle defensively)
            return {
                "status": "unhealthy",
                "error": "Redis PING returned False",
                "response_time_ms": response_time_ms
            }
            
    except RedisError as e:
        # Catch all Redis-specific errors (ConnectionError, TimeoutError, AuthenticationError, etc.)
        response_time_ms = round((time.perf_counter() - start_time) * 1000, 2)
        return {
            "status": "unhealthy",
            "error": f"Redis error: {str(e)}",
            "response_time_ms": response_time_ms
        }
    except Exception as e:
        # Catch any unexpected errors
        response_time_ms = round((time.perf_counter() - start_time) * 1000, 2)
        return {
            "status": "unhealthy",
            "error": f"Unexpected error: {str(e)}",
            "response_time_ms": response_time_ms
        }


async def check_database() -> Dict[str, Any]:
    """
    Check database connectivity and responsiveness.
    
    Returns:
        Dict with status and optional error message
    """
    start_time = time.perf_counter()
    
    try:
        async with AsyncSessionLocal() as db:
            # Execute simple query
            result = await db.execute(text("SELECT 1"))
            result.scalar()
            
            response_time_ms = round((time.perf_counter() - start_time) * 1000, 2)
            
            return {
                "status": "healthy",
                "response_time_ms": response_time_ms
            }
    except Exception as e:
        response_time_ms = round((time.perf_counter() - start_time) * 1000, 2)
        return {
            "status": "unhealthy",
            "error": str(e),
            "response_time_ms": response_time_ms
        }


@router.get("")
async def health_check() -> Dict[str, str]:
    """
    Basic health check endpoint.
    
    Returns a simple status indicating if the application is running.
    This endpoint does NOT check dependencies for faster response.
    Use for Kubernetes liveness probes.
    
    Returns:
        Simple status object with environment and timestamp
    """
    return {
        "status": "healthy",
        "environment": settings.environment.value,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }


@router.get("/detailed")
async def detailed_health_check() -> Dict[str, Any]:
    """
    Detailed health check with dependency verification.
    
    Checks:
    - Database connectivity (PostgreSQL)
    - Redis connectivity (Pub/Sub + ARQ)
    - Overall application status
    
    Use for Kubernetes readiness probes or monitoring dashboards.
    
    Returns:
        Detailed health status with all dependency checks
        - Status 200 if all healthy
        - Status 503 if any dependency unhealthy
    """
    # Run all health checks in parallel would be ideal,
    # but for simplicity run sequentially
    db_check = await check_database()
    redis_check = await check_redis()
    
    # Determine overall status
    checks_status = [db_check["status"], redis_check["status"]]
    
    if all(s == "healthy" for s in checks_status):
        overall_status = "healthy"
        http_status = status.HTTP_200_OK
    else:
        # Any unhealthy dependency = overall unhealthy
        overall_status = "unhealthy"
        http_status = status.HTTP_503_SERVICE_UNAVAILABLE
    
    response = {
        "status": overall_status,
        "environment": settings.environment.value,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "checks": {
            "database": db_check,
            "redis": redis_check
        }
    }
    
    return response
```

**Why:** 
- **PING command**: Official Redis documentation recommends PING for health checks (O(1) fast, designed for this purpose)
- **Response time measurement**: Using `time.perf_counter()` for high-resolution timing, essential for monitoring/alerting
- **Error hierarchy**: Catch `RedisError` first (covers ConnectionError, TimeoutError, AuthenticationError), then generic Exception as fallback
- **Defensive programming**: Handle unexpected False return from PING (should never happen but makes code robust)
- **No logging**: Health checks run frequently, logging would create noise. Monitoring systems will track response_time_ms metrics instead.

**Alternatives considered:**
- Using INFO command: Rejected, PING is faster and sufficient for connectivity check
- Parallel async checks: Would be faster but adds complexity, sequential is acceptable for health endpoint
- Caching health status: Rejected, want real-time status for accurate monitoring

---

### 3. Update main.py to register health router

**Files:** `/Users/philippbriese/Documents/dev/projects/by IDE/Claude Code/Smart Youtube Bookmarks/backend/app/main.py`

**Action:** Remove old inline health check endpoint and register new health router.

**Code:**

```python
# Find and remove old health check (around line 53):
# @app.get("/api/health")
# async def health_check() -> dict[str, str]:
#     return {"status": "ok"}

# Add health import to existing imports (around line 20-30):
from app.api import lists, videos, processing, websocket, tags, auth, health

# Add router registration with other routers (around line 40-50):
app.include_router(health.router)
```

**Why:** Consolidates health checks in dedicated module following Single Responsibility Principle. The new router provides both basic (`/api/health`) and detailed (`/api/health/detailed`) endpoints, maintaining backward compatibility with existing health check URL.

**Run:** `cd backend && pytest tests/api/test_health.py -v`  
**Expected:** PASS (all tests green)

---

### 4. Run unit tests and verify coverage

**Files:** N/A (testing phase)

**Action:** Run pytest with verbose output and coverage reporting to ensure all code paths are tested.

**Commands:**

```bash
cd backend

# Run health check tests with verbose output
pytest tests/api/test_health.py -v

# Run with coverage to verify 100% coverage of health module
pytest tests/api/test_health.py --cov=app.api.health --cov-report=term-missing

# Expected coverage: 100% for check_redis() and health endpoints
```

**Why:** Verify all error paths are covered (successful PING, connection refused, timeout, auth failure). Coverage report ensures no untested code paths remain.

---

### 5. Manual testing with Redis running and stopped

**Files:** N/A (manual testing phase)

**Action:** Perform manual integration testing to verify real-world behavior with actual Redis instance.

**Manual Testing Checklist:**

1. **Redis running (healthy state):**
   ```bash
   # Start Redis
   docker-compose up -d redis
   
   # Start backend
   cd backend && uvicorn app.main:app --reload
   
   # Test basic health check
   curl http://localhost:8000/api/health
   # Expected: {"status":"healthy","environment":"development","timestamp":"..."}
   
   # Test detailed health check
   curl http://localhost:8000/api/health/detailed
   # Expected: {"status":"healthy",...,"checks":{"database":{"status":"healthy","response_time_ms":X},"redis":{"status":"healthy","response_time_ms":X}}}
   ```

2. **Redis stopped (unhealthy state):**
   ```bash
   # Stop Redis
   docker-compose stop redis
   
   # Test basic health check (should still work - no dependency check)
   curl http://localhost:8000/api/health
   # Expected: {"status":"healthy",...}
   
   # Test detailed health check (should return 503)
   curl -i http://localhost:8000/api/health/detailed
   # Expected: HTTP/1.1 503 Service Unavailable
   # Body: {"status":"unhealthy",...,"checks":{...,"redis":{"status":"unhealthy","error":"..."}}}
   ```

3. **Redis authentication failure (wrong password):**
   ```bash
   # Temporarily change REDIS_URL to use wrong password
   export REDIS_URL="redis://:wrongpassword@localhost:6379/0"
   
   # Restart backend and test
   curl http://localhost:8000/api/health/detailed
   # Expected: Redis check status "unhealthy" with auth error
   ```

4. **Response time verification:**
   ```bash
   # Redis running - check response times are reasonable
   curl http://localhost:8000/api/health/detailed | jq '.checks.redis.response_time_ms'
   # Expected: < 100ms for local Redis
   ```

5. **Swagger UI testing:**
   ```
   Open http://localhost:8000/docs
   - Test GET /api/health
   - Test GET /api/health/detailed
   - Verify response schemas match documentation
   ```

**Why:** Manual testing verifies real-world scenarios that mocks can't simulate:
- Actual network latency and connection handling
- Real Redis PING command execution
- Proper error messages from real Redis errors
- Integration with docker-compose Redis service

**Expected Results:**
- ✅ Basic health check always returns 200 (no dependencies)
- ✅ Detailed health check returns 503 when Redis down
- ✅ Response times < 100ms for healthy services
- ✅ Error messages are descriptive and actionable

---

### 6. Add integration test with real Redis

**Files:** `/Users/philippbriese/Documents/dev/projects/by IDE/Claude Code/Smart Youtube Bookmarks/backend/tests/integration/test_health_integration.py`

**Action:** Create integration test that uses real Redis connection from test environment to verify end-to-end health check flow.

**Code:**

```python
"""Integration tests for health check endpoints with real dependencies."""

import pytest
from httpx import AsyncClient

from app.main import app


@pytest.mark.asyncio
async def test_health_check_with_real_redis(client):
    """
    Integration test: health check with real Redis connection.
    
    This test requires Redis to be running (via docker-compose or test fixtures).
    It verifies that check_redis() works with actual Redis instance.
    """
    response = await client.get("/api/health/detailed")
    
    assert response.status_code == 200
    data = response.json()
    
    # Overall status should be healthy when all services running
    assert data["status"] == "healthy"
    
    # Redis check should succeed
    assert data["checks"]["redis"]["status"] == "healthy"
    assert data["checks"]["redis"]["response_time_ms"] > 0
    assert data["checks"]["redis"]["response_time_ms"] < 1000  # Should be fast
    assert "error" not in data["checks"]["redis"]
    
    # Database check should also succeed
    assert data["checks"]["database"]["status"] == "healthy"


@pytest.mark.asyncio
async def test_basic_health_check_always_succeeds(client):
    """
    Basic health check should always return 200 even if dependencies are down.
    
    This endpoint is meant for Kubernetes liveness probes.
    """
    response = await client.get("/api/health")
    
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert "environment" in data
    assert "timestamp" in data
```

**Why:** Integration tests verify the full stack works together:
- Real Redis client initialization from `get_redis_client()`
- Actual PING command execution over network
- Database session creation and query execution
- FastAPI routing and response serialization

Unlike unit tests with mocks, integration tests catch issues like:
- Redis URL parsing errors
- Network connectivity problems
- Response serialization issues

**Run:** `cd backend && pytest tests/integration/test_health_integration.py -v`  
**Expected:** PASS (requires Redis running via docker-compose)

---

### 7. Update CLAUDE.md documentation

**Files:** `/Users/philippbriese/Documents/dev/projects/by IDE/Claude Code/Smart Youtube Bookmarks/CLAUDE.md`

**Action:** Add health check endpoint documentation to API Documentation section and Architecture section.

**Code:**

Find the "## API Documentation" section (around line 400+) and update:

```markdown
## API Documentation

- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

**Health Check Endpoints:**
- Basic Health: `GET /api/health` - Fast liveness check (no dependency verification)
- Detailed Health: `GET /api/health/detailed` - Complete health status with database and Redis checks

**Health Check Response Format:**

Basic health check (always returns 200):
```json
{
  "status": "healthy",
  "environment": "development",
  "timestamp": "2025-11-10T12:00:00Z"
}
```

Detailed health check (returns 200 if healthy, 503 if unhealthy):
```json
{
  "status": "healthy",
  "environment": "development",
  "timestamp": "2025-11-10T12:00:00Z",
  "checks": {
    "database": {
      "status": "healthy",
      "response_time_ms": 5.2
    },
    "redis": {
      "status": "healthy",
      "response_time_ms": 2.8
    }
  }
}
```

When a dependency is down:
```json
{
  "status": "unhealthy",
  "checks": {
    "redis": {
      "status": "unhealthy",
      "error": "Redis error: Connection refused",
      "response_time_ms": 0.1
    }
  }
}
```

**Use Cases:**
- **Kubernetes liveness probe:** Use `/api/health` (fast, always succeeds if app running)
- **Kubernetes readiness probe:** Use `/api/health/detailed` (verifies dependencies)
- **Monitoring dashboards:** Use `/api/health/detailed` for dependency status
- **Load balancer health checks:** Use `/api/health` for low overhead
```

**Why:** Documentation helps future developers and operators understand:
- Which endpoint to use for different monitoring scenarios
- Expected response formats and status codes
- Difference between liveness (app running) and readiness (dependencies healthy)

---

### 8. Run full test suite to verify no regressions

**Files:** N/A (testing phase)

**Action:** Run complete backend test suite to ensure Redis health check doesn't break existing functionality.

**Commands:**

```bash
cd backend

# Run all tests
pytest -v

# Verify no failures
# Expected: All tests pass including new health check tests

# Optional: Run with coverage for full report
pytest --cov=app --cov-report=html
# Review coverage report in htmlcov/index.html
```

**Why:** Ensures no regression from adding health module:
- Import statements don't break existing code
- Router registration doesn't conflict
- No circular dependencies introduced

---

## 🧪 Testing Strategy

**Unit Tests (7 tests in test_health.py):**

1. **test_basic_health_check** - Verify `/api/health` returns 200 without dependency checks
2. **test_detailed_health_check_all_healthy** - Verify `/api/health/detailed` structure when all healthy
3. **test_check_redis_successful_ping** - Mock successful PING returns healthy status with response time
4. **test_check_redis_connection_refused** - Mock ConnectionError returns unhealthy with error message
5. **test_check_redis_timeout** - Mock TimeoutError returns unhealthy with timeout error
6. **test_check_redis_authentication_failure** - Mock AuthenticationError returns unhealthy with auth error
7. **test_detailed_health_degraded_when_redis_down** - Verify overall status becomes unhealthy when Redis down

**Integration Tests (2 tests in test_health_integration.py):**

1. **test_health_check_with_real_redis** - End-to-end test with real Redis verifies PING command works
2. **test_basic_health_check_always_succeeds** - Verify basic endpoint has no dependencies

**Manual Testing Checklist:**

1. ✅ Redis running → detailed health returns 200 with healthy status
2. ✅ Redis stopped → detailed health returns 503 with unhealthy status
3. ✅ Redis auth failure → detailed health returns 503 with auth error message
4. ✅ Response times < 100ms for healthy services
5. ✅ Basic health check always returns 200 (no dependency checks)
6. ✅ Swagger UI documentation displays correctly

**Performance Expectations:**

- PING command: < 10ms (local Redis)
- check_redis() function: < 20ms (includes timing overhead)
- /api/health/detailed: < 50ms (both checks sequential)

---

## 📚 Reference

**REF MCP Findings:**

1. **Redis Production Best Practices** (https://redis.io/docs/latest/develop/clients/redis-py/produsage/#health-checks)
   - Official recommendation: Use `health_check_interval` parameter or manual PING commands
   - PING is O(1) fast operation designed for health checks
   - Health checks should measure response time for monitoring
   - Handle RedisError exception hierarchy (ConnectionError, TimeoutError, AuthenticationError)

2. **PING Command Documentation** (https://redis.io/docs/latest/commands/ping/#ping)
   - Returns "PONG" or copy of argument if provided
   - Primary use cases: test connection alive, verify data serving ability, measure latency
   - Expected return: Simple string reply "PONG" (redis-py returns True for success)

3. **Redis Connection Error Handling** (https://redis.io/docs/latest/develop/clients/redis-py/connect/#retrying-connections)
   - redis-py v6.0+ includes automatic retry with exponential backoff
   - Default: 3 retries for ConnectionError and TimeoutError
   - Health checks benefit from retry mechanism (transient failures won't trigger alerts)

**Related Code Patterns:**

- Redis client singleton: `/Users/philippbriese/Documents/dev/projects/by IDE/Claude Code/Smart Youtube Bookmarks/backend/app/core/redis.py` (lines 24-49)
  - Uses double-check locking pattern for thread-safe initialization
  - Returns client with UTF-8 encoding and response decoding enabled

- ARQ worker Redis config: `/Users/philippbriese/Documents/dev/projects/by IDE/Claude Code/Smart Youtube Bookmarks/backend/app/workers/settings.py` (lines 76-88)
  - Shows Redis DSN parsing pattern used in app
  - Same Redis instance used for ARQ and pub/sub

- Test patterns: `/Users/philippbriese/Documents/dev/projects/by IDE/Claude Code/Smart Youtube Bookmarks/backend/tests/conftest.py` (lines 118-123)
  - Mock Redis fixture shows AsyncMock pattern for testing
  - Health check tests should follow same mocking approach

**Design Decisions:**

1. **Why PING command over INFO or other commands?**
   - PING is specifically designed for health checks (O(1) constant time)
   - INFO returns server statistics (more overhead, unnecessary for connectivity check)
   - PING is recommended in official Redis production usage guide

2. **Why measure response time?**
   - Monitoring systems can alert on slow responses (degraded performance)
   - Helps identify network issues before complete failure
   - Standard practice in health check patterns (database check also includes timing)

3. **Why catch RedisError instead of specific exceptions?**
   - RedisError is base class for all Redis exceptions
   - Handles current exceptions (ConnectionError, TimeoutError, AuthenticationError)
   - Future-proof against new Redis exception types
   - Still logs specific error message via `str(e)`

4. **Why no caching of health status?**
   - Health checks need real-time status for accurate monitoring
   - Cached status could hide real outages
   - PING is fast enough (<10ms) that caching isn't needed
   - Monitoring systems typically call health endpoint every 10-30 seconds

5. **Why return 503 instead of 200 for unhealthy?**
   - HTTP 503 Service Unavailable is semantic correct for "dependencies down"
   - Load balancers recognize 503 and remove instance from pool
   - Monitoring systems can alert on 5xx status codes
   - Follows REST API best practices for health endpoints

**Related Tasks:**

- Task #178: Comprehensive Health Checks (parent task in security hardening plan)
- Task #179: Database Connectivity Check (companion task, similar pattern)
- Task #181: Kubernetes readiness/liveness probes (will use these endpoints)

**Estimated Time:** 1-1.5 hours
- Step 1 (tests): 15 min
- Step 2-3 (implementation): 25 min
- Step 4-6 (testing): 25 min
- Step 7-8 (documentation): 15 min
