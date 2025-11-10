# Task #124: Add slowapi dependency

**Plan Task:** #124
**Wave/Phase:** Security Hardening - Task 4: API Rate Limiting, Step 1
**Dependencies:** None

---

## 🎯 Ziel

Add slowapi library to backend dependencies to enable API rate limiting functionality. This is a prerequisite step before implementing rate limiting logic for protecting endpoints against abuse and brute-force attacks.

## 📋 Acceptance Criteria

- [ ] slowapi 0.1.9 added to `backend/requirements.txt`
- [ ] slowapi successfully installed in backend environment
- [ ] Import verification passes (slowapi can be imported without errors)
- [ ] Version compatibility confirmed with existing dependencies (FastAPI 0.109.0, Python 3.11+)
- [ ] Redis client dependency verified (redis==5.0.1 already present)
- [ ] No dependency conflicts or installation errors

---

## 🛠️ Implementation Steps

### 1. Add slowapi to requirements.txt
**Files:** `backend/requirements.txt`
**Action:** Add slowapi with pinned version after existing dependencies

```txt
# Add after line 20 (after google-genai)
slowapi==0.1.9
```

**Rationale:**
- Version 0.1.9 is the latest stable release (released February 5, 2024)
- Pin exact version for reproducible builds
- Position after existing dependencies maintains alphabetical grouping

### 2. Install slowapi package
**Files:** None (installation only)
**Action:** Install slowapi in backend virtual environment

```bash
cd backend
pip install slowapi==0.1.9
```

**Expected Output:**
```
Collecting slowapi==0.1.9
  Using cached slowapi-0.1.9-py3-none-any.whl
Collecting limits>=2.3.0
  Using cached limits-X.X.X-py3-none-any.whl
Installing collected packages: limits, slowapi
Successfully installed limits-X.X.X slowapi-0.1.9
```

### 3. Verify installation and imports
**Files:** None (verification only)
**Action:** Test that slowapi can be imported and verify version

```bash
cd backend
python -c "import slowapi; print(f'slowapi version: {slowapi.__version__}')"
python -c "from slowapi import Limiter, _rate_limit_exceeded_handler; print('Import successful')"
```

**Expected Output:**
```
slowapi version: 0.1.9
Import successful
```

### 4. Verify Redis compatibility
**Files:** None (verification only)
**Action:** Confirm slowapi can initialize with Redis backend (test connection string format)

```bash
cd backend
python -c "from slowapi import Limiter; from slowapi.util import get_remote_address; limiter = Limiter(key_func=get_remote_address, storage_uri='memory://'); print('Limiter initialized successfully')"
```

**Expected Output:**
```
Limiter initialized successfully
```

**Note:** Redis backend testing will occur in Task #125 (implementation phase)

---

## 🧪 Testing Strategy

**Import Tests:**
- Test 1: Verify slowapi core imports without errors
  - Import `Limiter`, `_rate_limit_exceeded_handler` from slowapi
  - Expected: No ImportError exceptions

- Test 2: Verify slowapi.util imports without errors
  - Import `get_remote_address` from slowapi.util
  - Expected: No ImportError exceptions

**Version Verification:**
- Test 3: Confirm installed version matches requirements.txt
  - Run `pip show slowapi | grep Version`
  - Expected: Version: 0.1.9

**Dependency Compatibility:**
- Test 4: Verify no dependency conflicts after installation
  - Run `pip check`
  - Expected: "No broken requirements found."

**Manual Verification:**
1. Install slowapi in backend virtual environment
   - Expected: Installation completes without errors
2. Check installed version matches 0.1.9
   - Expected: `pip show slowapi` shows Version: 0.1.9
3. Import slowapi in Python REPL
   - Expected: All imports succeed without errors
4. Verify limits library (dependency) is auto-installed
   - Expected: `pip show limits` shows package is installed

---

## 📚 Reference

**Related Docs:**
- Security Hardening Plan: `docs/plans/2025-11-02-security-hardening-implementation.md` - Task 4, Step 1 (lines 1476-1500)
- slowapi GitHub: https://github.com/laurentS/slowapi
- slowapi PyPI: https://pypi.org/project/slowapi/
- slowapi Documentation: https://slowapi.readthedocs.io/
- limits library (underlying rate limiter): https://limits.readthedocs.io/en/stable/storage.html

**Related Code:**
- Existing Redis configuration: `backend/requirements.txt` line 8 (redis==5.0.1)
- Existing ARQ Redis usage: `backend/app/workers/settings.py`
- Next implementation step: Task #125 (create rate_limit.py module)

**Design Decisions:**

### Why slowapi over alternatives?

**Comparison Matrix:**

| Feature | slowapi | fastapi-limiter | fastapi-throttle |
|---------|---------|-----------------|------------------|
| Redis Backend | ✅ Yes (optional) | ✅ Yes (required) | ❌ No |
| Memory Backend | ✅ Yes | ❌ No | ✅ Yes |
| Decorator-based | ✅ Yes | ❌ No (dependency injection) | ✅ Yes |
| Maintenance Status | ⚠️ Low (last release Feb 2024) | ⚠️ Low (1 release in 12 months) | ⚠️ Low |
| Production Usage | ✅ Millions of requests/month | ⚠️ Unknown | ⚠️ Unknown |
| Flask-like API | ✅ Yes (familiar pattern) | ❌ No | ❌ No |

**Decision: Choose slowapi**

Reasons:
1. **Flexible Backend Support**: Works with memory (dev) and Redis (prod)
2. **Proven Track Record**: Used in production handling millions of requests
3. **Familiar API**: Decorator-based approach matches flask-limiter (well-documented pattern)
4. **Already in Security Plan**: Pre-selected in Task 4 specification (line 1493)
5. **Redis Integration**: Project already uses redis==5.0.1 for ARQ workers
6. **No Breaking Changes**: Inactive maintenance is acceptable for mature, stable library

**Trade-offs:**
- ⚠️ Low maintenance activity (last release Feb 2024)
- ✅ However: Stable API, no breaking changes needed
- ✅ Production-tested with FastAPI 0.109.0 compatibility confirmed via GitHub issues

### Version Selection: 0.1.9

**Why pin to 0.1.9?**
- Latest stable version (released February 5, 2024)
- Proven compatibility with FastAPI 0.109.0 (project uses this version)
- Python >=3.7,<4.0 requirement satisfied (project uses Python 3.11/3.12)
- No known breaking issues with current dependency stack

### Compatibility Matrix

| Dependency | Current Version | slowapi 0.1.9 Requirement | Compatible? |
|------------|----------------|---------------------------|-------------|
| Python | 3.11/3.12 | >=3.7,<4.0 | ✅ Yes |
| FastAPI | 0.109.0 | Any (Starlette-based) | ✅ Yes |
| redis | 5.0.1 | N/A (optional) | ✅ Yes |
| Starlette | (via FastAPI) | Any recent | ✅ Yes |

**Auto-installed Dependencies:**
- `limits>=2.3.0` (underlying rate limiting engine)
- Additional transitive dependencies managed by pip

### Redis Backend Configuration

slowapi supports Redis via connection string format:
```python
# Format: redis://<host>:<port>/<database>
storage_uri = "redis://localhost:6379/1"  # Database 1
storage_uri = "redis://localhost:6379"     # Database 0 (default)
```

**Project Context:**
- Redis already configured for ARQ workers (redis==5.0.1)
- Same Redis instance can be used for rate limiting
- Database separation recommended: ARQ uses default DB, rate limiting uses DB 1

### Rollback Plan

If installation fails or causes conflicts:

1. **Remove from requirements.txt:**
   ```bash
   # Delete line: slowapi==0.1.9
   ```

2. **Uninstall package:**
   ```bash
   pip uninstall slowapi limits -y
   ```

3. **Verify clean state:**
   ```bash
   pip check
   ```

4. **Alternative: Try fastapi-limiter (if slowapi incompatible):**
   ```txt
   # In requirements.txt
   fastapi-limiter==0.1.5
   ```
   - Note: Requires Redis (no memory fallback)
   - Different API (dependency injection vs decorators)

### Implementation Notes

**Post-installation:**
- This task ONLY installs the library
- Task #125 will implement rate limiting logic in `backend/app/core/rate_limit.py`
- Task #126+ will apply rate limiting to specific endpoints

**Testing Approach:**
- Import verification only (no functional testing yet)
- Functional testing deferred to Task #125 (rate_limit.py implementation)
- Integration testing deferred to Task #126+ (endpoint protection)

**Environment Considerations:**
- Development: Memory backend sufficient for testing
- Production: Redis backend required for distributed rate limiting (multiple workers)
- Configuration: Environment-aware backend selection (Task #125)

---

**Next Steps After Completion:**
1. Task #125: Create `backend/app/core/rate_limit.py` with Limiter configuration
2. Task #126: Write tests for rate limiting functionality
3. Task #127+: Apply rate limiting decorators to auth endpoints
