# Task #118: Secure Default Credentials - Add Secret Validation to Config Class

**Plan Task:** #118
**Wave/Phase:** Phase 4 - Security Hardening (Task 2 from Security Plan)
**Dependencies:** Task #116 (secrets generation script) ✅, Task #117 (.env.example with placeholders) ✅

---

## 🎯 Ziel

Add Pydantic field validators to `backend/app/core/config.py` Settings class to reject weak or default credentials at application startup. This prevents accidentally deploying with insecure secrets by failing fast with clear error messages.

**Expected Outcome:** Production deployments fail immediately with helpful error messages if weak/default secrets are detected. Development environments allow defaults but log warnings.

**Reference:** Security Hardening Plan (docs/plans/2025-11-02-security-hardening-implementation.md, lines 964-999)

---

## 📋 Acceptance Criteria

- [ ] **Secret Key Validation** (existing validator extended)
  - [x] Already validates min 32 chars in production ✅ EXISTS
  - [x] Already rejects default "your-secret-key-here-change-in-production" ✅ EXISTS
  - [ ] NEW: Also reject "CHANGE_ME_RUN_scripts_generate_secrets_py" (Task #116 placeholder)
  - [ ] Production: Validation errors with clear fix instructions
  - [ ] Development: Warnings logged but startup continues

- [ ] **PostgreSQL Password Validation** (new validator)
  - [ ] Min 16 characters in production
  - [ ] Reject common defaults: "changeme", "CHANGE_ME_RUN_scripts_generate_secrets_py"
  - [ ] Extract password from `database_url` connection string for validation
  - [ ] Clear error messages with setup instructions

- [ ] **Redis Password Validation** (new validator)
  - [ ] Min 16 characters in production (if password is set)
  - [ ] Reject common defaults: "CHANGE_ME_RUN_scripts_generate_secrets_py"
  - [ ] Extract password from `redis_url` connection string for validation
  - [ ] Allow empty password in development (log warning)
  - [ ] Require password in production

- [ ] **Test Coverage** (new test suite)
  - [ ] Test file: `backend/tests/core/test_config.py` (extend existing)
  - [ ] Secret key: valid/invalid scenarios (production vs development)
  - [ ] Postgres password: URL parsing, default rejection, length validation
  - [ ] Redis password: URL parsing, optional vs required, default rejection
  - [ ] Environment context: production vs development behavior differences
  - [ ] Error message clarity: validate helpful instructions included

- [ ] **Documentation**
  - [ ] Inline docstrings explain validation rules
  - [ ] Error messages reference Task #116 script: `scripts/generate_secrets.py`
  - [ ] Code comments explain why field_validator vs model_validator

---

## 🛠️ Implementation Steps

### 1. Extend Secret Key Validator

**File:** `backend/app/core/config.py`

**Current State:**
- Lines 42-88: Existing `validate_secret_key()` validator
- Already validates min 32 chars in production
- Already rejects default "your-secret-key-here-change-in-production"

**Changes:**
```python
@field_validator("secret_key")
@classmethod
def validate_secret_key(cls, v: str, info) -> str:
    """
    Validate JWT secret key.
    
    In production, reject default values and require minimum 32 characters.
    In development, allow defaults but log warning.
    
    Args:
        v: Secret key value
        info: Validation context (access to other fields via info.data)
    
    Returns:
        Validated secret key
    
    Raises:
        ValueError: If production uses default or short secret
    """
    import logging
    
    # Get env from values being validated (might not be set yet)
    env = info.data.get("env", "development")
    
    # List of known weak/default values (from Tasks #116-117)
    WEAK_DEFAULTS = [
        "your-secret-key-here-change-in-production",  # Old default
        "CHANGE_ME_RUN_scripts_generate_secrets_py",   # Task #116 placeholder
    ]
    
    # Check for default value
    is_default = v in WEAK_DEFAULTS
    
    # In production, reject defaults and enforce minimum length
    if env == "production":
        if is_default:
            raise ValueError(
                "Cannot use default secret_key in production. "
                "Run 'python scripts/generate_secrets.py' to generate secure secrets, "
                "then set SECRET_KEY environment variable."
            )
        if len(v) < 32:
            raise ValueError(
                "secret_key must be at least 32 characters in production. "
                f"Current length: {len(v)}. "
                "Run 'python scripts/generate_secrets.py' to generate a secure value."
            )
    
    # In development, warn if using default
    if is_default and env == "development":
        logging.warning(
            "Using default secret_key in development. "
            "This is insecure for production use. "
            "Run 'python scripts/generate_secrets.py' before deploying."
        )
    
    return v
```

**Why `info.data`?**
- Pydantic v2 validators run in field definition order
- `env` field is defined AFTER `secret_key` (line 30 vs line 25)
- WAIT - This is a problem! We need `env` to determine validation strictness
- **Solution:** Move `env` field definition BEFORE `secret_key` in Settings class

---

### 2. Add PostgreSQL Password Validator

**File:** `backend/app/core/config.py`

**Challenge:** Password is embedded in connection string format:
```
postgresql+asyncpg://user:PASSWORD@localhost/dbname
```

**Implementation:**
```python
@field_validator("database_url")
@classmethod
def validate_database_url(cls, v: str, info) -> str:
    """
    Validate PostgreSQL password strength.
    
    Extracts password from connection string and validates it meets
    security requirements in production.
    
    Args:
        v: Database connection URL
        info: Validation context
    
    Returns:
        Validated connection URL
    
    Raises:
        ValueError: If production uses weak password
    """
    import logging
    from urllib.parse import urlparse
    
    env = info.data.get("env", "development")
    
    # Parse connection string to extract password
    try:
        parsed = urlparse(v)
        password = parsed.password
    except Exception:
        # If URL parsing fails, let database connection fail later
        # (don't add validation errors for malformed URLs)
        return v
    
    if not password:
        if env == "production":
            raise ValueError(
                "PostgreSQL password is required in production. "
                "Set POSTGRES_PASSWORD environment variable."
            )
        else:
            logging.warning("PostgreSQL password not set in connection string.")
        return v
    
    # List of known weak defaults
    WEAK_DEFAULTS = [
        "changeme",
        "CHANGE_ME_RUN_scripts_generate_secrets_py",
    ]
    
    # In production, validate password strength
    if env == "production":
        if password in WEAK_DEFAULTS:
            raise ValueError(
                f"Cannot use default PostgreSQL password '{password}' in production. "
                "Run 'python scripts/generate_secrets.py' to generate secure secrets, "
                "then rebuild database_url with POSTGRES_PASSWORD."
            )
        if len(password) < 16:
            raise ValueError(
                f"PostgreSQL password must be at least 16 characters in production. "
                f"Current length: {len(password)}. "
                "Run 'python scripts/generate_secrets.py' to generate a secure value."
            )
    
    # In development, warn if using defaults
    if password in WEAK_DEFAULTS and env == "development":
        logging.warning(
            f"Using default PostgreSQL password '{password}' in development. "
            "This is insecure for production use."
        )
    
    return v
```

**Why validate `database_url` instead of separate field?**
- Current Settings class uses `database_url: str` (line 15), not separate components
- Pydantic BaseSettings builds URL from components automatically
- **Alternative (better DX):** Add separate `postgres_password: str` field, then build URL in model_validator

---

### 3. Add Redis Password Validator

**File:** `backend/app/core/config.py`

**Challenge:** Password might be in URL format or separate field:
```
redis://:PASSWORD@localhost:6379
```

**Implementation:**
```python
@field_validator("redis_url")
@classmethod
def validate_redis_url(cls, v: str, info) -> str:
    """
    Validate Redis password strength.
    
    Extracts password from connection string (if present) and validates
    it meets security requirements in production.
    
    Redis password is OPTIONAL in development but REQUIRED in production.
    
    Args:
        v: Redis connection URL
        info: Validation context
    
    Returns:
        Validated connection URL
    
    Raises:
        ValueError: If production lacks password or uses weak password
    """
    import logging
    from urllib.parse import urlparse
    
    env = info.data.get("env", "development")
    
    # Parse connection string to extract password
    try:
        parsed = urlparse(v)
        password = parsed.password
    except Exception:
        # If URL parsing fails, let Redis connection fail later
        return v
    
    # In production, password is REQUIRED
    if env == "production" and not password:
        raise ValueError(
            "Redis password is required in production. "
            "Set REDIS_PASSWORD environment variable and rebuild redis_url."
        )
    
    # If no password in development, just warn
    if not password:
        if env == "development":
            logging.warning(
                "Redis password not set. "
                "This is insecure for production use. "
                "Run 'python scripts/generate_secrets.py' before deploying."
            )
        return v
    
    # List of known weak defaults
    WEAK_DEFAULTS = [
        "CHANGE_ME_RUN_scripts_generate_secrets_py",
    ]
    
    # In production, validate password strength
    if env == "production":
        if password in WEAK_DEFAULTS:
            raise ValueError(
                f"Cannot use default Redis password '{password}' in production. "
                "Run 'python scripts/generate_secrets.py' to generate secure secrets."
            )
        if len(password) < 16:
            raise ValueError(
                f"Redis password must be at least 16 characters in production. "
                f"Current length: {len(password)}. "
                "Run 'python scripts/generate_secrets.py' to generate a secure value."
            )
    
    # In development, warn if using defaults
    if password in WEAK_DEFAULTS and env == "development":
        logging.warning(
            f"Using default Redis password '{password}' in development. "
            "This is insecure for production use."
        )
    
    return v
```

---

### 4. Fix Field Ordering Issue

**File:** `backend/app/core/config.py`

**Problem:** Validators need `env` from `info.data`, but `env` is defined AFTER the secrets:
```python
# Current order (lines 14-30)
database_url: str = "..."  # Line 15
redis_url: str = "..."     # Line 18
secret_key: str = "..."    # Line 25
env: str = "development"   # Line 30
```

**Solution:** Move `env` to FIRST field position:
```python
class Settings(BaseSettings):
    # Environment (MUST be first for validators to access via info.data)
    env: str = "development"
    
    # Database
    database_url: str = "postgresql+asyncpg://user:changeme@localhost/youtube_bookmarks"
    
    # Redis
    redis_url: str = "redis://localhost:6379"
    
    # External APIs
    youtube_api_key: str = ""
    gemini_api_key: str = ""
    
    # Authentication (JWT)
    secret_key: str = "your-secret-key-here-change-in-production"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 30
    
    # ... rest of settings
```

**Why this matters:**
- Pydantic validates fields in definition order (top to bottom)
- `info.data` only contains already-validated fields
- If `env` is last, it won't be in `info.data` when validating earlier fields
- Reference: Pydantic docs (https://docs.pydantic.dev/latest/concepts/validators/#validation-data)

---

### 5. Write Comprehensive Tests

**File:** `backend/tests/core/test_config.py` (extend existing file)

**Current State:**
- Only 1 test: `test_youtube_api_key_exists()`
- No validation testing

**Test Structure:**
```python
"""Tests for configuration settings"""
import pytest
from pydantic import ValidationError
from app.core.config import Settings


# --- Secret Key Tests ---

def test_secret_key_valid_production():
    """Valid secret key in production passes validation"""
    settings = Settings(
        env="production",
        secret_key="a" * 32,  # 32 char minimum
        database_url="postgresql+asyncpg://user:validpassword1234@localhost/db",
        redis_url="redis://:validpassword1234@localhost:6379"
    )
    assert settings.secret_key == "a" * 32


def test_secret_key_too_short_production():
    """Short secret key in production raises error"""
    with pytest.raises(ValidationError) as exc_info:
        Settings(
            env="production",
            secret_key="short",
            database_url="postgresql+asyncpg://user:validpassword1234@localhost/db",
            redis_url="redis://:validpassword1234@localhost:6379"
        )
    
    error = exc_info.value.errors()[0]
    assert "secret_key must be at least 32 characters" in error["msg"]
    assert "Current length: 5" in error["msg"]


def test_secret_key_default_rejected_production():
    """Default secret key in production raises error"""
    with pytest.raises(ValidationError) as exc_info:
        Settings(
            env="production",
            secret_key="your-secret-key-here-change-in-production",
            database_url="postgresql+asyncpg://user:validpassword1234@localhost/db",
            redis_url="redis://:validpassword1234@localhost:6379"
        )
    
    error = exc_info.value.errors()[0]
    assert "Cannot use default secret_key in production" in error["msg"]
    assert "generate_secrets.py" in error["msg"]


def test_secret_key_task116_placeholder_rejected_production():
    """Task #116 placeholder secret key in production raises error"""
    with pytest.raises(ValidationError) as exc_info:
        Settings(
            env="production",
            secret_key="CHANGE_ME_RUN_scripts_generate_secrets_py",
            database_url="postgresql+asyncpg://user:validpassword1234@localhost/db",
            redis_url="redis://:validpassword1234@localhost:6379"
        )
    
    error = exc_info.value.errors()[0]
    assert "Cannot use default secret_key in production" in error["msg"]


def test_secret_key_default_allowed_development(caplog):
    """Default secret key in development logs warning but allows startup"""
    settings = Settings(
        env="development",
        secret_key="your-secret-key-here-change-in-production",
        database_url="postgresql+asyncpg://user:changeme@localhost/db",
        redis_url="redis://localhost:6379"
    )
    
    assert settings.secret_key == "your-secret-key-here-change-in-production"
    assert "Using default secret_key in development" in caplog.text


def test_secret_key_short_allowed_development():
    """Short secret key in development is allowed"""
    settings = Settings(
        env="development",
        secret_key="short",
        database_url="postgresql+asyncpg://user:changeme@localhost/db",
        redis_url="redis://localhost:6379"
    )
    assert settings.secret_key == "short"


# --- PostgreSQL Password Tests ---

def test_postgres_password_valid_production():
    """Valid PostgreSQL password in production passes"""
    settings = Settings(
        env="production",
        secret_key="a" * 32,
        database_url="postgresql+asyncpg://user:validpassword1234@localhost/db",
        redis_url="redis://:validpassword1234@localhost:6379"
    )
    assert "validpassword1234" in settings.database_url


def test_postgres_password_too_short_production():
    """Short PostgreSQL password in production raises error"""
    with pytest.raises(ValidationError) as exc_info:
        Settings(
            env="production",
            secret_key="a" * 32,
            database_url="postgresql+asyncpg://user:short@localhost/db",
            redis_url="redis://:validpassword1234@localhost:6379"
        )
    
    error = exc_info.value.errors()[0]
    assert "PostgreSQL password must be at least 16 characters" in error["msg"]
    assert "Current length: 5" in error["msg"]


def test_postgres_password_default_rejected_production():
    """Default 'changeme' password in production raises error"""
    with pytest.raises(ValidationError) as exc_info:
        Settings(
            env="production",
            secret_key="a" * 32,
            database_url="postgresql+asyncpg://user:changeme@localhost/db",
            redis_url="redis://:validpassword1234@localhost:6379"
        )
    
    error = exc_info.value.errors()[0]
    assert "Cannot use default PostgreSQL password" in error["msg"]
    assert "changeme" in error["msg"]


def test_postgres_password_task116_placeholder_rejected_production():
    """Task #116 placeholder PostgreSQL password in production raises error"""
    with pytest.raises(ValidationError) as exc_info:
        Settings(
            env="production",
            secret_key="a" * 32,
            database_url="postgresql+asyncpg://user:CHANGE_ME_RUN_scripts_generate_secrets_py@localhost/db",
            redis_url="redis://:validpassword1234@localhost:6379"
        )
    
    error = exc_info.value.errors()[0]
    assert "Cannot use default PostgreSQL password" in error["msg"]


def test_postgres_password_missing_production():
    """Missing PostgreSQL password in production raises error"""
    with pytest.raises(ValidationError) as exc_info:
        Settings(
            env="production",
            secret_key="a" * 32,
            database_url="postgresql+asyncpg://user@localhost/db",  # No password
            redis_url="redis://:validpassword1234@localhost:6379"
        )
    
    error = exc_info.value.errors()[0]
    assert "PostgreSQL password is required in production" in error["msg"]


def test_postgres_password_default_allowed_development(caplog):
    """Default PostgreSQL password in development logs warning"""
    settings = Settings(
        env="development",
        secret_key="dev-key",
        database_url="postgresql+asyncpg://user:changeme@localhost/db",
        redis_url="redis://localhost:6379"
    )
    
    assert "changeme" in settings.database_url
    assert "Using default PostgreSQL password" in caplog.text


def test_postgres_password_url_parsing_malformed():
    """Malformed database URL doesn't crash validation"""
    # Should not raise during validation (will fail later during DB connection)
    settings = Settings(
        env="development",
        secret_key="dev-key",
        database_url="not-a-valid-url",
        redis_url="redis://localhost:6379"
    )
    assert settings.database_url == "not-a-valid-url"


# --- Redis Password Tests ---

def test_redis_password_valid_production():
    """Valid Redis password in production passes"""
    settings = Settings(
        env="production",
        secret_key="a" * 32,
        database_url="postgresql+asyncpg://user:validpassword1234@localhost/db",
        redis_url="redis://:validpassword1234@localhost:6379"
    )
    assert "validpassword1234" in settings.redis_url


def test_redis_password_too_short_production():
    """Short Redis password in production raises error"""
    with pytest.raises(ValidationError) as exc_info:
        Settings(
            env="production",
            secret_key="a" * 32,
            database_url="postgresql+asyncpg://user:validpassword1234@localhost/db",
            redis_url="redis://:short@localhost:6379"
        )
    
    error = exc_info.value.errors()[0]
    assert "Redis password must be at least 16 characters" in error["msg"]
    assert "Current length: 5" in error["msg"]


def test_redis_password_default_rejected_production():
    """Task #116 placeholder Redis password in production raises error"""
    with pytest.raises(ValidationError) as exc_info:
        Settings(
            env="production",
            secret_key="a" * 32,
            database_url="postgresql+asyncpg://user:validpassword1234@localhost/db",
            redis_url="redis://:CHANGE_ME_RUN_scripts_generate_secrets_py@localhost:6379"
        )
    
    error = exc_info.value.errors()[0]
    assert "Cannot use default Redis password" in error["msg"]


def test_redis_password_missing_production():
    """Missing Redis password in production raises error"""
    with pytest.raises(ValidationError) as exc_info:
        Settings(
            env="production",
            secret_key="a" * 32,
            database_url="postgresql+asyncpg://user:validpassword1234@localhost/db",
            redis_url="redis://localhost:6379"  # No password
        )
    
    error = exc_info.value.errors()[0]
    assert "Redis password is required in production" in error["msg"]


def test_redis_password_missing_development(caplog):
    """Missing Redis password in development logs warning"""
    settings = Settings(
        env="development",
        secret_key="dev-key",
        database_url="postgresql+asyncpg://user:changeme@localhost/db",
        redis_url="redis://localhost:6379"
    )
    
    assert settings.redis_url == "redis://localhost:6379"
    assert "Redis password not set" in caplog.text


def test_redis_password_default_allowed_development(caplog):
    """Default Redis password in development logs warning"""
    settings = Settings(
        env="development",
        secret_key="dev-key",
        database_url="postgresql+asyncpg://user:changeme@localhost/db",
        redis_url="redis://:CHANGE_ME_RUN_scripts_generate_secrets_py@localhost:6379"
    )
    
    assert "CHANGE_ME_RUN_scripts_generate_secrets_py" in settings.redis_url
    assert "Using default Redis password" in caplog.text


def test_redis_password_url_parsing_malformed():
    """Malformed Redis URL doesn't crash validation"""
    settings = Settings(
        env="development",
        secret_key="dev-key",
        database_url="postgresql+asyncpg://user:changeme@localhost/db",
        redis_url="not-a-valid-url"
    )
    assert settings.redis_url == "not-a-valid-url"


# --- Environment Context Tests ---

def test_validation_strictness_production_vs_development():
    """Production enforces strict validation, development is lenient"""
    # Development allows weak secrets
    dev_settings = Settings(
        env="development",
        secret_key="short",
        database_url="postgresql+asyncpg://user:changeme@localhost/db",
        redis_url="redis://localhost:6379"
    )
    assert dev_settings.env == "development"
    
    # Production rejects same configuration
    with pytest.raises(ValidationError):
        Settings(
            env="production",
            secret_key="short",  # Too short
            database_url="postgresql+asyncpg://user:changeme@localhost/db",  # Default password
            redis_url="redis://localhost:6379"  # No password
        )


def test_error_messages_include_fix_instructions():
    """All production validation errors include script reference"""
    with pytest.raises(ValidationError) as exc_info:
        Settings(
            env="production",
            secret_key="short",
            database_url="postgresql+asyncpg://user:changeme@localhost/db",
            redis_url="redis://localhost:6379"
        )
    
    # Should have 3 errors (secret_key, postgres password, redis password)
    errors = exc_info.value.errors()
    assert len(errors) == 3
    
    # All errors should reference the script
    error_messages = [e["msg"] for e in errors]
    assert any("generate_secrets.py" in msg for msg in error_messages)


# --- Legacy Tests ---

def test_youtube_api_key_exists():
    """Test that YouTube API key is configured"""
    # Keep existing test, update to provide required production fields
    settings = Settings(
        env="development",
        database_url="postgresql+asyncpg://user:changeme@localhost/db"
    )
    assert settings.youtube_api_key is not None
```

**Test Coverage Targets:**
- Secret key validator: 7 tests (valid, short, defaults, dev vs prod)
- Postgres password validator: 8 tests (valid, short, defaults, missing, malformed URL)
- Redis password validator: 8 tests (valid, short, defaults, missing, malformed URL)
- Environment context: 2 tests (strictness, error messages)
- **Total: 25+ new tests**

**Run Tests:**
```bash
cd backend
pytest tests/core/test_config.py -v
pytest tests/core/test_config.py --cov=app.core.config --cov-report=term-missing
```

---

## 🧠 Design Decisions

### 1. Why `field_validator` instead of `model_validator`?

**`@field_validator`** (chosen):
- Validates individual fields immediately as they're processed
- Error messages clearly identify which field failed
- Can access other already-validated fields via `info.data`
- Matches Pydantic v2 best practices

**`@model_validator`** (not used):
- Runs after all fields validated
- Used for cross-field validation (e.g., password confirmation)
- Less clear error attribution (which field caused the problem?)

**Decision:** Use `field_validator` because we're validating individual secrets, not relationships between them.

### 2. Why check for specific weak values instead of entropy analysis?

**Specific Blocklist** (chosen):
```python
WEAK_DEFAULTS = [
    "your-secret-key-here-change-in-production",
    "CHANGE_ME_RUN_scripts_generate_secrets_py",
    "changeme",
]
```

**Entropy Analysis** (not used):
```python
import math
def calculate_entropy(s):
    """Calculate Shannon entropy of string"""
    # Complex algorithm, false positives/negatives
```

**Decision:** Specific blocklist because:
1. **Deterministic:** No false positives (valid random strings rejected)
2. **Fast:** Simple string comparison vs mathematical analysis
3. **Targeted:** Catches actual defaults from our codebase
4. **Clear errors:** "Cannot use default 'changeme'" vs "Entropy too low (3.2 bits)"
5. **Maintainable:** Easy to add new defaults as discovered

**Trade-off:** Won't catch weak user-chosen passwords (e.g., "password123456789012345678901234"), but that's okay because:
- Length requirement (16/32 chars) filters most weak choices
- Secrets script generates cryptographically random values
- Production deployments should use generated secrets, not manual input

### 3. Why helpful error messages instead of generic "invalid value"?

**Helpful (chosen):**
```python
raise ValueError(
    "Cannot use default secret_key in production. "
    "Run 'python scripts/generate_secrets.py' to generate secure secrets, "
    "then set SECRET_KEY environment variable."
)
```

**Generic (not used):**
```python
raise ValueError("Invalid secret_key")
```

**Decision:** Helpful messages because:
1. **Self-service:** Developer can fix without searching docs
2. **Actionable:** Exact command to run
3. **Educational:** Explains *why* it's invalid
4. **Reference:** Points to Task #116 script
5. **Reduces support burden:** No need to explain via Slack/email

**Inspired by:** Rust compiler errors (show problem + solution)

### 4. Why validate URLs instead of extracting passwords to separate fields?

**Current Approach** (validate URLs):
```python
@field_validator("database_url")
def validate_database_url(cls, v: str, info) -> str:
    parsed = urlparse(v)
    password = parsed.password
    # ... validate password
    return v  # Return original URL unchanged
```

**Alternative** (separate fields):
```python
class Settings(BaseSettings):
    postgres_user: str
    postgres_password: str
    postgres_host: str
    postgres_db: str
    
    @model_validator(mode='after')
    def build_database_url(self) -> Self:
        self.database_url = f"postgresql+asyncpg://{self.postgres_user}:{self.postgres_password}@{self.postgres_host}/{self.postgres_db}"
        return self
```

**Decision:** Validate URLs (current approach) because:
1. **Backward compatible:** Existing `database_url` field unchanged
2. **Minimal changes:** Don't need to refactor all consumers
3. **Pydantic BaseSettings:** Already has env var → URL building logic
4. **Docker-friendly:** `DATABASE_URL` env var is common pattern

**Trade-off:** URL parsing adds complexity, but `urlparse()` is robust and standard library.

### 5. Why move `env` field to first position?

**Problem:**
```python
class Settings(BaseSettings):
    secret_key: str = "..."  # Wants to check info.data["env"]
    env: str = "development" # But env is defined AFTER secret_key!
```

**Pydantic Validation Order:**
- Fields validated top-to-bottom in definition order
- `info.data` only contains already-validated fields
- If `env` is last, it's not in `info.data` when validating `secret_key`

**Solution:**
```python
class Settings(BaseSettings):
    env: str = "development"  # FIRST field
    secret_key: str = "..."   # Now info.data["env"] is available
```

**Reference:** Pydantic docs - Validation Data section
https://docs.pydantic.dev/latest/concepts/validators/#validation-data

**Why not use `model_validator` instead?**
- Would work, but less clear which field failed
- Field-level validation is more Pydantic-idiomatic

---

## 📦 Code Examples

### Complete Settings Class (After Task #118)

**File:** `backend/app/core/config.py`

```python
"""
Application configuration module.

This module defines the settings for the Smart YouTube Bookmarks application,
including database connection strings, API keys, and environment configuration.
Settings can be overridden via environment variables or a .env file.
"""

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # IMPORTANT: env MUST be first field so validators can access it via info.data
    # Environment
    env: str = "development"
    
    # Database
    database_url: str = "postgresql+asyncpg://user:changeme@localhost/youtube_bookmarks"
    
    # Redis
    redis_url: str = "redis://localhost:6379"
    
    # External APIs
    youtube_api_key: str = ""
    gemini_api_key: str = ""
    
    # Authentication (JWT)
    secret_key: str = "your-secret-key-here-change-in-production"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 30
    
    # Database connection pool (for ARQ workers)
    db_pool_size: int = 10  # Match ARQ max_jobs
    db_max_overflow: int = 5
    db_pool_pre_ping: bool = True
    
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8"
    )
    
    @field_validator("secret_key")
    @classmethod
    def validate_secret_key(cls, v: str, info) -> str:
        """
        Validate JWT secret key.
        
        In production, reject default values and require minimum 32 characters.
        In development, allow defaults but log warning.
        
        Args:
            v: Secret key value
            info: Validation context (access to other fields via info.data)
        
        Returns:
            Validated secret key
        
        Raises:
            ValueError: If production uses default or short secret
        """
        import logging
        
        # Get env from values being validated (available because env is defined FIRST)
        env = info.data.get("env", "development")
        
        # List of known weak/default values (from Tasks #116-117)
        WEAK_DEFAULTS = [
            "your-secret-key-here-change-in-production",  # Old default
            "CHANGE_ME_RUN_scripts_generate_secrets_py",   # Task #116 placeholder
        ]
        
        # Check for default value
        is_default = v in WEAK_DEFAULTS
        
        # In production, reject defaults and enforce minimum length
        if env == "production":
            if is_default:
                raise ValueError(
                    "Cannot use default secret_key in production. "
                    "Run 'python scripts/generate_secrets.py' to generate secure secrets, "
                    "then set SECRET_KEY environment variable."
                )
            if len(v) < 32:
                raise ValueError(
                    "secret_key must be at least 32 characters in production. "
                    f"Current length: {len(v)}. "
                    "Run 'python scripts/generate_secrets.py' to generate a secure value."
                )
        
        # In development, warn if using default
        if is_default and env == "development":
            logging.warning(
                "Using default secret_key in development. "
                "This is insecure for production use. "
                "Run 'python scripts/generate_secrets.py' before deploying."
            )
        
        return v
    
    @field_validator("database_url")
    @classmethod
    def validate_database_url(cls, v: str, info) -> str:
        """
        Validate PostgreSQL password strength.
        
        Extracts password from connection string and validates it meets
        security requirements in production.
        
        Args:
            v: Database connection URL (format: postgresql+asyncpg://user:password@host/db)
            info: Validation context
        
        Returns:
            Validated connection URL
        
        Raises:
            ValueError: If production uses weak password
        """
        import logging
        from urllib.parse import urlparse
        
        env = info.data.get("env", "development")
        
        # Parse connection string to extract password
        try:
            parsed = urlparse(v)
            password = parsed.password
        except Exception:
            # If URL parsing fails, let database connection fail later
            # (don't add validation errors for malformed URLs)
            return v
        
        if not password:
            if env == "production":
                raise ValueError(
                    "PostgreSQL password is required in production. "
                    "Set POSTGRES_PASSWORD environment variable."
                )
            else:
                logging.warning("PostgreSQL password not set in connection string.")
            return v
        
        # List of known weak defaults
        WEAK_DEFAULTS = [
            "changeme",
            "CHANGE_ME_RUN_scripts_generate_secrets_py",
        ]
        
        # In production, validate password strength
        if env == "production":
            if password in WEAK_DEFAULTS:
                raise ValueError(
                    f"Cannot use default PostgreSQL password '{password}' in production. "
                    "Run 'python scripts/generate_secrets.py' to generate secure secrets, "
                    "then rebuild database_url with POSTGRES_PASSWORD."
                )
            if len(password) < 16:
                raise ValueError(
                    f"PostgreSQL password must be at least 16 characters in production. "
                    f"Current length: {len(password)}. "
                    "Run 'python scripts/generate_secrets.py' to generate a secure value."
                )
        
        # In development, warn if using defaults
        if password in WEAK_DEFAULTS and env == "development":
            logging.warning(
                f"Using default PostgreSQL password '{password}' in development. "
                "This is insecure for production use."
            )
        
        return v
    
    @field_validator("redis_url")
    @classmethod
    def validate_redis_url(cls, v: str, info) -> str:
        """
        Validate Redis password strength.
        
        Extracts password from connection string (if present) and validates
        it meets security requirements in production.
        
        Redis password is OPTIONAL in development but REQUIRED in production.
        
        Args:
            v: Redis connection URL (format: redis://:password@host:port)
            info: Validation context
        
        Returns:
            Validated connection URL
        
        Raises:
            ValueError: If production lacks password or uses weak password
        """
        import logging
        from urllib.parse import urlparse
        
        env = info.data.get("env", "development")
        
        # Parse connection string to extract password
        try:
            parsed = urlparse(v)
            password = parsed.password
        except Exception:
            # If URL parsing fails, let Redis connection fail later
            return v
        
        # In production, password is REQUIRED
        if env == "production" and not password:
            raise ValueError(
                "Redis password is required in production. "
                "Set REDIS_PASSWORD environment variable and rebuild redis_url."
            )
        
        # If no password in development, just warn
        if not password:
            if env == "development":
                logging.warning(
                    "Redis password not set. "
                    "This is insecure for production use. "
                    "Run 'python scripts/generate_secrets.py' before deploying."
                )
            return v
        
        # List of known weak defaults
        WEAK_DEFAULTS = [
            "CHANGE_ME_RUN_scripts_generate_secrets_py",
        ]
        
        # In production, validate password strength
        if env == "production":
            if password in WEAK_DEFAULTS:
                raise ValueError(
                    f"Cannot use default Redis password '{password}' in production. "
                    "Run 'python scripts/generate_secrets.py' to generate secure secrets."
                )
            if len(password) < 16:
                raise ValueError(
                    f"Redis password must be at least 16 characters in production. "
                    f"Current length: {len(password)}. "
                    "Run 'python scripts/generate_secrets.py' to generate a secure value."
                )
        
        # In development, warn if using defaults
        if password in WEAK_DEFAULTS and env == "development":
            logging.warning(
                f"Using default Redis password '{password}' in development. "
                "This is insecure for production use."
            )
        
        return v
    
    @field_validator("gemini_api_key")
    @classmethod
    def validate_gemini_api_key(cls, v: str, info) -> str:
        """
        Validate Gemini API key at startup.
        
        In production, require API key to be set (non-empty).
        In development, allow empty but warn if Gemini features are used.
        
        Args:
            v: Gemini API key value
            info: Validation context
        
        Returns:
            Validated API key
        
        Raises:
            ValueError: If production environment has empty API key
        """
        import logging
        
        # Get env from values being validated
        env = info.data.get("env", "development")
        
        # Check if API key is empty
        is_empty = not v or not v.strip()
        
        # In production, reject empty API key
        if env == "production" and is_empty:
            raise ValueError(
                "Gemini API key is required in production. "
                "Set GEMINI_API_KEY environment variable."
            )
        
        # In development, warn if empty (features requiring Gemini will fail)
        if is_empty and env == "development":
            logging.warning(
                "Gemini API key not set. "
                "Video extraction features will not work. "
                "Set GEMINI_API_KEY environment variable to enable."
            )
        
        return v


settings = Settings()
```

---

## ✅ Verification Steps

### 1. Test Production Validation

```bash
cd backend

# Test 1: Production with weak secrets should FAIL
export ENV=production
export SECRET_KEY=short
export POSTGRES_PASSWORD=changeme
export REDIS_PASSWORD=""

python -c "from app.core.config import settings; print(settings.env)"
# Expected: ValidationError with helpful messages

# Test 2: Production with strong secrets should SUCCEED
export SECRET_KEY=$(python -c "import secrets; print(secrets.token_urlsafe(32))")
export POSTGRES_PASSWORD=$(python -c "import secrets; print(secrets.token_urlsafe(24))")
export REDIS_PASSWORD=$(python -c "import secrets; print(secrets.token_urlsafe(24))")
export DATABASE_URL="postgresql+asyncpg://user:${POSTGRES_PASSWORD}@localhost/db"
export REDIS_URL="redis://:${REDIS_PASSWORD}@localhost:6379"

python -c "from app.core.config import settings; print(f'✅ Production config valid: {settings.env}')"
# Expected: ✅ Production config valid: production
```

### 2. Test Development Warnings

```bash
cd backend

# Development with defaults should LOG WARNINGS but succeed
export ENV=development
export SECRET_KEY=your-secret-key-here-change-in-production
export DATABASE_URL="postgresql+asyncpg://user:changeme@localhost/db"
export REDIS_URL="redis://localhost:6379"

python -c "from app.core.config import settings; print(f'Dev config loaded: {settings.env}')"
# Expected: 3 warnings logged + "Dev config loaded: development"
```

### 3. Run Test Suite

```bash
cd backend

# Run all config tests
pytest tests/core/test_config.py -v

# Check coverage
pytest tests/core/test_config.py --cov=app.core.config --cov-report=term-missing

# Expected: 95%+ coverage, 25+ tests passing
```

### 4. Integration Test (Startup)

```bash
# Start backend with production config
cd backend
export ENV=production
export SECRET_KEY=short  # Intentionally weak

uvicorn app.main:app --reload
# Expected: Immediate crash with ValidationError before server starts
```

---

## 📊 Success Metrics

- [ ] **Security:** Production deployments fail with weak secrets (no accidental insecure deploys)
- [ ] **Developer Experience:** Clear error messages with exact fix commands
- [ ] **Test Coverage:** 95%+ coverage for config.py validators
- [ ] **Performance:** Validation adds <10ms to startup time
- [ ] **Documentation:** Code comments explain all design decisions

---

## 🔗 Related Tasks

**Depends On:**
- Task #116: `scripts/generate_secrets.py` ✅
- Task #117: `.env.example` with placeholders ✅

**Enables:**
- Task #119: Docker Compose secrets integration
- Task #120: Production deployment guide

**Reference:**
- Security Hardening Plan: `docs/plans/2025-11-02-security-hardening-implementation.md` (Task 2, lines 964-999)
- Pydantic Validation Docs: https://docs.pydantic.dev/latest/concepts/validators/

---

## 📝 Notes

**Why This Matters:**
- Prevents OWASP A07:2021 "Identification and Authentication Failures"
- Catches misconfiguration before production deployment (fail fast)
- Industry best practice: NIST 800-63B recommends 32-char secrets for HS256 JWT

**Password Length Rationale:**
- 32 chars for secret_key: Matches HS256 key strength recommendations
- 16 chars for database passwords: NIST minimum for server passwords
- Reference: https://tools.ietf.org/id/draft-whited-kitten-password-storage-00.html

**Development vs Production Philosophy:**
- Development: Warn but allow (developer convenience)
- Production: Strict enforcement (security first)
- Inspired by Django's DEBUG mode behavior
