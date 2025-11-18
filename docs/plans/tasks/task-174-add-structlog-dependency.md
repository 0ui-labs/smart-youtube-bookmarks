# Task #174: Add structlog dependency

**Plan Task:** #174
**Wave/Phase:** Security Hardening - Task 7: Structured Logging, Step 1
**Dependencies:** None

---

## 🎯 Ziel

Add structlog library to backend dependencies to enable structured JSON logging for improved observability and production monitoring. This is a prerequisite step before implementing comprehensive structured logging throughout the application.

## 📋 Acceptance Criteria

- [ ] structlog 24.1.0 added to `backend/requirements.txt`
- [ ] structlog successfully installed in backend environment
- [ ] Import verification passes (structlog can be imported without errors)
- [ ] All required structlog modules are importable (contextvars, stdlib, processors, dev)
- [ ] Version compatibility confirmed with existing dependencies (Python 3.11+, FastAPI 0.109.0)
- [ ] No dependency conflicts or installation errors
- [ ] Installation verifiable with `pip show structlog`

---

## 🛠️ Implementation Steps

### 1. Add structlog to requirements.txt
**Files:** `backend/requirements.txt`
**Action:** Add structlog with pinned version after existing dependencies

```txt
# Add after line 20 (after google-genai)
structlog==24.1.0
```

**Rationale:**
- Version 24.1.0 is the latest stable release (released January 2024)
- Pin exact version for reproducible builds and deterministic behavior
- Position after existing dependencies maintains dependency grouping
- Version 24.x is the current major version with active maintenance

### 2. Install structlog package
**Files:** None (installation only)
**Action:** Install structlog in backend virtual environment

```bash
cd backend
pip install structlog==24.1.0
```

**Expected Output:**
```
Collecting structlog==24.1.0
  Using cached structlog-24.1.0-py3-none-any.whl
Collecting typing-extensions>=4.0.0
  Using cached typing_extensions-X.X.X-py3-none-any.whl
Installing collected packages: typing-extensions, structlog
Successfully installed typing-extensions-X.X.X structlog-24.1.0
```

### 3. Verify installation and core imports
**Files:** None (verification only)
**Action:** Test that structlog can be imported and verify version

```bash
cd backend
python -c "import structlog; print(f'structlog version: {structlog.__version__}')"
```

**Expected Output:**
```
structlog version: 24.1.0
```

### 4. Verify all required submodules are importable
**Files:** None (verification only)
**Action:** Confirm all structlog components needed for logging configuration can be imported

```bash
cd backend
python -c "from structlog.types import FilteringBoundLogger; print('FilteringBoundLogger import successful')"
python -c "from structlog import contextvars; print('contextvars module import successful')"
python -c "from structlog import stdlib; print('stdlib module import successful')"
python -c "from structlog import processors; print('processors module import successful')"
python -c "from structlog import dev; print('dev module import successful')"
```

**Expected Output:**
```
FilteringBoundLogger import successful
contextvars module import successful
stdlib module import successful
processors module import successful
dev module import successful
```

### 5. Verify dependency chain
**Files:** None (verification only)
**Action:** Confirm no dependency conflicts and check auto-installed dependencies

```bash
cd backend
pip check
pip show structlog
```

**Expected Output:**
```
No broken requirements found.
Name: structlog
Version: 24.1.0
Summary: Structured Logging for Python
Home-page: https://www.structlog.org/
Author: Hynek Schlawack
License: Apache License, Version 2.0
```

---

## 🧪 Testing Strategy

**Import Tests:**
- Test 1: Verify structlog core import without errors
  - Import `structlog` module
  - Expected: No ImportError exceptions
  - Command: `python -c "import structlog"`

- Test 2: Verify structlog.types imports without errors
  - Import `FilteringBoundLogger` from structlog.types
  - Expected: No ImportError exceptions
  - Command: `python -c "from structlog.types import FilteringBoundLogger"`

- Test 3: Verify structlog.contextvars imports
  - Import `merge_contextvars` from structlog.contextvars
  - Expected: No ImportError exceptions
  - Command: `python -c "from structlog.contextvars import merge_contextvars"`

- Test 4: Verify structlog.stdlib imports
  - Import `add_log_level`, `add_logger_name`, `BoundLogger` from structlog.stdlib
  - Expected: No ImportError exceptions
  - Command: `python -c "from structlog.stdlib import add_log_level, add_logger_name, BoundLogger, LoggerFactory"`

- Test 5: Verify structlog.processors imports
  - Import `TimeStamper`, `StackInfoRenderer`, `format_exc_info`, `JSONRenderer` from structlog.processors
  - Expected: No ImportError exceptions
  - Command: `python -c "from structlog.processors import TimeStamper, StackInfoRenderer, format_exc_info, JSONRenderer"`

- Test 6: Verify structlog.dev imports
  - Import `ConsoleRenderer` from structlog.dev
  - Expected: No ImportError exceptions
  - Command: `python -c "from structlog.dev import ConsoleRenderer"`

**Version Verification:**
- Test 7: Confirm installed version matches requirements.txt
  - Run `pip show structlog | grep Version`
  - Expected: Version: 24.1.0

**Dependency Compatibility:**
- Test 8: Verify no dependency conflicts after installation
  - Run `pip check`
  - Expected: "No broken requirements found."

**Manual Verification Checklist:**
1. Install structlog in backend virtual environment
   - Expected: Installation completes without errors
2. Check installed version matches 24.1.0
   - Expected: `pip show structlog` shows Version: 24.1.0
3. Import structlog in Python REPL
   - Expected: All imports succeed without errors
4. Verify typing-extensions (dependency) is auto-installed
   - Expected: `pip show typing-extensions` shows package is installed

---

## 📚 Reference

**Related Docs:**
- Security Hardening Plan: `docs/plans/2025-11-02-security-hardening-implementation.md` - Task 7, Step 1 (lines 2215-2228)
- structlog GitHub: https://github.com/hynek/structlog
- structlog PyPI: https://pypi.org/project/structlog/
- structlog Documentation: https://www.structlog.org/
- structlog API Reference: https://www.structlog.org/en/stable/api.html

**Related Code:**
- Existing Python standard logging: `backend/app/workers/video_processor.py` (ARQ worker logging)
- Existing logging configuration location: Will be `backend/app/core/logging.py` (Task #175)
- Next implementation step: Task #175 (create logging.py module with structured logging configuration)

**Design Decisions:**

### Why structlog over alternatives?

**Comparison Matrix:**

| Feature | structlog | python-json-logger | pythonjsonlogger |
|---------|-----------|-------------------|------------------|
| Structured JSON Output | ✅ Yes | ✅ Yes | ✅ Yes |
| Development Console Renderer | ✅ Yes (colored) | ❌ No | ❌ No |
| Context Variables Support | ✅ Yes (built-in) | ⚠️ Manual | ⚠️ Manual |
| Processor Pipeline | ✅ Yes (powerful) | ❌ Limited | ⚠️ Limited |
| Production Ready | ✅ Yes | ✅ Yes | ✅ Yes |
| Maintenance Status | ✅ Active | ⚠️ Maintained | ⚠️ Low |
| Community Adoption | ✅ High | ⚠️ Medium | ⚠️ Low |
| Async Support | ✅ Yes (contextvars) | ❌ No | ❌ No |

**Decision: Choose structlog**

Reasons:
1. **Best Developer Experience**: Colored console output in development (vs blank JSON)
2. **Async-Ready**: Built-in contextvars support for async/await applications
3. **Flexible Processors**: Pipeline-based architecture enables custom processing
4. **Production-Proven**: Millions of deployments across industry
5. **Already in Security Plan**: Pre-selected in Task 7 specification (line 2221)
6. **FastAPI Ecosystem**: Used in many FastAPI production applications
7. **Active Maintenance**: Regular updates and responsive to issues

**Trade-offs:**
- ✅ Higher learning curve than standard library logging
- ✅ Requires explicit configuration (but more flexible)
- ✅ Processor pipeline paradigm (more powerful but less familiar)

### Version Selection: 24.1.0

**Why pin to 24.1.0?**
- Latest stable version in 24.x series (released January 2024)
- Proven compatibility with Python 3.11+ (project uses these versions)
- Stable API with no breaking changes expected
- No known issues with FastAPI 0.109.0 or current dependency stack
- Requires: `typing-extensions>=4.0.0` (auto-installed, safe dependency)

### Compatibility Matrix

| Dependency | Current Version | structlog 24.1.0 Requirement | Compatible? |
|------------|----------------|------------------------------|-------------|
| Python | 3.11/3.12 | >=3.9,<4.0 | ✅ Yes |
| FastAPI | 0.109.0 | N/A (independent) | ✅ Yes |
| typing-extensions | (auto-installed) | >=4.0.0 | ✅ Yes |
| Starlette | (via FastAPI) | N/A (independent) | ✅ Yes |

**Auto-installed Dependencies:**
- `typing-extensions>=4.0.0` (typing support for Python 3.9+)
- Additional transitive dependencies managed by pip

### Context: Why Structured Logging?

**Current State:**
```python
# Current unstructured logging:
logger.info(f"Processing video {video_id} from list {list_id}")
logger.error(f"Failed to fetch YouTube metadata: {error_message}")
```

**With structlog (Task #175+):**
```python
# Structured logging outputs JSON:
logger.info("video_processing_started", video_id="...", list_id="...", youtube_id="...")
logger.error("youtube_metadata_fetch_failed", video_id="...", error="...", error_type="...")
```

**Benefits:**
- Machine-readable logs for indexing (ELK, Datadog, etc.)
- Structured context for debugging (video_id always in same field)
- Production monitoring and alerting capabilities
- Performance tracing with duration_ms
- User attribution with user_id context

### Implementation Roadmap

**Phase 1 (Dependencies):**
- Task #174: Add structlog 24.1.0 (this task)

**Phase 2 (Configuration):**
- Task #175: Create `backend/app/core/logging.py` with structured logging setup

**Phase 3 (Application):**
- Task #176: Add logging middleware to FastAPI app
- Task #177: Update video processing API to use structured logging
- Task #178: Write tests for structured logging

### Rollback Plan

If installation fails or causes conflicts:

1. **Remove from requirements.txt:**
   ```bash
   # Delete line: structlog==24.1.0
   ```

2. **Uninstall package:**
   ```bash
   pip uninstall structlog typing-extensions -y
   ```

3. **Verify clean state:**
   ```bash
   pip check
   ```

4. **Alternative (if needed):**
   - Standard library logging only (no external dependency)
   - Note: Would require custom JSON formatter instead of structlog processors

### Implementation Notes

**Post-installation:**
- This task ONLY installs the library
- Task #175 will implement structured logging configuration in `backend/app/core/logging.py`
- Task #176+ will integrate logging into FastAPI middleware and endpoints
- Structured logging is opt-in: unstructured logging continues to work during transition

**Testing Approach:**
- Import verification only (no functional testing yet)
- Functional testing deferred to Task #175+ (logging configuration and tests)
- Integration testing deferred to Task #176+ (middleware integration)

**Environment Considerations:**
- Development: Uses ConsoleRenderer for colored, human-readable output
- Production: Uses JSONRenderer for structured JSON logs (machine-readable)
- Configuration: Environment-aware processor selection (in Task #175)

### Performance Impact

**Expected overhead:**
- structlog is highly optimized for performance
- JSON serialization happens only on output (not on every log call)
- Context variable lookup: < 1µs per call
- Log processor chain: < 10µs for typical configuration

**Benchmarks (from structlog docs):**
- Simple log call: ~10-15µs
- With context variables: ~20-25µs
- Full processor pipeline: ~30-40µs
- Negligible compared to I/O operations

---

**Next Steps After Completion:**
1. Task #175: Create `backend/app/core/logging.py` with Limiter configuration
2. Task #176: Write tests for structured logging functionality
3. Task #177: Add logging middleware to FastAPI app
4. Task #178+: Apply structured logging to API endpoints and workers
