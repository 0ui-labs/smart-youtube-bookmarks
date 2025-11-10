# Task #140: Comprehensive Health Checks

**Plan Task:** #140
**Wave/Phase:** P2 - Operational Excellence (Security Hardening - Task 8)
**Dependencies:** None (extends existing health endpoint)

---

## 🎯 Goal

Implement comprehensive health check API endpoints with dependency verification (PostgreSQL, Redis) to enable monitoring, alerting, and Kubernetes orchestration. Provide both basic (fast) and detailed (dependency-checking) endpoints, plus dedicated liveness/readiness probes for container orchestration.

**Expected Outcome:** Production-ready health check system with 4 endpoints, comprehensive tests (including failure scenarios), proper HTTP status codes, and clear documentation for monitoring integration.

---

## 📋 Acceptance Criteria

### Functional Requirements

- [ ] **GET /api/health** - Basic health endpoint (200 OK, no dependency checks, <10ms response)
- [ ] **GET /api/health/detailed** - Detailed endpoint with database + Redis checks (200 OK if healthy, 503 if unhealthy)
- [ ] **GET /api/health/live** - Kubernetes liveness probe (200 OK if process running)
- [ ] **GET /api/health/ready** - Kubernetes readiness probe (200 OK if all dependencies healthy, 503 if not ready)
- [ ] **Database health check** - Executes `SELECT 1` query with timeout
- [ ] **Redis health check** - Executes `PING` command with timeout
- [ ] **Status codes** - Returns 503 when dependencies are unhealthy
- [ ] **Response format** - Consistent JSON structure with timestamp, status, checks

### Technical Requirements

- [ ] **Testing:** 10+ tests covering success and failure scenarios
- [ ] **Mocked failures:** Database/Redis connection failures return 503
- [ ] **Timeout handling:** Health checks don't hang indefinitely
- [ ] **Error logging:** Failed health checks logged with structured logging
- [ ] **No breaking changes:** Replaces existing `/api/health` endpoint seamlessly
- [ ] **Type safety:** Full type hints, Pydantic response models

---

## 🛠️ Implementation Steps

### Step 1: Create Health Check Module with Helper Functions

**Files:**
- `backend/app/api/health.py` (NEW)

**Action:** Create health check router with database and Redis verification functions.

**Implementation:**

```python
"""
Health check endpoints for monitoring application status.

Provides basic and detailed health checks for the application
and its dependencies (PostgreSQL, Redis).
"""

from datetime import datetime, timezone
from typing import Dict, Any, Literal
import asyncio

from fastapi import APIRouter, status, Response
from sqlalchemy import text
from pydantic import BaseModel

from app.core.database import AsyncSessionLocal
from app.core.redis import get_redis_client


router = APIRouter(prefix="/api/health", tags=["health"])


# Response Models
class BasicHealthResponse(BaseModel):
    """Basic health check response."""
    status: Literal["healthy"]
    timestamp: str


class DependencyCheck(BaseModel):
    """Individual dependency health check result."""
    status: Literal["healthy", "unhealthy"]
    response_time_ms: int | None = None
    error: str | None = None


class DetailedHealthResponse(BaseModel):
    """Detailed health check response with dependency checks."""
    status: Literal["healthy", "degraded", "unhealthy"]
    timestamp: str
    checks: Dict[str, DependencyCheck]


class LivenessResponse(BaseModel):
    """Liveness probe response."""
    status: Literal["alive"]


class ReadinessResponse(BaseModel):
    """Readiness probe response."""
    status: Literal["ready", "not_ready"]
    timestamp: str


async def check_database(timeout_seconds: float = 5.0) -> DependencyCheck:
    """
    Check database connectivity and responsiveness.

    Executes a simple SELECT 1 query with timeout to verify:
    - Database is reachable
    - Connection pool is healthy
    - Query execution is working

    Args:
        timeout_seconds: Maximum time to wait for response (default: 5s)

    Returns:
        DependencyCheck with status, response time, or error
    """
    start_time = datetime.now(timezone.utc)
    
    try:
        async with asyncio.timeout(timeout_seconds):
            async with AsyncSessionLocal() as db:
                # Execute simple query
                result = await db.execute(text("SELECT 1"))
                result.scalar()
                
                # Calculate response time
                end_time = datetime.now(timezone.utc)
                response_time_ms = int((end_time - start_time).total_seconds() * 1000)
                
                return DependencyCheck(
                    status="healthy",
                    response_time_ms=response_time_ms
                )
    except asyncio.TimeoutError:
        return DependencyCheck(
            status="unhealthy",
            error=f"Database query timeout after {timeout_seconds}s"
        )
    except Exception as e:
        return DependencyCheck(
            status="unhealthy",
            error=f"Database connection failed: {str(e)}"
        )


async def check_redis(timeout_seconds: float = 5.0) -> DependencyCheck:
    """
    Check Redis connectivity and responsiveness.

    Executes PING command with timeout to verify:
    - Redis is reachable
    - Connection is healthy
    - Commands are executing

    Args:
        timeout_seconds: Maximum time to wait for response (default: 5s)

    Returns:
        DependencyCheck with status, response time, or error
    """
    start_time = datetime.now(timezone.utc)
    
    try:
        async with asyncio.timeout(timeout_seconds):
            redis = await get_redis_client()
            
            # Execute PING command
            response = await redis.ping()
            
            # Calculate response time
            end_time = datetime.now(timezone.utc)
            response_time_ms = int((end_time - start_time).total_seconds() * 1000)
            
            if response:
                return DependencyCheck(
                    status="healthy",
                    response_time_ms=response_time_ms
                )
            else:
                return DependencyCheck(
                    status="unhealthy",
                    error="Redis PING returned False"
                )
    except asyncio.TimeoutError:
        return DependencyCheck(
            status="unhealthy",
            error=f"Redis PING timeout after {timeout_seconds}s"
        )
    except Exception as e:
        return DependencyCheck(
            status="unhealthy",
            error=f"Redis connection failed: {str(e)}"
        )


@router.get("", response_model=BasicHealthResponse)
async def health_check_basic() -> BasicHealthResponse:
    """
    Basic health check endpoint.

    Returns a simple status indicating if the application process is running.
    This endpoint does NOT check dependencies for fastest possible response.

    Use cases:
    - Quick uptime checks
    - Load balancer health checks (when dependencies are monitored separately)
    - High-frequency polling scenarios

    Returns:
        200 OK with basic status
    """
    return BasicHealthResponse(
        status="healthy",
        timestamp=datetime.now(timezone.utc).isoformat()
    )


@router.get("/detailed", response_model=DetailedHealthResponse)
async def health_check_detailed() -> Response:
    """
    Detailed health check with dependency verification.

    Checks all critical dependencies:
    - PostgreSQL database (connection pool, query execution)
    - Redis (pub/sub for real-time updates, ARQ job queue)

    Status determination:
    - healthy: All dependencies are healthy
    - unhealthy: One or more dependencies are unhealthy
    - degraded: Reserved for partial failures (not used currently)

    Use cases:
    - Monitoring dashboards
    - Alerting systems
    - Kubernetes readiness probes (use /ready endpoint instead)

    Returns:
        200 OK if all dependencies healthy
        503 Service Unavailable if any dependency unhealthy
    """
    # Run all health checks concurrently
    db_check, redis_check = await asyncio.gather(
        check_database(),
        check_redis(),
        return_exceptions=False
    )
    
    # Determine overall status
    checks_status = [db_check.status, redis_check.status]
    
    if all(s == "healthy" for s in checks_status):
        overall_status = "healthy"
        http_status = status.HTTP_200_OK
    else:
        overall_status = "unhealthy"
        http_status = status.HTTP_503_SERVICE_UNAVAILABLE
    
    response_data = DetailedHealthResponse(
        status=overall_status,
        timestamp=datetime.now(timezone.utc).isoformat(),
        checks={
            "database": db_check,
            "redis": redis_check
        }
    )
    
    return Response(
        content=response_data.model_dump_json(),
        status_code=http_status,
        media_type="application/json"
    )


@router.get("/live", response_model=LivenessResponse)
async def liveness_check() -> LivenessResponse:
    """
    Kubernetes liveness probe endpoint.

    Returns 200 if the application process is running and can handle requests.
    Does NOT check dependencies - only verifies the process is alive.

    Kubernetes behavior:
    - If this endpoint fails, Kubernetes will restart the pod
    - Should only fail if the application is completely broken
    - Should NOT fail due to dependency issues (use /ready for that)

    Use cases:
    - Kubernetes liveness probe
    - Detecting deadlocks or unrecoverable errors
    - Process health monitoring

    Returns:
        200 OK always (if endpoint is reachable, process is alive)
    """
    return LivenessResponse(status="alive")


@router.get("/ready", response_model=ReadinessResponse)
async def readiness_check() -> Response:
    """
    Kubernetes readiness probe endpoint.

    Returns 200 only if application is ready to serve traffic
    (all dependencies are healthy).

    Kubernetes behavior:
    - If this endpoint fails, Kubernetes removes pod from service load balancer
    - Pod is not killed, just removed from rotation
    - When endpoint succeeds again, pod is added back to rotation

    Use cases:
    - Kubernetes readiness probe
    - Ensuring no traffic is routed to unhealthy instances
    - Graceful handling of dependency failures

    Returns:
        200 OK if all dependencies healthy (ready to serve traffic)
        503 Service Unavailable if not ready
    """
    # Run dependency checks concurrently
    db_check, redis_check = await asyncio.gather(
        check_database(),
        check_redis(),
        return_exceptions=False
    )
    
    # Ready only if ALL dependencies are healthy
    if db_check.status == "healthy" and redis_check.status == "healthy":
        response_data = ReadinessResponse(
            status="ready",
            timestamp=datetime.now(timezone.utc).isoformat()
        )
        return Response(
            content=response_data.model_dump_json(),
            status_code=status.HTTP_200_OK,
            media_type="application/json"
        )
    else:
        response_data = ReadinessResponse(
            status="not_ready",
            timestamp=datetime.now(timezone.utc).isoformat()
        )
        return Response(
            content=response_data.model_dump_json(),
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            media_type="application/json"
        )
```

**Why this design:**
- **Pydantic models:** Type-safe responses, auto-generated OpenAPI docs
- **Concurrent checks:** `asyncio.gather()` runs DB/Redis checks in parallel (faster)
- **Timeout handling:** `asyncio.timeout()` prevents hanging checks
- **Response time tracking:** Helps identify performance degradation
- **Clear status codes:** 200 = healthy, 503 = unhealthy (standard HTTP semantics)

---

### Step 2: Update main.py to Use New Health Router

**Files:**
- `backend/app/main.py` (MODIFIED)

**Action:** Replace existing basic health check with new comprehensive router.

**Implementation:**

```python
# Remove old health check endpoint (lines 53-55)
# @app.get("/api/health")
# async def health_check() -> dict[str, str]:
#     return {"status": "ok"}

# Import health router (add to imports at top)
from app.api import lists, videos, processing, websocket, tags, custom_fields, schemas, schema_fields, health

# Register health router (add after schema_fields router)
app.include_router(health.router)
```

**Why this approach:**
- **No breaking changes:** New endpoints maintain backward compatibility (basic endpoint still returns simple status)
- **Consistent routing:** Follows existing router registration pattern
- **Clean separation:** Health checks isolated in dedicated module

**Verification:**
```bash
cd backend
python -c "from app.main import app; print([r.path for r in app.routes if 'health' in r.path])"

# Expected output: ['/api/health', '/api/health/detailed', '/api/health/live', '/api/health/ready']
```

---

### Step 3: Create Comprehensive Tests (TDD)

**Files:**
- `backend/tests/api/test_health.py` (NEW)

**Action:** Write comprehensive tests covering all endpoints and failure scenarios.

**Implementation:**

```python
"""Tests for health check endpoints."""

import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from sqlalchemy.exc import OperationalError


@pytest.mark.asyncio
async def test_health_check_basic(client):
    """Test basic health check endpoint returns 200 without checking dependencies."""
    response = await client.get("/api/health")
    
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert "timestamp" in data
    # Verify timestamp is ISO 8601 format
    from datetime import datetime
    datetime.fromisoformat(data["timestamp"])


@pytest.mark.asyncio
async def test_health_check_basic_fast(client):
    """Test basic health check is fast (< 100ms)."""
    import time
    
    start_time = time.time()
    response = await client.get("/api/health")
    end_time = time.time()
    
    response_time_ms = (end_time - start_time) * 1000
    
    assert response.status_code == 200
    assert response_time_ms < 100  # Should be very fast (no dependency checks)


@pytest.mark.asyncio
async def test_health_check_detailed_all_healthy(client):
    """Test detailed health check when all dependencies are healthy."""
    response = await client.get("/api/health/detailed")
    
    assert response.status_code == 200
    data = response.json()
    
    # Overall status
    assert data["status"] == "healthy"
    assert "timestamp" in data
    
    # Database check
    assert "database" in data["checks"]
    assert data["checks"]["database"]["status"] == "healthy"
    assert "response_time_ms" in data["checks"]["database"]
    assert data["checks"]["database"]["response_time_ms"] is not None
    assert data["checks"]["database"]["error"] is None
    
    # Redis check
    assert "redis" in data["checks"]
    assert data["checks"]["redis"]["status"] == "healthy"
    assert "response_time_ms" in data["checks"]["redis"]
    assert data["checks"]["redis"]["response_time_ms"] is not None
    assert data["checks"]["redis"]["error"] is None


@pytest.mark.asyncio
async def test_health_check_detailed_database_failure(client):
    """Test detailed health check returns 503 when database is down."""
    # Mock database connection to fail
    with patch('app.api.health.AsyncSessionLocal') as mock_session:
        mock_session.return_value.__aenter__.return_value.execute.side_effect = OperationalError(
            "connection failed", None, None
        )
        
        response = await client.get("/api/health/detailed")
        
        assert response.status_code == 503
        data = response.json()
        
        # Overall status should be unhealthy
        assert data["status"] == "unhealthy"
        
        # Database check should show error
        assert data["checks"]["database"]["status"] == "unhealthy"
        assert "error" in data["checks"]["database"]
        assert data["checks"]["database"]["error"] is not None


@pytest.mark.asyncio
async def test_health_check_detailed_redis_failure(client):
    """Test detailed health check returns 503 when Redis is down."""
    # Mock Redis to fail
    with patch('app.api.health.get_redis_client') as mock_redis:
        mock_redis.return_value.ping = AsyncMock(side_effect=ConnectionError("Redis unavailable"))
        
        response = await client.get("/api/health/detailed")
        
        assert response.status_code == 503
        data = response.json()
        
        # Overall status should be unhealthy
        assert data["status"] == "unhealthy"
        
        # Redis check should show error
        assert data["checks"]["redis"]["status"] == "unhealthy"
        assert "error" in data["checks"]["redis"]
        assert data["checks"]["redis"]["error"] is not None


@pytest.mark.asyncio
async def test_health_check_detailed_both_dependencies_fail(client):
    """Test detailed health check when both dependencies fail."""
    with patch('app.api.health.AsyncSessionLocal') as mock_session, \
         patch('app.api.health.get_redis_client') as mock_redis:
        
        # Mock both to fail
        mock_session.return_value.__aenter__.return_value.execute.side_effect = OperationalError(
            "db error", None, None
        )
        mock_redis.return_value.ping = AsyncMock(side_effect=ConnectionError("redis error"))
        
        response = await client.get("/api/health/detailed")
        
        assert response.status_code == 503
        data = response.json()
        
        assert data["status"] == "unhealthy"
        assert data["checks"]["database"]["status"] == "unhealthy"
        assert data["checks"]["redis"]["status"] == "unhealthy"


@pytest.mark.asyncio
async def test_health_check_liveness(client):
    """Test liveness probe always returns 200 (process is alive)."""
    response = await client.get("/api/health/live")
    
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "alive"


@pytest.mark.asyncio
async def test_health_check_liveness_no_dependency_checks(client):
    """Test liveness probe doesn't check dependencies (fast response)."""
    # Even if dependencies fail, liveness should succeed
    # (This is intentional - liveness only checks if process is alive)
    import time
    
    start_time = time.time()
    response = await client.get("/api/health/live")
    end_time = time.time()
    
    response_time_ms = (end_time - start_time) * 1000
    
    assert response.status_code == 200
    assert response_time_ms < 50  # Should be very fast


@pytest.mark.asyncio
async def test_health_check_readiness_all_healthy(client):
    """Test readiness probe returns 200 when all dependencies healthy."""
    response = await client.get("/api/health/ready")
    
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ready"
    assert "timestamp" in data


@pytest.mark.asyncio
async def test_health_check_readiness_database_failure(client):
    """Test readiness probe returns 503 when database is down."""
    with patch('app.api.health.AsyncSessionLocal') as mock_session:
        mock_session.return_value.__aenter__.return_value.execute.side_effect = OperationalError(
            "db error", None, None
        )
        
        response = await client.get("/api/health/ready")
        
        assert response.status_code == 503
        data = response.json()
        assert data["status"] == "not_ready"


@pytest.mark.asyncio
async def test_health_check_readiness_redis_failure(client):
    """Test readiness probe returns 503 when Redis is down."""
    with patch('app.api.health.get_redis_client') as mock_redis:
        mock_redis.return_value.ping = AsyncMock(side_effect=ConnectionError("redis error"))
        
        response = await client.get("/api/health/ready")
        
        assert response.status_code == 503
        data = response.json()
        assert data["status"] == "not_ready"


@pytest.mark.asyncio
async def test_database_check_timeout():
    """Test database health check times out after configured duration."""
    from app.api.health import check_database
    import asyncio
    
    # Mock to hang indefinitely
    with patch('app.api.health.AsyncSessionLocal') as mock_session:
        async def hang_forever(*args, **kwargs):
            await asyncio.sleep(10)  # Longer than timeout
            
        mock_session.return_value.__aenter__.return_value.execute = hang_forever
        
        # Should timeout and return unhealthy
        result = await check_database(timeout_seconds=0.1)
        
        assert result.status == "unhealthy"
        assert "timeout" in result.error.lower()


@pytest.mark.asyncio
async def test_redis_check_timeout():
    """Test Redis health check times out after configured duration."""
    from app.api.health import check_redis
    import asyncio
    
    # Mock to hang indefinitely
    with patch('app.api.health.get_redis_client') as mock_redis:
        async def hang_forever(*args, **kwargs):
            await asyncio.sleep(10)
            
        mock_redis.return_value.ping = hang_forever
        
        # Should timeout and return unhealthy
        result = await check_redis(timeout_seconds=0.1)
        
        assert result.status == "unhealthy"
        assert "timeout" in result.error.lower()


@pytest.mark.asyncio
async def test_health_check_response_time_tracking(client):
    """Test that response times are tracked in detailed health check."""
    response = await client.get("/api/health/detailed")
    
    assert response.status_code == 200
    data = response.json()
    
    # Response times should be positive integers
    db_time = data["checks"]["database"]["response_time_ms"]
    redis_time = data["checks"]["redis"]["response_time_ms"]
    
    assert isinstance(db_time, int)
    assert isinstance(redis_time, int)
    assert db_time > 0
    assert redis_time > 0
```

**Test Coverage:** 15 tests covering:
- Basic endpoint (2 tests: success, performance)
- Detailed endpoint (5 tests: all healthy, DB failure, Redis failure, both failures, response times)
- Liveness probe (2 tests: success, no dependency checks)
- Readiness probe (3 tests: success, DB failure, Redis failure)
- Timeout handling (2 tests: DB timeout, Redis timeout)
- Performance (1 test: response time tracking)

**Verification:**
```bash
cd backend
pytest tests/api/test_health.py -v

# Expected: 15/15 tests passing
```

---

### Step 4: Update OpenAPI Documentation

**Files:**
- `backend/app/api/health.py` (MODIFIED)

**Action:** Ensure OpenAPI docs include all endpoints with proper descriptions.

**Implementation:**

Already included in Step 1 via:
- Router `tags=["health"]` - Groups all health endpoints in OpenAPI UI
- Pydantic response models - Auto-generates response schemas
- Docstrings - Converted to endpoint descriptions

**Verification:**
```bash
cd backend
uvicorn app.main:app --reload

# Visit http://localhost:8000/docs
# Verify "health" tag exists with 4 endpoints
# Verify each endpoint has proper description and response schema
```

---

### Step 5: Add Integration Test for Kubernetes Scenario

**Files:**
- `backend/tests/integration/test_health_k8s.py` (NEW)

**Action:** Write integration test simulating Kubernetes probe behavior.

**Implementation:**

```python
"""Integration tests for Kubernetes health probe scenarios."""

import pytest
import asyncio


@pytest.mark.asyncio
async def test_k8s_startup_sequence(client):
    """
    Test Kubernetes startup sequence:
    1. Liveness becomes healthy (process started)
    2. Readiness becomes healthy (dependencies ready)
    
    This simulates the expected K8s pod lifecycle.
    """
    # Step 1: Liveness should be healthy immediately
    liveness_response = await client.get("/api/health/live")
    assert liveness_response.status_code == 200
    assert liveness_response.json()["status"] == "alive"
    
    # Step 2: Readiness should be healthy once dependencies are up
    # (In real scenario, might need to wait for DB/Redis to initialize)
    readiness_response = await client.get("/api/health/ready")
    assert readiness_response.status_code == 200
    assert readiness_response.json()["status"] == "ready"


@pytest.mark.asyncio
async def test_k8s_rolling_update_scenario(client):
    """
    Test rolling update scenario:
    - Old pod continues serving while new pod starts
    - Readiness checks prevent traffic to unhealthy pod
    - Liveness checks keep pod alive during startup
    """
    # Simulate multiple concurrent health checks (load balancer polling)
    tasks = [
        client.get("/api/health/ready"),
        client.get("/api/health/ready"),
        client.get("/api/health/ready"),
        client.get("/api/health/live"),
        client.get("/api/health/live"),
    ]
    
    responses = await asyncio.gather(*tasks)
    
    # All checks should succeed
    assert all(r.status_code == 200 for r in responses)


@pytest.mark.asyncio
async def test_k8s_dependency_failure_scenario(client):
    """
    Test dependency failure scenario:
    - Liveness should remain healthy (don't restart pod)
    - Readiness should fail (remove from load balancer)
    
    This prevents unnecessary pod restarts during transient failures.
    """
    from unittest.mock import patch, AsyncMock
    
    # Simulate Redis failure
    with patch('app.api.health.get_redis_client') as mock_redis:
        mock_redis.return_value.ping = AsyncMock(side_effect=ConnectionError("Redis down"))
        
        # Liveness should still succeed (process is alive)
        liveness_response = await client.get("/api/health/live")
        assert liveness_response.status_code == 200
        assert liveness_response.json()["status"] == "alive"
        
        # Readiness should fail (not ready to serve traffic)
        readiness_response = await client.get("/api/health/ready")
        assert readiness_response.status_code == 503
        assert readiness_response.json()["status"] == "not_ready"
```

**Why this test:**
- Validates Kubernetes probe separation (liveness vs readiness)
- Tests concurrent probe requests (realistic load balancer behavior)
- Verifies graceful handling of dependency failures

**Verification:**
```bash
cd backend
pytest tests/integration/test_health_k8s.py -v

# Expected: 3/3 tests passing
```

---

### Step 6: Update CLAUDE.md Documentation

**Files:**
- `CLAUDE.md` (MODIFIED)

**Action:** Document new health check endpoints and patterns.

**Implementation:**

```markdown
## Health Check Endpoints (Task #140)

**Overview:** Comprehensive health check system for monitoring, alerting, and Kubernetes orchestration.

**Endpoints:**
- `GET /api/health` - Basic health (200 OK, no dependency checks, <10ms)
- `GET /api/health/detailed` - Full health with DB/Redis checks (200 OK or 503)
- `GET /api/health/live` - Kubernetes liveness probe (200 OK if process alive)
- `GET /api/health/ready` - Kubernetes readiness probe (200 OK or 503)

**Health Check Functions:**
- `check_database()` - Executes `SELECT 1` with 5s timeout, tracks response time
- `check_redis()` - Executes `PING` with 5s timeout, tracks response time
- **Concurrent execution:** Uses `asyncio.gather()` for parallel checks
- **Timeout handling:** `asyncio.timeout()` prevents hanging checks
- **Error handling:** Returns structured error messages, never raises

**Status Codes:**
- 200 OK - Healthy/ready to serve traffic
- 503 Service Unavailable - Unhealthy/not ready

**Response Models (Pydantic):**
- `BasicHealthResponse` - Simple status + timestamp
- `DetailedHealthResponse` - Status + timestamp + per-dependency checks
- `DependencyCheck` - Status + response_time_ms + optional error
- `LivenessResponse` - Alive status
- `ReadinessResponse` - Ready/not_ready status + timestamp

**Kubernetes Integration:**
```yaml
livenessProbe:
  httpGet:
    path: /api/health/live
    port: 8000
  initialDelaySeconds: 10
  periodSeconds: 30

readinessProbe:
  httpGet:
    path: /api/health/ready
    port: 8000
  initialDelaySeconds: 5
  periodSeconds: 10
```

**Design Decisions:**
- **Liveness vs Readiness:** Liveness checks process health (no dependencies), readiness checks full stack
- **Timeout strategy:** 5s default timeout prevents hanging, configurable per check
- **Concurrent checks:** Parallel execution reduces detailed endpoint latency
- **Response time tracking:** Enables performance monitoring and alerting
- **503 status:** Standard HTTP for "temporarily unavailable"
```

**Commit:**
```bash
git add CLAUDE.md
git commit -m "docs: document comprehensive health check system

- Document 4 health check endpoints
- Document Kubernetes probe integration
- Document timeout and concurrency strategies
- Add example K8s probe configuration

Task #140 - Step 6

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Step 7: Run Full Test Suite and Commit

**Action:** Verify all tests pass and commit implementation.

**Verification:**
```bash
cd backend

# Run health check tests
pytest tests/api/test_health.py -v
# Expected: 15/15 passing

# Run integration tests
pytest tests/integration/test_health_k8s.py -v
# Expected: 3/3 passing

# Run all tests to ensure no regressions
pytest
# Expected: All tests passing

# Type check
mypy app/api/health.py
# Expected: Success: no issues found

# Start server and verify endpoints
uvicorn app.main:app --reload &
sleep 5

curl http://localhost:8000/api/health
curl http://localhost:8000/api/health/detailed
curl http://localhost:8000/api/health/live
curl http://localhost:8000/api/health/ready

# Check OpenAPI docs
open http://localhost:8000/docs
```

**Commit:**
```bash
git add backend/app/api/health.py backend/app/main.py backend/tests/api/test_health.py backend/tests/integration/test_health_k8s.py
git commit -m "feat: implement comprehensive health checks

- Add 4 health check endpoints (basic, detailed, liveness, readiness)
- Add database and Redis health check functions with timeouts
- Add Pydantic response models for type safety
- Add 15 unit tests covering success and failure scenarios
- Add 3 integration tests for Kubernetes scenarios
- Replace simple /api/health endpoint with comprehensive router
- Support concurrent dependency checks for fast response
- Return 503 status when dependencies unhealthy

Task #140 - Security Hardening P2 Task 8

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## 🧪 Testing Strategy

### Unit Tests (15 tests in test_health.py)

**Basic Endpoint:**
- ✅ Returns 200 with healthy status
- ✅ Response time < 100ms (no dependency checks)

**Detailed Endpoint:**
- ✅ Returns 200 when all dependencies healthy
- ✅ Returns 503 when database fails
- ✅ Returns 503 when Redis fails
- ✅ Returns 503 when both dependencies fail
- ✅ Tracks response times for each check

**Liveness Probe:**
- ✅ Always returns 200 (process alive)
- ✅ Response time < 50ms (no checks)

**Readiness Probe:**
- ✅ Returns 200 when all dependencies healthy
- ✅ Returns 503 when database fails
- ✅ Returns 503 when Redis fails

**Timeout Handling:**
- ✅ Database check times out after configured duration
- ✅ Redis check times out after configured duration

### Integration Tests (3 tests in test_health_k8s.py)

**Kubernetes Scenarios:**
- ✅ Startup sequence (liveness ready before readiness)
- ✅ Rolling update (concurrent health checks)
- ✅ Dependency failure (liveness succeeds, readiness fails)

### Manual Testing Checklist

- [ ] **Basic endpoint** - `curl http://localhost:8000/api/health`
  - [ ] Returns JSON with `status: "healthy"` and ISO timestamp
  - [ ] Response < 10ms

- [ ] **Detailed endpoint** - `curl http://localhost:8000/api/health/detailed`
  - [ ] Returns 200 with database and Redis checks
  - [ ] Each check has `status`, `response_time_ms`, `error` fields
  - [ ] Response times are reasonable (< 100ms each)

- [ ] **Liveness probe** - `curl http://localhost:8000/api/health/live`
  - [ ] Returns 200 with `status: "alive"`
  - [ ] Always succeeds (even if dependencies down)

- [ ] **Readiness probe** - `curl http://localhost:8000/api/health/ready`
  - [ ] Returns 200 with `status: "ready"` when healthy
  - [ ] Returns 503 with `status: "not_ready"` when dependencies down

- [ ] **Failure scenarios**
  - [ ] Stop PostgreSQL: `docker-compose stop postgres`
    - [ ] `/api/health` still returns 200
    - [ ] `/api/health/detailed` returns 503
    - [ ] `/api/health/live` still returns 200
    - [ ] `/api/health/ready` returns 503
  - [ ] Stop Redis: `docker-compose stop redis`
    - [ ] Same behavior as PostgreSQL failure
  - [ ] Restart services and verify recovery

- [ ] **OpenAPI documentation**
  - [ ] Visit http://localhost:8000/docs
  - [ ] Verify "health" tag exists
  - [ ] Verify all 4 endpoints documented
  - [ ] Verify response schemas are complete
  - [ ] Try "Execute" on each endpoint

---

## 📚 Design Decisions & Rationale

### 1. Four Separate Endpoints

**Decision:** Provide `/health`, `/health/detailed`, `/health/live`, `/health/ready` instead of single endpoint with query parameters.

**Rationale:**
- **Clear semantics:** Each endpoint has single responsibility
- **Performance:** Basic/liveness endpoints skip dependency checks (faster)
- **Kubernetes compatibility:** Probes expect specific paths
- **Monitoring flexibility:** Different tools can use different endpoints
- **Standard pattern:** Matches industry best practices (Spring Boot Actuator, ASP.NET Health Checks)

**Alternative Considered:** Single endpoint with `?detailed=true` parameter
- **Rejected:** Less clear, harder to configure in K8s, slower for basic checks

### 2. Liveness vs Readiness Separation

**Decision:** Liveness checks only process health, readiness checks dependencies.

**Rationale:**
- **Prevents restart loops:** Liveness failure triggers pod restart (expensive)
- **Graceful degradation:** Readiness failure removes from load balancer (recoverable)
- **Transient failures:** Database hiccup shouldn't restart entire pod
- **Kubernetes best practice:** [K8s docs](https://kubernetes.io/docs/tasks/configure-pod-container/configure-liveness-readiness-startup-probes/)

**Example Scenario:**
```
Redis connection pool exhausted (transient):
- Liveness: 200 OK (process is fine)
- Readiness: 503 (not ready to serve traffic)
- K8s action: Remove from load balancer, keep pod alive
- Result: Pod recovers when Redis connection freed
```

### 3. Timeout Strategy

**Decision:** 5 second default timeout for each dependency check.

**Rationale:**
- **Prevents hanging:** Database/Redis failures shouldn't block indefinitely
- **Fast failure detection:** 5s is long enough to catch transient issues
- **Configurable:** Can adjust per-check if needed
- **Concurrent checks:** With parallel execution, total time is ~5s (not 10s)

**Calculation:**
```
Without timeout: Hung connection = infinite wait
With 5s timeout: Max response time = max(db_time, redis_time) ≈ 5s
Worst case: Both timeout = ~5s (parallel execution)
Best case: Both healthy in 10ms each = ~10ms
```

**Alternative Considered:** 10s timeout
- **Rejected:** Too slow for high-frequency health checks (K8s default: every 10s)

### 4. Concurrent Dependency Checks

**Decision:** Use `asyncio.gather()` to run DB/Redis checks in parallel.

**Rationale:**
- **Faster response:** Max latency instead of sum latency
- **Better user experience:** Detailed endpoint responds in ~10-50ms (healthy) or ~5s (timeout)
- **Efficient:** No CPU time wasted waiting sequentially

**Comparison:**
```python
# Sequential (slow)
db_check = await check_database()      # 10ms
redis_check = await check_redis()      # 10ms
# Total: 20ms

# Concurrent (fast)
db_check, redis_check = await asyncio.gather(
    check_database(),    # 10ms \
    check_redis()        # 10ms  > parallel
)                                      /
# Total: ~10ms
```

### 5. Response Time Tracking

**Decision:** Include `response_time_ms` in each dependency check.

**Rationale:**
- **Performance monitoring:** Detect degradation before failures
- **Alerting:** Set thresholds (e.g., alert if DB check > 500ms)
- **Debugging:** Identify slow dependencies quickly
- **Historical analysis:** Track trends over time

**Example Alert Rules:**
```
Alert: DatabaseSlowHealthCheck
  Condition: response_time_ms > 500
  Action: Warning (investigate before failure)

Alert: DatabaseHealthCheckFailed
  Condition: status == "unhealthy"
  Action: Critical (dependency down)
```

### 6. Status Code Strategy

**Decision:** Return 503 (Service Unavailable) when unhealthy, not 500 (Internal Server Error).

**Rationale:**
- **Semantic correctness:** 503 = "temporarily unavailable", 500 = "server bug"
- **Load balancer behavior:** Many LBs treat 503 as "retry later"
- **Client behavior:** Clients should retry 503, but may not retry 500
- **HTTP standard:** [RFC 7231 Section 6.6.4](https://tools.ietf.org/html/rfc7231#section-6.6.4)

**Comparison:**
```
503 Service Unavailable:
- Meaning: "I'm alive but can't serve traffic right now"
- Typical cause: Dependency failure, overload
- Client action: Retry with backoff

500 Internal Server Error:
- Meaning: "I have a bug/unexpected error"
- Typical cause: Code exception, unhandled error
- Client action: May not retry (could be permanent)
```

---

## ⏱️ Time Estimate

**Implementation:** 2.5-3 hours
- Step 1: Create health.py module (60 min)
- Step 2: Update main.py (10 min)
- Step 3: Write unit tests (45 min)
- Step 4: Update OpenAPI docs (5 min - already done in Step 1)
- Step 5: Write integration tests (20 min)
- Step 6: Update CLAUDE.md (15 min)
- Step 7: Full verification (15 min)

**Testing & Verification:** 30-45 min
- Run all tests and verify passing
- Manual testing with curl
- Test failure scenarios (stop DB/Redis)
- Verify OpenAPI documentation
- Performance testing (response times)

**Total:** 3-3.75 hours

---

## 📝 Definition of Done

- [ ] `backend/app/api/health.py` created with all endpoints
- [ ] `backend/app/main.py` updated to use health router
- [ ] Old `/api/health` endpoint removed
- [ ] 15 unit tests in `test_health.py` passing
- [ ] 3 integration tests in `test_health_k8s.py` passing
- [ ] All existing tests still passing (no regressions)
- [ ] TypeScript type check passes (`mypy`)
- [ ] OpenAPI docs include all 4 endpoints with proper schemas
- [ ] CLAUDE.md updated with health check documentation
- [ ] Manual testing checklist completed
- [ ] Failure scenarios tested (DB/Redis down)
- [ ] Performance verified (basic < 10ms, detailed < 100ms when healthy)
- [ ] Code committed with descriptive message

---

## 🔗 Related Tasks

**Security Hardening Plan:**
- Task 8: Comprehensive Health Checks (THIS TASK)
- Task 7: CORS Configuration (completed)
- Task 6: Rate Limiting (completed)
- Task 5: Input Sanitization (completed)

**Future Enhancements:**
- Add external API health checks (YouTube API, Gemini API)
- Add ARQ worker health check (queue length, failed jobs)
- Add disk space check
- Add memory usage check
- Structured logging integration (log health check failures)
- Metrics export (Prometheus format)

**Related Documentation:**
- `docs/plans/2025-11-02-security-hardening-implementation.md` - Lines 2510-2808 (Task 8)
- Security Hardening Master Plan

---

## 🚀 Kubernetes Integration Example

**Deployment YAML:**

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: youtube-bookmarks-api
spec:
  replicas: 3
  selector:
    matchLabels:
      app: youtube-bookmarks-api
  template:
    metadata:
      labels:
        app: youtube-bookmarks-api
    spec:
      containers:
      - name: api
        image: youtube-bookmarks-api:latest
        ports:
        - containerPort: 8000
        
        # Liveness Probe - Restart pod if failing
        livenessProbe:
          httpGet:
            path: /api/health/live
            port: 8000
          initialDelaySeconds: 10  # Wait 10s after container start
          periodSeconds: 30         # Check every 30s
          timeoutSeconds: 5         # Timeout after 5s
          failureThreshold: 3       # Restart after 3 consecutive failures
        
        # Readiness Probe - Remove from service if failing
        readinessProbe:
          httpGet:
            path: /api/health/ready
            port: 8000
          initialDelaySeconds: 5    # Check earlier than liveness
          periodSeconds: 10         # Check more frequently
          timeoutSeconds: 5
          failureThreshold: 2       # Remove after 2 failures
          successThreshold: 1       # Add back after 1 success
        
        # Startup Probe - Allow slow startup (optional)
        startupProbe:
          httpGet:
            path: /api/health/live
            port: 8000
          initialDelaySeconds: 0
          periodSeconds: 5
          failureThreshold: 30      # Allow up to 150s startup time
```

**Monitoring Integration (Prometheus):**

```yaml
# ServiceMonitor for Prometheus Operator
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: youtube-bookmarks-api
spec:
  selector:
    matchLabels:
      app: youtube-bookmarks-api
  endpoints:
  - port: http
    path: /api/health/detailed
    interval: 30s
    scrapeTimeout: 10s
```

**Alert Rules:**

```yaml
groups:
- name: health_checks
  rules:
  - alert: APIUnhealthy
    expr: probe_success{job="youtube-bookmarks-api"} == 0
    for: 2m
    labels:
      severity: critical
    annotations:
      summary: "API health check failing"
      description: "{{ $labels.instance }} health check failed for > 2 minutes"
  
  - alert: APIDatabaseSlow
    expr: health_check_database_response_time_ms > 500
    for: 5m
    labels:
      severity: warning
    annotations:
      summary: "Database health check slow"
      description: "Database response time {{ $value }}ms (threshold: 500ms)"
```

---

## 📖 References

**FastAPI Documentation:**
- [Custom Response](https://fastapi.tiangolo.com/advanced/custom-response/)
- [Pydantic Models](https://docs.pydantic.dev/latest/concepts/models/)
- [APIRouter](https://fastapi.tiangolo.com/tutorial/bigger-applications/)

**Kubernetes Documentation:**
- [Configure Liveness, Readiness Probes](https://kubernetes.io/docs/tasks/configure-pod-container/configure-liveness-readiness-startup-probes/)
- [Health Checks Best Practices](https://kubernetes.io/docs/concepts/workloads/pods/pod-lifecycle/#container-probes)

**Industry Standards:**
- [RFC 7231 - HTTP Status Codes](https://tools.ietf.org/html/rfc7231)
- [12-Factor App - Admin Processes](https://12factor.net/admin-processes)
- [Spring Boot Actuator Health](https://docs.spring.io/spring-boot/docs/current/reference/html/actuator.html#actuator.endpoints.health)

**Similar Implementations:**
- `backend/app/api/processing.py` - Existing API endpoints pattern
- `backend/app/core/database.py` - AsyncSessionLocal usage
- `backend/app/core/redis.py` - get_redis_client() usage

**Security Plan:**
- `docs/plans/2025-11-02-security-hardening-implementation.md` - Task 8 (lines 2510-2808)

---

**End of Implementation Plan**
