# Task #121: Environment-Aware Configuration - Add Environment-Aware CORS Helpers

**Plan Task:** #121
**Priority:** P0 - Critical Security (Must Fix Before Any Production Use)
**Parent Plan:** Security Hardening Implementation (Task 3, lines 1263-1326)
**Dependencies:** None (standalone security improvement)

---

## 🎯 Goal

Implement environment-aware CORS (Cross-Origin Resource Sharing) helper functions to enforce secure CORS policies in production while maintaining developer experience in development. Replace the current hardcoded CORS middleware configuration in `main.py` with configurable helpers that:
- Allow wildcards in development for DX (developer experience)
- Enforce explicit allowlists in production for security
- Fail fast with clear error messages if production config is missing

**Expected Result:**
- Three helper functions: `get_cors_origins()`, `get_cors_methods()`, `get_cors_headers()`
- Development: Wildcards allowed for methods/headers, localhost origins hardcoded
- Production: Explicit allowlists required, runtime validation of ALLOWED_ORIGINS env var
- Updated `main.py` using the helpers
- Comprehensive tests for both development and production modes
- Updated CLAUDE.md documenting CORS security rationale

---

## 🔒 Security Rationale

### Why CORS Wildcards Are Dangerous in Production

**The Attack Vector:**
CORS wildcards (`allow_origins=["*"]`, `allow_methods=["*"]`, `allow_headers=["*"]`) in production create multiple security risks:

1. **Data Exfiltration:** Any malicious website can make requests to your API and read responses (if credentials are not used)
2. **CSRF Amplification:** While CORS is not CSRF protection, wildcards remove a defense-in-depth layer
3. **Header Injection:** Allowing all headers (`["*"]`) permits custom headers that might bypass security middleware
4. **Method Confusion:** Allowing all methods enables attackers to use unexpected HTTP verbs (e.g., TRACE, CONNECT)

**IMPORTANT: CORS is Defense-in-Depth, NOT Primary Security:**
- CORS protects the **browser** from malicious JavaScript on other sites reading your API responses
- CORS does **NOT** protect your API from direct HTTP requests (curl, Postman, Python requests)
- Primary security comes from authentication (JWT tokens), authorization, and input validation
- CORS is an additional layer that limits what hostile frontend code can do

**The MDN Wildcard Rule:**
From [MDN CORS Documentation](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CORS#credentialed_requests_and_wildcards):
> When responding to a credentialed request:
> - The server **must not** specify the `*` wildcard for `Access-Control-Allow-Origin`
> - The server **must not** specify the `*` wildcard for `Access-Control-Allow-Headers`
> - The server **must not** specify the `*` wildcard for `Access-Control-Allow-Methods`

Since this API uses `allow_credentials=True` (for cookies/auth headers), wildcards would be rejected by browsers anyway.

**FastAPI Default Behavior:**
From [FastAPI CORS Documentation](https://fastapi.tiangolo.com/tutorial/cors/#use-corsmiddleware):
> The default parameters used by the `CORSMiddleware` implementation are restrictive by default, so you'll need to explicitly enable particular origins, methods, or headers.

Current `main.py` violates this by using wildcards for methods/headers.

---

## 📋 Acceptance Criteria

**Code Quality:**
- [ ] Three helper functions created in `backend/app/core/config.py`
- [ ] `get_cors_origins()` returns localhost list in dev, explicit origins in prod
- [ ] `get_cors_methods()` returns `["*"]` in dev, explicit list in prod
- [ ] `get_cors_headers()` returns `["*"]` in dev, explicit list in prod
- [ ] Production mode raises `ValueError` if `ALLOWED_ORIGINS` env var not set
- [ ] `backend/app/main.py` updated to use helpers in CORS middleware
- [ ] No hardcoded CORS config remains in `main.py`

**Testing:**
- [ ] 12+ unit tests in `backend/tests/core/test_config.py`
- [ ] Test: Development mode returns localhost origins
- [ ] Test: Development mode returns wildcard methods/headers
- [ ] Test: Production mode with ALLOWED_ORIGINS returns explicit lists
- [ ] Test: Production mode without ALLOWED_ORIGINS raises ValueError
- [ ] Test: ALLOWED_ORIGINS parsing handles comma-separated values
- [ ] Test: ALLOWED_ORIGINS parsing strips whitespace
- [ ] Test: Integration test verifies CORS middleware config
- [ ] All tests pass: `pytest backend/tests/core/test_config.py -v`

**Documentation:**
- [ ] Inline docstrings for all three helpers (with examples)
- [ ] CLAUDE.md updated with CORS security section
- [ ] Environment variable documentation added for ALLOWED_ORIGINS

**Code Review:**
- [ ] Subagent code review (Grade A expected)
- [ ] Security review: no wildcards in production code paths
- [ ] DX review: development mode still allows easy local testing

---

## 🛠️ Implementation Steps

### Step 1: Add ALLOWED_ORIGINS to Settings

**File:** `backend/app/core/config.py`

**Action:** Add `allowed_origins` field to Settings class with validation

**Code (insert after line 30, after `env: str = "development"`):**
```python
    # CORS Configuration
    allowed_origins: str = ""  # Comma-separated list of allowed origins for production

    @property
    def is_development(self) -> bool:
        """Check if running in development environment."""
        return self.env == "development"

    @property
    def is_production(self) -> bool:
        """Check if running in production environment."""
        return self.env == "production"
```

**Why:** Provides environment detection and CORS config storage

---

### Step 2: Implement get_cors_origins()

**File:** `backend/app/core/config.py`

**Action:** Add helper function after Settings class definition (after line 135)

**Code:**
```python
def get_cors_origins() -> list[str]:
    """
    Get CORS allowed origins based on environment.

    Development:
        Returns hardcoded localhost origins for frontend (5173) and backend (8000).
        Includes both localhost and 127.0.0.1 variants for compatibility.

    Production:
        Returns origins from ALLOWED_ORIGINS environment variable.
        Format: Comma-separated list of URLs (e.g., "https://app.example.com,https://www.example.com")
        Raises ValueError if ALLOWED_ORIGINS is not set.

    Returns:
        List of allowed origin URLs

    Raises:
        ValueError: If ALLOWED_ORIGINS is not set in production

    Examples:
        Development:
            >>> get_cors_origins()
            ['http://localhost:5173', 'http://localhost:8000', 'http://127.0.0.1:5173', 'http://127.0.0.1:8000']

        Production (with ALLOWED_ORIGINS="https://app.example.com"):
            >>> get_cors_origins()
            ['https://app.example.com']

    Security Note:
        Wildcard origins (["*"]) are NEVER returned. Production requires explicit allowlist.
        This prevents arbitrary websites from making authenticated requests to the API.
    """
    if settings.is_development:
        return [
            "http://localhost:5173",  # Vite dev server default port
            "http://localhost:8000",  # FastAPI dev server (for testing)
            "http://127.0.0.1:5173",  # Alternative localhost notation
            "http://127.0.0.1:8000"   # Alternative localhost notation
        ]

    # Production: Only allow explicitly configured origins
    if not settings.allowed_origins:
        raise ValueError(
            "ALLOWED_ORIGINS environment variable must be set in production. "
            "Example: ALLOWED_ORIGINS='https://app.example.com,https://www.example.com'"
        )

    # Parse comma-separated origins and strip whitespace
    origins = [origin.strip() for origin in settings.allowed_origins.split(",")]

    # Remove empty strings (in case of trailing commas)
    origins = [origin for origin in origins if origin]

    if not origins:
        raise ValueError(
            "ALLOWED_ORIGINS environment variable is set but contains no valid origins. "
            "Example: ALLOWED_ORIGINS='https://app.example.com'"
        )

    return origins
```

**Why:** 
- Development: Hardcoded localhost for fast iteration without env vars
- Production: Explicit allowlist prevents security issues
- Fail-fast validation ensures production misconfiguration is caught at startup

---

### Step 3: Implement get_cors_methods()

**File:** `backend/app/core/config.py`

**Action:** Add helper function after `get_cors_origins()`

**Code:**
```python
def get_cors_methods() -> list[str]:
    """
    Get CORS allowed methods based on environment.

    Development:
        Returns wildcard ["*"] to allow all HTTP methods for easy testing.

    Production:
        Returns explicit list of allowed HTTP methods.
        Only includes methods actually used by the API:
        - GET: Read operations
        - POST: Create operations
        - PUT: Full update operations
        - PATCH: Partial update operations
        - DELETE: Delete operations
        - OPTIONS: CORS preflight requests (always required)

    Returns:
        List of allowed HTTP methods

    Examples:
        Development:
            >>> get_cors_methods()
            ['*']

        Production:
            >>> get_cors_methods()
            ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']

    Security Note:
        Production excludes uncommon HTTP methods (TRACE, CONNECT, HEAD) to reduce attack surface.
        Wildcard is only used in development for developer convenience.

    CORS Preflight Note:
        OPTIONS is always required for CORS preflight requests.
        The browser sends OPTIONS before actual requests to check permissions.
        See: https://developer.mozilla.org/en-US/docs/Glossary/Preflight_request
    """
    if settings.is_development:
        return ["*"]

    # Production: Explicit methods only
    return ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]
```

**Why:**
- Development: Wildcard for easy testing (no preflight issues)
- Production: Only allows methods the API actually uses
- OPTIONS always included (required for CORS preflight)

---

### Step 4: Implement get_cors_headers()

**File:** `backend/app/core/config.py`

**Action:** Add helper function after `get_cors_methods()`

**Code:**
```python
def get_cors_headers() -> list[str]:
    """
    Get CORS allowed headers based on environment.

    Development:
        Returns wildcard ["*"] to allow all request headers for easy testing.

    Production:
        Returns explicit list of allowed request headers.
        Includes standard headers required for REST APIs with authentication:
        - Authorization: JWT bearer tokens
        - Content-Type: Request body format (application/json)
        - Accept: Response format preferences
        - Origin: CORS origin header (always sent by browser)
        - User-Agent: Client identification
        - DNT: Do Not Track privacy header
        - Cache-Control: Cache directives
        - X-Requested-With: AJAX request identification

    Returns:
        List of allowed request headers

    Examples:
        Development:
            >>> get_cors_headers()
            ['*']

        Production:
            >>> get_cors_headers()
            ['Authorization', 'Content-Type', 'Accept', 'Origin', 'User-Agent', 'DNT', 'Cache-Control', 'X-Requested-With']

    Security Note:
        Production only allows standard REST/auth headers to prevent header injection attacks.
        Custom application headers (X-Custom-*) can be added as needed but should be documented.

    CORS Simple Request Headers:
        Accept, Accept-Language, Content-Language, Content-Type (for certain MIME types)
        are always allowed by browsers for "simple requests" per CORS spec.
        We explicitly list them for clarity and consistency.
        See: https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS#simple_requests
    """
    if settings.is_development:
        return ["*"]

    # Production: Explicit headers only
    return [
        "Authorization",    # JWT bearer tokens (future auth implementation)
        "Content-Type",     # Request body format (application/json)
        "Accept",           # Response format preferences
        "Origin",           # CORS origin header (sent by browser)
        "User-Agent",       # Client identification
        "DNT",              # Do Not Track privacy header
        "Cache-Control",    # Cache directives
        "X-Requested-With"  # AJAX request identification (legacy, but common)
    ]
```

**Why:**
- Development: Wildcard for easy frontend development
- Production: Only standard REST/auth headers allowed
- Prevents header injection while supporting common use cases

---

### Step 5: Update main.py to Use Helpers

**File:** `backend/app/main.py`

**Action:** Replace hardcoded CORS middleware config with helper functions

**Current Code (lines 34-40):**
```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:8000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

**New Code:**
```python
from app.core.config import get_cors_origins, get_cors_methods, get_cors_headers

app.add_middleware(
    CORSMiddleware,
    allow_origins=get_cors_origins(),
    allow_credentials=True,
    allow_methods=get_cors_methods(),
    allow_headers=get_cors_headers(),
)
```

**Why:**
- Replaces hardcoded config with environment-aware helpers
- Same behavior in development, secure in production
- Single source of truth for CORS policy

---

### Step 6: Write Tests for Development Mode

**File:** `backend/tests/core/test_config.py`

**Action:** Add tests for development environment behavior

**Code (append to existing test file):**
```python
"""Tests for CORS configuration helpers"""
import pytest
from app.core.config import get_cors_origins, get_cors_methods, get_cors_headers, settings


class TestCorsHelpersDevelopment:
    """Test CORS helpers in development environment"""

    @pytest.fixture(autouse=True)
    def setup_development_env(self, monkeypatch):
        """Ensure development environment for all tests in this class"""
        monkeypatch.setattr(settings, "env", "development")

    def test_get_cors_origins_development(self):
        """Development mode should return localhost origins"""
        origins = get_cors_origins()

        assert isinstance(origins, list)
        assert len(origins) == 4
        assert "http://localhost:5173" in origins  # Vite dev server
        assert "http://localhost:8000" in origins  # FastAPI dev server
        assert "http://127.0.0.1:5173" in origins  # Alternative localhost
        assert "http://127.0.0.1:8000" in origins  # Alternative localhost

    def test_get_cors_methods_development(self):
        """Development mode should return wildcard methods"""
        methods = get_cors_methods()

        assert isinstance(methods, list)
        assert methods == ["*"]

    def test_get_cors_headers_development(self):
        """Development mode should return wildcard headers"""
        headers = get_cors_headers()

        assert isinstance(headers, list)
        assert headers == ["*"]


class TestCorsHelpersProduction:
    """Test CORS helpers in production environment"""

    @pytest.fixture(autouse=True)
    def setup_production_env(self, monkeypatch):
        """Ensure production environment for all tests in this class"""
        monkeypatch.setattr(settings, "env", "production")

    def test_get_cors_origins_production_missing_env_var(self, monkeypatch):
        """Production mode should raise error if ALLOWED_ORIGINS not set"""
        monkeypatch.setattr(settings, "allowed_origins", "")

        with pytest.raises(ValueError) as exc_info:
            get_cors_origins()

        assert "ALLOWED_ORIGINS environment variable must be set in production" in str(exc_info.value)

    def test_get_cors_origins_production_single_origin(self, monkeypatch):
        """Production mode should parse single origin"""
        monkeypatch.setattr(settings, "allowed_origins", "https://app.example.com")

        origins = get_cors_origins()

        assert isinstance(origins, list)
        assert origins == ["https://app.example.com"]

    def test_get_cors_origins_production_multiple_origins(self, monkeypatch):
        """Production mode should parse comma-separated origins"""
        monkeypatch.setattr(
            settings,
            "allowed_origins",
            "https://app.example.com,https://www.example.com,https://api.example.com"
        )

        origins = get_cors_origins()

        assert isinstance(origins, list)
        assert len(origins) == 3
        assert "https://app.example.com" in origins
        assert "https://www.example.com" in origins
        assert "https://api.example.com" in origins

    def test_get_cors_origins_production_strips_whitespace(self, monkeypatch):
        """Production mode should strip whitespace from origins"""
        monkeypatch.setattr(
            settings,
            "allowed_origins",
            " https://app.example.com , https://www.example.com "
        )

        origins = get_cors_origins()

        assert origins == ["https://app.example.com", "https://www.example.com"]

    def test_get_cors_origins_production_empty_after_strip(self, monkeypatch):
        """Production mode should raise error if ALLOWED_ORIGINS is whitespace only"""
        monkeypatch.setattr(settings, "allowed_origins", "   ,  , ")

        with pytest.raises(ValueError) as exc_info:
            get_cors_origins()

        assert "contains no valid origins" in str(exc_info.value)

    def test_get_cors_methods_production(self):
        """Production mode should return explicit methods list"""
        methods = get_cors_methods()

        assert isinstance(methods, list)
        assert len(methods) == 6
        assert "GET" in methods
        assert "POST" in methods
        assert "PUT" in methods
        assert "PATCH" in methods
        assert "DELETE" in methods
        assert "OPTIONS" in methods  # Required for CORS preflight
        assert "*" not in methods  # No wildcards in production

    def test_get_cors_headers_production(self):
        """Production mode should return explicit headers list"""
        headers = get_cors_headers()

        assert isinstance(headers, list)
        assert len(headers) == 8
        assert "Authorization" in headers  # JWT tokens
        assert "Content-Type" in headers  # Request body format
        assert "Accept" in headers  # Response format
        assert "Origin" in headers  # CORS header
        assert "User-Agent" in headers  # Client identification
        assert "DNT" in headers  # Do Not Track
        assert "Cache-Control" in headers  # Cache directives
        assert "X-Requested-With" in headers  # AJAX identification
        assert "*" not in headers  # No wildcards in production
```

**Run:** `cd backend && pytest tests/core/test_config.py::TestCorsHelpersDevelopment -v`
**Expected:** All 3 tests pass

**Run:** `cd backend && pytest tests/core/test_config.py::TestCorsHelpersProduction -v`
**Expected:** All 9 tests pass

**Why:**
- Tests both development and production modes
- Verifies wildcard behavior in dev
- Verifies explicit lists in production
- Tests error handling for missing config
- Tests edge cases (whitespace, empty strings)

---

### Step 7: Integration Test for CORS Middleware

**File:** `backend/tests/core/test_config.py`

**Action:** Add integration test verifying CORS middleware uses helpers

**Code (append to existing test file):**
```python
class TestCorsIntegration:
    """Integration tests for CORS middleware configuration"""

    def test_cors_middleware_development(self, monkeypatch):
        """CORS middleware should use development config in dev mode"""
        monkeypatch.setattr(settings, "env", "development")

        origins = get_cors_origins()
        methods = get_cors_methods()
        headers = get_cors_headers()

        # Development should use wildcards for methods/headers
        assert methods == ["*"]
        assert headers == ["*"]

        # Development should use localhost origins
        assert "http://localhost:5173" in origins

    def test_cors_middleware_production(self, monkeypatch):
        """CORS middleware should use production config in prod mode"""
        monkeypatch.setattr(settings, "env", "production")
        monkeypatch.setattr(settings, "allowed_origins", "https://app.example.com")

        origins = get_cors_origins()
        methods = get_cors_methods()
        headers = get_cors_headers()

        # Production should NOT use wildcards
        assert "*" not in methods
        assert "*" not in headers

        # Production should use explicit origins
        assert origins == ["https://app.example.com"]

    def test_cors_middleware_production_fails_without_config(self, monkeypatch):
        """CORS middleware should fail fast if production config missing"""
        monkeypatch.setattr(settings, "env", "production")
        monkeypatch.setattr(settings, "allowed_origins", "")

        with pytest.raises(ValueError) as exc_info:
            get_cors_origins()

        assert "ALLOWED_ORIGINS" in str(exc_info.value)
```

**Run:** `cd backend && pytest tests/core/test_config.py::TestCorsIntegration -v`
**Expected:** All 3 tests pass

**Why:** Ensures the helpers work correctly when used by FastAPI middleware

---

### Step 8: Update CLAUDE.md Documentation

**File:** `CLAUDE.md`

**Action:** Add CORS security section after "Security Notes" (around line 200)

**Code (insert after line 211, after "Production Roadmap:"):**
```markdown
**CORS Configuration (Environment-Aware):**
- Development: Wildcards allowed for methods/headers, localhost origins hardcoded
- Production: Explicit allowlists required, fail-fast validation
- Helper functions: `get_cors_origins()`, `get_cors_methods()`, `get_cors_headers()`
- Configuration: `ALLOWED_ORIGINS` environment variable (comma-separated URLs)

**CORS Security Principles:**
1. CORS is defense-in-depth, NOT primary security
2. CORS protects browsers from malicious JavaScript on other sites
3. CORS does NOT protect against direct HTTP requests (curl, Postman)
4. Wildcards (`["*"]`) are NEVER used in production
5. Production requires explicit origin allowlist via `ALLOWED_ORIGINS` env var
6. Primary security comes from authentication (JWT), authorization, input validation

**Example Production Configuration:**
```bash
# .env (production)
ENV=production
ALLOWED_ORIGINS=https://app.example.com,https://www.example.com
```

**CORS Preflight Requests:**
- Browser sends OPTIONS request before actual request (for non-simple requests)
- Checks if server allows the origin/method/headers
- FastAPI's CORSMiddleware handles preflight automatically
- OPTIONS method must be in allowed methods list (included by default)
```

**Why:** Documents CORS security for future developers and Claude threads

---

### Step 9: Run All Tests and Verify

**Action:** Run all config tests to verify implementation

**Commands:**
```bash
cd backend

# Run all CORS helper tests
pytest tests/core/test_config.py::TestCorsHelpersDevelopment -v
pytest tests/core/test_config.py::TestCorsHelpersProduction -v
pytest tests/core/test_config.py::TestCorsIntegration -v

# Run all config tests
pytest tests/core/test_config.py -v

# Check code coverage
pytest tests/core/test_config.py --cov=app.core.config --cov-report=term-missing
```

**Expected:**
- 15+ tests pass
- 100% coverage for new helper functions
- No warnings or errors

**Why:** Ensures implementation is correct before committing

---

### Step 10: Manual Testing

**Action:** Test CORS helpers in both development and production modes

**Test 1: Development Mode (default)**
```bash
cd backend

# Start FastAPI server (development mode is default)
uvicorn app.main:app --reload

# In another terminal, test CORS with curl
curl -H "Origin: http://localhost:5173" \
     -H "Access-Control-Request-Method: POST" \
     -H "Access-Control-Request-Headers: Content-Type" \
     -X OPTIONS \
     http://localhost:8000/api/health \
     -v
```

**Expected Response Headers:**
```
Access-Control-Allow-Origin: http://localhost:5173
Access-Control-Allow-Methods: *
Access-Control-Allow-Headers: *
Access-Control-Allow-Credentials: true
```

**Test 2: Production Mode (with ALLOWED_ORIGINS set)**
```bash
cd backend

# Create temporary production .env
cat > .env.test.production << 'DOTENV'
ENV=production
ALLOWED_ORIGINS=https://app.example.com
DATABASE_URL=postgresql+asyncpg://user:changeme@localhost/youtube_bookmarks
REDIS_URL=redis://localhost:6379
SECRET_KEY=test-secret-key-at-least-32-characters-long-for-jwt-tokens
YOUTUBE_API_KEY=test-key
GEMINI_API_KEY=test-key
DOTENV

# Start server with production config
ENV=production uvicorn app.main:app --reload --env-file .env.test.production

# Test CORS with allowed origin
curl -H "Origin: https://app.example.com" \
     -H "Access-Control-Request-Method: POST" \
     -H "Access-Control-Request-Headers: Content-Type" \
     -X OPTIONS \
     http://localhost:8000/api/health \
     -v
```

**Expected Response Headers:**
```
Access-Control-Allow-Origin: https://app.example.com
Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS
Access-Control-Allow-Headers: Authorization, Content-Type, Accept, Origin, User-Agent, DNT, Cache-Control, X-Requested-With
Access-Control-Allow-Credentials: true
```

**Test 3: Production Mode (without ALLOWED_ORIGINS)**
```bash
cd backend

# Create production .env without ALLOWED_ORIGINS
cat > .env.test.production.invalid << 'DOTENV'
ENV=production
DATABASE_URL=postgresql+asyncpg://user:changeme@localhost/youtube_bookmarks
REDIS_URL=redis://localhost:6379
SECRET_KEY=test-secret-key-at-least-32-characters-long-for-jwt-tokens
DOTENV

# Try to start server (should fail)
ENV=production uvicorn app.main:app --env-file .env.test.production.invalid
```

**Expected:**
```
ValueError: ALLOWED_ORIGINS environment variable must be set in production.
Example: ALLOWED_ORIGINS='https://app.example.com,https://www.example.com'
```

**Why:** Verifies fail-fast behavior prevents production misconfiguration

**Cleanup:**
```bash
rm .env.test.production .env.test.production.invalid
```

---

## 🔍 Design Decisions

### 1. Why Not Use `allow_origin_regex` Instead of Explicit List?

**Decision:** Use explicit origin list, not regex patterns

**Rationale:**
- **Security:** Regex is error-prone (typos can allow unintended origins)
- **Clarity:** Explicit list is easier to audit and understand
- **Performance:** String comparison is faster than regex matching
- **Debugging:** Easier to troubleshoot when origins are listed explicitly

**Trade-off:** Must update `ALLOWED_ORIGINS` when adding new production domains

---

### 2. Why Include Both `localhost` and `127.0.0.1` in Development?

**Decision:** Include both variants in development origins

**Rationale:**
- **Browser Behavior:** Some browsers treat `localhost` and `127.0.0.1` as different origins
- **Developer Tools:** Different tools may use different notation
- **DX:** Prevents "CORS error" confusion during local development

**Trade-off:** Slightly larger origin list (4 instead of 2)

---

### 3. Why Not Allow Custom Headers in Production by Default?

**Decision:** Production only allows standard REST/auth headers

**Rationale:**
- **Security:** Custom headers (e.g., `X-Custom-Token`) could be attack vectors
- **Principle of Least Privilege:** Only allow what's actually needed
- **Auditability:** Explicit list makes it clear what the API accepts

**How to Add Custom Headers:**
If the application needs custom headers in production (e.g., `X-API-Version`):
1. Add to `get_cors_headers()` return list
2. Document in CLAUDE.md
3. Add test case verifying the custom header is allowed

---

### 4. Why Fail Fast in Production Instead of Defaulting to Empty List?

**Decision:** Raise `ValueError` if `ALLOWED_ORIGINS` not set in production

**Rationale:**
- **Fail-Fast:** Better to crash at startup than silently block all CORS requests
- **Security:** Empty list would block all cross-origin requests (bad UX)
- **Developer Feedback:** Clear error message guides developers to fix config

**Trade-off:** Requires explicit production configuration (intentional)

---

### 5. Why Keep `allow_credentials=True`?

**Decision:** Keep credentials enabled for future JWT authentication

**Rationale:**
- **Future-Proof:** JWT tokens will be sent via `Authorization` header (requires credentials)
- **CORS Spec Compliance:** With credentials enabled, wildcards are already rejected by browsers
- **Consistency:** Matches the Security Hardening Plan (Task 1: JWT Authentication)

**Important:** With `allow_credentials=True`, wildcards for origins/methods/headers are **already forbidden by browsers** per CORS spec. This implementation makes that security explicit in the code.

---

## 📊 Testing Strategy

### Unit Tests (12 tests)
- Development mode: 3 tests (origins, methods, headers)
- Production mode: 6 tests (origins with config, origins missing config, methods, headers, whitespace handling, empty handling)
- Integration: 3 tests (dev config, prod config, fail-fast)

### Manual Tests (3 scenarios)
- Development mode with localhost origin
- Production mode with valid `ALLOWED_ORIGINS`
- Production mode without `ALLOWED_ORIGINS` (fail-fast)

### Coverage Target
- 100% coverage for new helper functions
- 100% coverage for Settings class additions

---

## 🚀 Deployment Checklist

**Before Deploying to Production:**
- [ ] Set `ENV=production` environment variable
- [ ] Set `ALLOWED_ORIGINS` to comma-separated list of production frontend URLs
- [ ] Verify no wildcards (`*`) in any CORS configuration
- [ ] Test CORS preflight requests with production origins
- [ ] Verify browser can make authenticated requests
- [ ] Monitor CORS errors in browser console
- [ ] Document production CORS configuration in deployment guide

**Example Production Environment Variables:**
```bash
ENV=production
ALLOWED_ORIGINS=https://app.example.com,https://www.example.com
DATABASE_URL=postgresql+asyncpg://user:password@db.example.com/youtube_bookmarks
REDIS_URL=redis://redis.example.com:6379
SECRET_KEY=<64-character-random-string>
YOUTUBE_API_KEY=<api-key>
GEMINI_API_KEY=<api-key>
```

---

## 📚 References

**CORS Specification & Best Practices:**
- [MDN: CORS](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS)
- [MDN: CORS Credentialed Requests and Wildcards](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS#credentialed_requests_and_wildcards)
- [MDN: CORS Simple Requests](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS#simple_requests)
- [MDN: CORS Preflight Requests](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS#preflighted_requests)

**FastAPI Documentation:**
- [FastAPI CORS Tutorial](https://fastapi.tiangolo.com/tutorial/cors/)
- [FastAPI CORSMiddleware Reference](https://fastapi.tiangolo.com/reference/middleware/#fastapi.middleware.cors.CORSMiddleware)

**Security Resources:**
- [OWASP: Cross-Origin Resource Sharing (CORS)](https://owasp.org/www-community/attacks/CORS_OriginHeaderScrutiny)
- [PortSwigger: CORS Vulnerabilities](https://portswigger.net/web-security/cors)

**Parent Plan:**
- `docs/plans/2025-11-02-security-hardening-implementation.md` (Task 3, lines 1263-1326)

---

## ✅ Definition of Done

- [ ] All 15+ tests pass with 100% coverage
- [ ] Manual testing completed for dev and prod modes
- [ ] CLAUDE.md updated with CORS security section
- [ ] Code reviewed by subagent (Grade A)
- [ ] No wildcards in production code paths
- [ ] Fail-fast validation prevents production misconfiguration
- [ ] Development mode still allows easy local testing
- [ ] Documentation includes production deployment checklist

---

**Estimated Time:** 2-3 hours (including testing and documentation)

**Priority:** P0 - Critical Security (must be implemented before Task 1: JWT Authentication)

**Next Tasks:**
- Task #122: Environment-aware rate limiting configuration
- Task #1: JWT Authentication System (depends on this task for secure CORS)
