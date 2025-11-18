# Task #164: Add slowapi Dependency

**Plan Task:** #164
**Wave/Phase:** Security Hardening - Task 4: API Rate Limiting (Step 1)
**Dependencies:** None

---

## 🎯 Ziel

Add slowapi library to the project's Python dependencies to enable Redis-backed API rate limiting. This task installs slowapi version 0.1.9 and verifies the installation, preparing the backend for implementing distributed rate limiting across multiple application instances.

---

## 📋 Acceptance Criteria

- [ ] `slowapi==0.1.9` added to `backend/requirements.txt`
- [ ] slowapi successfully installed in virtual environment
- [ ] slowapi version verified with `pip show slowapi`
- [ ] No dependency conflicts after installation
- [ ] Import test passes (`python -c "import slowapi; print(slowapi.__version__)"`)

**Evidence:**
- `backend/requirements.txt` contains `slowapi==0.1.9` on new line
- `pip show slowapi` output shows version 0.1.9
- Import statement executes without errors

---

## 🛠️ Implementation Steps

### 1. Add slowapi to requirements.txt

**Files:** `/Users/philippbriese/Documents/dev/projects/by IDE/Claude Code/Smart Youtube Bookmarks/backend/requirements.txt`

**Action:** Add slowapi==0.1.9 after existing dependencies

**Current requirements.txt (last 3 lines):**
```
tenacity==8.2.3
isodate==0.6.1
google-genai[aiohttp]==0.3.0
```

**Add after line 20:**
```
slowapi==0.1.9
```

**Why this version:**
- 0.1.9 is the latest stable release (as of 2024)
- Production-tested with FastAPI 0.109.0 (our version)
- Includes Redis storage backend support
- No known security vulnerabilities

---

### 2. Install slowapi in virtual environment

**Command:**
```bash
cd /Users/philippbriese/Documents/dev/projects/by\ IDE/Claude\ Code/Smart\ Youtube\ Bookmarks/backend
pip install slowapi==0.1.9
```

**Expected output:**
```
Collecting slowapi==0.1.9
  Using cached slowapi-0.1.9-py3-none-any.whl
Collecting limits>=2.3.0
  Using cached limits-3.6.0-py3-none-any.whl
Collecting redis>=3.4.0
  Using cached redis-5.0.1-py3-none-any.whl (already satisfied)
Installing collected packages: limits, slowapi
Successfully installed limits-3.6.0 slowapi-0.1.9
```

**What gets installed:**
- `slowapi==0.1.9` - Main rate limiting library
- `limits>=2.3.0` - Dependency for rate limit strategies (fixed-window, moving-window, etc.)
- `redis>=3.4.0` - Already installed (project uses redis==5.0.1)

---

### 3. Verify installation

**Command:**
```bash
cd /Users/philippbriese/Documents/dev/projects/by\ IDE/Claude\ Code/Smart\ Youtube\ Bookmarks/backend
pip show slowapi
```

**Expected output:**
```
Name: slowapi
Version: 0.1.9
Summary: A rate limiting extension for FastAPI
Home-page: https://github.com/laurents/slowapi
Author: Laurent Savaete
License: MIT
Location: /path/to/venv/lib/python3.11/site-packages
Requires: limits, redis
Required-by:
```

**Verify fields:**
- Version: `0.1.9` ✓
- Requires: `limits, redis` ✓
- Location: Should be in virtual environment ✓

---

### 4. Test import and version check

**Command:**
```bash
cd /Users/philippbriese/Documents/dev/projects/by\ IDE/Claude\ Code/Smart\ Youtube\ Bookmarks/backend
python -c "import slowapi; print(f'slowapi version: {slowapi.__version__}')"
```

**Expected output:**
```
slowapi version: 0.1.9
```

**Additional import test:**
```bash
python -c "from slowapi import Limiter; from slowapi.util import get_remote_address; print('All imports successful')"
```

**Expected output:**
```
All imports successful
```

---

### 5. Check for dependency conflicts

**Command:**
```bash
cd /Users/philippbriese/Documents/dev/projects/by\ IDE/Claude\ Code/Smart\ Youtube\ Bookmarks/backend
pip check
```

**Expected output:**
```
No broken requirements found.
```

**If conflicts exist:**
- Review conflict details
- Check if slowapi's dependencies conflict with existing packages
- Resolve by adjusting version constraints (unlikely with 0.1.9)

---

### 6. Verify Redis compatibility

**Test script:** Create temporary test file `test_slowapi_redis.py`

```python
"""Quick test to verify slowapi works with existing Redis setup."""
import asyncio
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.core.config import settings

# Create limiter with project's Redis URL
limiter = Limiter(
    key_func=get_remote_address,
    storage_uri=settings.redis_url,
    strategy="fixed-window"
)

print(f"✓ Limiter created successfully")
print(f"✓ Storage URI: {limiter.storage_uri}")
print(f"✓ Strategy: {limiter._strategy}")
print(f"✓ slowapi is ready for rate limiting implementation")
```

**Run:**
```bash
cd /Users/philippbriese/Documents/dev/projects/by\ IDE/Claude\ Code/Smart\ Youtube\ Bookmarks/backend
python test_slowapi_redis.py
```

**Expected output:**
```
✓ Limiter created successfully
✓ Storage URI: redis://localhost:6379
✓ Strategy: fixed-window
✓ slowapi is ready for rate limiting implementation
```

**Cleanup:**
```bash
rm test_slowapi_redis.py
```

---

## 🧪 Testing Strategy

### Installation Verification

**Test 1: requirements.txt updated**
```bash
cd /Users/philippbriese/Documents/dev/projects/by\ IDE/Claude\ Code/Smart\ Youtube\ Bookmarks/backend
grep "slowapi==0.1.9" requirements.txt
```
**Expected:** Line exists with exact version

**Test 2: Package installed**
```bash
pip list | grep slowapi
```
**Expected:** `slowapi               0.1.9`

**Test 3: Dependency tree check**
```bash
pip show slowapi
```
**Expected:** Shows version 0.1.9, requires limits and redis

**Test 4: Import test**
```bash
python -c "import slowapi; from slowapi import Limiter; from slowapi.util import get_remote_address; from slowapi.errors import RateLimitExceeded; print('✓ All imports successful')"
```
**Expected:** No errors, prints success message

**Test 5: No conflicts**
```bash
pip check
```
**Expected:** `No broken requirements found.`

**Test 6: Redis storage backend**
```bash
python -c "from slowapi import Limiter; limiter = Limiter(key_func=lambda r: 'test', storage_uri='redis://localhost:6379'); print('✓ Redis backend works')"
```
**Expected:** No errors, prints success message

---

### Manual Testing

#### Prerequisites
```bash
# Ensure virtual environment activated
cd /Users/philippbriese/Documents/dev/projects/by\ IDE/Claude\ Code/Smart\ Youtube\ Bookmarks/backend
source venv/bin/activate  # or your venv path

# Ensure Redis is running
docker-compose up -d redis
docker ps | grep redis  # Should show running container
```

#### Test 1: Verify slowapi version
```bash
pip show slowapi | grep Version
```
**Expected:** `Version: 0.1.9`

#### Test 2: Test basic limiter creation
```bash
python -c "
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(
    key_func=get_remote_address,
    storage_uri='redis://localhost:6379',
    strategy='fixed-window'
)

print(f'Limiter created: {limiter}')
print(f'Strategy: {limiter._strategy}')
print(f'Storage: {limiter.storage_uri}')
"
```

**Expected output:**
```
Limiter created: <slowapi.limiter.Limiter object at 0x...>
Strategy: fixed-window
Storage: redis://localhost:6379
```

#### Test 3: Test with project settings
```bash
python -c "
from slowapi import Limiter
from slowapi.util import get_remote_address
from app.core.config import settings

limiter = Limiter(
    key_func=get_remote_address,
    storage_uri=settings.redis_url,
    strategy='fixed-window'
)

print(f'✓ Limiter works with project Redis: {settings.redis_url}')
"
```

**Expected:** Success message with Redis URL

#### Test 4: Verify limits library installed
```bash
python -c "
import limits
print(f'limits version: {limits.__version__}')

# Test creating a rate limit
rate_limit = limits.parse('5/minute')
print(f'✓ Created rate limit: {rate_limit}')
"
```

**Expected:**
```
limits version: 3.6.0
✓ Created rate limit: 5 per 1 minute
```

#### Test 5: Check if slowapi can connect to Redis
```bash
python -c "
import redis
from slowapi import Limiter
from slowapi.util import get_remote_address

# Verify Redis connection first
r = redis.from_url('redis://localhost:6379')
r.ping()
print('✓ Redis connection works')

# Create limiter with Redis storage
limiter = Limiter(
    key_func=get_remote_address,
    storage_uri='redis://localhost:6379',
    strategy='fixed-window'
)
print('✓ slowapi can use Redis storage')
"
```

**Expected:**
```
✓ Redis connection works
✓ slowapi can use Redis storage
```

---

## 📚 Reference

### Related Docs

- **Security Hardening Plan:** `/Users/philippbriese/Documents/dev/projects/by IDE/Claude Code/Smart Youtube Bookmarks/docs/plans/2025-11-02-security-hardening-implementation.md` - Task 4, Step 1 (lines 1487-1500)
- **slowapi GitHub:** https://github.com/laurents/slowapi
- **slowapi PyPI:** https://pypi.org/project/slowapi/
- **limits Library Docs:** https://limits.readthedocs.io/en/stable/ (slowapi dependency)

### Related Code

- **Current requirements.txt:** `/Users/philippbriese/Documents/dev/projects/by IDE/Claude Code/Smart Youtube Bookmarks/backend/requirements.txt` - Add slowapi after line 20
- **Redis configuration:** `/Users/philippbriese/Documents/dev/projects/by IDE/Claude Code/Smart Youtube Bookmarks/backend/app/core/config.py` - Uses `redis_url` setting (line 18)
- **Existing Redis usage:** `/Users/philippbriese/Documents/dev/projects/by IDE/Claude Code/Smart Youtube Bookmarks/backend/app/core/redis.py` - Shows Redis already integrated

### Design Decisions

#### 1. Why slowapi over alternatives?

**Chosen:** slowapi

**Rationale:**
- **FastAPI-native:** Designed specifically for FastAPI (matches project architecture)
- **Redis support:** Built-in distributed storage (already using Redis for pub/sub)
- **Production-tested:** Used by many FastAPI projects in production
- **Simple API:** Decorator-based, minimal boilerplate
- **Active maintenance:** Regular updates, responsive maintainers

**Alternatives considered:**
- **fastapi-limiter:** Requires more setup, less intuitive API
- **aiohttp-ratelimiter:** For aiohttp, not FastAPI
- **DIY with Redis:** Reinventing the wheel, error-prone
- **nginx rate limiting:** Requires infrastructure changes, less flexible

#### 2. Why version 0.1.9?

**Chosen:** 0.1.9 (latest stable as of 2024)

**Rationale:**
- **Stable:** No known bugs or security issues
- **Compatible:** Works with FastAPI 0.109.0 (current project version)
- **Redis 5.x support:** Compatible with redis==5.0.1 (current dependency)
- **Python 3.11 compatible:** Matches project Python version

**Version history:**
- 0.1.9 (2023): Latest stable, production-ready
- 0.1.8 (2022): Older, missing some fixes
- 0.2.x (future): Not yet released

#### 3. Why install now vs later?

**Chosen:** Install in separate task (Task #164) before implementation (Task #165)

**Rationale:**
- **Fail fast:** Catch dependency conflicts early
- **Clean separation:** Installation (infrastructure) vs implementation (code)
- **Easier debugging:** If slowapi doesn't install, know immediately (before writing code)
- **Follows TDD:** Set up environment before writing tests

**Benefits:**
- Clear checkpoint: "Dependencies ready" ✓
- Easier rollback if issues arise
- Better documentation (separate task plans)

#### 4. Redis storage vs in-memory storage

**Chosen:** Redis storage (configured in next task)

**Rationale:**
- **Distributed:** Works across multiple app instances (load balancing, horizontal scaling)
- **Persistent:** Rate limits survive app restarts
- **Already available:** Project already uses Redis for WebSocket progress pub/sub
- **Production-ready:** Required for multi-instance deployments

**Implementation note:**
- This task installs slowapi with Redis support
- Next task (Task #165) configures limiter with `storage_uri=settings.redis_url`

#### 5. No version pinning for dependencies?

**Chosen:** Pin slowapi, allow transitive dependencies to float (within limits)

**Rationale:**
- **slowapi pinned:** `slowapi==0.1.9` (exact version for reproducibility)
- **limits not pinned:** slowapi specifies `limits>=2.3.0` (acceptable range)
- **redis already pinned:** `redis==5.0.1` in requirements.txt (existing)

**Trade-off:**
- Exact pinning: More reproducible, but miss security fixes in dependencies
- Range pinning: Get security updates, but risk breaking changes

**Decision:** Pin top-level (slowapi), trust slowapi's dependency ranges

---

## Notes

### Task Scope

This task focuses **only on installation**:
- Add slowapi to requirements.txt
- Install package
- Verify installation
- Test imports

**NOT in scope:**
- Writing rate limiting code (Task #165)
- Integrating with FastAPI app (Task #165)
- Applying to endpoints (future tasks)

### Dependencies

**Requires:**
- Python 3.11 (project requirement)
- pip and virtual environment (development setup)
- Redis running (for verification tests, but not mandatory for installation)

**Enables:**
- Task #165: Implement rate limiting utilities (uses slowapi library)

### Installation Notes

**slowapi dependencies:**
- `limits>=2.3.0` - Rate limiting strategies (fixed-window, sliding-window, etc.)
- `redis>=3.4.0` - Already satisfied by `redis==5.0.1` in project

**What gets installed:**
```
slowapi==0.1.9
├── limits>=2.3.0 (will install 3.6.0 or newer)
└── redis>=3.4.0 (already installed: 5.0.1)
```

**Disk space:** ~500KB total (slowapi + limits, redis already installed)

### Known Issues

**Issue 1: Redis not running**
- **Symptom:** Verification tests fail with connection error
- **Fix:** Start Redis: `docker-compose up -d redis`
- **Note:** Not critical for installation, only for verification

**Issue 2: Virtual environment not activated**
- **Symptom:** slowapi installs globally instead of in project venv
- **Fix:** Activate venv: `source venv/bin/activate`
- **Check:** `which pip` should point to venv

**Issue 3: Dependency conflict with limits**
- **Symptom:** `pip check` shows conflict
- **Fix:** Unlikely, but if occurs, update limits: `pip install --upgrade limits`

### Future Tasks Using slowapi

After this task, slowapi will be used in:
- **Task #165:** Create `app/core/rate_limit.py` with limiter instance
- **Task #165:** Integrate limiter into `app/main.py`
- **Future tasks:** Apply rate limits to auth endpoints (`@limiter.limit("5/minute")`)
- **Future tasks:** Apply rate limits to API endpoints (`@limiter.limit("100/minute")`)

### Testing Approach

**Installation verification:**
1. Check file: `requirements.txt` contains `slowapi==0.1.9`
2. Check package: `pip show slowapi` shows version 0.1.9
3. Check imports: `import slowapi` succeeds
4. Check dependencies: `pip check` passes
5. Check Redis backend: Can create limiter with Redis storage

**No unit/integration tests needed:**
- This is infrastructure setup (dependencies)
- Next task (Task #165) will have comprehensive tests

### Rollback Plan

If slowapi causes issues:

```bash
# Remove from requirements.txt
# Edit /Users/philippbriese/Documents/dev/projects/by IDE/Claude Code/Smart Youtube Bookmarks/backend/requirements.txt
# Delete line: slowapi==0.1.9

# Uninstall package
cd /Users/philippbriese/Documents/dev/projects/by\ IDE/Claude\ Code/Smart\ Youtube\ Bookmarks/backend
pip uninstall slowapi limits -y

# Verify
pip list | grep slowapi  # Should be empty
```

**Note:** limits will be uninstalled only if no other packages depend on it.

---

## Completion Checklist

- [ ] `backend/requirements.txt` updated with `slowapi==0.1.9`
- [ ] `pip install slowapi==0.1.9` executed successfully
- [ ] `pip show slowapi` confirms version 0.1.9
- [ ] `python -c "import slowapi"` succeeds
- [ ] `pip check` shows no conflicts
- [ ] Limiter can be created with Redis storage (verification test)
- [ ] Ready for Task #165 (implementation)
