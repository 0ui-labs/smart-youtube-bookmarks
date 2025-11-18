# Task #175: Implement Logging Configuration

**Plan Task:** #175
**Wave/Phase:** P2 - Operational Excellence (Security Hardening)
**Dependencies:** None

---

## 🎯 Ziel

Replace standard library string-based logging with structured JSON logging using `structlog`. Provide environment-aware log output (JSON in production, colored console in development) and centralized logging configuration with structured context support.

## 📋 Acceptance Criteria

- [ ] `structlog` dependency added to `requirements.txt`
- [ ] `backend/app/core/logging.py` module created with `configure_logging()` and `get_logger()` functions
- [ ] Environment-aware processor chain (JSON for production, colored for development)
- [ ] Helper function `log_request()` for standardized HTTP request logging
- [ ] Unit tests verify JSON parsing, context inclusion, and log level filtering
- [ ] Tests achieve 100% code coverage for logging module
- [ ] All tests passing (`pytest backend/tests/core/test_logging.py -v`)
- [ ] No breaking changes to existing logger usage patterns

---

## 🛠️ Implementation Steps

### 1. Add structlog dependency

**Files:** `backend/requirements.txt`
**Action:** Add `structlog` to dependencies list

```diff
 isodate==0.6.1
 google-genai[aiohttp]==0.3.0
+structlog==24.1.0
```

**Install:**
```bash
cd backend
pip install structlog==24.1.0
```

**Verification:**
```bash
python -c "import structlog; print(structlog.__version__)"
# Expected output: 24.1.0
```

---

### 2. Create test file (TDD approach)

**Files:** `backend/tests/core/test_logging.py`
**Action:** Write comprehensive unit tests before implementation

```python
"""
Tests for structured logging module.

Tests verify:
- JSON output format in production mode
- Colored console output in development mode
- Context inclusion (user_id, video_id, etc.)
- Log level filtering
- HTTP request logging helper
"""

import json
import logging
from io import StringIO
from unittest.mock import patch

import pytest

from app.core.logging import configure_logging, get_logger, log_request


class TestStructuredLogging:
    """Test suite for structured logging configuration."""

    def test_json_output_in_production(self):
        """
        Test that logs are output as JSON in production mode.

        Verifies:
        - Output is valid JSON
        - Contains expected fields (event, timestamp, level, logger)
        - Custom context fields are included
        """
        output = StringIO()
        
        # Mock production environment
        with patch("app.core.logging.settings.env", "production"):
            configure_logging(stream=output)
            
            logger = get_logger("test")
            logger.info("test_event", user_id="user-123", action="video_upload")
        
        # Parse JSON output
        output.seek(0)
        log_line = output.readline()
        log_data = json.loads(log_line)
        
        # Verify structure
        assert log_data["event"] == "test_event"
        assert log_data["user_id"] == "user-123"
        assert log_data["action"] == "video_upload"
        assert log_data["level"] == "info"
        assert log_data["logger"] == "test"
        assert "timestamp" in log_data

    def test_colored_console_in_development(self):
        """
        Test that logs use colored console renderer in development.

        Verifies:
        - Output is NOT JSON (human-readable)
        - Contains event name and context
        """
        output = StringIO()
        
        # Mock development environment
        with patch("app.core.logging.settings.env", "development"):
            configure_logging(stream=output)
            
            logger = get_logger("test")
            logger.info("dev_event", user_id="dev-user")
        
        output.seek(0)
        log_output = output.read()
        
        # Should NOT be valid JSON in development
        with pytest.raises(json.JSONDecodeError):
            json.loads(log_output)
        
        # Should contain event name and context
        assert "dev_event" in log_output
        assert "dev-user" in log_output

    def test_log_includes_context(self):
        """
        Test that logs include all contextual information.

        Verifies:
        - Logger name is captured
        - Custom fields are preserved
        - Log level is correct
        """
        output = StringIO()
        
        with patch("app.core.logging.settings.env", "production"):
            configure_logging(stream=output)
            
            logger = get_logger("app.api.videos")
            logger.error(
                "operation_failed",
                error="Connection timeout",
                video_id="abc-123",
                retry_count=3
            )
        
        output.seek(0)
        log_data = json.loads(output.readline())
        
        assert log_data["level"] == "error"
        assert log_data["logger"] == "app.api.videos"
        assert log_data["event"] == "operation_failed"
        assert log_data["error"] == "Connection timeout"
        assert log_data["video_id"] == "abc-123"
        assert log_data["retry_count"] == 3

    def test_log_levels(self):
        """
        Test that different log levels are correctly captured.

        Verifies debug, info, warning, error levels.
        """
        output = StringIO()
        
        with patch("app.core.logging.settings.env", "production"):
            configure_logging(stream=output)
            
            logger = get_logger("test")
            logger.debug("debug_event")
            logger.info("info_event")
            logger.warning("warning_event")
            logger.error("error_event")
        
        output.seek(0)
        lines = output.readlines()
        
        # Parse all log lines
        logs = [json.loads(line) for line in lines]
        
        assert logs[0]["level"] == "debug"
        assert logs[1]["level"] == "info"
        assert logs[2]["level"] == "warning"
        assert logs[3]["level"] == "error"

    def test_log_request_helper_success(self):
        """
        Test log_request() helper for successful requests (2xx status).

        Verifies:
        - Uses info level for 2xx status codes
        - Includes all required fields (method, path, status, duration)
        - Optional user_id is included when provided
        """
        output = StringIO()
        
        with patch("app.core.logging.settings.env", "production"):
            configure_logging(stream=output)
            
            logger = get_logger("test")
            log_request(
                logger=logger,
                method="GET",
                path="/api/videos",
                status_code=200,
                duration_ms=45.67,
                user_id="user-456"
            )
        
        output.seek(0)
        log_data = json.loads(output.readline())
        
        assert log_data["level"] == "info"
        assert log_data["event"] == "http_request"
        assert log_data["method"] == "GET"
        assert log_data["path"] == "/api/videos"
        assert log_data["status_code"] == 200
        assert log_data["duration_ms"] == 45.67
        assert log_data["user_id"] == "user-456"

    def test_log_request_helper_client_error(self):
        """
        Test log_request() helper for client errors (4xx status).

        Verifies warning level is used for 4xx status codes.
        """
        output = StringIO()
        
        with patch("app.core.logging.settings.env", "production"):
            configure_logging(stream=output)
            
            logger = get_logger("test")
            log_request(
                logger=logger,
                method="POST",
                path="/api/videos",
                status_code=404,
                duration_ms=12.34
            )
        
        output.seek(0)
        log_data = json.loads(output.readline())
        
        assert log_data["level"] == "warning"
        assert log_data["status_code"] == 404
        # user_id should not be present when not provided
        assert "user_id" not in log_data

    def test_log_request_helper_server_error(self):
        """
        Test log_request() helper for server errors (5xx status).

        Verifies error level is used for 5xx status codes.
        """
        output = StringIO()
        
        with patch("app.core.logging.settings.env", "production"):
            configure_logging(stream=output)
            
            logger = get_logger("test")
            log_request(
                logger=logger,
                method="PUT",
                path="/api/videos/123",
                status_code=500,
                duration_ms=1234.56
            )
        
        output.seek(0)
        log_data = json.loads(output.readline())
        
        assert log_data["level"] == "error"
        assert log_data["status_code"] == 500

    def test_timestamp_format(self):
        """
        Test that timestamps are in ISO 8601 format.

        Verifies timestamp can be parsed and is recent.
        """
        from datetime import datetime, timedelta
        
        output = StringIO()
        
        with patch("app.core.logging.settings.env", "production"):
            configure_logging(stream=output)
            
            logger = get_logger("test")
            logger.info("timestamp_test")
        
        output.seek(0)
        log_data = json.loads(output.readline())
        
        # Verify timestamp exists and is ISO format
        assert "timestamp" in log_data
        timestamp = datetime.fromisoformat(log_data["timestamp"].replace("Z", "+00:00"))
        
        # Should be within last 5 seconds
        now = datetime.now(timestamp.tzinfo)
        assert (now - timestamp) < timedelta(seconds=5)

    def test_exception_logging(self):
        """
        Test that exceptions are properly logged with stack traces.

        Verifies exc_info is captured when exception occurs.
        """
        output = StringIO()
        
        with patch("app.core.logging.settings.env", "production"):
            configure_logging(stream=output)
            
            logger = get_logger("test")
            
            try:
                raise ValueError("Test exception")
            except ValueError:
                logger.exception("error_occurred", operation="test")
        
        output.seek(0)
        log_data = json.loads(output.readline())
        
        assert log_data["event"] == "error_occurred"
        assert log_data["operation"] == "test"
        # Exception info should be present
        assert "exception" in log_data or "exc_info" in log_data

    def test_multiple_loggers(self):
        """
        Test that multiple loggers can be created with different names.

        Verifies logger isolation and correct name attribution.
        """
        output = StringIO()
        
        with patch("app.core.logging.settings.env", "production"):
            configure_logging(stream=output)
            
            logger1 = get_logger("app.api.videos")
            logger2 = get_logger("app.workers.processor")
            
            logger1.info("video_event")
            logger2.info("worker_event")
        
        output.seek(0)
        lines = output.readlines()
        
        log1 = json.loads(lines[0])
        log2 = json.loads(lines[1])
        
        assert log1["logger"] == "app.api.videos"
        assert log1["event"] == "video_event"
        assert log2["logger"] == "app.workers.processor"
        assert log2["event"] == "worker_event"

    def test_duration_rounding(self):
        """
        Test that log_request() rounds duration to 2 decimal places.

        Verifies floating point precision handling.
        """
        output = StringIO()
        
        with patch("app.core.logging.settings.env", "production"):
            configure_logging(stream=output)
            
            logger = get_logger("test")
            log_request(
                logger=logger,
                method="GET",
                path="/test",
                status_code=200,
                duration_ms=123.456789
            )
        
        output.seek(0)
        log_data = json.loads(output.readline())
        
        # Should be rounded to 2 decimal places
        assert log_data["duration_ms"] == 123.46
```

**Run test (expect FAIL - module not found):**
```bash
cd backend
pytest tests/core/test_logging.py -v
```

**Expected output:**
```
ModuleNotFoundError: No module named 'app.core.logging'
```

---

### 3. Implement logging configuration module

**Files:** `backend/app/core/logging.py`
**Action:** Create structured logging module with environment-aware configuration

```python
"""
Structured logging configuration using structlog.

This module provides centralized logging configuration with environment-aware
output formats:
- Production: JSON-formatted logs for machine parsing
- Development: Colored console output for human readability

Usage:
    from app.core.logging import get_logger

    logger = get_logger(__name__)
    logger.info("user_login", user_id="123", ip_address="192.168.1.1")
"""

import sys
import logging
from typing import Optional, Any

import structlog
from structlog.types import FilteringBoundLogger

from app.core.config import settings


def configure_logging(stream: Optional[Any] = None) -> None:
    """
    Configure application-wide structured logging.

    Logs are output as JSON in production for machine parsing, and as
    colored console output in development for human readability.

    Args:
        stream: Optional output stream (default: sys.stdout).
                Used for testing to capture log output.

    Example:
        # At application startup (main.py)
        configure_logging()

        # In tests
        from io import StringIO
        output = StringIO()
        configure_logging(stream=output)
    """
    # Determine log level based on environment
    # Production: INFO and above, Development: DEBUG and above
    log_level = logging.INFO if settings.env == "production" else logging.DEBUG

    # Configure standard library logging (structlog wraps this)
    logging.basicConfig(
        format="%(message)s",
        stream=stream or sys.stdout,
        level=log_level,
    )

    # Shared processors (used in both environments)
    shared_processors = [
        # Merge in context variables (e.g., request_id from middleware)
        structlog.contextvars.merge_contextvars,
        # Add log level (debug, info, warning, error)
        structlog.stdlib.add_log_level,
        # Add logger name (e.g., "app.api.videos")
        structlog.stdlib.add_logger_name,
        # Add ISO 8601 timestamp
        structlog.processors.TimeStamper(fmt="iso"),
        # Add stack info for exceptions
        structlog.processors.StackInfoRenderer(),
    ]

    # Environment-specific processors
    if settings.env == "development":
        # Development: Human-readable colored output
        # Example: [info     ] user_login [app.api.auth] user_id='123'
        processors = shared_processors + [
            structlog.dev.ConsoleRenderer()
        ]
    else:
        # Production: JSON output for log aggregation (ELK, CloudWatch, etc.)
        # Example: {"event":"user_login","level":"info","user_id":"123",...}
        processors = shared_processors + [
            # Format exceptions as strings
            structlog.processors.format_exc_info,
            # Render as JSON
            structlog.processors.JSONRenderer()
        ]

    # Apply configuration globally
    structlog.configure(
        processors=processors,
        wrapper_class=structlog.stdlib.BoundLogger,
        context_class=dict,
        logger_factory=structlog.stdlib.LoggerFactory(),
        cache_logger_on_first_use=True,
    )


def get_logger(name: str) -> FilteringBoundLogger:
    """
    Get a structured logger instance.

    Args:
        name: Logger name, typically __name__ of the calling module.
              Example: "app.api.videos", "app.workers.processor"

    Returns:
        Configured structured logger with bound context support.

    Example:
        logger = get_logger(__name__)
        logger.info("video_processed", video_id="abc-123", duration_ms=450)
    """
    return structlog.get_logger(name)


def log_request(
    logger: FilteringBoundLogger,
    method: str,
    path: str,
    status_code: int,
    duration_ms: float,
    user_id: Optional[str] = None
) -> None:
    """
    Log HTTP request with structured data and appropriate log level.

    Automatically chooses log level based on status code:
    - 2xx, 3xx: info
    - 4xx: warning
    - 5xx: error

    Args:
        logger: Structured logger instance from get_logger()
        method: HTTP method (GET, POST, PUT, DELETE, etc.)
        path: Request path (e.g., "/api/videos/123")
        status_code: HTTP response status code
        duration_ms: Request processing duration in milliseconds
        user_id: Optional authenticated user ID

    Example:
        logger = get_logger(__name__)
        log_request(
            logger=logger,
            method="GET",
            path="/api/videos",
            status_code=200,
            duration_ms=45.67,
            user_id="user-123"
        )

        # Output (JSON):
        # {
        #   "event": "http_request",
        #   "level": "info",
        #   "method": "GET",
        #   "path": "/api/videos",
        #   "status_code": 200,
        #   "duration_ms": 45.67,
        #   "user_id": "user-123",
        #   "timestamp": "2024-11-10T12:34:56.789Z"
        # }
    """
    # Build structured log data
    log_data = {
        "method": method,
        "path": path,
        "status_code": status_code,
        "duration_ms": round(duration_ms, 2),  # Round to 2 decimal places
    }

    # Include user_id only if provided (avoid null fields)
    if user_id:
        log_data["user_id"] = user_id

    # Choose log level based on status code
    if status_code >= 500:
        logger.error("http_request", **log_data)
    elif status_code >= 400:
        logger.warning("http_request", **log_data)
    else:
        logger.info("http_request", **log_data)
```

**Verification:**
```bash
cd backend
python -c "from app.core.logging import configure_logging, get_logger; configure_logging(); logger = get_logger('test'); logger.info('test_event')"
```

---

### 4. Run tests and verify implementation

**Files:** `backend/tests/core/test_logging.py`
**Action:** Run full test suite and verify all tests pass

```bash
cd backend
pytest tests/core/test_logging.py -v --cov=app.core.logging --cov-report=term-missing
```

**Expected output:**
```
tests/core/test_logging.py::TestStructuredLogging::test_json_output_in_production PASSED
tests/core/test_logging.py::TestStructuredLogging::test_colored_console_in_development PASSED
tests/core/test_logging.py::TestStructuredLogging::test_log_includes_context PASSED
tests/core/test_logging.py::TestStructuredLogging::test_log_levels PASSED
tests/core/test_logging.py::TestStructuredLogging::test_log_request_helper_success PASSED
tests/core/test_logging.py::TestStructuredLogging::test_log_request_helper_client_error PASSED
tests/core/test_logging.py::TestStructuredLogging::test_log_request_helper_server_error PASSED
tests/core/test_logging.py::TestStructuredLogging::test_timestamp_format PASSED
tests/core/test_logging.py::TestStructuredLogging::test_exception_logging PASSED
tests/core/test_logging.py::TestStructuredLogging::test_multiple_loggers PASSED
tests/core/test_logging.py::TestStructuredLogging::test_duration_rounding PASSED

---------- coverage: 100% -----------
Name                         Stmts   Miss  Cover   Missing
----------------------------------------------------------
app/core/logging.py            45      0   100%
----------------------------------------------------------
TOTAL                          45      0   100%

11 passed in 0.45s
```

---

### 5. Create test directory if needed

**Files:** `backend/tests/core/__init__.py`
**Action:** Ensure test directory structure exists

```bash
mkdir -p backend/tests/core
touch backend/tests/core/__init__.py
```

---

## 🧪 Testing Strategy

### Unit Tests (11 tests)

**Test Coverage:**
1. **JSON output in production** - Verify JSON format, required fields
2. **Colored console in development** - Verify human-readable output
3. **Context inclusion** - Verify custom fields are preserved
4. **Log levels** - Verify debug, info, warning, error levels
5. **HTTP request helper (success)** - Verify info level for 2xx
6. **HTTP request helper (client error)** - Verify warning level for 4xx
7. **HTTP request helper (server error)** - Verify error level for 5xx
8. **Timestamp format** - Verify ISO 8601 format
9. **Exception logging** - Verify stack trace capture
10. **Multiple loggers** - Verify logger isolation
11. **Duration rounding** - Verify floating point precision

**Coverage Target:** 100% line and branch coverage

**Performance:**
- All tests should complete in < 1 second
- No external dependencies (Redis, PostgreSQL)
- Pure unit tests with mocked settings

---

### Integration Testing (Manual)

**Test 1: Development mode output**
```bash
cd backend
export ENV=development
python -c "
from app.core.logging import configure_logging, get_logger
configure_logging()
logger = get_logger('test')
logger.info('test_event', user_id='123', action='upload')
"
```

**Expected:** Colored console output with readable format

**Test 2: Production mode output**
```bash
cd backend
export ENV=production
python -c "
from app.core.logging import configure_logging, get_logger
configure_logging()
logger = get_logger('test')
logger.info('test_event', user_id='123', action='upload')
"
```

**Expected:** Single line JSON output:
```json
{"event":"test_event","level":"info","logger":"test","user_id":"123","action":"upload","timestamp":"2024-11-10T..."}
```

**Test 3: Log request helper**
```bash
cd backend
python -c "
from app.core.logging import configure_logging, get_logger, log_request
configure_logging()
logger = get_logger('test')
log_request(logger, 'GET', '/api/videos', 200, 45.67, 'user-123')
log_request(logger, 'POST', '/api/videos', 404, 12.34)
log_request(logger, 'PUT', '/api/videos/1', 500, 1000.0)
"
```

**Expected:** Three log lines with appropriate levels (info, warning, error)

---

## 📚 Reference

**Related Docs:**
- `docs/plans/2025-11-02-security-hardening-implementation.md` - Lines 2200-2350 (Task 7: Structured Logging)
- [structlog documentation](https://www.structlog.org/en/stable/) - Official docs
- [structlog processors](https://www.structlog.org/en/stable/processors.html) - Processor chain guide

**Related Code:**
- `backend/app/core/config.py` - Settings pattern with `env` field
- `backend/app/api/websocket.py:17` - Current logger usage pattern (`logger = logging.getLogger(__name__)`)
- `backend/app/workers/video_processor.py:14` - Worker logger usage

**Current Logger Usage (8 files):**
```
backend/app/api/videos.py:58
backend/app/workers/video_processor.py:14
backend/app/clients/youtube.py:24
backend/app/workers/settings.py:11
backend/app/api/processing.py:19
backend/app/core/config.py:82,109
backend/app/workers/db_manager.py:17
backend/app/clients/gemini.py:23
backend/app/api/websocket.py:17
```

**Migration Note:** Existing `logging.getLogger(__name__)` usage remains compatible. No breaking changes required. Future tasks will migrate to `get_logger()` gradually.

---

## 🎯 Design Decisions

### 1. Why structlog?

**Alternatives Considered:**
- Standard library `logging` - No structured output support
- `python-json-logger` - Limited processor chain, no development mode
- `loguru` - Opinionated, difficult to customize

**Why structlog:**
- Industry standard for structured logging in Python
- Flexible processor chain (add timestamp, context, format)
- Environment-aware rendering (JSON prod, console dev)
- Performance: Lazy evaluation, caching
- Battle-tested in production systems

### 2. Processor Chain Design

**Shared Processors (both environments):**
```python
[
    structlog.contextvars.merge_contextvars,  # Request ID, user context
    structlog.stdlib.add_log_level,           # info, warning, error
    structlog.stdlib.add_logger_name,         # app.api.videos
    structlog.processors.TimeStamper(fmt="iso"),  # 2024-11-10T12:34:56Z
    structlog.processors.StackInfoRenderer(),     # Stack traces
]
```

**Production Processors:**
```python
+ [
    structlog.processors.format_exc_info,  # Format exceptions as strings
    structlog.processors.JSONRenderer()    # Output as JSON
]
```

**Development Processors:**
```python
+ [
    structlog.dev.ConsoleRenderer()  # Colored, indented output
]
```

**Rationale:**
- **Shared first:** Common functionality (timestamp, level, name) in both modes
- **Environment-specific last:** Final rendering depends on environment
- **Exception handling:** `format_exc_info` before JSON to avoid nested objects

### 3. Environment Switching Logic

**Decision:** Use `settings.env` field from `config.py`

```python
if settings.env == "development":
    processors = shared + [ConsoleRenderer()]
else:
    processors = shared + [JSONRenderer()]
```

**Why not `settings.debug`?**
- No `debug` field exists in current `Settings` class (see `config.py:30`)
- `env` field already exists with values: "development", "production"
- Consistent with existing validation logic (see `config.py:62, 68`)

**Why not `DEBUG` environment variable?**
- Adds another config variable (complexity)
- `ENV=development|production` is more explicit

### 4. log_request() Helper Design

**Decision:** Provide convenience function for HTTP request logging

**Rationale:**
- Common use case: Log every API request
- Standardizes log structure across endpoints
- Auto-selects log level based on status code
- Optional fields (user_id) handled gracefully

**Alternative considered:** FastAPI middleware
- **Rejected:** Middleware implementation belongs in Task #176 (middleware integration)
- **This task:** Only provides the logging infrastructure
- **Next task:** Integrate with FastAPI request/response cycle

### 5. Test Strategy

**Decision:** Pure unit tests with mocked `settings.env`

```python
with patch("app.core.logging.settings.env", "production"):
    configure_logging(stream=output)
```

**Rationale:**
- Fast tests (no subprocess, no file I/O)
- Isolated from environment variables
- StringIO captures output for JSON parsing
- 100% coverage achievable

**Alternative considered:** Integration tests with subprocess
- **Rejected:** Slow, flaky, hard to debug
- **Unit tests sufficient:** Logic is pure (settings → processors)

### 6. Backward Compatibility

**Decision:** No breaking changes to existing logger usage

**Current pattern (8 files):**
```python
import logging
logger = logging.getLogger(__name__)
logger.info("message")
```

**Still works after this task:**
- `structlog.configure()` wraps stdlib logging
- Existing `logging.getLogger()` calls continue to work
- Output changes (JSON in prod), but API unchanged

**Migration plan (future tasks):**
```python
# Old (still works)
import logging
logger = logging.getLogger(__name__)
logger.info("Cache hit for video %s", video_id)

# New (preferred)
from app.core.logging import get_logger
logger = get_logger(__name__)
logger.info("cache_hit", video_id=video_id)
```

**Gradual migration:** Replace loggers file-by-file in subsequent tasks

---

## ✅ Verification Checklist

**Before marking task complete:**

- [ ] `structlog==24.1.0` added to `requirements.txt`
- [ ] `backend/app/core/logging.py` created with 3 functions
- [ ] `backend/tests/core/test_logging.py` created with 11 tests
- [ ] All tests pass: `pytest tests/core/test_logging.py -v`
- [ ] 100% code coverage achieved
- [ ] Manual test in development mode shows colored output
- [ ] Manual test in production mode shows JSON output
- [ ] No existing tests broken (run full test suite)
- [ ] No imports changed in existing files (backward compatible)

**Command to verify:**
```bash
cd backend
pytest tests/core/test_logging.py -v --cov=app.core.logging --cov-report=term-missing
pytest  # Run full test suite to ensure no regressions
```

---

## 📝 Notes

**Do NOT do in this task:**
- Integrate with FastAPI middleware (Task #176)
- Migrate existing logger usage (Future tasks)
- Add request_id to logs (Task #176 - middleware)
- Configure external log aggregation (Out of scope)

**This task provides:**
- Logging infrastructure only
- Test coverage for infrastructure
- Foundation for future middleware integration

**Next steps after this task:**
- Task #176: Add logging middleware to `main.py`
- Task #177: Migrate high-traffic endpoints to structured logging
- Task #178: Add request_id context propagation
