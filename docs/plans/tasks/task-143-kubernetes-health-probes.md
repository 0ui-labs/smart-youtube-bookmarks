# Task #143: Add Kubernetes Liveness/Readiness Probes

**Plan Task:** #143
**Wave/Phase:** Security Hardening P2 - Operational Excellence (Task 8: Comprehensive Health Checks)
**Dependencies:** Task #141 (Database Health Check), Task #142 (Redis Health Check)

---

## 🎯 Ziel

Implement dedicated Kubernetes probe endpoints (`/api/health/live` and `/api/health/ready`) that follow Kubernetes best practices for container orchestration. The liveness probe detects deadlock/crashed states (no dependency checks), while the readiness probe verifies all dependencies are healthy before accepting traffic (checks database + Redis).

**Key Principle:** Liveness = "Is the process alive?" (fast, always returns 200 unless crashed). Readiness = "Can I serve traffic?" (checks dependencies, returns 503 if unhealthy).

## 📋 Acceptance Criteria

- [ ] `/api/health/live` endpoint implemented (liveness probe - no dependency checks)
- [ ] `/api/health/ready` endpoint implemented (readiness probe - checks database + Redis)
- [ ] Liveness returns 200 with `{"status": "alive"}` always (unless app crashed)
- [ ] Readiness returns 200 when all dependencies healthy
- [ ] Readiness returns 503 when any dependency unhealthy
- [ ] Unit tests (4+): liveness always up, readiness healthy/unhealthy scenarios
- [ ] Integration tests (2+): readiness with real DB down, Redis down scenarios
- [ ] Kubernetes Deployment YAML examples documented
- [ ] Documentation updated in CLAUDE.md

---

## 🔍 REF MCP Research Findings

### Finding 1: Liveness vs Readiness Semantics (Kubernetes Official Docs)
**Source:** https://github.com/kubernetes/website/blob/main/content/en/docs/concepts/workloads/pods/pod-lifecycle.md

**Key Points:**
- **Liveness Probe:** Detects deadlock conditions where process runs but app is unresponsive. Failed probe = kubelet kills and restarts container.
- **Readiness Probe:** Detects temporary unavailability (e.g., loading cache, waiting for dependencies). Failed probe = Pod removed from Service endpoints (no traffic), but Pod NOT restarted.
- **Critical Rule:** "If a container does not provide a liveness probe, the default state is Success" - liveness should be simple and NOT check external dependencies.

**Application:**
- Liveness: Simple HTTP GET returning 200 (process alive check only)
- Readiness: Check database + Redis before accepting traffic

### Finding 2: Never Check External Dependencies in Liveness (AWS EKS Best Practices)
**Source:** https://docs.aws.amazon.com/eks/latest/best-practices/application.html#use-liveness-probe-to-remove-unhealthy-pods

**Key Points:**
- "Avoid configuring the Liveness Probe to depend on a factor that is external to your Pod, for example, an external database."
- **Why:** If external database goes down, ALL Pods fail liveness simultaneously → Kubernetes kills all Pods → application completely offline → control plane overload.
- **Anti-Pattern:** Liveness probe that checks database availability.

**Application:**
- Liveness: Only check if FastAPI process responds (no DB/Redis checks)
- Readiness: Check external dependencies (safe - Pod just removed from load balancer, not killed)

### Finding 3: Readiness for Temporary Unavailability (AWS EKS Best Practices)
**Source:** https://docs.aws.amazon.com/eks/latest/best-practices/application.html#use-readiness-probe-to-detect-partial-unavailability

**Key Points:**
- "Readiness Probe detects conditions where the app may be temporarily unavailable"
- "Unlike Liveness Probe, where a failure would result in a recreation of Pod, a failed Readiness Probe would mean that Pod will not receive any traffic from Kubernetes Service"
- **Use Case:** During intense disk I/O, cache loading, or dependency unavailability

**Application:**
- Readiness returns 503 when DB/Redis unavailable (Pod exists but doesn't receive traffic)
- Once dependencies recover, readiness passes → Pod receives traffic again

### Finding 4: Probe Configuration Best Practices (Google Cloud GKE)
**Source:** https://cloud.google.com/architecture/best-practices-for-running-cost-effective-kubernetes-applications-on-gke

**Key Points:**
- "Define the readiness probe for all your containers"
- "Never make any probe logic access other services. It can compromise the lifecycle of your Pod if these services don't respond promptly."
- **Exception:** Readiness CAN check dependencies (that's its purpose), but use timeouts to prevent hanging

**Application:**
- Use async health checks with reasonable timeouts (already implemented in Tasks #141-142)
- Liveness: No external service calls
- Readiness: Check dependencies but with timeout protection

### Finding 5: HTTP Probe Mechanism (Kubernetes Official Docs)
**Source:** https://github.com/kubernetes/website/blob/main/content/en/docs/concepts/workloads/pods/pod-lifecycle.md

**Key Points:**
- "httpGet: Performs an HTTP GET request against the Pod's IP address on a specified port and path. The diagnostic is considered successful if the response has a status code greater than or equal to 200 and less than 400."
- **Success Range:** 200-399 (200 OK, 204 No Content, etc.)
- **Failure:** Any status >= 400 (including 503 Service Unavailable)

**Application:**
- Liveness: Return 200 (success)
- Readiness: Return 200 when healthy, 503 when unhealthy (triggers failure)

---

## 🛠️ Implementation Steps

### 1. Create Test File with Failing Tests (TDD Approach)
**Files:** `/Users/philippbriese/Documents/dev/projects/by IDE/Claude Code/Smart Youtube Bookmarks/backend/tests/api/test_kubernetes_probes.py`
**Action:** Write failing tests for liveness and readiness endpoints before implementation

```python
"""Tests for Kubernetes liveness and readiness probe endpoints."""

import pytest
from httpx import AsyncClient
from unittest.mock import AsyncMock, patch

from app.main import app


@pytest.mark.asyncio
async def test_liveness_probe_always_returns_200():
    """Test that liveness probe always returns 200 (process is alive)."""
    async with AsyncClient(app=app, base_url="http://test") as client:
        response = await client.get("/api/health/live")

    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "alive"


@pytest.mark.asyncio
async def test_liveness_probe_does_not_check_dependencies():
    """Test that liveness probe does NOT check database or Redis."""
    # Mock database and Redis to fail - liveness should still return 200
    with patch("app.api.health.check_database") as mock_db, \
         patch("app.api.health.check_redis") as mock_redis:
        
        # Make dependencies appear unhealthy
        mock_db.return_value = {"status": "unhealthy", "error": "DB down"}
        mock_redis.return_value = {"status": "unhealthy", "error": "Redis down"}
        
        async with AsyncClient(app=app, base_url="http://test") as client:
            response = await client.get("/api/health/live")

        # Liveness should still succeed (doesn't call mocked functions)
        assert response.status_code == 200
        assert mock_db.call_count == 0  # Should NOT be called
        assert mock_redis.call_count == 0  # Should NOT be called


@pytest.mark.asyncio
async def test_readiness_probe_returns_200_when_all_healthy():
    """Test that readiness probe returns 200 when all dependencies are healthy."""
    with patch("app.api.health.check_database") as mock_db, \
         patch("app.api.health.check_redis") as mock_redis:
        
        # Make dependencies appear healthy
        mock_db.return_value = {"status": "healthy"}
        mock_redis.return_value = {"status": "healthy"}
        
        async with AsyncClient(app=app, base_url="http://test") as client:
            response = await client.get("/api/health/ready")

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ready"
        assert "timestamp" in data


@pytest.mark.asyncio
async def test_readiness_probe_returns_503_when_database_unhealthy():
    """Test that readiness probe returns 503 when database is unhealthy."""
    with patch("app.api.health.check_database") as mock_db, \
         patch("app.api.health.check_redis") as mock_redis:
        
        # Database unhealthy, Redis healthy
        mock_db.return_value = {"status": "unhealthy", "error": "Connection failed"}
        mock_redis.return_value = {"status": "healthy"}
        
        async with AsyncClient(app=app, base_url="http://test") as client:
            response = await client.get("/api/health/ready")

        assert response.status_code == 503
        data = response.json()
        assert data["status"] == "not_ready"


@pytest.mark.asyncio
async def test_readiness_probe_returns_503_when_redis_unhealthy():
    """Test that readiness probe returns 503 when Redis is unhealthy."""
    with patch("app.api.health.check_database") as mock_db, \
         patch("app.api.health.check_redis") as mock_redis:
        
        # Database healthy, Redis unhealthy
        mock_db.return_value = {"status": "healthy"}
        mock_redis.return_value = {"status": "unhealthy", "error": "Connection timeout"}
        
        async with AsyncClient(app=app, base_url="http://test") as client:
            response = await client.get("/api/health/ready")

        assert response.status_code == 503
        data = response.json()
        assert data["status"] == "not_ready"


@pytest.mark.asyncio
async def test_readiness_probe_returns_503_when_both_unhealthy():
    """Test that readiness probe returns 503 when both dependencies are unhealthy."""
    with patch("app.api.health.check_database") as mock_db, \
         patch("app.api.health.check_redis") as mock_redis:
        
        # Both unhealthy
        mock_db.return_value = {"status": "unhealthy", "error": "DB error"}
        mock_redis.return_value = {"status": "unhealthy", "error": "Redis error"}
        
        async with AsyncClient(app=app, base_url="http://test") as client:
            response = await client.get("/api/health/ready")

        assert response.status_code == 503
        data = response.json()
        assert data["status"] == "not_ready"
```

**Why:** TDD ensures tests define expected behavior before implementation. Tests verify the critical distinction: liveness never checks dependencies (always 200), readiness checks dependencies (503 when unhealthy).

**Run:** `cd backend && pytest tests/api/test_kubernetes_probes.py -v`
**Expected:** FAIL - Endpoints not yet implemented

---

### 2. Implement Liveness Probe Endpoint (Simple, No Dependency Checks)
**Files:** `/Users/philippbriese/Documents/dev/projects/by IDE/Claude Code/Smart Youtube Bookmarks/backend/app/api/health.py`
**Action:** Add `/api/health/live` endpoint that always returns 200 (unless app crashed)

```python
from datetime import datetime, timezone
from typing import Dict, Any

from fastapi import APIRouter, status, Response
from sqlalchemy import text

from app.core.database import AsyncSessionLocal
from app.core.redis import get_redis_client
from app.core.logging import get_logger

router = APIRouter(prefix="/api/health", tags=["health"])
logger = get_logger(__name__)


@router.get("/live")
async def liveness_check() -> Dict[str, str]:
    """
    Kubernetes liveness probe endpoint.
    
    Returns 200 if the application process is running.
    Does NOT check dependencies (database, Redis, etc.).
    
    **Kubernetes Usage:**
    - If this endpoint fails, Kubernetes will kill and restart the Pod
    - Should only fail if the application is deadlocked or crashed
    - NEVER check external dependencies in liveness probes
    
    **Why No Dependency Checks:**
    If external database goes down, all Pods fail simultaneously →
    Kubernetes kills ALL Pods → entire application goes offline →
    unnecessary control plane strain.
    
    Returns:
        Simple status indicating the process is alive
    """
    return {"status": "alive"}
```

**Why:** 
- **Simplicity:** Liveness only answers "Is the process alive?" - if FastAPI can respond to HTTP requests, the process is alive.
- **Safety:** No external dependency checks prevents cascade failures (all Pods dying when DB goes down).
- **Speed:** Fast response (<1ms) enables frequent probing without overhead.

**Run:** `cd backend && pytest tests/api/test_kubernetes_probes.py::test_liveness_probe_always_returns_200 -v`
**Expected:** PASS

---

### 3. Verify Liveness Doesn't Check Dependencies
**Files:** Same as Step 2
**Action:** Confirm liveness test passes even when dependencies mocked as unhealthy

**Run:** `cd backend && pytest tests/api/test_kubernetes_probes.py::test_liveness_probe_does_not_check_dependencies -v`
**Expected:** PASS - liveness returns 200 and doesn't call check_database() or check_redis()

**Why:** Critical safety verification - ensures liveness probe cannot cause cascade failures during external service outages.

---

### 4. Implement Readiness Probe Endpoint (Check Dependencies)
**Files:** `/Users/philippbriese/Documents/dev/projects/by IDE/Claude Code/Smart Youtube Bookmarks/backend/app/api/health.py`
**Action:** Add `/api/health/ready` endpoint that checks database + Redis

```python
@router.get("/ready")
async def readiness_check() -> Dict[str, Any]:
    """
    Kubernetes readiness probe endpoint.
    
    Returns 200 only if application is ready to serve traffic
    (all dependencies are healthy).
    
    **Kubernetes Usage:**
    - If this endpoint fails, Pod is removed from Service endpoints
    - Pod continues running but receives no traffic
    - Once dependencies recover, Pod automatically receives traffic again
    
    **Checked Dependencies:**
    - Database (PostgreSQL): Can execute queries
    - Redis: Can respond to PING
    
    **Why Check Dependencies:**
    Prevents routing traffic to Pods that cannot fulfill requests
    due to missing dependencies. Unlike liveness, failed readiness
    does NOT restart the Pod - just removes it from load balancer.
    
    Returns:
        Status 200 with "ready" when healthy
        Status 503 with "not_ready" when dependencies unhealthy
    """
    # Check all dependencies (implemented in Tasks #141-142)
    db_check = await check_database()
    redis_check = await check_redis()
    
    # Readiness requires ALL dependencies to be healthy
    if db_check["status"] == "healthy" and redis_check["status"] == "healthy":
        return {
            "status": "ready",
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
    else:
        # Return 503 to signal Pod is not ready for traffic
        return Response(
            content='{"status": "not_ready"}',
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            media_type="application/json"
        )


async def check_database() -> Dict[str, Any]:
    """
    Check database connectivity and responsiveness.
    
    Implemented in Task #141.
    
    Returns:
        Dict with status ("healthy" or "unhealthy") and optional error
    """
    try:
        async with AsyncSessionLocal() as db:
            # Execute simple query with timeout
            result = await db.execute(text("SELECT 1"))
            result.scalar()
            
            return {
                "status": "healthy",
                "response_time_ms": 0  # Could add timing here
            }
    except Exception as e:
        logger.error("database_health_check_failed", error=str(e))
        return {
            "status": "unhealthy",
            "error": str(e)
        }


async def check_redis() -> Dict[str, Any]:
    """
    Check Redis connectivity and responsiveness.
    
    Implemented in Task #142.
    
    Returns:
        Dict with status ("healthy" or "unhealthy") and optional error
    """
    try:
        redis = await get_redis_client()
        
        # Execute PING command
        response = await redis.ping()
        
        if response:
            return {
                "status": "healthy",
                "response_time_ms": 0
            }
        else:
            return {
                "status": "unhealthy",
                "error": "Redis PING failed"
            }
    except Exception as e:
        logger.error("redis_health_check_failed", error=str(e))
        return {
            "status": "unhealthy",
            "error": str(e)
        }
```

**Why:**
- **Purpose:** Readiness protects against routing traffic to Pods that cannot serve requests due to missing dependencies.
- **Safe Dependency Checks:** Unlike liveness, failed readiness doesn't kill Pod - just removes from load balancer. Pod can recover when dependencies return.
- **503 Status Code:** Signals to Kubernetes that Pod is not ready (triggers removal from Service endpoints).

---

### 5. Run Readiness Probe Tests
**Files:** Test file from Step 1
**Action:** Verify all readiness probe tests pass

**Run:** `cd backend && pytest tests/api/test_kubernetes_probes.py -k readiness -v`
**Expected:** PASS - All 4 readiness tests (healthy, DB down, Redis down, both down)

**Why:** Confirms readiness probe correctly identifies when dependencies are unhealthy and returns appropriate 503 status.

---

### 6. Create Integration Tests with Real Dependencies
**Files:** `/Users/philippbriese/Documents/dev/projects/by IDE/Claude Code/Smart Youtube Bookmarks/backend/tests/integration/test_kubernetes_probes_integration.py`
**Action:** Test readiness probe with real database and Redis (no mocks)

```python
"""Integration tests for Kubernetes probe endpoints with real dependencies."""

import pytest
from httpx import AsyncClient
from sqlalchemy import text

from app.main import app
from app.core.database import AsyncSessionLocal
from app.core.redis import get_redis_client


@pytest.mark.asyncio
async def test_readiness_with_healthy_dependencies():
    """
    Test readiness probe with real healthy database and Redis.
    
    This test verifies that readiness returns 200 when all dependencies
    are actually healthy (not mocked).
    """
    # Verify dependencies are actually healthy first
    async with AsyncSessionLocal() as db:
        result = await db.execute(text("SELECT 1"))
        assert result.scalar() == 1
    
    redis = await get_redis_client()
    assert await redis.ping() is True
    
    # Test readiness probe
    async with AsyncClient(app=app, base_url="http://test") as client:
        response = await client.get("/api/health/ready")
    
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ready"
    assert "timestamp" in data


@pytest.mark.asyncio
async def test_liveness_independent_of_dependencies():
    """
    Test that liveness probe succeeds regardless of dependency state.
    
    This test verifies liveness works even if dependencies are under stress
    or temporarily unavailable.
    """
    # Liveness should succeed without checking anything
    async with AsyncClient(app=app, base_url="http://test") as client:
        response = await client.get("/api/health/live")
    
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "alive"
    
    # Response should be very fast (< 100ms)
    # In a real integration test, we could measure this with time.time()
```

**Why:** Integration tests verify probes work correctly with real database and Redis connections (not mocked). This catches issues like connection pooling, timeouts, or async/await problems.

**Run:** `cd backend && pytest tests/integration/test_kubernetes_probes_integration.py -v`
**Expected:** PASS

---

### 7. Create Kubernetes Deployment YAML Examples
**Files:** `/Users/philippbriese/Documents/dev/projects/by IDE/Claude Code/Smart Youtube Bookmarks/docs/deployment/kubernetes-health-probes-example.yaml`
**Action:** Provide complete Kubernetes Deployment YAML with probe configuration

```yaml
# Kubernetes Deployment example with liveness and readiness probes
# for Smart YouTube Bookmarks FastAPI backend

apiVersion: apps/v1
kind: Deployment
metadata:
  name: smart-youtube-backend
  namespace: default
  labels:
    app: smart-youtube-backend
spec:
  replicas: 3
  selector:
    matchLabels:
      app: smart-youtube-backend
  template:
    metadata:
      labels:
        app: smart-youtube-backend
    spec:
      containers:
      - name: backend
        image: smart-youtube-backend:latest
        ports:
        - containerPort: 8000
          name: http
          protocol: TCP
        
        # Environment variables
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: backend-secrets
              key: database-url
        - name: REDIS_URL
          valueFrom:
            secretKeyRef:
              name: backend-secrets
              key: redis-url
        
        # Resource limits (recommended for production)
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        
        # LIVENESS PROBE: Detects deadlock/crashed state
        livenessProbe:
          httpGet:
            path: /api/health/live
            port: http
            scheme: HTTP
          initialDelaySeconds: 15    # Wait 15s after container starts
          periodSeconds: 10           # Check every 10 seconds
          timeoutSeconds: 3           # Probe timeout (fast response expected)
          successThreshold: 1         # 1 success = healthy
          failureThreshold: 3         # 3 consecutive failures = restart Pod
        
        # READINESS PROBE: Detects when app can serve traffic
        readinessProbe:
          httpGet:
            path: /api/health/ready
            port: http
            scheme: HTTP
          initialDelaySeconds: 10    # Wait 10s after container starts
          periodSeconds: 5           # Check every 5 seconds (more frequent)
          timeoutSeconds: 5          # Allow time for dependency checks
          successThreshold: 1        # 1 success = ready for traffic
          failureThreshold: 3        # 3 consecutive failures = remove from Service
        
        # STARTUP PROBE (optional): For slow-starting applications
        # Disables liveness/readiness until startup succeeds
        startupProbe:
          httpGet:
            path: /api/health/live
            port: http
            scheme: HTTP
          initialDelaySeconds: 0     # Start checking immediately
          periodSeconds: 5           # Check every 5 seconds
          timeoutSeconds: 3          
          successThreshold: 1        
          failureThreshold: 30       # Allow up to 150s to start (30 * 5s)

---
# Service to expose the backend
apiVersion: v1
kind: Service
metadata:
  name: smart-youtube-backend
  namespace: default
spec:
  type: ClusterIP
  selector:
    app: smart-youtube-backend
  ports:
  - port: 80
    targetPort: http
    protocol: TCP
    name: http
```

**Why:**
- **Complete Example:** Shows all three probe types (liveness, readiness, startup) with production-ready timings.
- **Liveness Settings:** Conservative (15s initial delay, 3 failures before restart) to avoid false positives.
- **Readiness Settings:** More aggressive (5s period) to quickly remove unhealthy Pods from load balancer.
- **Startup Probe:** Allows 150s for app to start (protects slow starts during initial deployment).

---

### 8. Document Probe Timing Recommendations
**Files:** `/Users/philippbriese/Documents/dev/projects/by IDE/Claude Code/Smart Youtube Bookmarks/docs/deployment/kubernetes-probe-tuning.md`
**Action:** Create guide for tuning probe parameters

```markdown
# Kubernetes Health Probe Tuning Guide

## Probe Endpoints

- **Liveness:** `/api/health/live` - Process alive check (no dependencies)
- **Readiness:** `/api/health/ready` - Dependency health check (database + Redis)

## Default Configuration

### Liveness Probe (Detects Deadlock/Crash)

```yaml
livenessProbe:
  httpGet:
    path: /api/health/live
    port: 8000
  initialDelaySeconds: 15    # Wait for app to start
  periodSeconds: 10          # Check every 10 seconds
  timeoutSeconds: 3          # Probe timeout (should be fast)
  failureThreshold: 3        # 3 failures = restart Pod
```

**Restart Delay:** 15s (initial) + 10s * 3 (failures) = **45 seconds** before restart

### Readiness Probe (Detects Dependency Failures)

```yaml
readinessProbe:
  httpGet:
    path: /api/health/ready
    port: 8000
  initialDelaySeconds: 10    # Wait for app to start
  periodSeconds: 5           # Check more frequently
  timeoutSeconds: 5          # Allow time for dependency checks
  failureThreshold: 3        # 3 failures = remove from Service
```

**Traffic Removal Delay:** 10s (initial) + 5s * 3 (failures) = **25 seconds** before traffic removed

## Tuning Guidelines

### Fast Application Startup (< 5 seconds)

If your application starts quickly, you can reduce initial delays:

```yaml
livenessProbe:
  initialDelaySeconds: 5     # Reduce from 15s
  
readinessProbe:
  initialDelaySeconds: 3     # Reduce from 10s
```

### Slow Application Startup (> 30 seconds)

For applications that take time to initialize (loading large caches, migrations, etc.), add a startup probe:

```yaml
startupProbe:
  httpGet:
    path: /api/health/live
    port: 8000
  periodSeconds: 5
  failureThreshold: 60       # Allow 5s * 60 = 300s (5 minutes) to start
```

**Benefits:**
- Liveness/readiness disabled until startup succeeds
- Prevents premature Pod restarts during slow initialization
- Once startup succeeds, liveness/readiness take over

### High-Traffic Production Environment

For production with strict availability requirements:

```yaml
livenessProbe:
  periodSeconds: 10          # Keep default
  failureThreshold: 5        # Increase from 3 (more tolerant of transient failures)
  
readinessProbe:
  periodSeconds: 3           # Check more frequently (detect failures faster)
  failureThreshold: 2        # Decrease from 3 (remove unhealthy Pods faster)
```

**Trade-offs:**
- Liveness: More tolerant (50s before restart vs 30s)
- Readiness: More aggressive (6s before traffic removal vs 15s)

### Development/Testing Environment

For development, you can be more lenient:

```yaml
livenessProbe:
  periodSeconds: 30          # Less frequent
  failureThreshold: 10       # Very tolerant
  
readinessProbe:
  periodSeconds: 10          # Less frequent
  failureThreshold: 5        # More tolerant
```

## Monitoring Probe Failures

Monitor probe failures in production to tune settings:

```bash
# Check probe failure events
kubectl get events --field-selector reason=Unhealthy

# View Pod events
kubectl describe pod <pod-name>

# Check probe metrics (if using Prometheus)
kubectl_http_requests_total{handler="/api/health/live"}
kubectl_http_requests_total{handler="/api/health/ready"}
```

## Common Issues

### Issue: Pods Restarting Frequently
**Symptom:** Liveness probe failing, Pods in CrashLoopBackOff
**Solution:**
- Increase `initialDelaySeconds` (app may need more time to start)
- Increase `failureThreshold` (reduce false positives)
- Add `startupProbe` if startup is slow

### Issue: Traffic Sent to Unhealthy Pods
**Symptom:** 503 errors, slow responses from some Pods
**Solution:**
- Decrease `periodSeconds` on readiness (detect failures faster)
- Decrease `failureThreshold` on readiness (remove unhealthy Pods faster)
- Check that `/api/health/ready` correctly detects dependency failures

### Issue: All Pods Unhealthy Simultaneously
**Symptom:** All Pods show readiness failures, no traffic served
**Solution:**
- Check database/Redis availability (external dependencies may be down)
- Verify readiness probe doesn't have cascading failure logic
- Consider adding circuit breakers for dependency checks

### Issue: Slow Deployment Rollouts
**Symptom:** Deployments take long time to complete
**Solution:**
- Decrease `initialDelaySeconds` on readiness (if app starts quickly)
- Decrease `periodSeconds` on readiness (detect ready state faster)
- Ensure application signals readiness as soon as possible

## Reference

- [Kubernetes Pod Lifecycle](https://kubernetes.io/docs/concepts/workloads/pods/pod-lifecycle/)
- [Configure Liveness, Readiness, Startup Probes](https://kubernetes.io/docs/tasks/configure-pod-container/configure-liveness-readiness-startup-probes/)
- [AWS EKS Best Practices - Health Checks](https://aws.github.io/aws-eks-best-practices/reliability/docs/application/#use-liveness-and-readiness-probes)
```

**Why:** Comprehensive tuning guide helps operators adjust probe settings for their specific deployment environment and availability requirements.

---

### 9. Manual Testing with curl/httpie
**Files:** N/A (command-line testing)
**Action:** Manually test both probe endpoints with curl

**Commands:**

```bash
# Start backend server
cd backend
uvicorn app.main:app --reload

# Test liveness probe (should always return 200)
curl -i http://localhost:8000/api/health/live

# Expected output:
# HTTP/1.1 200 OK
# {"status":"alive"}

# Test readiness probe (should return 200 when dependencies healthy)
curl -i http://localhost:8000/api/health/ready

# Expected output (healthy):
# HTTP/1.1 200 OK
# {"status":"ready","timestamp":"2025-11-10T12:34:56.789Z"}

# Test readiness probe with database down (stop PostgreSQL)
docker-compose stop postgres
sleep 2
curl -i http://localhost:8000/api/health/ready

# Expected output (unhealthy):
# HTTP/1.1 503 Service Unavailable
# {"status":"not_ready"}

# Restart PostgreSQL
docker-compose start postgres
sleep 5

# Test readiness probe with Redis down (stop Redis)
docker-compose stop redis
sleep 2
curl -i http://localhost:8000/api/health/ready

# Expected output (unhealthy):
# HTTP/1.1 503 Service Unavailable
# {"status":"not_ready"}

# Restart Redis
docker-compose start redis
sleep 5

# Verify readiness returns 200 when all dependencies back up
curl -i http://localhost:8000/api/health/ready

# Expected output:
# HTTP/1.1 200 OK
# {"status":"ready","timestamp":"..."}
```

**Manual Testing Checklist:**

1. [ ] Liveness returns 200 with `{"status":"alive"}`
2. [ ] Liveness response is fast (< 100ms)
3. [ ] Readiness returns 200 when all dependencies healthy
4. [ ] Readiness returns 503 when database down
5. [ ] Readiness returns 503 when Redis down
6. [ ] Readiness returns 503 when both down
7. [ ] Readiness recovers to 200 when dependencies restart
8. [ ] Liveness always returns 200 regardless of dependency state

**Why:** Manual testing with real dependencies validates that probes work correctly in development environment before Kubernetes deployment.

---

### 10. Update API Documentation
**Files:** `/Users/philippbriese/Documents/dev/projects/by IDE/Claude Code/Smart Youtube Bookmarks/backend/app/api/health.py`
**Action:** Ensure FastAPI auto-generates correct OpenAPI docs for probe endpoints

**Verification:**

```bash
# Start server
cd backend
uvicorn app.main:app --reload

# Open Swagger UI
open http://localhost:8000/docs

# Verify these endpoints appear:
# - GET /api/health/live (Kubernetes liveness probe)
# - GET /api/health/ready (Kubernetes readiness probe)

# Click "Try it out" on each endpoint to test interactively
```

**Why:** FastAPI's automatic API documentation helps developers understand probe endpoints and test them interactively.

---

### 11. TypeScript Type Verification (Frontend Integration)
**Files:** `/Users/philippbriese/Documents/dev/projects/by IDE/Claude Code/Smart Youtube Bookmarks/frontend/src/types/health.ts`
**Action:** Add TypeScript types for health probe responses (if frontend needs to call these)

```typescript
/**
 * TypeScript types for health check endpoints.
 * 
 * Note: These endpoints are primarily for Kubernetes probes,
 * but can also be used by frontend monitoring dashboards.
 */

export interface LivenessResponse {
  status: 'alive';
}

export interface ReadinessResponse {
  status: 'ready';
  timestamp: string; // ISO 8601 timestamp
}

export interface NotReadyResponse {
  status: 'not_ready';
}

/**
 * Utility function to check if backend is ready.
 * 
 * @returns true if backend is ready, false otherwise
 */
export async function isBackendReady(): Promise<boolean> {
  try {
    const response = await fetch('http://localhost:8000/api/health/ready');
    return response.status === 200;
  } catch (error) {
    console.error('Failed to check backend readiness:', error);
    return false;
  }
}
```

**Why:** TypeScript types provide type safety if frontend needs to check backend health (e.g., for monitoring dashboards or startup screens).

---

### 12. Update CLAUDE.md Documentation
**Files:** `/Users/philippbriese/Documents/dev/projects/by IDE/Claude Code/Smart Youtube Bookmarks/CLAUDE.md`
**Action:** Document probe endpoints in project documentation

**Add to "API Documentation" Section:**

```markdown
## Health Check Endpoints

The application provides multiple health check endpoints for different purposes:

### Basic Health Check
- **Endpoint:** `GET /api/health`
- **Purpose:** Simple health check (legacy endpoint, may be deprecated)
- **Response:** `{"status": "ok"}`

### Kubernetes Liveness Probe
- **Endpoint:** `GET /api/health/live`
- **Purpose:** Detects if the application process is running
- **Checks:** None (process alive = returns 200)
- **Usage:** Kubernetes uses this to determine if Pod should be restarted
- **Response:** `{"status": "alive"}`
- **Never Fails Unless:** Application is deadlocked or crashed

### Kubernetes Readiness Probe
- **Endpoint:** `GET /api/health/ready`
- **Purpose:** Detects if the application can serve traffic
- **Checks:** Database connectivity, Redis connectivity
- **Usage:** Kubernetes uses this to determine if Pod should receive traffic
- **Response (Healthy):** `{"status": "ready", "timestamp": "2025-11-10T12:34:56Z"}` (200)
- **Response (Unhealthy):** `{"status": "not_ready"}` (503)

### Detailed Health Check
- **Endpoint:** `GET /api/health/detailed`
- **Purpose:** Comprehensive health check with all dependency details
- **Checks:** Database, Redis, with detailed status for each
- **Usage:** Monitoring dashboards, debugging
- **Response:** Detailed status object with individual check results

**Important Distinction:**
- **Liveness = "Is the process alive?"** - Does NOT check dependencies (prevents cascade failures)
- **Readiness = "Can I serve traffic?"** - Checks all dependencies (safe to fail, Pod just removed from load balancer)

**Kubernetes Deployment:**
See `docs/deployment/kubernetes-health-probes-example.yaml` for complete Deployment YAML with probe configuration.
```

**Why:** Comprehensive documentation ensures future developers understand the purpose and behavior of each health endpoint, especially the critical liveness vs readiness distinction.

---

### 13. Run All Tests and Verify
**Files:** All test files
**Action:** Run complete test suite to ensure no regressions

**Commands:**

```bash
# Run all health-related tests
cd backend
pytest tests/api/test_kubernetes_probes.py -v
pytest tests/integration/test_kubernetes_probes_integration.py -v

# Run full test suite
pytest -v

# Check test coverage
pytest --cov=app.api.health --cov-report=term-missing
```

**Expected Results:**
- All liveness probe tests pass (2 tests)
- All readiness probe tests pass (4 tests)
- Integration tests pass (2 tests)
- Test coverage for health.py >= 90%

**Why:** Comprehensive test execution ensures probe endpoints work correctly and don't introduce regressions in other health check functionality.

---

### 14. Commit Changes
**Files:** All modified files
**Action:** Create git commit with descriptive message

```bash
cd /Users/philippbriese/Documents/dev/projects/by\ IDE/Claude\ Code/Smart\ Youtube\ Bookmarks

git add backend/app/api/health.py
git add backend/tests/api/test_kubernetes_probes.py
git add backend/tests/integration/test_kubernetes_probes_integration.py
git add docs/deployment/kubernetes-health-probes-example.yaml
git add docs/deployment/kubernetes-probe-tuning.md
git add frontend/src/types/health.ts
git add CLAUDE.md

git commit -m "feat(health): add Kubernetes liveness and readiness probes

- Implement /api/health/live endpoint (liveness probe)
  - Always returns 200 (process alive check only)
  - Never checks dependencies (prevents cascade failures)
- Implement /api/health/ready endpoint (readiness probe)
  - Returns 200 when all dependencies healthy
  - Returns 503 when database or Redis unhealthy
  - Checks database and Redis connectivity
- Add 6 unit tests (liveness, readiness scenarios)
- Add 2 integration tests (real dependency checks)
- Provide Kubernetes Deployment YAML example with all probes
- Document probe tuning guidelines for production
- Update CLAUDE.md with endpoint documentation

Based on REF MCP research:
- Kubernetes official docs: Liveness detects deadlock, readiness detects unavailability
- AWS EKS best practices: Never check external dependencies in liveness
- Google Cloud GKE: Readiness should check dependencies with timeouts

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

**Why:** Comprehensive commit message documents what was implemented, why it was implemented this way, and references to authoritative sources (REF MCP findings).

---

## 🧪 Testing Strategy

### Unit Tests (6 Tests)

**Liveness Probe Tests:**
1. `test_liveness_probe_always_returns_200` - Verify liveness returns 200 with "alive" status
2. `test_liveness_probe_does_not_check_dependencies` - Verify liveness doesn't call check_database() or check_redis() even when mocked as unhealthy

**Readiness Probe Tests:**
3. `test_readiness_probe_returns_200_when_all_healthy` - Verify readiness returns 200 when both database and Redis healthy
4. `test_readiness_probe_returns_503_when_database_unhealthy` - Verify readiness returns 503 when database unhealthy
5. `test_readiness_probe_returns_503_when_redis_unhealthy` - Verify readiness returns 503 when Redis unhealthy
6. `test_readiness_probe_returns_503_when_both_unhealthy` - Verify readiness returns 503 when both dependencies unhealthy

**Coverage Target:** 100% of new code (liveness_check and readiness_check functions)

### Integration Tests (2 Tests)

1. `test_readiness_with_healthy_dependencies` - Test readiness with real database and Redis connections (no mocks)
2. `test_liveness_independent_of_dependencies` - Verify liveness works regardless of actual dependency state

**Why Integration Tests:**
- Validates async/await patterns work correctly with real connections
- Catches connection pooling or timeout issues
- Ensures check_database() and check_redis() implementations (from Tasks #141-142) integrate correctly

### Manual Testing Checklist (8 Scenarios)

1. [ ] **All Healthy:** Liveness returns 200, readiness returns 200
2. [ ] **Database Down:** Liveness returns 200, readiness returns 503
3. [ ] **Redis Down:** Liveness returns 200, readiness returns 503
4. [ ] **Both Down:** Liveness returns 200, readiness returns 503
5. [ ] **Recovery:** After dependencies restart, readiness returns 200
6. [ ] **Performance:** Liveness response time < 100ms (no dependency checks)
7. [ ] **Performance:** Readiness response time < 500ms (with dependency checks)
8. [ ] **OpenAPI Docs:** Endpoints appear in Swagger UI with correct descriptions

**Testing Commands:**

```bash
# Scenario 1: All Healthy
curl -i http://localhost:8000/api/health/live
curl -i http://localhost:8000/api/health/ready

# Scenario 2: Database Down
docker-compose stop postgres
sleep 2
curl -i http://localhost:8000/api/health/live    # Should still be 200
curl -i http://localhost:8000/api/health/ready   # Should be 503
docker-compose start postgres

# Scenario 3: Redis Down
docker-compose stop redis
sleep 2
curl -i http://localhost:8000/api/health/live    # Should still be 200
curl -i http://localhost:8000/api/health/ready   # Should be 503
docker-compose start redis

# Scenario 4: Both Down
docker-compose stop postgres redis
sleep 2
curl -i http://localhost:8000/api/health/ready   # Should be 503
docker-compose start postgres redis

# Scenario 5: Recovery
sleep 10  # Wait for dependencies to start
curl -i http://localhost:8000/api/health/ready   # Should be 200 again

# Scenario 6-7: Performance
time curl -s http://localhost:8000/api/health/live   # Should be < 100ms
time curl -s http://localhost:8000/api/health/ready  # Should be < 500ms

# Scenario 8: OpenAPI Docs
open http://localhost:8000/docs
```

---

## 📚 Reference

### Related Documentation

**Master Plan:**
- `docs/plans/2025-11-02-security-hardening-implementation.md` - Lines 2510-2808 (Task 8: Comprehensive Health Checks)
- Specifically lines 2745-2790 for Kubernetes probe implementation details

**Dependencies:**
- Task #141: `check_database()` implementation (database health check)
- Task #142: `check_redis()` implementation (Redis health check)

**Related Code:**
- `backend/app/api/health.py` - Health check router (implemented in Tasks #141-142, extended in this task)
- `backend/app/main.py` - Health router registration

### REF MCP Research Sources

1. **Kubernetes Official Documentation - Container Probes**
   - URL: https://github.com/kubernetes/website/blob/main/content/en/docs/concepts/workloads/pods/pod-lifecycle.md
   - Key Finding: Liveness detects deadlock (restarts Pod), readiness detects unavailability (removes from Service)
   - Critical Quote: "If a container does not provide a liveness probe, the default state is Success"

2. **AWS EKS Best Practices - Liveness Probes**
   - URL: https://docs.aws.amazon.com/eks/latest/best-practices/application.html#use-liveness-probe-to-remove-unhealthy-pods
   - Key Finding: Never check external dependencies in liveness (causes cascade failures)
   - Critical Quote: "Avoid configuring the Liveness Probe to depend on a factor that is external to your Pod"

3. **AWS EKS Best Practices - Readiness Probes**
   - URL: https://docs.aws.amazon.com/eks/latest/best-practices/application.html#use-readiness-probe-to-detect-partial-unavailability
   - Key Finding: Readiness for temporary unavailability (Pod exists but doesn't receive traffic)
   - Critical Quote: "A failed Readiness Probe would mean that Pod will not receive any traffic from Kubernetes Service"

4. **Google Cloud GKE Best Practices - Health Probes**
   - URL: https://cloud.google.com/architecture/best-practices-for-running-cost-effective-kubernetes-applications-on-gke
   - Key Finding: Define readiness for all containers, but never access other services in probes
   - Critical Quote: "Never make any probe logic access other services. It can compromise the lifecycle of your Pod"

5. **Kubernetes Official Documentation - HTTP Probe Mechanism**
   - URL: https://github.com/kubernetes/website/blob/main/content/en/docs/concepts/workloads/pods/pod-lifecycle.md
   - Key Finding: HTTP probes succeed for status codes 200-399, fail for 400+
   - Application: Readiness should return 503 (triggers failure, removes from Service)

### Design Decisions

**Decision 1: Liveness Does NOT Check Dependencies**

**Rationale:**
- If external database goes down, ALL Pods fail liveness simultaneously
- Kubernetes kills all Pods → entire application offline
- Pods restarting won't fix external database issue
- Creates unnecessary strain on control plane
- **Solution:** Liveness only checks if process is alive (can respond to HTTP)

**Evidence:** AWS EKS Best Practices explicitly warn against this anti-pattern

---

**Decision 2: Readiness DOES Check Dependencies**

**Rationale:**
- Purpose of readiness is to determine if Pod can serve traffic
- If database/Redis unavailable, Pod cannot serve requests (would return 500 errors)
- Failed readiness removes Pod from load balancer but keeps Pod alive
- Once dependencies recover, Pod automatically receives traffic again
- **Safe:** Failed readiness doesn't kill Pod, just prevents traffic routing

**Evidence:** Kubernetes official docs state "If your app has a strict dependency on back-end services, you can implement both a liveness and a readiness probe."

---

**Decision 3: Return 503 for Failed Readiness**

**Rationale:**
- HTTP status codes 400+ trigger probe failure in Kubernetes
- 503 Service Unavailable semantically correct (dependencies unavailable)
- Load balancers and reverse proxies recognize 503 as "retry later"
- **Alternative Rejected:** 500 Internal Server Error (implies application bug, not temporary unavailability)

**Evidence:** Kubernetes HTTP probe mechanism considers 200-399 success, 400+ failure

---

**Decision 4: Use Async Helper Functions from Tasks #141-142**

**Rationale:**
- `check_database()` already implemented in Task #141 (database connectivity check)
- `check_redis()` already implemented in Task #142 (Redis PING check)
- Both functions use proper async/await patterns
- Both functions have timeouts to prevent hanging
- **Reuse:** DRY principle - don't duplicate health check logic

**Evidence:** Existing implementations verified in Tasks #141-142

---

**Decision 5: Provide Kubernetes Deployment YAML Examples**

**Rationale:**
- Probe configuration is critical for production deployments
- Examples show correct timing parameters (initialDelaySeconds, periodSeconds, etc.)
- Demonstrates all three probe types (liveness, readiness, startup)
- Operators can copy-paste and customize for their environment
- **Prevents:** Common misconfiguration issues (too aggressive, too lenient)

**Evidence:** Industry best practice from Google Cloud and AWS documentation

---

**Estimated Time:** 1.5-2 hours

**Breakdown:**
- Step 1-3: Write tests + implement liveness (30 min)
- Step 4-5: Implement readiness + tests (30 min)
- Step 6: Integration tests (20 min)
- Step 7-8: Kubernetes YAML + tuning guide (30 min)
- Step 9-13: Manual testing + documentation (20 min)
- Step 14: Commit (10 min)

---

## ✅ Completion Checklist

- [ ] All unit tests pass (6 tests)
- [ ] All integration tests pass (2 tests)
- [ ] Manual testing completed (8 scenarios verified)
- [ ] Kubernetes Deployment YAML example created
- [ ] Probe tuning guide documented
- [ ] CLAUDE.md updated with probe documentation
- [ ] TypeScript types added (if needed for frontend)
- [ ] OpenAPI documentation verified
- [ ] Git commit created with descriptive message
- [ ] Code review requested (if team workflow requires)

---

**Next Tasks:**
- Task #144: Implement structured logging with structlog (Security Hardening P2)
- Deploy to staging environment with Kubernetes probes enabled
- Monitor probe metrics in production
