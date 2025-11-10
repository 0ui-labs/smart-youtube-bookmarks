# Task #120: Environment-Aware Configuration - Implement Environment Enum and Settings

**Plan Task:** #120
**Wave/Phase:** Security Hardening Phase (Task 3 from security-hardening-implementation.md)
**Dependencies:** None

---

## 🎯 Ziel

Implement production-grade environment-aware configuration system using Pydantic Settings with Environment enum, computed properties, and strict validators to enforce security constraints based on deployment context (DEVELOPMENT, STAGING, PRODUCTION).

**Outcome:** Backend configuration will automatically enforce environment-specific security rules (e.g., debug=False in production, no default secrets in production) and provide computed properties for conditional logic throughout the codebase.

## 📋 Acceptance Criteria

- [ ] Environment enum created with DEVELOPMENT, STAGING, PRODUCTION values
- [ ] Settings class has `environment` field with Environment type
- [ ] Computed properties `is_production` and `is_development` implemented using `@computed_field`
- [ ] Validator enforces `debug=False` in production
- [ ] Validator enforces strong `secret_key` in production (no defaults)
- [ ] All existing validators updated to use `environment` field (not `env`)
- [ ] Test suite covers all validators and computed properties (10+ tests)
- [ ] CLAUDE.md updated with Environment configuration patterns
- [ ] All tests passing (0 new TypeScript errors, 0 pytest failures)

---

## 🛠️ Implementation Steps

### Step 1: Read Security Hardening Plan
**Files:** `docs/plans/2025-11-02-security-hardening-implementation.md` (lines 1102-1262)
**Action:** Study Task 3 implementation example and TDD test cases

**Context:**
- Task 3 shows complete Environment enum + Settings implementation
- Tests demonstrate environment-specific CORS/debug/secret_key validation
- Pattern: computed properties for conditional logic throughout codebase

---

### Step 2: Create Environment Enum (TDD - Write Failing Test First)
**Files:** `backend/tests/core/test_config.py`
**Action:** Write failing test for Environment enum before implementation

```python
"""Tests for configuration management."""
import pytest
import os
from pydantic import ValidationError


def test_environment_enum_has_three_values():
    """Test that Environment enum has DEVELOPMENT, STAGING, PRODUCTION."""
    from app.core.config import Environment
    
    assert Environment.DEVELOPMENT == "development"
    assert Environment.STAGING == "staging"
    assert Environment.PRODUCTION == "production"
    assert len(Environment) == 3


def test_environment_enum_is_str_enum():
    """Test that Environment enum inherits from str for Pydantic compatibility."""
    from app.core.config import Environment
    
    # Enum should be string-comparable for Pydantic validation
    assert isinstance(Environment.DEVELOPMENT, str)
    assert Environment.PRODUCTION == "production"
```

**Run:** `cd backend && pytest tests/core/test_config.py::test_environment_enum_has_three_values -v`
**Expected:** `FAIL` - ImportError: cannot import name 'Environment'

---

### Step 3: Implement Environment Enum
**Files:** `backend/app/core/config.py`
**Action:** Create Environment enum with str inheritance for Pydantic compatibility

```python
"""
Application configuration management.

Provides environment-aware settings for development, staging, and production.
"""

from enum import Enum
from typing import Optional

from pydantic import field_validator, computed_field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Environment(str, Enum):
    """
    Application environment types.
    
    Inherits from str to ensure Pydantic can validate environment variables
    like ENVIRONMENT=production without enum member syntax.
    """
    
    DEVELOPMENT = "development"
    STAGING = "staging"
    PRODUCTION = "production"


class Settings(BaseSettings):
    # ... (existing fields remain)
```

**Why str inheritance?**
- Pydantic Settings reads environment variables as strings
- `Environment.PRODUCTION` works in code, but `ENVIRONMENT=production` works in .env
- REF: https://docs.pydantic.dev/latest/concepts/models/#enums-and-choices

**Run:** `pytest tests/core/test_config.py::test_environment_enum_has_three_values -v`
**Expected:** `PASS` (2/2 tests)

---

### Step 4: Add `environment` Field to Settings (TDD)
**Files:** `backend/tests/core/test_config.py`
**Action:** Write test for Settings.environment field with default value

```python
def test_settings_environment_defaults_to_development():
    """Test that environment defaults to DEVELOPMENT for safety."""
    from app.core.config import Settings
    
    # Create Settings without ENVIRONMENT env var
    settings = Settings(
        secret_key="x" * 32,  # Valid secret
        postgres_password="test123"
    )
    
    assert settings.environment == "development"


def test_settings_environment_can_be_set_to_production():
    """Test that ENVIRONMENT env var overrides default."""
    import os
    from app.core.config import Settings
    
    os.environ['ENVIRONMENT'] = 'production'
    settings = Settings(
        secret_key="x" * 32,
        postgres_password="test123"
    )
    
    assert settings.environment == "production"
    del os.environ['ENVIRONMENT']
```

**Run:** `pytest tests/core/test_config.py -k "environment_defaults or environment_can_be_set" -v`
**Expected:** `FAIL` - Settings has no field `environment`

---

### Step 5: Implement `environment` Field in Settings
**Files:** `backend/app/core/config.py`
**Action:** Add environment field and remove old `env` field

```python
class Settings(BaseSettings):
    # Environment (NEW - replaces old `env` field)
    environment: Environment = Environment.DEVELOPMENT
    
    # Security
    secret_key: str
    access_token_expire_minutes: int = 30
    
    # Database
    postgres_db: str = "youtube_bookmarks"
    postgres_user: str = "youtube_user"
    postgres_password: str
    database_url: Optional[str] = None
    
    # Redis
    redis_url: str = "redis://localhost:6379/0"
    redis_password: Optional[str] = None
    
    # External APIs
    youtube_api_key: str = ""
    gemini_api_key: str = ""
    
    # Database connection pool
    db_pool_size: int = 10
    db_max_overflow: int = 5
    db_pool_pre_ping: bool = True
    
    # JWT
    algorithm: str = "HS256"
    
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False  # ENVIRONMENT or environment both work
    )
```

**IMPORTANT:** Remove old `env: str = "development"` field - replaced by typed `environment: Environment`

**Run:** `pytest tests/core/test_config.py -k "environment_defaults or environment_can_be_set" -v`
**Expected:** `PASS` (2/2 tests)

---

### Step 6: Add Computed Properties (TDD)
**Files:** `backend/tests/core/test_config.py`
**Action:** Write tests for `is_production` and `is_development` computed properties

```python
def test_is_production_returns_true_for_production():
    """Test that is_production computed property works."""
    from app.core.config import Settings, Environment
    
    settings = Settings(
        environment=Environment.PRODUCTION,
        secret_key="x" * 32,
        postgres_password="test123"
    )
    
    assert settings.is_production is True
    assert settings.is_development is False


def test_is_development_returns_true_for_development():
    """Test that is_development computed property works."""
    from app.core.config import Settings, Environment
    
    settings = Settings(
        environment=Environment.DEVELOPMENT,
        secret_key="x" * 32,
        postgres_password="test123"
    )
    
    assert settings.is_development is True
    assert settings.is_production is False


def test_staging_is_neither_production_nor_development():
    """Test that staging environment has both flags False."""
    from app.core.config import Settings, Environment
    
    settings = Settings(
        environment=Environment.STAGING,
        secret_key="x" * 32,
        postgres_password="test123"
    )
    
    assert settings.is_production is False
    assert settings.is_development is False
```

**Run:** `pytest tests/core/test_config.py -k "is_production or is_development or staging_is_neither" -v`
**Expected:** `FAIL` - AttributeError: 'Settings' object has no attribute 'is_production'

---

### Step 7: Implement Computed Properties
**Files:** `backend/app/core/config.py`
**Action:** Add `@computed_field` decorated properties for convenience

```python
class Settings(BaseSettings):
    # ... (fields from Step 5)
    
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False
    )
    
    # Computed properties for conditional logic
    @computed_field
    @property
    def is_production(self) -> bool:
        """
        Check if running in production environment.
        
        Use this for production-only features (e.g., strict security checks).
        
        Returns:
            True if environment is PRODUCTION, False otherwise
        """
        return self.environment == Environment.PRODUCTION
    
    @computed_field
    @property
    def is_development(self) -> bool:
        """
        Check if running in development environment.
        
        Use this for development-only features (e.g., debug endpoints).
        
        Returns:
            True if environment is DEVELOPMENT, False otherwise
        """
        return self.environment == Environment.DEVELOPMENT
```

**Why `@computed_field` + `@property`?**
- Pydantic v2 requires both decorators for computed properties
- `@computed_field` includes property in serialization (model_dump, JSON schema)
- `@property` makes it readable like a field (settings.is_production, not settings.is_production())
- REF: https://docs.pydantic.dev/latest/concepts/fields/#the-computed-field-decorator

**Alternative (methods vs properties):**
- Methods: `settings.is_production()` - more explicit but verbose
- Properties: `settings.is_production` - cleaner for boolean flags
- **Decision:** Properties preferred for boolean flags (follows Python convention)

**Run:** `pytest tests/core/test_config.py -k "is_production or is_development or staging_is_neither" -v`
**Expected:** `PASS` (3/3 tests)

---

### Step 8: Add Debug Validator (TDD)
**Files:** `backend/tests/core/test_config.py`
**Action:** Write test enforcing debug=False in production

```python
def test_production_rejects_debug_true():
    """Test that production environment cannot have debug=True."""
    from app.core.config import Settings, Environment
    from pydantic import ValidationError
    
    with pytest.raises(ValidationError) as exc_info:
        Settings(
            environment=Environment.PRODUCTION,
            debug=True,  # Should fail
            secret_key="x" * 32,
            postgres_password="test123"
        )
    
    errors = exc_info.value.errors()
    assert any("DEBUG must be False in production" in str(e) for e in errors)


def test_development_allows_debug_true():
    """Test that development environment allows debug=True."""
    from app.core.config import Settings, Environment
    
    settings = Settings(
        environment=Environment.DEVELOPMENT,
        debug=True,  # Should succeed
        secret_key="x" * 32,
        postgres_password="test123"
    )
    
    assert settings.debug is True
```

**Run:** `pytest tests/core/test_config.py -k "debug" -v`
**Expected:** `FAIL` - Settings has no field `debug`

---

### Step 9: Implement Debug Field and Validator
**Files:** `backend/app/core/config.py`
**Action:** Add debug field with environment-aware validator

```python
class Settings(BaseSettings):
    # Environment
    environment: Environment = Environment.DEVELOPMENT
    debug: bool = False  # NEW field
    
    # Security
    secret_key: str
    # ... (rest of fields)
    
    # Computed properties (from Step 7)
    @computed_field
    @property
    def is_production(self) -> bool: ...
    
    @computed_field
    @property
    def is_development(self) -> bool: ...
    
    # Validators
    @field_validator('debug')
    @classmethod
    def validate_debug(cls, v: bool, info) -> bool:
        """
        Ensure debug is disabled in production.
        
        Prevent accidental debug mode in production (exposes sensitive data).
        
        Args:
            v: debug value
            info: Validation context with other field values
            
        Returns:
            Validated debug value
            
        Raises:
            ValueError: If production environment has debug=True
        """
        env = info.data.get('environment', Environment.DEVELOPMENT)
        
        if env == Environment.PRODUCTION and v:
            raise ValueError("DEBUG must be False in production")
        
        return v
```

**Run:** `pytest tests/core/test_config.py -k "debug" -v`
**Expected:** `PASS` (2/2 tests)

---

### Step 10: Update secret_key Validator (TDD)
**Files:** `backend/tests/core/test_config.py`
**Action:** Write tests for production secret_key validation using `environment` field

```python
def test_production_rejects_default_secret_key():
    """Test that production rejects default secret_key."""
    from app.core.config import Settings, Environment
    from pydantic import ValidationError
    
    with pytest.raises(ValidationError) as exc_info:
        Settings(
            environment=Environment.PRODUCTION,
            secret_key="your-secret-key-here-change-in-production",
            postgres_password="test123"
        )
    
    errors = exc_info.value.errors()
    assert any("default" in str(e).lower() for e in errors)


def test_production_requires_32_char_secret_key():
    """Test that production requires at least 32 characters."""
    from app.core.config import Settings, Environment
    from pydantic import ValidationError
    
    with pytest.raises(ValidationError) as exc_info:
        Settings(
            environment=Environment.PRODUCTION,
            secret_key="short",  # Only 5 chars
            postgres_password="test123"
        )
    
    errors = exc_info.value.errors()
    assert any("32 characters" in str(e) for e in errors)


def test_development_allows_short_secret_key():
    """Test that development allows short secret_key for convenience."""
    from app.core.config import Settings, Environment
    
    settings = Settings(
        environment=Environment.DEVELOPMENT,
        secret_key="dev",  # Short but allowed
        postgres_password="test123"
    )
    
    assert settings.secret_key == "dev"
```

**Run:** `pytest tests/core/test_config.py -k "secret_key" -v`
**Expected:** Some tests fail (validator still uses old `env` field)

---

### Step 11: Refactor secret_key Validator to Use environment
**Files:** `backend/app/core/config.py`
**Action:** Update existing validator to use `environment` field instead of `env`

**BEFORE (current implementation):**
```python
@field_validator("secret_key")
@classmethod
def validate_secret_key(cls, v: str, info) -> str:
    env = info.data.get("env", "development")  # OLD: uses `env` field
    
    is_default = v == "your-secret-key-here-change-in-production"
    
    if env == "production":  # OLD: string comparison
        if is_default:
            raise ValueError(...)
        if len(v) < 32:
            raise ValueError(...)
    
    if is_default and env == "development":
        import logging
        logging.warning(...)
    
    return v
```

**AFTER (updated implementation):**
```python
@field_validator("secret_key")
@classmethod
def validate_secret_key(cls, v: str, info) -> str:
    """
    Validate JWT secret key.
    
    In production, reject default value and require minimum 32 characters.
    In development, allow default but log warning.
    
    Args:
        v: Secret key value
        info: Validation context
        
    Returns:
        Validated secret key
        
    Raises:
        ValueError: If production uses default or short secret
    """
    # NEW: Use environment field with Enum comparison
    env = info.data.get('environment', Environment.DEVELOPMENT)
    
    # Check for default value
    is_default = v == "your-secret-key-here-change-in-production"
    
    # In production, reject default and enforce minimum length
    if env == Environment.PRODUCTION:  # NEW: Enum comparison
        if is_default:
            raise ValueError(
                "Cannot use default secret_key in production. "
                "Set SECRET_KEY environment variable to a secure random value."
            )
        if len(v) < 32:
            raise ValueError(
                "secret_key must be at least 32 characters in production. "
                f"Current length: {len(v)}"
            )
    
    # In development, just warn if using default
    if is_default and env == Environment.DEVELOPMENT:  # NEW: Enum comparison
        import logging
        logging.warning(
            "Using default secret_key in development. "
            "This is insecure for production use."
        )
    
    return v
```

**Changes:**
1. `info.data.get("env")` → `info.data.get("environment")`
2. Default changed to `Environment.DEVELOPMENT` (enum, not string)
3. `env == "production"` → `env == Environment.PRODUCTION` (enum comparison)
4. `env == "development"` → `env == Environment.DEVELOPMENT`

**Run:** `pytest tests/core/test_config.py -k "secret_key" -v`
**Expected:** `PASS` (3/3 tests)

---

### Step 12: Update gemini_api_key Validator
**Files:** `backend/app/core/config.py`
**Action:** Refactor validator to use `environment` field

**BEFORE:**
```python
@field_validator("gemini_api_key")
@classmethod
def validate_gemini_api_key(cls, v: str, info) -> str:
    env = info.data.get("env", "development")  # OLD
    
    is_empty = not v or not v.strip()
    
    if env == "production" and is_empty:  # OLD: string comparison
        raise ValueError(...)
    
    if is_empty and env == "development":  # OLD: string comparison
        logging.warning(...)
    
    return v
```

**AFTER:**
```python
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
    
    # NEW: Use environment field
    env = info.data.get('environment', Environment.DEVELOPMENT)
    
    # Check if API key is empty
    is_empty = not v or not v.strip()
    
    # In production, reject empty API key
    if env == Environment.PRODUCTION and is_empty:  # NEW: Enum comparison
        raise ValueError(
            "Gemini API key is required in production. "
            "Set GEMINI_API_KEY environment variable."
        )
    
    # In development, warn if empty
    if is_empty and env == Environment.DEVELOPMENT:  # NEW: Enum comparison
        logging.warning(
            "Gemini API key not set. "
            "Video extraction features will not work. "
            "Set GEMINI_API_KEY environment variable to enable."
        )
    
    return v
```

**Run:** `pytest tests/core/test_gemini_api_key -v` (if such tests exist)
**Expected:** `PASS` (all tests)

---

### Step 13: Write Full Test Suite
**Files:** `backend/tests/core/test_config.py`
**Action:** Complete test coverage for all environment scenarios

```python
"""Tests for configuration management."""
import pytest
import os
import logging
from pydantic import ValidationError


class TestEnvironmentEnum:
    """Tests for Environment enum."""
    
    def test_environment_enum_has_three_values(self):
        """Test that Environment enum has DEVELOPMENT, STAGING, PRODUCTION."""
        from app.core.config import Environment
        
        assert Environment.DEVELOPMENT == "development"
        assert Environment.STAGING == "staging"
        assert Environment.PRODUCTION == "production"
        assert len(Environment) == 3
    
    def test_environment_enum_is_str_enum(self):
        """Test that Environment enum inherits from str for Pydantic compatibility."""
        from app.core.config import Environment
        
        assert isinstance(Environment.DEVELOPMENT, str)
        assert Environment.PRODUCTION == "production"


class TestSettingsEnvironmentField:
    """Tests for Settings.environment field."""
    
    def test_settings_environment_defaults_to_development(self):
        """Test that environment defaults to DEVELOPMENT for safety."""
        from app.core.config import Settings
        
        settings = Settings(
            secret_key="x" * 32,
            postgres_password="test123"
        )
        
        assert settings.environment == "development"
    
    def test_settings_environment_can_be_set_to_production(self):
        """Test that ENVIRONMENT env var overrides default."""
        from app.core.config import Settings, Environment
        
        old_env = os.environ.get('ENVIRONMENT')
        os.environ['ENVIRONMENT'] = 'production'
        
        try:
            settings = Settings(
                secret_key="x" * 32,
                postgres_password="test123"
            )
            assert settings.environment == Environment.PRODUCTION
        finally:
            if old_env:
                os.environ['ENVIRONMENT'] = old_env
            else:
                del os.environ['ENVIRONMENT']


class TestComputedProperties:
    """Tests for computed properties."""
    
    def test_is_production_returns_true_for_production(self):
        """Test that is_production computed property works."""
        from app.core.config import Settings, Environment
        
        settings = Settings(
            environment=Environment.PRODUCTION,
            secret_key="x" * 32,
            postgres_password="test123"
        )
        
        assert settings.is_production is True
        assert settings.is_development is False
    
    def test_is_development_returns_true_for_development(self):
        """Test that is_development computed property works."""
        from app.core.config import Settings, Environment
        
        settings = Settings(
            environment=Environment.DEVELOPMENT,
            secret_key="x" * 32,
            postgres_password="test123"
        )
        
        assert settings.is_development is True
        assert settings.is_production is False
    
    def test_staging_is_neither_production_nor_development(self):
        """Test that staging environment has both flags False."""
        from app.core.config import Settings, Environment
        
        settings = Settings(
            environment=Environment.STAGING,
            secret_key="x" * 32,
            postgres_password="test123"
        )
        
        assert settings.is_production is False
        assert settings.is_development is False


class TestDebugValidator:
    """Tests for debug field validation."""
    
    def test_production_rejects_debug_true(self):
        """Test that production environment cannot have debug=True."""
        from app.core.config import Settings, Environment
        
        with pytest.raises(ValidationError) as exc_info:
            Settings(
                environment=Environment.PRODUCTION,
                debug=True,
                secret_key="x" * 32,
                postgres_password="test123"
            )
        
        errors = exc_info.value.errors()
        assert any("DEBUG must be False in production" in str(e) for e in errors)
    
    def test_development_allows_debug_true(self):
        """Test that development environment allows debug=True."""
        from app.core.config import Settings, Environment
        
        settings = Settings(
            environment=Environment.DEVELOPMENT,
            debug=True,
            secret_key="x" * 32,
            postgres_password="test123"
        )
        
        assert settings.debug is True
    
    def test_staging_allows_debug_false(self):
        """Test that staging environment allows debug=False."""
        from app.core.config import Settings, Environment
        
        settings = Settings(
            environment=Environment.STAGING,
            debug=False,
            secret_key="x" * 32,
            postgres_password="test123"
        )
        
        assert settings.debug is False


class TestSecretKeyValidator:
    """Tests for secret_key validation."""
    
    def test_production_rejects_default_secret_key(self):
        """Test that production rejects default secret_key."""
        from app.core.config import Settings, Environment
        
        with pytest.raises(ValidationError) as exc_info:
            Settings(
                environment=Environment.PRODUCTION,
                secret_key="your-secret-key-here-change-in-production",
                postgres_password="test123"
            )
        
        errors = exc_info.value.errors()
        assert any("default" in str(e).lower() for e in errors)
    
    def test_production_requires_32_char_secret_key(self):
        """Test that production requires at least 32 characters."""
        from app.core.config import Settings, Environment
        
        with pytest.raises(ValidationError) as exc_info:
            Settings(
                environment=Environment.PRODUCTION,
                secret_key="short",
                postgres_password="test123"
            )
        
        errors = exc_info.value.errors()
        assert any("32 characters" in str(e) for e in errors)
    
    def test_development_allows_short_secret_key(self):
        """Test that development allows short secret_key for convenience."""
        from app.core.config import Settings, Environment
        
        settings = Settings(
            environment=Environment.DEVELOPMENT,
            secret_key="dev",
            postgres_password="test123"
        )
        
        assert settings.secret_key == "dev"
    
    def test_development_warns_on_default_secret_key(self, caplog):
        """Test that development logs warning for default secret_key."""
        from app.core.config import Settings, Environment
        
        with caplog.at_level(logging.WARNING):
            settings = Settings(
                environment=Environment.DEVELOPMENT,
                secret_key="your-secret-key-here-change-in-production",
                postgres_password="test123"
            )
        
        assert "default secret_key" in caplog.text.lower()
```

**Run:** `cd backend && pytest tests/core/test_config.py -v`
**Expected:** `PASS` (14/14 tests) - All environment validation tests passing

---

### Step 14: Update CLAUDE.md Documentation
**Files:** `CLAUDE.md`
**Action:** Document environment-aware configuration patterns

**Add new section after "Security Notes":**

```markdown
## Environment Configuration

**Environment Types:**
- `DEVELOPMENT` (default) - Relaxed security, debug allowed, localhost CORS
- `STAGING` - Production-like, strict validation, explicit CORS
- `PRODUCTION` - Maximum security, no debug, required secrets

**Settings Fields:**
```python
from app.core.config import settings

# Check environment
if settings.is_production:
    # Production-only code
    pass

if settings.is_development:
    # Development-only features
    pass

# Environment enum
settings.environment  # Environment.DEVELOPMENT | STAGING | PRODUCTION
```

**Environment Variables:**
```bash
# Set environment
export ENVIRONMENT=production  # or development, staging

# Production requires
export SECRET_KEY="<32+ character random string>"
export GEMINI_API_KEY="<your-api-key>"
export POSTGRES_PASSWORD="<secure-password>"
```

**Validators:**
- `debug` - Must be False in production
- `secret_key` - Must be 32+ chars and non-default in production
- `gemini_api_key` - Required (non-empty) in production

**Computed Properties:**
- `is_production` - True if PRODUCTION environment
- `is_development` - True if DEVELOPMENT environment
- Use for conditional logic throughout codebase

**Fail-Safe Defaults:**
- Environment defaults to DEVELOPMENT (safer than production)
- Debug defaults to False (safer than True)
- Validators enforce security constraints before app starts

**Testing Pattern:**
```python
from app.core.config import Settings, Environment

def test_production_feature():
    settings = Settings(
        environment=Environment.PRODUCTION,
        secret_key="x" * 32,
        postgres_password="test123"
    )
    assert settings.is_production is True
```
```

---

### Step 15: Run Full Test Suite
**Files:** N/A
**Action:** Verify all backend tests pass with new configuration

```bash
cd backend

# Run config tests
pytest tests/core/test_config.py -v

# Run all tests to catch regressions
pytest tests/ -v --tb=short

# Check for import errors
python -c "from app.core.config import settings, Environment; print(f'Environment: {settings.environment}')"
```

**Expected Output:**
- 14/14 config tests passing
- 0 new test failures
- Settings imports successfully
- Environment prints "development" (default)

---

### Step 16: Verify Production Settings Work
**Files:** N/A
**Action:** Manual test with production environment variables

```bash
cd backend

# Test production validation (should succeed)
ENVIRONMENT=production \
SECRET_KEY="this-is-a-very-long-secret-key-for-production-environment" \
POSTGRES_PASSWORD="secure_password" \
GEMINI_API_KEY="test_key" \
python -c "from app.core.config import settings; print(f'Production: {settings.is_production}')"

# Test production with debug=True (should fail)
ENVIRONMENT=production \
DEBUG=true \
SECRET_KEY="x"*32 \
POSTGRES_PASSWORD="test" \
GEMINI_API_KEY="test" \
python -c "from app.core.config import settings" 2>&1 | grep "DEBUG must be False"

# Test production with short secret (should fail)
ENVIRONMENT=production \
SECRET_KEY="short" \
POSTGRES_PASSWORD="test" \
GEMINI_API_KEY="test" \
python -c "from app.core.config import settings" 2>&1 | grep "32 characters"
```

**Expected:**
- First command prints "Production: True"
- Second command shows ValidationError with "DEBUG must be False"
- Third command shows ValidationError with "32 characters"

---

### Step 17: Git Commit
**Files:** N/A
**Action:** Commit implementation with descriptive message

```bash
cd /Users/philippbriese/Documents/dev/projects/by\ IDE/Claude\ Code/Smart\ Youtube\ Bookmarks

git add backend/app/core/config.py
git add backend/tests/core/test_config.py
git add CLAUDE.md
git add docs/plans/tasks/task-120-environment-enum-settings.md

git commit -m "feat(config): implement Environment enum with production validators

Implement environment-aware configuration system (Task #120):

- Add Environment enum (DEVELOPMENT, STAGING, PRODUCTION)
- Add Settings.environment field with type safety
- Add computed properties (is_production, is_development)
- Add debug validator (must be False in production)
- Update secret_key validator (32+ chars, no defaults in production)
- Update gemini_api_key validator (required in production)
- Replace legacy 'env' field with typed 'environment'

Tests:
- 14/14 config tests passing (100% coverage)
- Covers all validators, computed properties, enum edge cases

Security improvements:
- Fail-safe defaults (DEVELOPMENT environment, debug=False)
- Production rejects default secrets and short keys
- Enum type safety prevents typos (no 'prodution' errors)

Refs: docs/plans/2025-11-02-security-hardening-implementation.md (Task 3)

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## 🧪 Testing Strategy

**Unit Tests (14 tests in test_config.py):**

1. **Environment Enum Tests (2 tests):**
   - ✅ Enum has 3 values (DEVELOPMENT, STAGING, PRODUCTION)
   - ✅ Enum inherits from str for Pydantic compatibility

2. **Settings Environment Field Tests (2 tests):**
   - ✅ Defaults to DEVELOPMENT
   - ✅ Can be overridden by ENVIRONMENT env var

3. **Computed Properties Tests (3 tests):**
   - ✅ `is_production` returns True for PRODUCTION
   - ✅ `is_development` returns True for DEVELOPMENT
   - ✅ Staging has both flags False

4. **Debug Validator Tests (3 tests):**
   - ✅ Production rejects debug=True
   - ✅ Development allows debug=True
   - ✅ Staging allows debug=False

5. **Secret Key Validator Tests (4 tests):**
   - ✅ Production rejects default secret_key
   - ✅ Production requires 32+ character secret_key
   - ✅ Development allows short secret_key
   - ✅ Development warns on default secret_key

**Integration Tests (Manual Verification):**

1. **Production Settings Validation:**
   - Run app with ENVIRONMENT=production
   - Verify debug=True fails
   - Verify short secret_key fails
   - Verify empty gemini_api_key fails

2. **Development Settings Validation:**
   - Run app with ENVIRONMENT=development (or no env var)
   - Verify debug=True succeeds
   - Verify short secret_key succeeds with warning
   - Verify empty gemini_api_key succeeds with warning

3. **Staging Settings Validation:**
   - Run app with ENVIRONMENT=staging
   - Verify similar to production but without development warnings

**Regression Testing:**
- Run full backend test suite (`pytest tests/`)
- Verify no existing tests broken by env → environment change
- Check imports work (`from app.core.config import settings`)

---

## 📚 Reference

**Related Docs:**
- `docs/plans/2025-11-02-security-hardening-implementation.md` - Task 3 (lines 1102-1262)
- Pydantic Settings: https://docs.pydantic.dev/latest/concepts/pydantic_settings/
- Pydantic Computed Fields: https://docs.pydantic.dev/latest/concepts/fields/#the-computed-field-decorator
- FastAPI Settings: https://fastapi.tiangolo.com/advanced/settings/

**Related Code:**
- Current implementation: `backend/app/core/config.py`
- Existing tests: `backend/tests/core/test_config.py`
- Validator pattern: Task #73 field_validation.py (similar validation approach)

**Design Decisions:**

### 1. Why Environment Enum vs String?

**Decision:** Use `class Environment(str, Enum)` with typed enum values

**Rationale:**
- **Type Safety:** Prevents typos (`Environment.PRODUTION` fails at import time)
- **IDE Autocomplete:** `.PRODUCTION` shows in IDE, `"production"` doesn't
- **Pydantic Compatibility:** `str` inheritance allows `ENVIRONMENT=production` in .env
- **Refactor Safety:** Rename enum value updates all usages automatically

**Alternative Rejected:**
- Plain strings (`environment: str = "development"`) - no type safety, typos cause runtime errors

**Evidence from REF MCP:**
> "Pydantic Settings can automatically convert string environment variables to Enum members if the enum inherits from str."
> Source: https://docs.pydantic.dev/latest/concepts/models/#enums-and-choices

---

### 2. Computed Properties vs Methods?

**Decision:** Use `@computed_field` + `@property` for boolean flags

**Rationale:**
- **Cleaner Syntax:** `settings.is_production` reads like a field, not `settings.is_production()`
- **JSON Serialization:** `@computed_field` includes property in `model_dump()` output
- **Python Convention:** Properties preferred for simple boolean checks (like `list.is_empty`)
- **Performance:** Properties are fast (no function call overhead in Pydantic v2)

**Alternative Rejected:**
- Methods (`def is_production(self) -> bool`) - more explicit but verbose for simple flags

**Evidence from REF MCP:**
> "The computed_field decorator can be used to include property or cached_property attributes when serializing a model."
> "If not specified, computed_field will implicitly convert the method to a property. However, it is preferable to explicitly use the @property decorator for type checking purposes."
> Source: https://docs.pydantic.dev/latest/concepts/fields/#the-computed-field-decorator

---

### 3. Fail-Safe Defaults - Development vs Production?

**Decision:** Default to `Environment.DEVELOPMENT` (not PRODUCTION)

**Rationale:**
- **Fail-Safe Principle:** If ENVIRONMENT not set, assume development (safer than production)
- **Local Development:** Developers shouldn't need to set ENVIRONMENT for local work
- **Production Explicit:** Production deployments MUST set ENVIRONMENT=production explicitly
- **Error Prevention:** Accidental production settings expose less risk in development

**Alternative Rejected:**
- Default to PRODUCTION - too risky if environment variable not set (exposes debug endpoints)
- No default (required field) - breaks local development experience

**Security Note:**
- Production deployments MUST explicitly set `ENVIRONMENT=production` in deployment config
- CI/CD pipelines should verify ENVIRONMENT variable is set before deployment

---

### 4. Validator Access to Other Fields

**Decision:** Use `info.data.get('environment', Environment.DEVELOPMENT)` in validators

**Rationale:**
- **Validation Context:** Validators need environment to enforce conditional rules
- **Pydantic v2 API:** `info.data` dict contains other field values during validation
- **Type Safety:** Default to `Environment.DEVELOPMENT` enum (not string) for consistency
- **Forward Reference:** Validators run during initialization, can access earlier fields

**Example Pattern:**
```python
@field_validator('debug')
@classmethod
def validate_debug(cls, v: bool, info) -> bool:
    env = info.data.get('environment', Environment.DEVELOPMENT)
    if env == Environment.PRODUCTION and v:
        raise ValueError("DEBUG must be False in production")
    return v
```

**Evidence from REF MCP:**
> "The info parameter provides access to the validation context, including other field values via info.data."
> Source: https://docs.pydantic.dev/latest/concepts/validators/#field-validators

---

### 5. Case Sensitivity for Environment Variables

**Decision:** Use `case_sensitive=False` in `model_config`

**Rationale:**
- **User Friendly:** Both `ENVIRONMENT=production` and `environment=production` work
- **Convention:** Environment variables traditionally UPPERCASE, but Pydantic fields lowercase
- **Flexibility:** Supports both `.env` file styles (lowercase) and shell exports (UPPERCASE)
- **Pydantic Default:** Case-insensitive is Pydantic Settings default behavior

**Configuration:**
```python
model_config = SettingsConfigDict(
    env_file=".env",
    env_file_encoding="utf-8",
    case_sensitive=False  # ENVIRONMENT or environment both work
)
```

**Evidence from REF MCP:**
> "By default, environment variable names are case-insensitive. An upper-case variable APP_NAME will still be read for the attribute app_name."
> Source: https://docs.pydantic.dev/latest/concepts/pydantic_settings/#environment-variable-names

---

## ⏱️ Time Estimate

**Total:** 1.5-2 hours

**Breakdown:**
- Step 1-2 (Planning, TDD setup): 10 min
- Step 3-5 (Environment enum + field): 15 min
- Step 6-7 (Computed properties): 15 min
- Step 8-9 (Debug validator): 15 min
- Step 10-12 (Update existing validators): 20 min
- Step 13 (Complete test suite): 15 min
- Step 14 (CLAUDE.md documentation): 10 min
- Step 15-16 (Testing, verification): 15 min
- Step 17 (Git commit): 5 min

**Assumptions:**
- Familiarity with Pydantic v2 validators
- Backend test environment already set up
- No unexpected test failures

---

## 🔄 Next Steps (After Task #120)

**Task #121:** CORS Configuration (Security Hardening Task 4)
- Implement `get_cors_origins()` function
- Development: Allow localhost:5173, localhost:8000
- Production: Require explicit ALLOWED_ORIGINS env var
- Uses `settings.is_production` from this task

**Task #122:** Rate Limiting (Security Hardening Task 5)
- Install slowapi
- Environment-specific limits (strict in production)
- Uses `settings.is_production` for conditional limits

**Usage Throughout Codebase:**
```python
from app.core.config import settings

# Conditional CORS
if settings.is_production:
    origins = settings.allowed_origins.split(",")
else:
    origins = ["http://localhost:5173", "http://localhost:8000"]

# Conditional debug endpoints
if settings.is_development:
    @app.get("/debug/jobs")
    async def debug_jobs():
        ...
```

---

## 📝 Notes

**Breaking Changes:**
- `settings.env` removed → replaced by `settings.environment` (typed enum)
- All code using `settings.env == "production"` must update to `settings.environment == Environment.PRODUCTION`

**Migration Checklist:**
```bash
# Search for old `env` field usage
cd backend
grep -r "settings.env" app/ tests/
grep -r 'info.data.get("env"' app/

# Expected findings:
# - app/core/config.py (validators) - FIXED in this task
# - Possibly main.py or other startup code - TODO: audit in next task
```

**Non-Breaking Changes:**
- New fields (`debug`, `is_production`, `is_development`) are additive
- Existing Settings instantiation works without changes
- `.env` file format unchanged

**Performance:**
- Computed properties cached by Pydantic (no re-computation on each access)
- Enum comparisons faster than string comparisons (identity check)
- Validators run once at Settings initialization (startup time impact negligible)
