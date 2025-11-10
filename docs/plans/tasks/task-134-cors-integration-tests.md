# Task #134: Add CORS Integration Tests

**Plan Task:** #134
**Priority:** P1 - High (Security Verification)
**Parent Plan:** Security Hardening Implementation (Task 6, lines 2090-2200)
**Dependencies:** Task #121 (CORS Helpers - COMPLETED), Task #133 (Verification - Can Run in Parallel)

---

## 🎯 Goal

Create comprehensive integration tests for CORS (Cross-Origin Resource Sharing) configuration to verify that:
- Development mode allows localhost origins with wildcard methods/headers
- Production mode enforces explicit origin allowlists with restricted methods/headers
- CORS preflight (OPTIONS) requests work correctly in both environments
- Credentials support is properly configured
- Edge cases (missing Origin header, disallowed origins, etc.) are handled correctly

**Expected Result:**
- New test file: `backend/tests/api/test_cors.py`
- 10+ test cases covering all CORS scenarios
- Tests verify actual HTTP response headers (not just helper function returns)
- 100% coverage of CORS middleware behavior
- All tests pass in both development and production modes

---

## 📋 Acceptance Criteria

**Test Coverage:**
- [ ] 10+ integration tests in `backend/tests/api/test_cors.py`
- [ ] Development mode: allowed origins accepted, wildcard methods/headers
- [ ] Production mode: explicit origin allowlist, restricted methods/headers
- [ ] Preflight OPTIONS requests: correct Access-Control-* headers returned
- [ ] Disallowed origins: CORS headers absent or incorrect
- [ ] Edge cases: missing Origin header, empty ALLOWED_ORIGINS, etc.
- [ ] Credentials: `Access-Control-Allow-Credentials: true` in all responses

**Test Quality:**
- [ ] Uses `httpx.AsyncClient` with `ASGITransport` (not TestClient)
- [ ] Uses `@pytest.mark.asyncio` for async test functions
- [ ] Uses `monkeypatch` to switch environments (dev/prod)
- [ ] Verifies actual HTTP response headers (case-insensitive checks)
- [ ] Tests both preflight (OPTIONS) and actual (GET/POST) requests
- [ ] Clear test names describing scenario being tested

**Passing Tests:**
- [ ] All tests pass: `pytest backend/tests/api/test_cors.py -v`
- [ ] Tests pass in both dev and prod modes
- [ ] No test flakiness or race conditions
- [ ] Coverage: `pytest backend/tests/api/test_cors.py --cov=app.main --cov-report=term-missing`

**Documentation:**
- [ ] Inline comments explaining CORS preflight behavior
- [ ] Test docstrings describe expected behavior
- [ ] Edge cases documented (e.g., why missing Origin is valid)

---

## 🛠️ Implementation Steps

### Step 1: Create Test File Structure

**File:** `backend/tests/api/test_cors.py`

**Action:** Create new test file with imports and fixtures

**Code:**
```python
"""
Integration tests for CORS (Cross-Origin Resource Sharing) configuration.

Tests verify that:
- Development mode allows localhost origins with wildcards
- Production mode enforces explicit allowlists
- CORS preflight (OPTIONS) requests work correctly
- Credentials support is enabled
- Disallowed origins are properly rejected
"""

import pytest
from httpx import AsyncClient, ASGITransport
import os

from app.main import app
from app.core.config import settings


@pytest.fixture
async def async_client():
    """
    Create async HTTP client for CORS testing.
    
    Note: We use AsyncClient instead of TestClient because:
    1. We need to test actual HTTP headers (not mocked responses)
    2. AsyncClient works with @pytest.mark.asyncio tests
    3. More realistic integration testing
    """
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client
```

**Why:** 
- Async client required for integration tests (per FastAPI docs)
- ASGITransport allows testing actual middleware behavior
- Fixture reusability across all test cases

---

### Step 2: Development Mode Tests - Allowed Origins

**File:** `backend/tests/api/test_cors.py`

**Action:** Add tests for development mode with allowed origins

**Code (append to file):**
```python
class TestCorsDevelopment:
    """Test CORS behavior in development environment"""

    @pytest.fixture(autouse=True)
    def setup_development_env(self, monkeypatch):
        """Set development environment for all tests in this class"""
        monkeypatch.setattr(settings, "env", "development")
        # Force middleware to reload with new settings
        # (In practice, app is recreated between tests)

    @pytest.mark.asyncio
    async def test_preflight_request_localhost_5173(self, async_client):
        """
        Development mode should allow CORS preflight from localhost:5173.
        
        Preflight is an OPTIONS request sent by browser before actual request
        to check if cross-origin request is allowed.
        """
        response = await async_client.options(
            "/api/health",
            headers={
                "Origin": "http://localhost:5173",
                "Access-Control-Request-Method": "POST",
                "Access-Control-Request-Headers": "Content-Type"
            }
        )

        # Preflight should return 200 OK
        assert response.status_code == 200

        # Check CORS headers (case-insensitive)
        headers = {k.lower(): v for k, v in response.headers.items()}
        assert "access-control-allow-origin" in headers
        assert headers["access-control-allow-origin"] == "http://localhost:5173"
        assert "access-control-allow-credentials" in headers
        assert headers["access-control-allow-credentials"] == "true"
        assert "access-control-allow-methods" in headers
        # Development mode uses wildcard
        assert "*" in headers["access-control-allow-methods"]

    @pytest.mark.asyncio
    async def test_actual_request_localhost_5173(self, async_client):
        """Development mode should allow actual GET request from localhost:5173"""
        response = await async_client.get(
            "/api/health",
            headers={"Origin": "http://localhost:5173"}
        )

        assert response.status_code == 200

        headers = {k.lower(): v for k, v in response.headers.items()}
        assert headers["access-control-allow-origin"] == "http://localhost:5173"
        assert headers["access-control-allow-credentials"] == "true"

    @pytest.mark.asyncio
    async def test_allows_localhost_127_variant(self, async_client):
        """Development mode should allow 127.0.0.1 variant of localhost"""
        response = await async_client.options(
            "/api/health",
            headers={
                "Origin": "http://127.0.0.1:5173",
                "Access-Control-Request-Method": "GET"
            }
        )

        assert response.status_code == 200

        headers = {k.lower(): v for k, v in response.headers.items()}
        assert headers["access-control-allow-origin"] == "http://127.0.0.1:5173"

    @pytest.mark.asyncio
    async def test_allows_all_methods_development(self, async_client):
        """Development mode should allow wildcard methods"""
        # Test with uncommon HTTP method
        response = await async_client.options(
            "/api/health",
            headers={
                "Origin": "http://localhost:5173",
                "Access-Control-Request-Method": "PATCH"
            }
        )

        assert response.status_code == 200

        headers = {k.lower(): v for k, v in response.headers.items()}
        # Wildcard should be present
        assert "*" in headers.get("access-control-allow-methods", "")
```

**Why:**
- Tests preflight OPTIONS requests (what browsers actually send)
- Tests actual GET requests (after preflight succeeds)
- Verifies both localhost and 127.0.0.1 variants work
- Confirms wildcard methods in development

---

### Step 3: Development Mode Tests - Disallowed Origins

**File:** `backend/tests/api/test_cors.py`

**Action:** Add test for origins not in development allowlist

**Code (append to TestCorsDevelopment class):**
```python
    @pytest.mark.asyncio
    async def test_rejects_external_origin_development(self, async_client):
        """
        Development mode should reject origins not in localhost allowlist.
        
        Even in dev mode, we don't use wildcard origins for security.
        Only localhost variants are allowed.
        """
        response = await async_client.options(
            "/api/health",
            headers={
                "Origin": "https://evil.com",
                "Access-Control-Request-Method": "GET"
            }
        )

        # Preflight request still returns 200, but without CORS headers
        # (FastAPI's CORSMiddleware behavior)
        assert response.status_code == 200

        headers = {k.lower(): v for k, v in response.headers.items()}
        # CORS header should either be missing or not match the origin
        if "access-control-allow-origin" in headers:
            assert headers["access-control-allow-origin"] != "https://evil.com"
```

**Why:**
- Verifies development mode doesn't allow ALL origins (security)
- Documents CORSMiddleware behavior (200 response, missing headers)

---

### Step 4: Production Mode Tests - Allowed Origins

**File:** `backend/tests/api/test_cors.py`

**Action:** Add tests for production mode with explicit allowlist

**Code (append to file):**
```python
class TestCorsProduction:
    """Test CORS behavior in production environment"""

    @pytest.fixture(autouse=True)
    def setup_production_env(self, monkeypatch):
        """Set production environment with ALLOWED_ORIGINS for all tests"""
        monkeypatch.setattr(settings, "env", "production")
        monkeypatch.setattr(
            settings,
            "allowed_origins",
            "https://app.example.com,https://www.example.com"
        )

    @pytest.mark.asyncio
    async def test_preflight_allowed_origin_production(self, async_client):
        """Production mode should allow origins in ALLOWED_ORIGINS"""
        response = await async_client.options(
            "/api/health",
            headers={
                "Origin": "https://app.example.com",
                "Access-Control-Request-Method": "POST",
                "Access-Control-Request-Headers": "Authorization,Content-Type"
            }
        )

        assert response.status_code == 200

        headers = {k.lower(): v for k, v in response.headers.items()}
        assert headers["access-control-allow-origin"] == "https://app.example.com"
        assert headers["access-control-allow-credentials"] == "true"

        # Production should NOT use wildcards
        methods = headers.get("access-control-allow-methods", "")
        assert "*" not in methods
        # Should list explicit methods
        assert "GET" in methods
        assert "POST" in methods
        assert "OPTIONS" in methods

    @pytest.mark.asyncio
    async def test_actual_request_allowed_origin_production(self, async_client):
        """Production mode should allow actual requests from allowed origins"""
        response = await async_client.get(
            "/api/health",
            headers={"Origin": "https://www.example.com"}
        )

        assert response.status_code == 200

        headers = {k.lower(): v for k, v in response.headers.items()}
        assert headers["access-control-allow-origin"] == "https://www.example.com"

    @pytest.mark.asyncio
    async def test_production_allows_specific_headers(self, async_client):
        """Production mode should allow specific headers (not wildcard)"""
        response = await async_client.options(
            "/api/health",
            headers={
                "Origin": "https://app.example.com",
                "Access-Control-Request-Method": "POST",
                "Access-Control-Request-Headers": "Authorization,Content-Type"
            }
        )

        assert response.status_code == 200

        headers = {k.lower(): v for k, v in response.headers.items()}
        allowed_headers = headers.get("access-control-allow-headers", "")

        # Should NOT be wildcard
        assert allowed_headers != "*"

        # Should include standard REST/auth headers
        assert "authorization" in allowed_headers.lower()
        assert "content-type" in allowed_headers.lower()
```

**Why:**
- Verifies production uses explicit origin allowlist
- Confirms no wildcards in production methods/headers
- Tests standard auth headers (Authorization, Content-Type)

---

### Step 5: Production Mode Tests - Disallowed Origins

**File:** `backend/tests/api/test_cors.py`

**Action:** Add tests for origins NOT in production allowlist

**Code (append to TestCorsProduction class):**
```python
    @pytest.mark.asyncio
    async def test_rejects_localhost_in_production(self, async_client):
        """
        Production mode should reject localhost origins.
        
        This prevents accidentally using dev frontend against prod API.
        """
        response = await async_client.options(
            "/api/health",
            headers={
                "Origin": "http://localhost:5173",
                "Access-Control-Request-Method": "GET"
            }
        )

        assert response.status_code == 200

        headers = {k.lower(): v for k, v in response.headers.items()}
        # CORS header should not allow localhost
        if "access-control-allow-origin" in headers:
            assert headers["access-control-allow-origin"] != "http://localhost:5173"

    @pytest.mark.asyncio
    async def test_rejects_unlisted_https_origin_production(self, async_client):
        """Production mode should reject HTTPS origins not in allowlist"""
        response = await async_client.options(
            "/api/health",
            headers={
                "Origin": "https://attacker.com",
                "Access-Control-Request-Method": "POST"
            }
        )

        assert response.status_code == 200

        headers = {k.lower(): v for k, v in response.headers.items()}
        if "access-control-allow-origin" in headers:
            assert headers["access-control-allow-origin"] != "https://attacker.com"
```

**Why:**
- Critical security test: unauthorized origins must be rejected
- Prevents accidental localhost usage in production
- Verifies explicit allowlist is enforced

---

### Step 6: Edge Cases and Error Conditions

**File:** `backend/tests/api/test_cors.py`

**Action:** Add tests for edge cases

**Code (append to file):**
```python
class TestCorsEdgeCases:
    """Test CORS edge cases and error conditions"""

    @pytest.mark.asyncio
    async def test_missing_origin_header_allowed(self, async_client):
        """
        Requests without Origin header should still work.
        
        Not all requests have Origin header:
        - Direct navigation (browser address bar)
        - Same-origin requests
        - Non-browser clients (curl, Postman)
        
        CORS only applies when Origin header is present.
        """
        # Development mode
        response = await async_client.get("/api/health")

        # Should succeed (no CORS check without Origin header)
        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_credentials_always_enabled(self, async_client, monkeypatch):
        """
        Credentials should be enabled in both dev and prod.
        
        Required for future JWT authentication via Authorization header.
        """
        # Test development mode
        monkeypatch.setattr(settings, "env", "development")
        response = await async_client.options(
            "/api/health",
            headers={
                "Origin": "http://localhost:5173",
                "Access-Control-Request-Method": "GET"
            }
        )

        headers = {k.lower(): v for k, v in response.headers.items()}
        assert headers.get("access-control-allow-credentials") == "true"

        # Test production mode
        monkeypatch.setattr(settings, "env", "production")
        monkeypatch.setattr(settings, "allowed_origins", "https://app.example.com")
        
        response = await async_client.options(
            "/api/health",
            headers={
                "Origin": "https://app.example.com",
                "Access-Control-Request-Method": "GET"
            }
        )

        headers = {k.lower(): v for k, v in response.headers.items()}
        assert headers.get("access-control-allow-credentials") == "true"

    @pytest.mark.asyncio
    async def test_production_missing_allowed_origins_fails_at_startup(self, monkeypatch):
        """
        Production mode without ALLOWED_ORIGINS should fail at app startup.
        
        Note: This tests the helper function, not the middleware.
        Middleware is configured at import time, so we test the config helper.
        """
        from app.core.config import get_cors_origins

        monkeypatch.setattr(settings, "env", "production")
        monkeypatch.setattr(settings, "allowed_origins", "")

        with pytest.raises(ValueError) as exc_info:
            get_cors_origins()

        assert "ALLOWED_ORIGINS" in str(exc_info.value)
        assert "production" in str(exc_info.value).lower()

    @pytest.mark.asyncio
    async def test_multiple_origins_in_allowlist(self, async_client, monkeypatch):
        """Production mode should handle multiple origins in allowlist"""
        monkeypatch.setattr(settings, "env", "production")
        monkeypatch.setattr(
            settings,
            "allowed_origins",
            "https://app.example.com,https://www.example.com,https://admin.example.com"
        )

        # Test first origin
        response1 = await async_client.get(
            "/api/health",
            headers={"Origin": "https://app.example.com"}
        )
        headers1 = {k.lower(): v for k, v in response1.headers.items()}
        assert headers1["access-control-allow-origin"] == "https://app.example.com"

        # Test second origin
        response2 = await async_client.get(
            "/api/health",
            headers={"Origin": "https://admin.example.com"}
        )
        headers2 = {k.lower(): v for k, v in response2.headers.items()}
        assert headers2["access-control-allow-origin"] == "https://admin.example.com"
```

**Why:**
- Tests missing Origin header (valid case)
- Verifies credentials always enabled (future JWT auth)
- Tests multiple origins in production allowlist
- Documents CORS behavior for non-browser clients

---

### Step 7: Run All Tests

**Action:** Execute test suite and verify all tests pass

**Commands:**
```bash
cd backend

# Run all CORS integration tests
pytest tests/api/test_cors.py -v

# Run with coverage
pytest tests/api/test_cors.py --cov=app.main --cov=app.core.config --cov-report=term-missing

# Run specific test class
pytest tests/api/test_cors.py::TestCorsDevelopment -v
pytest tests/api/test_cors.py::TestCorsProduction -v
pytest tests/api/test_cors.py::TestCorsEdgeCases -v
```

**Expected Output:**
```
tests/api/test_cors.py::TestCorsDevelopment::test_preflight_request_localhost_5173 PASSED
tests/api/test_cors.py::TestCorsDevelopment::test_actual_request_localhost_5173 PASSED
tests/api/test_cors.py::TestCorsDevelopment::test_allows_localhost_127_variant PASSED
tests/api/test_cors.py::TestCorsDevelopment::test_allows_all_methods_development PASSED
tests/api/test_cors.py::TestCorsDevelopment::test_rejects_external_origin_development PASSED
tests/api/test_cors.py::TestCorsProduction::test_preflight_allowed_origin_production PASSED
tests/api/test_cors.py::TestCorsProduction::test_actual_request_allowed_origin_production PASSED
tests/api/test_cors.py::TestCorsProduction::test_production_allows_specific_headers PASSED
tests/api/test_cors.py::TestCorsProduction::test_rejects_localhost_in_production PASSED
tests/api/test_cors.py::TestCorsProduction::test_rejects_unlisted_https_origin_production PASSED
tests/api/test_cors.py::TestCorsEdgeCases::test_missing_origin_header_allowed PASSED
tests/api/test_cors.py::TestCorsEdgeCases::test_credentials_always_enabled PASSED
tests/api/test_cors.py::TestCorsEdgeCases::test_production_missing_allowed_origins_fails_at_startup PASSED
tests/api/test_cors.py::TestCorsEdgeCases::test_multiple_origins_in_allowlist PASSED

======== 14 passed in 0.8s ========
```

**Why:** Comprehensive test execution ensures all scenarios work correctly

---

### Step 8: Verify Test Coverage

**Action:** Check code coverage for CORS-related code

**Command:**
```bash
cd backend
pytest tests/api/test_cors.py --cov=app.main --cov=app.core.config --cov-report=html --cov-report=term-missing
```

**Expected Coverage:**
- `app.main` CORS middleware setup: 100%
- `app.core.config` CORS helpers: 100% (already covered by unit tests)
- Total: 14+ tests covering all CORS code paths

**Why:** Ensures comprehensive test coverage of CORS logic

---

### Step 9: Add Test Documentation

**File:** `backend/tests/api/test_cors.py`

**Action:** Add module-level documentation

**Code (add at top of file after imports):**
```python
"""
Integration tests for CORS (Cross-Origin Resource Sharing) configuration.

CORS Security Principles:
--------------------------
1. CORS is defense-in-depth, NOT primary security
2. CORS protects browsers from malicious JavaScript on other sites
3. CORS does NOT protect against direct HTTP requests (curl, Postman)
4. Wildcards are NEVER used in production
5. Production requires explicit origin allowlist

Test Organization:
-------------------
- TestCorsDevelopment: Dev mode tests (localhost origins, wildcards)
- TestCorsProduction: Prod mode tests (explicit allowlist, no wildcards)
- TestCorsEdgeCases: Edge cases (missing headers, multiple origins, etc.)

CORS Preflight Requests:
-------------------------
Browsers send OPTIONS requests before actual requests to check permissions.
These are called "preflight requests" and must return:
- 200 OK status
- Access-Control-Allow-Origin: <origin>
- Access-Control-Allow-Methods: <methods>
- Access-Control-Allow-Headers: <headers>
- Access-Control-Allow-Credentials: true

References:
-----------
- MDN CORS: https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS
- FastAPI CORS: https://fastapi.tiangolo.com/tutorial/cors/
- Master Plan: docs/plans/2025-11-02-security-hardening-implementation.md (Task 6)
"""
```

**Why:** Provides context for future developers and Claude threads

---

### Step 10: Update CLAUDE.md

**File:** `CLAUDE.md`

**Action:** Document CORS testing patterns

**Code (add to "Testing Patterns" section, around line 160):**

```markdown
**CORS Integration Tests (backend/tests/api/test_cors.py):**
- Use `httpx.AsyncClient` for integration tests (not TestClient)
- Test both preflight (OPTIONS) and actual (GET/POST) requests
- Verify HTTP response headers (case-insensitive)
- Use `monkeypatch` to switch environments (dev/prod)
- Test matrix: dev/prod × allowed/disallowed × preflight/actual
- Edge cases: missing Origin header, multiple origins, credentials
```

**Why:** Documents CORS testing patterns for future test development

---

## 🧪 Testing Strategy

### Test Matrix

| Environment | Origin | Request Type | Expected Result |
|-------------|--------|--------------|-----------------|
| Development | localhost:5173 | Preflight | ✅ Allow (wildcard methods) |
| Development | localhost:5173 | Actual GET | ✅ Allow |
| Development | 127.0.0.1:5173 | Preflight | ✅ Allow |
| Development | evil.com | Preflight | ❌ Reject (no CORS headers) |
| Production | app.example.com | Preflight | ✅ Allow (explicit methods) |
| Production | app.example.com | Actual GET | ✅ Allow |
| Production | localhost:5173 | Preflight | ❌ Reject |
| Production | attacker.com | Preflight | ❌ Reject |
| Both | (no Origin header) | Actual GET | ✅ Allow (CORS doesn't apply) |
| Both | Any allowed | Any | ✅ Credentials: true |

### Coverage Target

- **14 integration tests** covering all matrix cells
- **100% coverage** of CORS middleware configuration
- **All edge cases** tested (missing headers, multiple origins, etc.)

---

## 🔍 Design Decisions

### 1. Why Integration Tests Instead of Unit Tests?

**Decision:** Write integration tests that test actual HTTP headers

**Rationale:**
- CORS is middleware behavior (not isolated function logic)
- Must verify actual HTTP response headers (what browsers see)
- Integration tests catch middleware configuration errors
- Unit tests of helpers already exist (Task #121)

**Trade-off:** Integration tests slower than unit tests, but necessary for CORS

---

### 2. Why Test Preflight (OPTIONS) AND Actual Requests?

**Decision:** Test both preflight and actual requests

**Rationale:**
- Browsers send OPTIONS before actual requests (for non-simple requests)
- Preflight and actual requests have different CORS header requirements
- Some CORS bugs only appear in preflight (e.g., missing methods)
- Real-world CORS issues often involve preflight failures

**Example Flow:**
1. User clicks button in React app
2. Browser sends OPTIONS preflight (checks if POST is allowed)
3. If preflight succeeds, browser sends actual POST request
4. Both requests must have correct CORS headers

---

### 3. Why Use AsyncClient Instead of TestClient?

**Decision:** Use `httpx.AsyncClient` with `ASGITransport`

**Rationale:**
- TestClient is synchronous (doesn't work in async tests)
- AsyncClient tests actual middleware behavior
- More realistic integration testing (closer to production)
- Per FastAPI async testing docs (https://fastapi.tiangolo.com/advanced/async-tests/)

**Trade-off:** Slightly more verbose setup (need ASGITransport)

---

### 4. Why Test Missing Origin Header?

**Decision:** Include test for requests without Origin header

**Rationale:**
- Not all requests have Origin header (direct navigation, curl, etc.)
- CORS only applies when Origin header is present
- Ensures API doesn't break for non-browser clients
- Documents expected behavior

**Important:** Missing Origin header is **valid and expected** for:
- Direct browser navigation (typing URL in address bar)
- Same-origin requests
- Non-browser HTTP clients (curl, Postman, Python requests)

---

### 5. Why Monkeypatch Settings Instead of Environment Variables?

**Decision:** Use `monkeypatch.setattr(settings, ...)` instead of `os.environ`

**Rationale:**
- Faster (no need to reload Settings object)
- More reliable (no environment variable pollution between tests)
- Cleaner test isolation
- Per-test environment switching (dev in one test, prod in next)

**Important:** CORS middleware is configured at import time, so we test the helper functions with monkeypatch. Real app startup would fail with missing ALLOWED_ORIGINS.

---

## 📚 References

**CORS Specification:**
- [MDN: CORS](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS)
- [MDN: Preflight Requests](https://developer.mozilla.org/en-US/docs/Glossary/Preflight_request)

**FastAPI Documentation:**
- [FastAPI CORS Tutorial](https://fastapi.tiangolo.com/tutorial/cors/)
- [FastAPI Async Tests](https://fastapi.tiangolo.com/advanced/async-tests/)

**Parent Plan:**
- `docs/plans/2025-11-02-security-hardening-implementation.md` (Task 6, lines 2090-2200)

**Related Tasks:**
- Task #121: CORS Helpers (COMPLETED)
- Task #133: Security Verification (Can Run in Parallel)

---

## ✅ Definition of Done

**Test Implementation:**
- [ ] 14 integration tests in `backend/tests/api/test_cors.py`
- [ ] All tests pass: `pytest tests/api/test_cors.py -v`
- [ ] Coverage ≥95%: `pytest tests/api/test_cors.py --cov --cov-report=term-missing`
- [ ] Tests use `httpx.AsyncClient` with `ASGITransport`
- [ ] Tests verify actual HTTP response headers (not just mock returns)

**Test Coverage:**
- [ ] Development mode: allowed origins, wildcard methods/headers
- [ ] Production mode: explicit allowlist, restricted methods/headers
- [ ] Preflight OPTIONS requests work correctly
- [ ] Actual GET/POST requests work correctly
- [ ] Disallowed origins rejected (no CORS headers)
- [ ] Edge cases: missing Origin, multiple origins, credentials

**Documentation:**
- [ ] Module docstring explains CORS security principles
- [ ] Test docstrings describe expected behavior
- [ ] CLAUDE.md updated with CORS testing patterns
- [ ] Inline comments explain preflight behavior

**Quality:**
- [ ] No test flakiness (run 3x to verify)
- [ ] Clear test names describing scenario
- [ ] Tests organized into logical classes
- [ ] Edge cases documented (why missing Origin is valid)

---

**Estimated Time:** 2-3 hours (including testing and documentation)

**Priority:** P1 - High (Security Verification)

**Next Steps After Completion:**
- Task #133: Manual security verification
- Task #1: JWT Authentication (depends on verified CORS)
