# Task #122: Update main.py with Environment-Aware CORS

**Plan Task:** #122
**Wave/Phase:** Wave 1 Security Hardening / Task 3: Environment-Aware Configuration
**Dependencies:** Task #120 (Environment Enum Settings), Task #121 (CORS Helper Functions)

---

## 🎯 Ziel

Update `backend/app/main.py` to use environment-aware CORS configuration functions from `config.py`, replacing hardcoded localhost origins with dynamic settings that adapt to development/staging/production environments while maintaining backward compatibility.

## 📋 Acceptance Criteria

- [ ] `main.py` imports CORS helper functions from `config.py`
- [ ] `CORSMiddleware` uses `get_cors_origins()`, `get_cors_methods()`, `get_cors_headers()`
- [ ] Health check endpoint returns current environment in response
- [ ] All existing tests continue to pass (backward compatibility)
- [ ] New integration tests verify CORS configuration in different environments
- [ ] Manual testing confirms localhost CORS works in development mode
- [ ] Code follows existing patterns from security hardening plan

---

## 🛠️ Implementation Steps

### 1. Update import statements in main.py

**File:** `backend/app/main.py`
**Action:** Add CORS helper functions to existing `config` import

**Current code (lines 8-13):**
```python
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import lists, videos, processing, websocket, tags, custom_fields, schemas, schema_fields
from app.core.redis import close_redis_client, close_arq_pool, get_arq_pool
```

**Updated code:**
```python
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import lists, videos, processing, websocket, tags, custom_fields, schemas, schema_fields
from app.core.redis import close_redis_client, close_arq_pool, get_arq_pool
from app.core.config import settings, get_cors_origins, get_cors_methods, get_cors_headers
```

**Rationale:** Import `settings` object for `debug` flag and environment value, plus the three CORS helper functions defined in Task #121.

### 2. Update FastAPI app initialization with debug flag

**File:** `backend/app/main.py`
**Action:** Add `debug=settings.debug` to FastAPI constructor

**Current code (line 32):**
```python
app = FastAPI(title="Smart YouTube Bookmarks", lifespan=lifespan)
```

**Updated code:**
```python
# Create FastAPI app with environment-aware settings
app = FastAPI(
    title="Smart YouTube Bookmarks",
    debug=settings.debug,
    lifespan=lifespan
)
```

**Rationale:** FastAPI's debug mode should match the environment setting. This controls detailed error responses and auto-reload behavior. According to REF MCP (FastAPI docs), debug mode provides more verbose error messages which should be disabled in production for security.

### 3. Update CORSMiddleware configuration

**File:** `backend/app/main.py`
**Action:** Replace hardcoded CORS values with environment-aware function calls

**Current code (lines 34-40):**
```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:8000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

**Updated code:**
```python
# Environment-aware CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=get_cors_origins(),
    allow_credentials=True,
    allow_methods=get_cors_methods(),
    allow_headers=get_cors_headers(),
)
```

**Rationale:**
- **REF MCP Finding (FastAPI CORS):** When `allow_credentials=True`, wildcards (`["*"]`) for origins, methods, or headers are not permitted. Production configuration explicitly sets methods and headers to satisfy this constraint.
- **Development mode:** Functions return permissive settings (`["*"]` for methods/headers, localhost origins)
- **Production mode:** Functions return explicit lists (no wildcards) with validated origins from environment variable
- **REF MCP Finding (MDN CORS):** CORS preflight requests require OPTIONS method support. The explicit methods list includes OPTIONS for production.

### 4. Update health check endpoint to show environment

**File:** `backend/app/main.py`
**Action:** Add `environment` field to health check response

**Current code (lines 53-55):**
```python
@app.get("/api/health")
async def health_check() -> dict[str, str]:
    return {"status": "ok"}
```

**Updated code:**
```python
@app.get("/api/health")
async def health_check() -> dict[str, str]:
    """Health check endpoint with environment information."""
    return {
        "status": "ok",
        "environment": settings.environment.value
    }
```

**Rationale:** Provides visibility into current environment configuration for debugging and monitoring. The `.value` attribute extracts string value from `Environment` enum (e.g., "development", "production").

### 5. Update module docstring

**File:** `backend/app/main.py`
**Action:** Update module-level docstring to reflect environment-aware configuration

**Current code (lines 1-6):**
```python
"""
Main FastAPI application module for Smart YouTube Bookmarks.

This module sets up the FastAPI application with CORS middleware
and provides the health check endpoint.
"""
```

**Updated code:**
```python
"""
Main FastAPI application module for Smart YouTube Bookmarks.

This module sets up the FastAPI application with environment-aware
CORS middleware and provides the health check endpoint.
"""
```

### 6. Write unit tests for environment-aware CORS in main.py

**File:** `backend/tests/core/test_main.py` (NEW)
**Action:** Create unit tests for main.py configuration

```python
"""Tests for main.py application configuration."""

import pytest
from unittest.mock import patch, MagicMock
from app.core.config import Environment


def test_main_imports_cors_helpers():
    """Test that main.py imports required CORS helper functions."""
    from app.main import get_cors_origins, get_cors_methods, get_cors_headers

    # Functions should be callable
    assert callable(get_cors_origins)
    assert callable(get_cors_methods)
    assert callable(get_cors_headers)


def test_app_uses_debug_from_settings():
    """Test that FastAPI app uses debug flag from settings."""
    # Mock settings before importing app
    with patch('app.main.settings') as mock_settings:
        mock_settings.debug = True

        # Re-import to get fresh app instance
        import importlib
        import app.main
        importlib.reload(app.main)

        # App should have debug enabled
        assert app.main.app.debug == True


@pytest.mark.asyncio
async def test_health_check_returns_environment(client):
    """Test that health check endpoint returns current environment."""
    response = await client.get("/api/health")

    assert response.status_code == 200
    data = response.json()
    assert "status" in data
    assert "environment" in data
    assert data["status"] == "ok"
    # In test environment, should be "development" (default)
    assert data["environment"] in ["development", "staging", "production"]


def test_cors_middleware_configured():
    """Test that CORSMiddleware is properly configured."""
    from app.main import app

    # Check that CORS middleware is in the middleware stack
    # FastAPI wraps middlewares, so we check the app's middleware attribute
    middleware_classes = [m.cls for m in app.user_middleware]

    from fastapi.middleware.cors import CORSMiddleware
    assert CORSMiddleware in middleware_classes
```

**Rationale:** These tests verify that main.py correctly imports and uses configuration functions. The health check test uses the existing `client` fixture from `conftest.py`.

### 7. Write integration tests for CORS behavior

**File:** `backend/tests/integration/test_cors.py` (NEW)
**Action:** Create integration tests that verify CORS headers in different environments

```python
"""Integration tests for CORS middleware behavior."""

import pytest
import os
from httpx import AsyncClient, ASGITransport


@pytest.mark.asyncio
async def test_cors_development_allows_localhost():
    """Test that development mode allows localhost origins."""
    # Set development environment
    os.environ['ENVIRONMENT'] = 'development'

    # Re-import app to pick up environment change
    import importlib
    import app.main
    importlib.reload(app.main)

    from app.main import app

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Make preflight request (OPTIONS) from localhost:5173
        response = await client.options(
            "/api/health",
            headers={
                "Origin": "http://localhost:5173",
                "Access-Control-Request-Method": "GET"
            }
        )

        # Should allow the origin
        assert response.status_code == 200
        assert "access-control-allow-origin" in response.headers
        assert response.headers["access-control-allow-origin"] in [
            "http://localhost:5173",
            "*"  # Development mode might use wildcard
        ]


@pytest.mark.asyncio
async def test_cors_production_requires_explicit_origins():
    """Test that production mode only allows configured origins."""
    # Set production environment with specific origins
    os.environ['ENVIRONMENT'] = 'production'
    os.environ['ALLOWED_ORIGINS'] = 'https://example.com,https://app.example.com'
    os.environ['SECRET_KEY'] = 'test-secret-key-at-least-32-characters-long-for-production'
    os.environ['DEBUG'] = 'false'

    # Re-import app to pick up environment changes
    import importlib
    import app.core.config
    import app.main
    importlib.reload(app.core.config)
    importlib.reload(app.main)

    from app.main import app

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Make preflight request from allowed origin
        response = await client.options(
            "/api/health",
            headers={
                "Origin": "https://example.com",
                "Access-Control-Request-Method": "GET"
            }
        )

        # Should allow configured origin
        assert response.status_code == 200
        assert response.headers.get("access-control-allow-origin") == "https://example.com"

        # Should NOT allow localhost in production
        response_localhost = await client.options(
            "/api/health",
            headers={
                "Origin": "http://localhost:5173",
                "Access-Control-Request-Method": "GET"
            }
        )

        # CORS should block this (no allow-origin header or null)
        origin_header = response_localhost.headers.get("access-control-allow-origin")
        assert origin_header is None or origin_header != "http://localhost:5173"


@pytest.mark.asyncio
async def test_cors_allows_credentials():
    """Test that CORS allows credentials (cookies, auth headers)."""
    os.environ['ENVIRONMENT'] = 'development'

    import importlib
    import app.main
    importlib.reload(app.main)

    from app.main import app

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.options(
            "/api/health",
            headers={
                "Origin": "http://localhost:5173",
                "Access-Control-Request-Method": "GET"
            }
        )

        # Should allow credentials
        assert response.headers.get("access-control-allow-credentials") == "true"
```

**Rationale:** Integration tests verify actual CORS behavior with preflight OPTIONS requests. Tests cover both development (permissive) and production (restrictive) modes. According to REF MCP (MDN CORS), preflight requests use OPTIONS method with Origin and Access-Control-Request-Method headers.

### 8. Run all tests to verify backward compatibility

**Command:**
```bash
cd backend
pytest tests/core/test_main.py -v
pytest tests/integration/test_cors.py -v
pytest -v  # Run all tests
```

**Expected:** All tests pass, including existing tests that rely on current CORS configuration.

**Verification checklist:**
- [ ] `test_main_imports_cors_helpers` passes
- [ ] `test_health_check_returns_environment` passes
- [ ] `test_cors_development_allows_localhost` passes
- [ ] `test_cors_production_requires_explicit_origins` passes
- [ ] All existing API tests still pass (no CORS regressions)

---

## 🧪 Testing Strategy

### Unit Tests

**File:** `backend/tests/core/test_main.py`

- **test_main_imports_cors_helpers** - Verify CORS helper functions are imported and callable
- **test_app_uses_debug_from_settings** - Verify FastAPI app uses `settings.debug` flag
- **test_health_check_returns_environment** - Verify health check returns environment in response
- **test_cors_middleware_configured** - Verify CORSMiddleware is in middleware stack

**Coverage:** Import statements, app initialization, health endpoint

### Integration Tests

**File:** `backend/tests/integration/test_cors.py`

- **test_cors_development_allows_localhost** - Verify development mode allows localhost:5173 and localhost:8000
- **test_cors_production_requires_explicit_origins** - Verify production mode only allows explicitly configured origins, rejects localhost
- **test_cors_allows_credentials** - Verify `allow_credentials=True` works in all environments

**Coverage:** Actual CORS behavior with HTTP OPTIONS preflight requests

### Manual Testing

**Development Mode (Default):**

1. Start backend: `cd backend && uvicorn app.main:app --reload`
2. Check health endpoint: `curl http://localhost:8000/api/health`
   - Expected: `{"status": "ok", "environment": "development"}`
3. Test CORS from browser console (navigate to http://localhost:5173):
   ```javascript
   fetch('http://localhost:8000/api/health', {
     method: 'GET',
     credentials: 'include'
   }).then(r => r.json()).then(console.log)
   ```
   - Expected: Response received, no CORS errors in console
4. Check preflight request in browser DevTools Network tab
   - Expected: OPTIONS request shows `access-control-allow-origin: http://localhost:5173`

**Production Mode:**

1. Set environment variables:
   ```bash
   export ENVIRONMENT=production
   export ALLOWED_ORIGINS=https://example.com
   export SECRET_KEY=production-secret-key-at-least-32-characters-long
   export DEBUG=false
   ```
2. Start backend: `uvicorn app.main:app`
3. Check health endpoint: `curl http://localhost:8000/api/health`
   - Expected: `{"status": "ok", "environment": "production"}`
4. Test CORS with curl:
   ```bash
   curl -i -X OPTIONS http://localhost:8000/api/health \
     -H "Origin: https://example.com" \
     -H "Access-Control-Request-Method: GET"
   ```
   - Expected: Response includes `access-control-allow-origin: https://example.com`
5. Test CORS with unauthorized origin:
   ```bash
   curl -i -X OPTIONS http://localhost:8000/api/health \
     -H "Origin: http://localhost:5173" \
     -H "Access-Control-Request-Method: GET"
   ```
   - Expected: No `access-control-allow-origin` header (or null value)

**Regression Testing:**

1. Run existing integration tests: `cd backend && pytest tests/integration/ -v`
   - Expected: All tests pass (no CORS-related failures)
2. Test frontend development workflow:
   - Start backend (development mode)
   - Start frontend: `cd frontend && npm run dev`
   - Navigate to http://localhost:5173/videos
   - Upload CSV file, verify video processing works
   - Expected: No CORS errors, WebSocket connects, progress updates appear

---

## 📚 Reference

### Related Docs

- **Security Hardening Plan:** `docs/plans/2025-11-02-security-hardening-implementation.md` (Task 3, lines 1327-1393)
- **REF MCP - FastAPI CORS:** https://fastapi.tiangolo.com/tutorial/cors/#use-corsmiddleware
- **REF MCP - Pydantic Settings:** https://fastapi.tiangolo.com/advanced/settings/#create-the-settings-object
- **REF MCP - MDN CORS:** https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CORS#functional_overview

### Related Code

- **Config helper functions:** `backend/app/core/config.py` (Task #121 - `get_cors_origins()`, `get_cors_methods()`, `get_cors_headers()`)
- **Environment enum:** `backend/app/core/config.py` (Task #120 - `Environment` enum)
- **Test fixtures:** `backend/tests/conftest.py` (lines 59-70 - `client` fixture for integration tests)
- **Existing config tests:** `backend/tests/core/test_config.py`

### Design Decisions

**1. Why not use `@lru_cache` for CORS helper functions?**

The security hardening plan does not use `@lru_cache` on CORS helpers. This is intentional because:
- Functions are called only once at app startup (middleware initialization)
- Caching provides no performance benefit for single execution
- REF MCP (FastAPI Settings) recommends `@lru_cache` for settings objects loaded per-request, not startup configuration

**2. Why keep `allow_credentials=True` in all environments?**

According to REF MCP (FastAPI CORS), credentials include Authorization headers and cookies needed for JWT authentication (future Task #1). This must remain enabled for the auth system to work. The security constraint is that wildcard origins cannot be used with credentials, which is satisfied by explicit origin lists in production.

**3. Why use function calls instead of direct `settings` attributes?**

The security hardening plan pattern (Task 3, Step 3) uses helper functions (`get_cors_origins()`, etc.) instead of direct attributes for several reasons:
- **Environment-specific logic:** Functions contain conditional logic based on `settings.environment`
- **Validation:** Functions can raise errors if production misconfigured (e.g., missing `ALLOWED_ORIGINS`)
- **Type safety:** Functions return explicit `list[str]` types, not comma-separated strings
- **Testability:** Functions can be mocked/overridden more easily than settings attributes

**4. Why add `environment` to health check response?**

Provides operational visibility for:
- Debugging configuration issues (is production mode actually enabled?)
- Monitoring dashboards can display environment
- Load balancer health checks can route based on environment
- No sensitive information exposed (environment name is not a secret)

**5. Backward compatibility strategy**

Default behavior (no environment variables set) matches current system:
- `ENVIRONMENT` defaults to "development"
- Development mode returns `["http://localhost:5173", "http://localhost:8000"]` origins
- This matches the current hardcoded values in main.py
- Existing tests continue to pass without modification

### REF MCP Findings

**FastAPI CORSMiddleware (https://fastapi.tiangolo.com/tutorial/cors/):**

1. **Credentials constraint:** When `allow_credentials=True`, wildcards for origins/methods/headers must be avoided. Production configuration explicitly lists all values.
2. **Preflight requests:** Browsers send OPTIONS requests with `Origin` and `Access-Control-Request-Method` headers before actual cross-origin requests.
3. **Default behavior:** CORSMiddleware is "restrictive by default" - explicit configuration required for cross-origin access.
4. **Origin format:** Origins must include protocol and port (e.g., `http://localhost:5173`, not `localhost:5173`).

**Pydantic Settings (https://fastapi.tiangolo.com/advanced/settings/):**

1. **Case-insensitive env vars:** `ENVIRONMENT` env var maps to `environment` attribute automatically.
2. **Type conversion:** Environment variables (strings) are converted to proper Python types (Enum, bool, int).
3. **Validation on init:** Settings validation occurs when `Settings()` instance created, not when env vars set.

**MDN CORS (https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CORS):**

1. **Simple requests:** GET/POST requests with simple headers don't require preflight.
2. **Preflight required:** PUT/DELETE or requests with Authorization headers trigger OPTIONS preflight.
3. **Error privacy:** CORS failures show generic errors in JavaScript; details only in browser console (security feature).
4. **Response headers:** Server must send `Access-Control-Allow-Origin` matching request's `Origin` header.

### Performance Considerations

- **No runtime overhead:** CORS functions called once at app startup during middleware initialization
- **No database queries:** All configuration from environment variables (in-memory)
- **No additional dependencies:** Uses existing Pydantic settings infrastructure
- **WebSocket compatibility:** CORS applies to HTTP handshake, not WebSocket frames (no performance impact on real-time updates)

### Security Considerations

- **Production validation:** Config validates that `ALLOWED_ORIGINS` is set in production (Task #121)
- **No wildcard credentials:** Explicit origins/methods/headers when `allow_credentials=True`
- **Debug mode control:** `debug=False` in production hides detailed error messages
- **Environment visibility:** Health check exposes environment name (non-sensitive operational data)
- **No secret exposure:** CORS headers are public (part of HTTP spec), no secrets in configuration
