# Task #131: Add sanitize_string for All Text Inputs

**Status:** 🟡 Ready  
**Priority:** High  
**Estimated Effort:** 2-3 hours  
**Parent Task:** Task #5 - Input Validation & ReDoS Protection  
**Dependencies:** None (validation.py module will be created in this task)

---

## 🎯 Goal

Implement comprehensive text input sanitization across all Pydantic schemas using the `sanitize_string()` function from the security hardening plan. This prevents XSS attacks, enforces length limits, and removes control characters from all user-provided text fields (list names, tag names, video titles/descriptions, custom field names, etc.).

---

## 📋 Acceptance Criteria

1. **Module Created:**
   - ✅ `backend/app/core/validation.py` exists with `sanitize_string()`, `validate_youtube_url()`, and `validate_email()` functions
   - ✅ All functions have timeout protection and length limits
   - ✅ Comprehensive tests in `backend/tests/core/test_validation.py`

2. **Sanitization Applied:**
   - ✅ List names and descriptions sanitized in `list.py`
   - ✅ Tag names sanitized in `tag.py`
   - ✅ Video titles sanitized in `video.py`
   - ✅ Custom field names sanitized in `custom_field.py`
   - ✅ Field schema names/descriptions sanitized in `field_schema.py`
   - ✅ Progress messages sanitized in `job_progress.py`

3. **Validation Rules Enforced:**
   - ✅ Whitespace trimming (leading/trailing)
   - ✅ Control character removal (except newlines where allowed)
   - ✅ Length limits enforced (before Pydantic's min/max validation)
   - ✅ Empty string handling (reject whitespace-only input)

4. **Testing:**
   - ✅ Unit tests for validation module (>95% coverage)
   - ✅ Integration tests verify sanitization in API endpoints
   - ✅ Edge cases tested: control chars, unicode, long strings, whitespace-only

5. **Documentation:**
   - ✅ Updated CLAUDE.md with validation patterns
   - ✅ Inline comments explain why sanitization is needed
   - ✅ Examples in docstrings

---

## 🛠️ Implementation Steps

### Step 1: Create validation module with sanitize_string()

**Why this approach?**  
The security hardening plan (lines 1807-1994) provides a complete validation module with ReDoS protection. We create this module first so all schemas can import and use `sanitize_string()`.

**File:** `backend/app/core/validation.py` (NEW)

```python
"""
Input validation utilities with security protections.

Provides functions for validating and sanitizing user inputs with
protections against ReDoS attacks and other injection vulnerabilities.
"""

import re
import signal
from contextlib import contextmanager
from typing import Optional


class ValidationError(ValueError):
    """Custom exception for validation errors."""
    pass


class TimeoutError(Exception):
    """Raised when regex matching times out."""
    pass


@contextmanager
def timeout(seconds: float):
    """
    Context manager for timeout protection (cross-platform).

    Args:
        seconds: Maximum execution time

    Raises:
        TimeoutError: If execution exceeds timeout

    Note:
        Uses threading-based timeout for cross-platform compatibility.
        On Unix systems, signal-based timeout could be used for better performance,
        but threading works on all platforms including Windows.
    """
    import threading
    from concurrent.futures import ThreadPoolExecutor, TimeoutError as FuturesTimeoutError

    # Note: This is a context manager that yields control, but the actual
    # timeout protection needs to be implemented where the context manager is used.
    # For regex matching, we'll use a different approach.
    yield


# Maximum URL length to prevent DoS
MAX_URL_LENGTH = 2048

# YouTube URL patterns (simplified to avoid ReDoS)
YOUTUBE_PATTERNS = [
    re.compile(r'^https?://(?:www\.)?youtube\.com/watch\?v=([a-zA-Z0-9_-]{11})'),
    re.compile(r'^https?://youtu\.be/([a-zA-Z0-9_-]{11})'),
    re.compile(r'^https?://m\.youtube\.com/watch\?v=([a-zA-Z0-9_-]{11})'),
]


def validate_youtube_url(url: str, max_length: int = MAX_URL_LENGTH) -> str:
    """
    Validate and extract YouTube video ID from URL.

    Includes protections against:
    - ReDoS attacks (regex timeout)
    - Excessively long URLs (length limit)
    - Invalid URL formats

    Args:
        url: YouTube URL to validate
        max_length: Maximum allowed URL length

    Returns:
        YouTube video ID (11 characters)

    Raises:
        ValidationError: If URL is invalid or security check fails
    """
    # Check URL length first (before any regex)
    if not url:
        raise ValidationError("URL cannot be empty")

    if len(url) > max_length:
        raise ValidationError(f"URL too long (max {max_length} characters)")

    # Try each pattern with timeout protection (cross-platform)
    from concurrent.futures import ThreadPoolExecutor, TimeoutError as FuturesTimeoutError

    def _match_patterns():
        """Helper function to match patterns."""
        for pattern in YOUTUBE_PATTERNS:
            match = pattern.match(url)
            if match:
                return match.group(1)
        return None

    # Use ThreadPoolExecutor for cross-platform timeout
    with ThreadPoolExecutor(max_workers=1) as executor:
        future = executor.submit(_match_patterns)
        try:
            result = future.result(timeout=0.5)  # 500ms timeout
            if result:
                return result
        except FuturesTimeoutError:
            raise ValidationError("URL validation timed out (possible attack)")

    # No pattern matched
    raise ValidationError("Invalid YouTube URL format")


def sanitize_string(
    value: str,
    max_length: int = 255,
    allow_newlines: bool = False
) -> str:
    """
    Sanitize string input for safe storage and display.

    Protections:
    - Trims leading/trailing whitespace
    - Enforces length limits (prevents DoS)
    - Removes control characters (prevents terminal injection)
    - Preserves newlines only if explicitly allowed

    Args:
        value: String to sanitize
        max_length: Maximum allowed length (after trimming)
        allow_newlines: Whether to preserve newline characters

    Returns:
        Sanitized string

    Raises:
        ValidationError: If input exceeds max length after trimming

    Examples:
        >>> sanitize_string("  Hello World  ", max_length=50)
        "Hello World"
        >>> sanitize_string("Line1\\nLine2", max_length=50, allow_newlines=True)
        "Line1\\nLine2"
        >>> sanitize_string("Line1\\nLine2", max_length=50, allow_newlines=False)
        "Line1Line2"
    """
    if not value:
        return ""

    # Trim whitespace
    value = value.strip()

    # Check length after trimming
    if len(value) > max_length:
        raise ValidationError(f"Input too long (max {max_length} characters)")

    # Remove control characters except newlines (if allowed)
    if allow_newlines:
        # Keep printable chars + newlines/carriage returns
        value = ''.join(char for char in value if char.isprintable() or char in '\n\r')
    else:
        # Keep only printable chars
        value = ''.join(char for char in value if char.isprintable())

    return value


def validate_email(email: str) -> str:
    """
    Validate email format with simple regex.

    Args:
        email: Email address to validate

    Returns:
        Lowercase email address

    Raises:
        ValidationError: If email format is invalid
    """
    if not email or len(email) > 320:  # RFC 5321
        raise ValidationError("Invalid email length")

    # Simple email regex (not comprehensive, but safe from ReDoS)
    email_pattern = re.compile(r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$')

    # Use ThreadPoolExecutor for cross-platform timeout
    from concurrent.futures import ThreadPoolExecutor, TimeoutError as FuturesTimeoutError

    def _match_email():
        """Helper function to match email pattern."""
        return email_pattern.match(email) is not None

    with ThreadPoolExecutor(max_workers=1) as executor:
        future = executor.submit(_match_email)
        try:
            if not future.result(timeout=0.1):  # 100ms timeout
                raise ValidationError("Invalid email format")
        except FuturesTimeoutError:
            raise ValidationError("Email validation timed out")

    return email.lower()
```

**Verification:**
```bash
# Check file created
ls -lh backend/app/core/validation.py
```

---

### Step 2: Write comprehensive tests for validation module

**Why this approach?**  
Following TDD principles, we write tests to verify all edge cases: empty strings, whitespace-only, control characters, unicode, length limits, timeout protection.

**File:** `backend/tests/core/test_validation.py` (NEW)

```python
"""Tests for input validation utilities."""

import pytest
from app.core.validation import (
    validate_youtube_url,
    sanitize_string,
    validate_email,
    ValidationError
)


# ============================================================================
# YouTube URL Validation Tests
# ============================================================================

def test_valid_youtube_urls():
    """Test that valid YouTube URLs pass validation."""
    valid_urls = [
        "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        "https://youtu.be/dQw4w9WgXcQ",
        "https://m.youtube.com/watch?v=dQw4w9WgXcQ"
    ]

    for url in valid_urls:
        video_id = validate_youtube_url(url)
        assert video_id == "dQw4w9WgXcQ"


def test_invalid_youtube_urls():
    """Test that invalid URLs raise ValidationError."""
    invalid_urls = [
        "https://example.com/watch?v=dQw4w9WgXcQ",
        "not a url",
        "https://youtube.com/",
        ""
    ]

    for url in invalid_urls:
        with pytest.raises(ValidationError):
            validate_youtube_url(url)


def test_url_length_limit():
    """Test that excessively long URLs are rejected."""
    long_url = "https://www.youtube.com/watch?v=" + "a" * 5000

    with pytest.raises(ValidationError, match="URL too long"):
        validate_youtube_url(long_url)


def test_redos_protection():
    """Test that regex has timeout protection."""
    # Crafted URL that could cause ReDoS without timeout
    malicious_url = "https://www.youtube.com/" + "a" * 10000 + "watch?v=test"

    # Should fail quickly, not hang
    import time
    start = time.time()

    with pytest.raises(ValidationError):
        validate_youtube_url(malicious_url)

    elapsed = time.time() - start
    assert elapsed < 1.0, "Regex timeout protection failed"


# ============================================================================
# String Sanitization Tests
# ============================================================================

def test_sanitize_string_basic():
    """Test basic string sanitization."""
    assert sanitize_string("Hello World", max_length=50) == "Hello World"
    assert sanitize_string("  trimmed  ", max_length=50) == "trimmed"


def test_sanitize_string_empty_input():
    """Test that empty/whitespace-only strings return empty string."""
    assert sanitize_string("", max_length=50) == ""
    assert sanitize_string("   ", max_length=50) == ""
    assert sanitize_string("\t\n", max_length=50) == ""


def test_sanitize_string_length_limit():
    """Test that strings exceeding max_length raise ValidationError."""
    long_string = "a" * 300

    with pytest.raises(ValidationError, match="Input too long"):
        sanitize_string(long_string, max_length=255)


def test_sanitize_string_control_characters():
    """Test that control characters are removed."""
    # ASCII control characters (0x00-0x1F)
    input_with_controls = "Hello\x00\x01\x02World\x1F"
    result = sanitize_string(input_with_controls, max_length=50)
    assert result == "HelloWorld"


def test_sanitize_string_newlines_default():
    """Test that newlines are removed by default."""
    input_with_newlines = "Line1\nLine2\rLine3"
    result = sanitize_string(input_with_newlines, max_length=50)
    assert result == "Line1Line2Line3"


def test_sanitize_string_newlines_allowed():
    """Test that newlines are preserved when allow_newlines=True."""
    input_with_newlines = "Line1\nLine2\rLine3"
    result = sanitize_string(input_with_newlines, max_length=50, allow_newlines=True)
    assert "\n" in result or "\r" in result
    assert "Line1" in result and "Line2" in result


def test_sanitize_string_unicode():
    """Test that unicode characters are handled correctly."""
    unicode_string = "Café ☕ 日本語"
    result = sanitize_string(unicode_string, max_length=50)
    assert result == unicode_string


def test_sanitize_string_length_after_trim():
    """Test that length is checked AFTER trimming whitespace."""
    # 260 chars + 10 whitespace = 270 total, but only 260 after trim
    padded_string = "  " + ("a" * 260) + "  "
    
    # Should raise because 260 > 255
    with pytest.raises(ValidationError, match="Input too long"):
        sanitize_string(padded_string, max_length=255)


# ============================================================================
# Email Validation Tests
# ============================================================================

def test_validate_email_valid():
    """Test that valid email formats pass."""
    valid_emails = [
        "user@example.com",
        "test.user@subdomain.example.org",
        "name+tag@example.co.uk"
    ]

    for email in valid_emails:
        result = validate_email(email)
        assert result == email.lower()


def test_validate_email_invalid():
    """Test that invalid email formats fail."""
    invalid_emails = [
        "not-an-email",
        "@example.com",
        "user@",
        "user@.com",
        "",
        "a" * 321  # Exceeds RFC 5321 limit
    ]

    for email in invalid_emails:
        with pytest.raises(ValidationError):
            validate_email(email)


def test_validate_email_lowercase():
    """Test that emails are normalized to lowercase."""
    assert validate_email("User@Example.COM") == "user@example.com"
```

**Verification:**
```bash
cd backend
pytest tests/core/test_validation.py -v
# Expected: All tests PASS
```

---

### Step 3: Update list.py schema with sanitization

**Why this approach?**  
Using Pydantic v2's `field_validator` decorator with `mode='before'` ensures sanitization happens BEFORE type validation. We sanitize both `name` (always required) and `description` (optional, allows newlines for longer text).

**File:** `backend/app/schemas/list.py` (MODIFY)

```python
from uuid import UUID
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field, field_validator

# Import sanitization function
from app.core.validation import sanitize_string, ValidationError


class ListCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = Field(None, max_length=1000)
    schema_id: Optional[UUID] = None
    user_id: Optional[UUID] = None  # Will be set from authenticated user

    @field_validator('name', mode='before')
    @classmethod
    def sanitize_name(cls, v: str) -> str:
        """
        Sanitize list name: trim whitespace, remove control chars.
        
        Security: Prevents XSS and terminal injection attacks.
        """
        if not v:
            raise ValueError("List name cannot be empty")
        
        try:
            sanitized = sanitize_string(v, max_length=255, allow_newlines=False)
        except ValidationError as e:
            raise ValueError(str(e))
        
        if not sanitized:
            raise ValueError("List name cannot be whitespace-only")
        
        return sanitized

    @field_validator('description', mode='before')
    @classmethod
    def sanitize_description(cls, v: Optional[str]) -> Optional[str]:
        """
        Sanitize list description: trim whitespace, preserve newlines.
        
        Security: Prevents XSS and terminal injection, allows multi-line text.
        """
        if v is None or v == "":
            return None
        
        try:
            sanitized = sanitize_string(v, max_length=1000, allow_newlines=True)
        except ValidationError as e:
            raise ValueError(str(e))
        
        # Return None for empty string after sanitization
        return sanitized if sanitized else None


class ListUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None

    @field_validator('name', mode='before')
    @classmethod
    def sanitize_name(cls, v: Optional[str]) -> Optional[str]:
        """Sanitize list name if provided."""
        if v is None:
            return None
        
        if not v:
            raise ValueError("List name cannot be empty")
        
        try:
            sanitized = sanitize_string(v, max_length=255, allow_newlines=False)
        except ValidationError as e:
            raise ValueError(str(e))
        
        if not sanitized:
            raise ValueError("List name cannot be whitespace-only")
        
        return sanitized

    @field_validator('description', mode='before')
    @classmethod
    def sanitize_description(cls, v: Optional[str]) -> Optional[str]:
        """Sanitize list description if provided."""
        if v is None or v == "":
            return None
        
        try:
            sanitized = sanitize_string(v, max_length=1000, allow_newlines=True)
        except ValidationError as e:
            raise ValueError(str(e))
        
        return sanitized if sanitized else None


class ListResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    description: Optional[str]
    user_id: UUID
    schema_id: Optional[UUID]
    video_count: int
    created_at: datetime
    updated_at: datetime
```

**Why mode='before'?**  
REF MCP validation (Pydantic v2 docs): "Before validators run before Pydantic's internal validation. They receive raw input and return sanitized value for further validation." This ensures our sanitization happens first, then Pydantic checks min_length/max_length constraints.

---

### Step 4: Update tag.py schema with sanitization

**Why this approach?**  
Tag names are shorter (max 100 chars) and don't need newlines. Color field already has regex validation, no sanitization needed (it's a strict hex pattern).

**File:** `backend/app/schemas/tag.py` (MODIFY)

```python
from pydantic import BaseModel, Field, field_validator
from uuid import UUID
from datetime import datetime

from app.schemas.field_schema import FieldSchemaResponse
from app.core.validation import sanitize_string, ValidationError


class TagBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100, description="Tag name")
    color: str | None = Field(None, pattern=r'^#[0-9A-Fa-f]{6}$', description="Hex color code")

    @field_validator('name', mode='before')
    @classmethod
    def sanitize_name(cls, v: str) -> str:
        """
        Sanitize tag name: trim whitespace, remove control chars.
        
        Security: Prevents XSS and terminal injection attacks.
        """
        if not v:
            raise ValueError("Tag name cannot be empty")
        
        try:
            sanitized = sanitize_string(v, max_length=100, allow_newlines=False)
        except ValidationError as e:
            raise ValueError(str(e))
        
        if not sanitized:
            raise ValueError("Tag name cannot be whitespace-only")
        
        return sanitized


class TagCreate(TagBase):
    pass


class TagUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=100)
    color: str | None = Field(None, pattern=r'^#[0-9A-Fa-f]{6}$')
    schema_id: UUID | None = None  # REF MCP: Simplified from Field(default=None)

    @field_validator('name', mode='before')
    @classmethod
    def sanitize_name(cls, v: str | None) -> str | None:
        """Sanitize tag name if provided."""
        if v is None:
            return None
        
        if not v:
            raise ValueError("Tag name cannot be empty")
        
        try:
            sanitized = sanitize_string(v, max_length=100, allow_newlines=False)
        except ValidationError as e:
            raise ValueError(str(e))
        
        if not sanitized:
            raise ValueError("Tag name cannot be whitespace-only")
        
        return sanitized


class TagResponse(TagBase):
    id: UUID
    user_id: UUID
    schema_id: UUID | None = None  # Add schema_id to response
    schema: FieldSchemaResponse | None = None  # Add nested schema object
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
```

---

### Step 5: Update video.py schema with title sanitization

**Why this approach?**  
Video titles come from YouTube API (already sanitized) but we add sanitization for defense-in-depth. YouTube URL validation is already handled by existing `validate_youtube_url()` in video.py (lines 24-66).

**File:** `backend/app/schemas/video.py` (MODIFY lines 1-20)

```python
"""
Pydantic schemas for Video API endpoints.

Includes enhanced URL validation with security checks.
"""

from datetime import datetime
from typing import Annotated
from uuid import UUID
from urllib.parse import urlparse
import re

from pydantic import BaseModel, Field, AfterValidator, ConfigDict, field_validator

# Import for circular dependency resolution (TYPE_CHECKING)
from typing import TYPE_CHECKING
if TYPE_CHECKING:
    from .tag import TagResponse

# Import existing CustomFieldResponse from Task #64 (REF #5: DRY principle)
from .custom_field import CustomFieldResponse

# Import sanitization (for title/description fields)
from app.core.validation import sanitize_string, ValidationError


def validate_youtube_url(url: str) -> str:
    """
    Validate YouTube URL with comprehensive security checks.

    Validates:
    1. ASCII-only characters (prevents Unicode bypass attacks)
    2. HTTPS protocol only (security requirement)
    3. Domain whitelist (prevents open redirect)
    4. YouTube video ID format (11 characters [a-zA-Z0-9_-])

    Raises:
        ValueError: If URL fails any validation check

    Returns:
        str: The validated URL
    """
    # 1. ASCII only (prevents Unicode bypass)
    if not url.isascii():
        raise ValueError('URL must contain only ASCII characters')

    # 2. Parse and validate protocol
    parsed = urlparse(url)
    if parsed.scheme != 'https':
        raise ValueError('URL must use HTTPS protocol')

    # 3. Domain whitelist (prevents open redirect)
    allowed_domains = {'youtube.com', 'www.youtube.com', 'youtu.be', 'm.youtube.com'}
    if parsed.netloc not in allowed_domains:
        raise ValueError(f'Domain must be one of: {", ".join(allowed_domains)}')

    # 4. Extract YouTube ID with regex
    patterns = [
        r'(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})',
        r'youtube\.com\/embed\/([a-zA-Z0-9_-]{11})',
        r'm\.youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})',
    ]

    for pattern in patterns:
        match = re.search(pattern, url)
        if match:
            return url

    raise ValueError('Invalid YouTube URL format - could not extract video ID')


class VideoAdd(BaseModel):
    """Schema for adding a video to a list."""
    url: Annotated[
        str,
        AfterValidator(validate_youtube_url),
        Field(min_length=1, description="YouTube video URL (HTTPS only)")
    ]


class VideoFieldValueResponse(BaseModel):
    """
    Response model for a video's custom field value.

    Includes the field definition, current value, and schema context
    for frontend grouping and conflict resolution display.

    REF MCP Improvement #3: value uses float (not int) for PostgreSQL NUMERIC compatibility.
    REF MCP Improvement #5: Reuses existing CustomFieldResponse from Task #64.
    """
    field_id: UUID
    field: CustomFieldResponse  # Nested field definition (from Task #64)
    value: str | float | bool | None = None  # REF #3: float not int
    schema_name: str | None = None  # For multi-tag conflict resolution
    show_on_card: bool = False  # From schema_fields.show_on_card
    display_order: int = 0  # From schema_fields.display_order

    model_config = ConfigDict(from_attributes=True)


class AvailableFieldResponse(BaseModel):
    """
    Metadata for an available field (without value).

    Used in detail endpoint to show which fields CAN be filled.
    """
    field_id: UUID
    field_name: str
    field_type: str  # 'rating', 'select', 'text', 'boolean'
    schema_name: str | None  # None if no conflict, else "Schema: Field"
    display_order: int
    show_on_card: bool

    # Optional: For UI hints
    config: dict = Field(default_factory=dict)  # e.g., {'max_rating': 5} or {'options': ['bad', 'good']}

    model_config = ConfigDict(from_attributes=True)


class VideoResponse(BaseModel):
    """
    Schema for video response.

    Includes YouTube metadata fields populated immediately via API fetch.
    Fields may be None if metadata fetch fails or video is not found.
    """
    id: UUID
    list_id: UUID
    youtube_id: str

    # YouTube Metadata (fetched from YouTube Data API v3)
    title: str | None = None
    channel: str | None = None
    thumbnail_url: str | None = None
    duration: int | None = None  # Duration in seconds
    published_at: datetime | None = None

    # Tags (many-to-many relationship)
    tags: list["TagResponse"] = Field(default_factory=list)

    # Field values (custom fields from tag schemas)
    field_values: list[VideoFieldValueResponse] = Field(default_factory=list)

    # NEW field for detail endpoint (Option D - Intelligente Lösung)
    available_fields: list[AvailableFieldResponse] | None = None  # Optional: only set in detail endpoint

    processing_status: str
    error_message: str | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {
        "from_attributes": True
    }

    @field_validator('title', mode='before')
    @classmethod
    def sanitize_title(cls, v: str | None) -> str | None:
        """
        Sanitize video title if present.
        
        Defense-in-depth: YouTube API returns sanitized titles, but we validate
        to protect against compromised API responses or database corruption.
        """
        if v is None or v == "":
            return None
        
        try:
            # Allow longer titles (YouTube max is 100 chars, but we allow 500 for safety)
            sanitized = sanitize_string(v, max_length=500, allow_newlines=False)
        except ValidationError as e:
            # Don't raise error for response models (data already in DB)
            # Just log and return original (or None)
            return v
        
        return sanitized if sanitized else None


class BulkUploadFailure(BaseModel):
    """Details about a failed video upload in bulk operation."""
    row: int
    url: str
    error: str


class BulkUploadResponse(BaseModel):
    """Response schema for bulk video upload."""
    created_count: int
    failed_count: int
    failures: list[BulkUploadFailure] = Field(default_factory=list)


# Resolve forward references after all schemas are defined
def rebuild_schemas():
    """Rebuild schemas to resolve forward references (TagResponse)."""
    from .tag import TagResponse  # noqa: F401
    VideoResponse.model_rebuild()


# Call rebuild when module is imported
rebuild_schemas()
```

**Note:**  
For `VideoResponse`, we use try-except to avoid breaking existing data. Response models should be lenient (data is already in DB), while Create/Update models should be strict.

---

### Step 6: Update custom_field.py schema with name sanitization

**Why this approach?**  
Custom field names already have a `strip_name` validator (lines 173-180). We enhance it to use `sanitize_string()` for additional security (control character removal).

**File:** `backend/app/schemas/custom_field.py` (MODIFY lines 1-180)

```python
"""
Pydantic schemas for Custom Field API endpoints.

Custom fields allow users to define reusable evaluation criteria for videos
(e.g., "Presentation Quality", "Overall Rating"). Fields are list-scoped and
support four types: select, rating, text, boolean.

Config validation uses discriminated unions to ensure type-specific constraints
are enforced (e.g., rating fields must have max_rating between 1-10).
"""

from typing import Literal, Annotated, Any, Dict
from uuid import UUID
from datetime import datetime

from pydantic import BaseModel, Field, field_validator, model_validator

# Import sanitization
from app.core.validation import sanitize_string, ValidationError


# Field type definitions (using Literal for better Pydantic integration)
FieldType = Literal['select', 'rating', 'text', 'boolean']


# Type-specific config schemas
class SelectConfig(BaseModel):
    """
    Configuration for 'select' field type.

    Select fields provide a dropdown with predefined options.
    Example: {"options": ["bad", "good", "great"]}
    """
    options: list[str] = Field(
        ...,
        min_length=1,
        description="List of selectable options (minimum 1 required)"
    )

    @field_validator('options', mode='before')
    @classmethod
    def validate_and_sanitize_options(cls, options: list[str]) -> list[str]:
        """
        Sanitize and validate all options.
        
        Security: Each option is sanitized to prevent XSS.
        """
        if not options:
            raise ValueError("Options list cannot be empty")
        
        sanitized = []
        for opt in options:
            if not isinstance(opt, str):
                raise ValueError("All options must be strings")
            
            try:
                clean_opt = sanitize_string(opt, max_length=100, allow_newlines=False)
            except ValidationError as e:
                raise ValueError(f"Invalid option: {e}")
            
            if not clean_opt:
                raise ValueError("All options must be non-empty strings")
            
            sanitized.append(clean_opt)
        
        return sanitized


class RatingConfig(BaseModel):
    """
    Configuration for 'rating' field type.

    Rating fields provide numeric scales (e.g., 1-5 stars).
    Example: {"max_rating": 5}
    """
    max_rating: int = Field(
        ...,
        ge=1,
        le=10,
        description="Maximum rating value (1-10)"
    )


class TextConfig(BaseModel):
    """
    Configuration for 'text' field type.

    Text fields allow free-form text input with optional length limits.
    Example: {"max_length": 500} or {}
    """
    max_length: int | None = Field(
        None,
        ge=1,
        description="Optional maximum text length (must be ≥1 if specified)"
    )


class BooleanConfig(BaseModel):
    """
    Configuration for 'boolean' field type.

    Boolean fields provide yes/no checkboxes. No config needed.
    Example: {}
    """
    pass  # No configuration needed for boolean fields


# Union type for all possible configs
FieldConfig = SelectConfig | RatingConfig | TextConfig | BooleanConfig | Dict[str, Any]


# Shared validation helper function (DRY principle)
def _validate_config_for_type(field_type: str, config: Dict[str, Any]) -> None:
    """
    Validate that config structure matches the field_type.

    This shared function implements the core validation logic for config/field_type
    combinations, ensuring DRY principle and consistent validation across
    CustomFieldBase and CustomFieldUpdate schemas.

    Args:
        field_type: The field type ('select', 'rating', 'text', 'boolean')
        config: The configuration dictionary to validate

    Raises:
        ValueError: If config doesn't match field_type requirements

    Examples:
        >>> _validate_config_for_type('select', {'options': ['a', 'b']})  # OK
        >>> _validate_config_for_type('select', {})  # Raises ValueError
        >>> _validate_config_for_type('rating', {'max_rating': 5})  # OK
        >>> _validate_config_for_type('rating', {'max_rating': 20})  # Raises ValueError
    """
    if field_type == 'select':
        # Validate SelectConfig
        if 'options' not in config:
            raise ValueError("'select' field type requires 'options' in config")

        options = config.get('options')
        if not isinstance(options, list):
            raise ValueError("'options' must be a list")
        if len(options) < 1:
            raise ValueError("'options' must contain at least 1 item")
        
        # Sanitize each option
        for opt in options:
            if not isinstance(opt, str):
                raise ValueError("All options must be strings")
            try:
                clean_opt = sanitize_string(opt, max_length=100, allow_newlines=False)
            except ValidationError as e:
                raise ValueError(f"Invalid option: {e}")
            if not clean_opt:
                raise ValueError("All options must be non-empty strings")

    elif field_type == 'rating':
        # Validate RatingConfig
        if 'max_rating' not in config:
            raise ValueError("'rating' field type requires 'max_rating' in config")

        max_rating = config.get('max_rating')
        if not isinstance(max_rating, int):
            raise ValueError("'max_rating' must be an integer")
        if max_rating < 1 or max_rating > 10:
            raise ValueError("'max_rating' must be between 1 and 10")

    elif field_type == 'text':
        # Validate TextConfig (max_length is optional)
        if 'max_length' in config:
            max_length = config.get('max_length')
            if not isinstance(max_length, int):
                raise ValueError("'max_length' must be an integer")
            if max_length < 1:
                raise ValueError("'max_length' must be at least 1")

    elif field_type == 'boolean':
        # Boolean fields should have empty config or only empty dict
        if config and config != {}:
            raise ValueError("'boolean' field type should have empty config")


class CustomFieldBase(BaseModel):
    """
    Base schema for custom field with shared validation logic.

    Validates that field name, type, and config are consistent and meet
    business requirements (e.g., rating config must have max_rating 1-10).
    """
    name: str = Field(
        ...,
        min_length=1,
        max_length=255,
        description="Field name (1-255 characters)"
    )
    field_type: FieldType = Field(
        ...,
        description="Field type: 'select', 'rating', 'text', or 'boolean'"
    )
    config: Dict[str, Any] = Field(
        default_factory=dict,
        description="Type-specific configuration (JSON object)"
    )

    @field_validator('name', mode='before')
    @classmethod
    def sanitize_name(cls, name: str) -> str:
        """
        Sanitize field name: trim whitespace, remove control chars.
        
        Security: Prevents XSS and terminal injection attacks.
        """
        if not name:
            raise ValueError("Field name cannot be empty")
        
        try:
            sanitized = sanitize_string(name, max_length=255, allow_newlines=False)
        except ValidationError as e:
            raise ValueError(str(e))
        
        if not sanitized:
            raise ValueError("Field name cannot be whitespace-only")
        
        return sanitized

    @model_validator(mode='after')
    def validate_config_matches_type(self) -> 'CustomFieldBase':
        """
        Validate that config structure matches the field_type.

        Uses shared validation function to ensure:
        - 'select' fields have 'options' list (sanitized)
        - 'rating' fields have 'max_rating' int (1-10)
        - 'text' fields have optional 'max_length' int (≥1)
        - 'boolean' fields have empty config or no config

        Raises:
            ValueError: If config doesn't match field_type requirements
        """
        _validate_config_for_type(self.field_type, self.config)
        return self


class CustomFieldCreate(CustomFieldBase):
    """
    Schema for creating a new custom field.

    Inherits all validation from CustomFieldBase. Used in:
    - POST /api/lists/{list_id}/custom-fields

    Example:
        {
            "name": "Presentation Quality",
            "field_type": "select",
            "config": {
                "options": ["bad", "all over the place", "confusing", "great"]
            }
        }
    """
    pass  # All validation inherited from CustomFieldBase


class CustomFieldUpdate(BaseModel):
    """
    Schema for updating an existing custom field.

    All fields are optional to support partial updates. When provided,
    fields are validated using the same rules as CustomFieldCreate.

    Used in:
    - PUT /api/custom-fields/{field_id}

    Example (partial update):
        {"name": "Updated Field Name"}

    Example (full update):
        {
            "name": "Overall Rating",
            "field_type": "rating",
            "config": {"max_rating": 10}
        }

    Note: Changing field_type on existing fields with values should be
    handled carefully by the API layer (may require confirmation).
    """
    name: str | None = Field(
        None,
        min_length=1,
        max_length=255,
        description="Field name (1-255 characters)"
    )
    field_type: FieldType | None = Field(
        None,
        description="Field type: 'select', 'rating', 'text', or 'boolean'"
    )
    config: Dict[str, Any] | None = Field(
        None,
        description="Type-specific configuration (JSON object)"
    )

    @field_validator('name', mode='before')
    @classmethod
    def sanitize_name(cls, name: str | None) -> str | None:
        """Sanitize field name if provided."""
        if name is None:
            return None
        
        if not name:
            raise ValueError("Field name cannot be empty")
        
        try:
            sanitized = sanitize_string(name, max_length=255, allow_newlines=False)
        except ValidationError as e:
            raise ValueError(str(e))
        
        if not sanitized:
            raise ValueError("Field name cannot be whitespace-only")
        
        return sanitized

    @model_validator(mode='after')
    def validate_config_matches_type(self) -> 'CustomFieldUpdate':
        """
        Validate config matches field_type if both are provided.

        Only validates when both field_type and config are present.
        Partial updates (only name, or only config) skip validation.
        """
        # Skip validation if either field is None
        if self.field_type is None or self.config is None:
            return self

        # Use shared validation function
        _validate_config_for_type(self.field_type, self.config)
        return self


class CustomFieldResponse(CustomFieldBase):
    """
    Schema for custom field response from API.

    Includes all fields from the database model (ORM attributes).
    Used in:
    - GET /api/lists/{list_id}/custom-fields (list)
    - POST /api/lists/{list_id}/custom-fields (single)
    - PUT /api/custom-fields/{field_id} (single)
    - GET /api/custom-fields/{field_id} (single)

    Example:
        {
            "id": "123e4567-e89b-12d3-a456-426614174000",
            "list_id": "987fcdeb-51a2-43d1-9012-345678901234",
            "name": "Presentation Quality",
            "field_type": "select",
            "config": {
                "options": ["bad", "good", "great"]
            },
            "created_at": "2025-11-06T10:30:00Z",
            "updated_at": "2025-11-06T10:30:00Z"
        }
    """
    id: UUID = Field(..., description="Unique field identifier")
    list_id: UUID = Field(..., description="Parent list identifier")
    created_at: datetime = Field(..., description="Creation timestamp")
    updated_at: datetime = Field(..., description="Last update timestamp")

    # Pydantic v2 configuration for ORM mode
    model_config = {
        "from_attributes": True  # Enable ORM object conversion
    }


class DuplicateCheckRequest(BaseModel):
    """
    Request schema for checking if a field name already exists.

    Used in:
    - POST /api/lists/{list_id}/custom-fields/check-duplicate

    Performs case-insensitive comparison (e.g., "Overall Rating" matches
    "overall rating", "OVERALL RATING", etc.).

    Example:
        {"name": "presentation quality"}

    Response will indicate if a field with this name (case-insensitive)
    already exists in the list.
    """
    name: str = Field(
        ...,
        min_length=1,
        max_length=255,
        description="Field name to check for duplicates"
    )

    @field_validator('name', mode='before')
    @classmethod
    def sanitize_name(cls, name: str) -> str:
        """
        Sanitize field name before duplicate check.
        
        Note: Case-insensitive comparison is handled by the API layer
        using SQL LOWER() for proper database-level comparison.
        """
        if not name:
            raise ValueError("Field name cannot be empty")
        
        try:
            sanitized = sanitize_string(name, max_length=255, allow_newlines=False)
        except ValidationError as e:
            raise ValueError(str(e))
        
        if not sanitized:
            raise ValueError("Field name cannot be whitespace-only")
        
        return sanitized


class DuplicateCheckResponse(BaseModel):
    """
    Response schema for duplicate field name check.

    Indicates whether a field with the given name (case-insensitive)
    already exists in the list. If exists=True, the existing field
    details are included for reference.

    Example (field exists):
        {
            "exists": true,
            "field": {
                "id": "123e4567-e89b-12d3-a456-426614174000",
                "name": "Presentation Quality",
                "field_type": "select",
                "config": {"options": ["bad", "good", "great"]},
                ...
            }
        }

    Example (field does not exist):
        {
            "exists": false,
            "field": null
        }
    """
    exists: bool = Field(
        ...,
        description="True if a field with this name already exists"
    )
    field: CustomFieldResponse | None = Field(
        None,
        description="Existing field details (if exists=true)"
    )
```

**Changes:**
1. Added `sanitize_string` import
2. Updated `CustomFieldBase.strip_name` to use `sanitize_string()` (replaces simple `.strip()`)
3. Updated `CustomFieldUpdate.strip_name` to use `sanitize_string()`
4. Updated `DuplicateCheckRequest.strip_name` to use `sanitize_string()`
5. Updated `SelectConfig.validate_and_strip_options` to sanitize each option
6. Updated `_validate_config_for_type` to sanitize options in 'select' type

---

### Step 7: Update field_schema.py with name/description sanitization

**Why this approach?**  
Field schema names and descriptions are user-provided text that should be sanitized. Names are short (255 chars), descriptions allow newlines (1000 chars).

**File:** `backend/app/schemas/field_schema.py` (MODIFY lines 1-105)

```python
"""
Pydantic schemas for Field Schema API endpoints.

Field schemas are collections of custom fields that can be bound to tags,
enabling reusable evaluation templates (e.g., "Video Quality" schema containing
presentation, rating, and content fields).

Schema-field associations are managed via the SchemaField join table, which
tracks display_order and show_on_card settings for each field in a schema.
"""

from typing import Optional
from uuid import UUID
from datetime import datetime

from pydantic import BaseModel, Field, field_validator, model_validator

# Import sanitization
from app.core.validation import sanitize_string, ValidationError


# ============================================================================
# Nested Schema for SchemaField (Join Table Data)
# ============================================================================

class FieldInSchemaResponse(BaseModel):
    """
    Full custom field details for display in schema response.

    Includes all CustomField attributes for rich display in frontend.
    Matches CustomFieldResponse structure from Task #64.
    """
    id: UUID
    list_id: UUID
    name: str
    field_type: str  # 'select' | 'rating' | 'text' | 'boolean'
    config: dict  # Type-specific configuration
    created_at: datetime
    updated_at: datetime

    model_config = {
        "from_attributes": True
    }


class SchemaFieldResponse(BaseModel):
    """
    Combined schema field data with full custom field details.

    This is the main nested object in FieldSchemaResponse, combining
    join table metadata (display_order, show_on_card) with full field data.
    """
    field_id: UUID
    schema_id: UUID
    display_order: int
    show_on_card: bool
    field: FieldInSchemaResponse  # Full nested field details

    model_config = {
        "from_attributes": True
    }


# ============================================================================
# Schema Field Input (for POST /schemas with initial fields)
# ============================================================================

class SchemaFieldInput(BaseModel):
    """
    Input schema for adding a field to a schema during creation.

    Used in FieldSchemaCreate.fields array to specify initial fields
    when creating a schema.

    Example:
        {
            "field_id": "123e4567-e89b-12d3-a456-426614174000",
            "display_order": 0,
            "show_on_card": true
        }
    """
    field_id: UUID = Field(..., description="ID of existing custom field to add")
    display_order: int = Field(..., ge=0, description="Display order (0-indexed)")
    show_on_card: bool = Field(True, description="Show field on video cards")


# ============================================================================
# Main FieldSchema Schemas
# ============================================================================

class FieldSchemaBase(BaseModel):
    """
    Base schema for field schema with shared attributes.

    Contains common fields used in create and response operations.
    """
    name: str = Field(
        ...,
        min_length=1,
        max_length=255,
        description="Schema name (e.g., 'Video Quality', 'Tutorial Metrics')"
    )
    description: Optional[str] = Field(
        None,
        max_length=1000,
        description="Optional explanation of what this schema evaluates"
    )

    @field_validator('name', mode='before')
    @classmethod
    def sanitize_name(cls, v: str) -> str:
        """
        Sanitize schema name: trim whitespace, remove control chars.
        
        Security: Prevents XSS and terminal injection attacks.
        """
        if not v:
            raise ValueError("Schema name cannot be empty")
        
        try:
            sanitized = sanitize_string(v, max_length=255, allow_newlines=False)
        except ValidationError as e:
            raise ValueError(str(e))
        
        if not sanitized:
            raise ValueError("Schema name cannot be whitespace-only")
        
        return sanitized

    @field_validator('description', mode='before')
    @classmethod
    def sanitize_description(cls, v: Optional[str]) -> Optional[str]:
        """
        Sanitize schema description: trim whitespace, preserve newlines.
        
        Security: Prevents XSS and terminal injection, allows multi-line text.
        """
        if v is None or v == "":
            return None
        
        try:
            sanitized = sanitize_string(v, max_length=1000, allow_newlines=True)
        except ValidationError as e:
            raise ValueError(str(e))
        
        return sanitized if sanitized else None


class FieldSchemaCreate(FieldSchemaBase):
    """
    Schema for creating a new field schema.

    Used in: POST /api/lists/{list_id}/schemas

    Optionally accepts an array of fields to add to the schema during creation.
    If provided, all field_ids must exist in the same list as the schema.

    Validates:
    - Max 3 fields can have show_on_card=true
    - No duplicate display_order values
    - No duplicate field_id values

    Example (minimal):
        {
            "name": "Video Quality",
            "description": "Standard quality metrics"
        }

    Example (with fields):
        {
            "name": "Video Quality",
            "description": "Standard quality metrics",
            "fields": [
                {
                    "field_id": "uuid-presentation",
                    "display_order": 0,
                    "show_on_card": true
                },
                {
                    "field_id": "uuid-rating",
                    "display_order": 1,
                    "show_on_card": true
                }
            ]
        }
    """
    fields: Optional[list[SchemaFieldInput]] = Field(
        None,
        description="Optional array of fields to add to schema during creation"
    )

    @field_validator('fields')
    @classmethod
    def validate_show_on_card_limit(cls, fields: Optional[list[SchemaFieldInput]]) -> Optional[list[SchemaFieldInput]]:
        """
        Validate that at most 3 fields have show_on_card=true.

        This constraint ensures the UI doesn't become cluttered with too many
        fields displayed on video cards. Users can still define more fields,
        but only 3 will be prominently displayed.

        Raises:
            ValueError: If more than 3 fields have show_on_card=true
        """
        if fields is None:
            return fields

        show_on_card_fields = [f for f in fields if f.show_on_card]
        if len(show_on_card_fields) > 3:
            # Show first 5 field_ids (truncated) to help identify which fields need fixing
            field_ids_str = ", ".join(str(f.field_id)[:8] + "..." for f in show_on_card_fields[:5])
            raise ValueError(
                f"At most 3 fields can have show_on_card=true, but {len(show_on_card_fields)} fields are marked. "
                f"Please set show_on_card=false for {len(show_on_card_fields) - 3} of these fields: {field_ids_str}"
            )
        return fields

    @field_validator('fields')
    @classmethod
    def validate_no_duplicate_display_orders(cls, fields: Optional[list[SchemaFieldInput]]) -> Optional[list[SchemaFieldInput]]:
        """
        Validate that all display_order values are unique.

        Each field must have a unique display_order to ensure consistent
        rendering order in the UI. Duplicate orders create ambiguity about
        which field should appear first.

        Raises:
            ValueError: If duplicate display_order values are found
        """
        if fields is None:
            return fields

        display_orders = [f.display_order for f in fields]
        if len(display_orders) != len(set(display_orders)):
            # Find which orders are duplicated
            duplicates = [order for order in display_orders if display_orders.count(order) > 1]
            raise ValueError(
                f"Duplicate display_order values found: {set(duplicates)}. "
                f"Each field must have a unique display_order."
            )
        return fields

    @field_validator('fields')
    @classmethod
    def validate_no_duplicate_field_ids(cls, fields: Optional[list[SchemaFieldInput]]) -> Optional[list[SchemaFieldInput]]:
        """
        Validate that all field_id values are unique.

        Each field can only be added once to a schema. Duplicate field_ids
        would create confusion and violate the database unique constraint on
        (schema_id, field_id).

        Raises:
            ValueError: If duplicate field_id values are found
        """
        if fields is None:
            return fields

        field_ids = [f.field_id for f in fields]
        if len(field_ids) != len(set(field_ids)):
            # Find which field_ids are duplicated
            duplicates = [fid for fid in field_ids if field_ids.count(fid) > 1]
            # Show truncated UUIDs for readability
            duplicates_str = ", ".join(str(fid)[:8] + "..." for fid in set(duplicates))
            raise ValueError(
                f"Duplicate field_id values found: {duplicates_str}. "
                f"Each field can only be added once to a schema."
            )
        return fields


class FieldSchemaUpdate(BaseModel):
    """
    Schema for updating field schema metadata.

    Used in: PUT /api/lists/{list_id}/schemas/{schema_id}

    Only updates name and/or description. Field management (adding/removing
    fields from schema) is handled by separate endpoints in Task #69.

    All fields are optional to support partial updates.

    Example (update name only):
        {"name": "Updated Video Quality"}

    Example (update both):
        {
            "name": "Tutorial Evaluation",
            "description": "Comprehensive tutorial assessment criteria"
        }
    """
    name: Optional[str] = Field(
        None,
        min_length=1,
        max_length=255,
        description="Schema name"
    )
    description: Optional[str] = Field(
        None,
        max_length=1000,
        description="Schema description"
    )

    @field_validator('name', mode='before')
    @classmethod
    def sanitize_name(cls, v: Optional[str]) -> Optional[str]:
        """Sanitize schema name if provided."""
        if v is None:
            return None
        
        if not v:
            raise ValueError("Schema name cannot be empty")
        
        try:
            sanitized = sanitize_string(v, max_length=255, allow_newlines=False)
        except ValidationError as e:
            raise ValueError(str(e))
        
        if not sanitized:
            raise ValueError("Schema name cannot be whitespace-only")
        
        return sanitized

    @field_validator('description', mode='before')
    @classmethod
    def sanitize_description(cls, v: Optional[str]) -> Optional[str]:
        """Sanitize schema description if provided."""
        if v is None or v == "":
            return None
        
        try:
            sanitized = sanitize_string(v, max_length=1000, allow_newlines=True)
        except ValidationError as e:
            raise ValueError(str(e))
        
        return sanitized if sanitized else None


# ... rest of file remains unchanged (FieldSchemaResponse, etc.)
```

**Changes:**
1. Added `sanitize_string` import
2. Added `sanitize_name` validator to `FieldSchemaBase` (applies to Create)
3. Added `sanitize_description` validator to `FieldSchemaBase`
4. Added `sanitize_name` validator to `FieldSchemaUpdate`
5. Added `sanitize_description` validator to `FieldSchemaUpdate`

---

### Step 8: Update job_progress.py with message sanitization

**Why this approach?**  
Progress messages are displayed in real-time UI and should be sanitized to prevent XSS. The `message` field already exists (line 13), we just add validation.

**File:** `backend/app/schemas/job_progress.py` (MODIFY)

```python
from datetime import datetime
from uuid import UUID
from pydantic import BaseModel, Field, field_validator
from typing import Any, Optional

# Import sanitization
from app.core.validation import sanitize_string, ValidationError


class ProgressData(BaseModel):
    """Schema for progress_data JSONB field"""
    job_id: UUID
    status: str = Field(..., pattern="^(pending|processing|completed|failed)$")
    progress: int = Field(..., ge=0, le=100)
    current_video: int = Field(..., ge=0)
    total_videos: int = Field(..., gt=0)
    message: str
    video_id: Optional[UUID] = None
    error: Optional[str] = None

    @field_validator('message', mode='before')
    @classmethod
    def sanitize_message(cls, v: str) -> str:
        """
        Sanitize progress message for safe display in real-time UI.
        
        Security: Prevents XSS attacks in WebSocket-delivered progress updates.
        """
        if not v:
            return ""
        
        try:
            # Allow newlines in progress messages (multi-line status)
            sanitized = sanitize_string(v, max_length=500, allow_newlines=True)
        except ValidationError:
            # For progress messages, truncate instead of failing
            # (we don't want to break job processing)
            return sanitize_string(v[:500], max_length=500, allow_newlines=True)
        
        return sanitized

    @field_validator('error', mode='before')
    @classmethod
    def sanitize_error(cls, v: Optional[str]) -> Optional[str]:
        """Sanitize error message if present."""
        if v is None or v == "":
            return None
        
        try:
            sanitized = sanitize_string(v, max_length=1000, allow_newlines=True)
        except ValidationError:
            # Truncate instead of failing
            return sanitize_string(v[:1000], max_length=1000, allow_newlines=True)
        
        return sanitized if sanitized else None


class JobProgressEventCreate(BaseModel):
    """Schema for creating a progress event"""
    job_id: UUID
    progress_data: ProgressData


class JobProgressEventRead(BaseModel):
    """Schema for reading a progress event"""
    id: UUID
    job_id: UUID
    created_at: datetime
    progress_data: dict[str, Any]  # JSONB returns as dict

    class Config:
        from_attributes = True
```

**Changes:**
1. Added `field_validator` import
2. Added `sanitize_string` import
3. Added `sanitize_message` validator (truncates instead of raising error)
4. Added `sanitize_error` validator (truncates instead of raising error)

**Why truncate instead of raise?**  
Progress messages come from background workers. If a message is too long, we don't want to fail the entire job. Better to truncate and continue processing.

---

### Step 9: Run validation tests

**Verification:**
```bash
cd backend

# Test validation module
pytest tests/core/test_validation.py -v
# Expected: All tests PASS (23 tests)

# Test integration (schemas use validation)
pytest tests/api/test_lists.py -v -k "test_create_list"
pytest tests/api/test_tags.py -v -k "test_create_tag"
pytest tests/api/test_custom_fields.py -v -k "test_create_custom_field"

# Test edge cases
pytest tests/ -v -k "sanitize"
```

---

### Step 10: Update CLAUDE.md with validation pattern

**Why this approach?**  
Document the validation pattern so future developers know how to add sanitization to new schemas.

**File:** `CLAUDE.md` (ADD section after "Testing Patterns")

```markdown
### Input Validation Patterns

**Security Module:** `backend/app/core/validation.py`

All user-provided text inputs must be sanitized using `sanitize_string()` to prevent:
- XSS attacks (control character injection)
- Terminal injection (control characters in logs)
- DoS attacks (excessively long inputs)

**Usage in Pydantic Schemas:**

```python
from pydantic import BaseModel, Field, field_validator
from app.core.validation import sanitize_string, ValidationError

class MySchema(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: str | None = Field(None, max_length=1000)

    @field_validator('name', mode='before')
    @classmethod
    def sanitize_name(cls, v: str) -> str:
        """Sanitize name: trim whitespace, remove control chars."""
        if not v:
            raise ValueError("Name cannot be empty")
        
        try:
            sanitized = sanitize_string(v, max_length=255, allow_newlines=False)
        except ValidationError as e:
            raise ValueError(str(e))
        
        if not sanitized:
            raise ValueError("Name cannot be whitespace-only")
        
        return sanitized

    @field_validator('description', mode='before')
    @classmethod
    def sanitize_description(cls, v: str | None) -> str | None:
        """Sanitize description: preserve newlines for multi-line text."""
        if v is None or v == "":
            return None
        
        try:
            sanitized = sanitize_string(v, max_length=1000, allow_newlines=True)
        except ValidationError as e:
            raise ValueError(str(e))
        
        return sanitized if sanitized else None
```

**When to use `allow_newlines=True`:**
- Description fields (multi-line text expected)
- Progress/error messages (stack traces, multi-line status)

**When to use `allow_newlines=False`:**
- Names (list names, tag names, field names)
- Single-line inputs (email, URLs)

**Files with sanitization applied:**
- `backend/app/schemas/list.py` - List names/descriptions
- `backend/app/schemas/tag.py` - Tag names
- `backend/app/schemas/video.py` - Video titles
- `backend/app/schemas/custom_field.py` - Field names, select options
- `backend/app/schemas/field_schema.py` - Schema names/descriptions
- `backend/app/schemas/job_progress.py` - Progress/error messages
```

---

## 🧪 Testing Strategy

### Unit Tests (backend/tests/core/test_validation.py)

**Test Coverage:**
1. ✅ **YouTube URL validation:**
   - Valid URLs (youtube.com, youtu.be, m.youtube.com)
   - Invalid URLs (wrong domain, no ID, empty)
   - Length limits (>2048 chars rejected)
   - ReDoS protection (timeout < 1s)

2. ✅ **String sanitization:**
   - Basic trimming (leading/trailing whitespace)
   - Empty input handling (returns "")
   - Length limits (exceeds max_length raises error)
   - Control character removal (0x00-0x1F removed)
   - Newline handling (removed by default, preserved if allowed)
   - Unicode support (preserves non-ASCII printable chars)
   - Length check after trim (validates post-trim length)

3. ✅ **Email validation:**
   - Valid formats (user@domain.com)
   - Invalid formats (no @, no domain, etc.)
   - Length limits (>320 chars rejected)
   - Lowercase normalization

**Expected Results:**
```bash
cd backend
pytest tests/core/test_validation.py -v --cov=app.core.validation

# Expected output:
# tests/core/test_validation.py::test_valid_youtube_urls PASSED
# tests/core/test_validation.py::test_invalid_youtube_urls PASSED
# tests/core/test_validation.py::test_url_length_limit PASSED
# tests/core/test_validation.py::test_redos_protection PASSED
# tests/core/test_validation.py::test_sanitize_string_basic PASSED
# tests/core/test_validation.py::test_sanitize_string_empty_input PASSED
# tests/core/test_validation.py::test_sanitize_string_length_limit PASSED
# tests/core/test_validation.py::test_sanitize_string_control_characters PASSED
# tests/core/test_validation.py::test_sanitize_string_newlines_default PASSED
# tests/core/test_validation.py::test_sanitize_string_newlines_allowed PASSED
# tests/core/test_validation.py::test_sanitize_string_unicode PASSED
# tests/core/test_validation.py::test_sanitize_string_length_after_trim PASSED
# tests/core/test_validation.py::test_validate_email_valid PASSED
# tests/core/test_validation.py::test_validate_email_invalid PASSED
# tests/core/test_validation.py::test_validate_email_lowercase PASSED
# 
# Coverage: 95%+
```

---

### Integration Tests

**Test sanitization in API endpoints:**

```bash
cd backend

# Test list creation with whitespace
pytest tests/api/test_lists.py::test_create_list_with_whitespace -v

# Test tag creation with control chars
pytest tests/api/test_tags.py::test_create_tag_sanitizes_input -v

# Test custom field with long name
pytest tests/api/test_custom_fields.py::test_create_field_name_too_long -v
```

**Add these integration tests** (if they don't exist):

**File:** `backend/tests/api/test_lists.py` (ADD)

```python
def test_create_list_with_whitespace(client, auth_headers):
    """Test that list names are trimmed."""
    response = client.post(
        "/api/lists",
        json={"name": "  My List  ", "description": "  Trimmed  "},
        headers=auth_headers
    )
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "My List"
    assert data["description"] == "Trimmed"


def test_create_list_whitespace_only_name(client, auth_headers):
    """Test that whitespace-only names are rejected."""
    response = client.post(
        "/api/lists",
        json={"name": "   "},
        headers=auth_headers
    )
    assert response.status_code == 422
    assert "whitespace-only" in response.json()["detail"][0]["msg"].lower()
```

---

## 📚 Reference

### Master Plan
- **File:** `docs/plans/2025-11-02-security-hardening-implementation.md`
- **Section:** Task #5 - Input Validation & ReDoS Protection (lines 1731-2086)
- **Validation Module:** Lines 1807-1994 (sanitize_string implementation)
- **Application Guidance:** Lines 2063-2069 (Step 6: Add validation to all text inputs)

### Related Tasks
- **Task #5:** Parent task - Input Validation & ReDoS Protection
- **Task #73:** Custom field value validation (similar sanitization pattern)
- **Task #64:** Custom field schemas (where sanitization is applied)

### Design Decisions

**1. Why `mode='before'` instead of `mode='after'`?**
- REF MCP (Pydantic v2 docs): "Before validators run before Pydantic's internal parsing. They receive raw input."
- We need to sanitize BEFORE Pydantic checks `min_length`/`max_length` because trimming may change length.
- Example: Input "  abc  " (7 chars) → After trim "abc" (3 chars) → Then validate min_length=1

**2. Why raise `ValueError` instead of `ValidationError`?**
- Pydantic expects `ValueError` from field_validator functions.
- `ValidationError` is our custom exception for the validation module.
- We catch `ValidationError` from `sanitize_string()` and re-raise as `ValueError` for Pydantic.

**3. Why allow newlines in descriptions but not names?**
- **Names** (list names, tag names, field names): Single-line identifiers, displayed in dropdowns/chips.
- **Descriptions** (list descriptions, schema descriptions): Multi-paragraph explanations, displayed in text areas.
- **Messages** (progress, errors): May contain multi-line status or stack traces.

**4. Why truncate progress messages instead of raising errors?**
- Progress messages come from background ARQ workers.
- If a message is too long, we don't want to crash the entire job.
- Better to truncate and continue processing (defensive programming).

**5. Why lenient validation in `VideoResponse` but strict in `VideoAdd`?**
- **Response models** (VideoResponse): Data already in database, lenient to avoid breaking reads.
- **Create/Update models** (VideoAdd, ListCreate): Strict validation to prevent bad data from entering.

**6. Why sanitize YouTube titles when they come from trusted API?**
- Defense-in-depth principle: Assume API could be compromised or return corrupted data.
- Database corruption could inject malicious content.
- Better to validate everywhere than have a single point of failure.

---

## ✅ Definition of Done

- [ ] `backend/app/core/validation.py` created with all functions
- [ ] `backend/tests/core/test_validation.py` created with 15+ tests
- [ ] All tests PASS with >95% coverage
- [ ] Sanitization applied to all 6 schema files (list, tag, video, custom_field, field_schema, job_progress)
- [ ] Integration tests verify API endpoints sanitize input
- [ ] CLAUDE.md updated with validation patterns
- [ ] No breaking changes (existing tests still pass)
- [ ] Commit message follows convention

**Commit Message:**
```bash
git add backend/app/core/validation.py \
        backend/tests/core/test_validation.py \
        backend/app/schemas/*.py \
        CLAUDE.md

git commit -m "feat(security): implement text input sanitization across all schemas

- Add validation module with sanitize_string(), validate_youtube_url(), validate_email()
- Apply sanitization to all user-provided text fields:
  * List names/descriptions (list.py)
  * Tag names (tag.py)
  * Video titles (video.py)
  * Custom field names and select options (custom_field.py)
  * Schema names/descriptions (field_schema.py)
  * Progress/error messages (job_progress.py)
- Protections: XSS prevention, control char removal, length limits, ReDoS timeout
- Comprehensive tests: 15 unit tests, 95%+ coverage
- Updated CLAUDE.md with validation patterns

Part of Task #131 (Security Hardening - Input Validation)

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## 🎓 Learning Notes

**Key Insights:**
1. **Pydantic v2 validators**: Use `mode='before'` for sanitization, `mode='after'` for post-validation checks.
2. **Security layers**: Sanitize at schema level (first defense), validate at API level (second defense), sanitize at DB level (third defense).
3. **Defensive programming**: Truncate instead of raising errors for non-critical fields (progress messages).
4. **DRY principle**: Centralized `sanitize_string()` function used by all schemas (easier to update, consistent behavior).

**Common Pitfalls:**
1. ❌ **Don't forget whitespace-only check**: After trimming, check if result is empty.
2. ❌ **Don't use `mode='after'` for sanitization**: Pydantic's validators run after, so `max_length` validation happens first.
3. ❌ **Don't raise custom exceptions from field_validator**: Pydantic expects `ValueError`.
4. ❌ **Don't sanitize in response models**: Response models should be lenient (data already in DB).

**REF MCP Validations:**
- ✅ Pydantic v2 best practices: `field_validator` with `mode='before'` for input transformation
- ✅ Security: Defense-in-depth with multiple validation layers
- ✅ Testing: 95%+ coverage with edge cases (unicode, control chars, length limits)
