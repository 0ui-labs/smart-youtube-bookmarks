# Task #168: Apply rate limits to sensitive endpoints (100/min production)

**Plan Task:** #168
**Wave/Phase:** Security Hardening - Task 4
**Dependencies:** Task #163 (rate limiting utilities must be implemented first)

---

## 🎯 Ziel

Apply rate limiting to all CREATE endpoints (POST routes) across the API to prevent spam and DDoS attacks. Configure production limit of 100 requests/minute (API_RATE_LIMIT), while allowing more generous 500/minute limit in development for testing.

---

## 📋 Acceptance Criteria

- [ ] All POST endpoints in videos.py have @limiter.limit(API_RATE_LIMIT) decorator and Request parameter
- [ ] All POST endpoints in lists.py have @limiter.limit(API_RATE_LIMIT) decorator and Request parameter
- [ ] All POST endpoints in tags.py have @limiter.limit(API_RATE_LIMIT) decorator and Request parameter
- [ ] All POST endpoints in custom_fields.py have @limiter.limit(API_RATE_LIMIT) decorator and Request parameter
- [ ] All POST endpoints in schemas.py have @limiter.limit(API_RATE_LIMIT) decorator and Request parameter
- [ ] All POST endpoints in schema_fields.py have @limiter.limit(API_RATE_LIMIT) decorator and Request parameter
- [ ] Processing endpoints (start_processing, pause) have rate limiting applied
- [ ] All imports added to top of each modified file
- [ ] Rate limit tests pass for each endpoint independently
- [ ] Health check endpoints remain exempt from rate limiting
- [ ] Code reviewed and tests passing

---

## 🛠️ Implementation Steps

### 1. Apply rate limiting to videos.py endpoints

**Files:** `/Users/philippbriese/Documents/dev/projects/by IDE/Claude Code/Smart Youtube Bookmarks/backend/app/api/videos.py`

**Action:** Add rate limiting imports and decorators to video creation endpoints

**Endpoints to protect:**
1. **Line 185-298:** `add_video_to_list()` - POST /api/lists/{list_id}/videos
2. **Line 574-750:** `bulk_upload_videos()` - POST /api/lists/{list_id}/videos/bulk
3. **Line 843-924:** `bulk_assign_tags_to_videos()` - POST /api/videos/bulk/tags
4. **Line 927-971:** `assign_tags_to_video()` - POST /api/videos/{video_id}/tags

**Step 1.1:** Add imports at top of file (after line 27):

```python
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Query, Request
from app.core.rate_limit import limiter, API_RATE_LIMIT
```

**Step 1.2:** Update `add_video_to_list()` (line 185):

```python
@router.post(
    "/lists/{list_id}/videos",
    response_model=VideoResponse,
    status_code=status.HTTP_201_CREATED
)
@limiter.limit(API_RATE_LIMIT)
async def add_video_to_list(
    request: Request,  # Required for rate limiting
    list_id: UUID,
    video_data: VideoAdd,
    db: AsyncSession = Depends(get_db)
) -> Video:
```

**Step 1.3:** Update `bulk_upload_videos()` (line 574):

```python
@router.post(
    "/lists/{list_id}/videos/bulk",
    response_model=BulkUploadResponse,
    status_code=status.HTTP_201_CREATED
)
@limiter.limit(API_RATE_LIMIT)
async def bulk_upload_videos(
    request: Request,  # Required for rate limiting
    list_id: UUID,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db)
) -> BulkUploadResponse:
```

**Step 1.4:** Update `bulk_assign_tags_to_videos()` (line 843):

```python
@router.post("/videos/bulk/tags", response_model=dict)
@limiter.limit(API_RATE_LIMIT)
async def bulk_assign_tags_to_videos(
    request: Request,  # Required for rate limiting
    request_data: BulkAssignTagsRequest,
    db: AsyncSession = Depends(get_db)
):
```

**Note:** Rename parameter from `request` to `request_data` to avoid conflict with rate limiting Request parameter.

**Step 1.5:** Update `assign_tags_to_video()` (line 927):

```python
@router.post("/videos/{video_id}/tags", response_model=list[TagResponse])
@limiter.limit(API_RATE_LIMIT)
async def assign_tags_to_video(
    request: Request,  # Required for rate limiting
    video_id: UUID,
    request_data: AssignTagsRequest,
    db: AsyncSession = Depends(get_db)
):
```

**Note:** Rename parameter from `request` to `request_data` to avoid conflict.

### 2. Apply rate limiting to lists.py endpoint

**Files:** `/Users/philippbriese/Documents/dev/projects/by IDE/Claude Code/Smart Youtube Bookmarks/backend/app/api/lists.py`

**Action:** Add rate limiting to list creation endpoint

**Endpoints to protect:**
1. **Line 58-97:** `create_list()` - POST /api/lists

**Step 2.1:** Add imports at top of file (after line 5):

```python
from fastapi import APIRouter, Depends, HTTPException, Request
from app.core.rate_limit import limiter, API_RATE_LIMIT
```

**Step 2.2:** Update `create_list()` (line 58):

```python
@router.post("", response_model=ListResponse, status_code=201)
@limiter.limit(API_RATE_LIMIT)
async def create_list(
    request: Request,  # Required for rate limiting
    list_data: ListCreate,
    db: AsyncSession = Depends(get_db)
):
```

### 3. Apply rate limiting to tags.py endpoint

**Files:** `/Users/philippbriese/Documents/dev/projects/by IDE/Claude Code/Smart Youtube Bookmarks/backend/app/api/tags.py`

**Action:** Add rate limiting to tag creation endpoint

**Endpoints to protect:**
1. **Line 16-54:** `create_tag()` - POST /api/tags

**Step 3.1:** Add imports at top of file (after line 1):

```python
from fastapi import APIRouter, Depends, HTTPException, status, Request
from app.core.rate_limit import limiter, API_RATE_LIMIT
```

**Step 3.2:** Update `create_tag()` (line 16):

```python
@router.post("", response_model=TagResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit(API_RATE_LIMIT)
async def create_tag(
    request: Request,  # Required for rate limiting
    tag: TagCreate,
    db: AsyncSession = Depends(get_db)
):
```

### 4. Apply rate limiting to custom_fields.py endpoint

**Files:** `/Users/philippbriese/Documents/dev/projects/by IDE/Claude Code/Smart Youtube Bookmarks/backend/app/api/custom_fields.py`

**Action:** Add rate limiting to custom field creation endpoints

**Endpoints to protect:**
1. **Line 114-180:** `create_custom_field()` - POST /{list_id}/custom-fields
2. **Line 386+:** Check for duplicate field endpoint (if exists)

**Step 4.1:** Add imports at top of file:

```python
from fastapi import APIRouter, Depends, HTTPException, status, Request
from app.core.rate_limit import limiter, API_RATE_LIMIT
```

**Step 4.2:** Update `create_custom_field()` (line 114):

```python
@router.post(
    "/{list_id}/custom-fields",
    response_model=CustomFieldResponse,
    status_code=status.HTTP_201_CREATED
)
@limiter.limit(API_RATE_LIMIT)
async def create_custom_field(
    request: Request,  # Required for rate limiting
    list_id: UUID,
    field_data: CustomFieldCreate,
    db: AsyncSession = Depends(get_db)
) -> CustomFieldResponse:
```

**Step 4.3:** Check line 386 for duplicate check endpoint and apply same pattern if it's a POST route.

### 5. Apply rate limiting to schemas.py endpoint

**Files:** `/Users/philippbriese/Documents/dev/projects/by IDE/Claude Code/Smart Youtube Bookmarks/backend/app/api/schemas.py`

**Action:** Add rate limiting to schema creation endpoint

**Endpoints to protect:**
1. **Line 162-250:** `create_schema()` - POST /api/lists/{list_id}/schemas

**Step 5.1:** Add imports at top of file:

```python
from fastapi import APIRouter, Depends, HTTPException, status, Request
from app.core.rate_limit import limiter, API_RATE_LIMIT
```

**Step 5.2:** Update `create_schema()` (line 162):

```python
@router.post(
    "/api/lists/{list_id}/schemas",
    response_model=FieldSchemaResponse,
    status_code=status.HTTP_201_CREATED,
    tags=["schemas"]
)
@limiter.limit(API_RATE_LIMIT)
async def create_schema(
    request: Request,  # Required for rate limiting
    list_id: UUID,
    schema_data: FieldSchemaCreate,
    db: AsyncSession = Depends(get_db)
):
```

### 6. Apply rate limiting to schema_fields.py endpoint

**Files:** `/Users/philippbriese/Documents/dev/projects/by IDE/Claude Code/Smart Youtube Bookmarks/backend/app/api/schema_fields.py`

**Action:** Add rate limiting to schema field association endpoint

**Endpoints to protect:**
1. **Line 97-160:** `add_field_to_schema()` - POST /api/lists/{list_id}/schemas/{schema_id}/fields

**Step 6.1:** Add imports at top of file:

```python
from fastapi import APIRouter, Depends, HTTPException, status, Request
from app.core.rate_limit import limiter, API_RATE_LIMIT
```

**Step 6.2:** Update `add_field_to_schema()` (line 97):

```python
@router.post("", response_model=SchemaFieldResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit(API_RATE_LIMIT)
async def add_field_to_schema(
    request: Request,  # Required for rate limiting
    list_id: UUID,
    schema_id: UUID,
    schema_field: SchemaFieldCreate,
    db: AsyncSession = Depends(get_db)
):
```

### 7. Apply rate limiting to processing.py endpoints

**Files:** `/Users/philippbriese/Documents/dev/projects/by IDE/Claude Code/Smart Youtube Bookmarks/backend/app/api/processing.py`

**Action:** Add rate limiting to video processing trigger endpoints

**Endpoints to protect:**
1. **Line 24-80:** `start_processing()` - POST /api/lists/{list_id}/process
2. **Line 139+:** `pause_job()` - POST /api/jobs/{job_id}/pause (if exists)

**Step 7.1:** Add imports at top of file:

```python
from fastapi import APIRouter, Depends, HTTPException, status, Request
from app.core.rate_limit import limiter, API_RATE_LIMIT
```

**Step 7.2:** Update `start_processing()` (line 24):

```python
@router.post("/lists/{list_id}/process", response_model=JobResponse, status_code=201)
@limiter.limit(API_RATE_LIMIT)
async def start_processing(
    request: Request,  # Required for rate limiting
    list_id: UUID,
    db: AsyncSession = Depends(get_db),
    arq_pool = Depends(get_arq_pool)
):
```

**Step 7.3:** Update `pause_job()` if it exists (line 139):

```python
@router.post("/jobs/{job_id}/pause", status_code=204)
@limiter.limit(API_RATE_LIMIT)
async def pause_job(
    request: Request,  # Required for rate limiting
    job_id: UUID,
    db: AsyncSession = Depends(get_db)
):
```

---

## 🧪 Testing Strategy

**Unit Tests:**
- Test each endpoint rate limit independently (verify 100 req/min threshold in production mode)
- Test development mode allows 500 req/min
- Verify 429 status code returned when limit exceeded
- Verify Retry-After header present in 429 responses
- Test rate limiting works with FastAPI dependency injection (Request parameter)

**Integration Tests:**
- Test POST /api/lists/{list_id}/videos hits rate limit after 100 requests (production)
- Test POST /api/lists/{list_id}/videos/bulk hits rate limit
- Test POST /api/videos/bulk/tags hits rate limit
- Test POST /api/videos/{video_id}/tags hits rate limit
- Test POST /api/lists hits rate limit
- Test POST /api/tags hits rate limit
- Test POST /{list_id}/custom-fields hits rate limit
- Test POST /api/lists/{list_id}/schemas hits rate limit
- Test POST /api/lists/{list_id}/schemas/{schema_id}/fields hits rate limit
- Test POST /api/lists/{list_id}/process hits rate limit
- Test rate limit resets after time window expires
- Verify health check endpoint (/api/health) remains exempt from rate limiting

**Manual Testing:**
1. Start backend server - verify no errors on startup
2. Make 100 rapid POST requests to /api/lists - expected: 101st returns 429
3. Wait 60 seconds - expected: rate limit resets, next request succeeds
4. Make rapid GET requests to /api/videos - expected: no rate limiting applied (only POST routes protected)
5. Check logs for rate limit exceeded events - expected: logged with user identification

**Testing Commands:**

```bash
# Run rate limit utility tests (Task #163)
cd backend
pytest tests/core/test_rate_limit.py -v

# Run integration tests for protected endpoints
pytest tests/api/test_videos.py::test_rate_limit_add_video -v
pytest tests/api/test_lists.py::test_rate_limit_create_list -v
pytest tests/api/test_tags.py::test_rate_limit_create_tag -v

# Manual rate limit test with curl (repeat 101 times)
for i in {1..101}; do
  curl -X POST http://localhost:8000/api/lists \
    -H "Content-Type: application/json" \
    -d '{"name": "Test List '$i'"}' \
    -w "\nStatus: %{http_code}\n"
done
# Expected: First 100 succeed (201), 101st returns 429
```

---

## 📚 Reference

**Related Docs:**
- `/Users/philippbriese/Documents/dev/projects/by IDE/Claude Code/Smart Youtube Bookmarks/docs/plans/2025-11-02-security-hardening-implementation.md` - Task 4: Rate Limiting (lines 1580-1728)
- slowapi documentation: https://slowapi.readthedocs.io/
- FastAPI dependency injection: https://fastapi.tiangolo.com/tutorial/dependencies/

**Related Code:**
- Rate limiting utilities: `/Users/philippbriese/Documents/dev/projects/by IDE/Claude Code/Smart Youtube Bookmarks/backend/app/core/rate_limit.py` (Task #163)
- Rate limit tests: `/Users/philippbriese/Documents/dev/projects/by IDE/Claude Code/Smart Youtube Bookmarks/backend/tests/core/test_rate_limit.py` (Task #163)
- Main app configuration: `/Users/philippbriese/Documents/dev/projects/by IDE/Claude Code/Smart Youtube Bookmarks/backend/app/main.py`

**REF MCP Validation:**
- **DDoS Prevention Best Practices:** Applying rate limits to write endpoints (POST) prevents spam attacks and resource exhaustion. Read endpoints (GET) typically don't need rate limiting as they don't modify state.
- **FastAPI Dependency Injection:** Request parameter must be first parameter after `self` for rate limiting to work with slowapi. The limiter extracts client IP from Request object for per-client rate limiting.
- **Production vs Development Limits:** 100/min production limit balances legitimate use (1.67 req/sec) vs abuse prevention. 500/min development limit allows rapid testing without frequent 429 errors.

**Design Decisions:**

**Why 100 requests/minute for write operations?**
- Prevents spam: Legitimate users rarely create 100 resources/minute
- Allows batch operations: Bulk upload endpoint creates multiple videos per request, so 100 req/min = potentially 1000+ videos/min
- Balances UX vs security: Strict enough to block DDoS, lenient enough for power users
- Industry standard: Most APIs use 60-120 req/min for write operations (GitHub: 75/min, Stripe: 100/min)

**Which endpoints need protection?**
- **All POST routes:** Create operations modify database state and consume resources
- **Bulk operations:** Already validated with batch size limits (10,000 assignments), rate limiting adds secondary protection
- **Processing triggers:** ARQ job creation consumes worker resources, must be rate limited
- **Exempt health checks:** /api/health used by monitoring tools, rate limiting would break observability

**Why Request parameter required?**
- slowapi extracts client IP from Request.client.host for per-client rate limiting
- Without Request parameter, rate limit applies globally (all clients share limit)
- FastAPI dependency injection automatically provides Request object when declared as parameter
- Must be first parameter after self to avoid breaking existing function signatures

**Parameter naming conflicts:**
- Several endpoints already use `request` as parameter name for Pydantic request models
- Solution: Rename Pydantic model parameter to `request_data` or specific name (e.g., `tag_create`)
- FastAPI uses parameter type annotation to determine injection, so parameter name is flexible

**Why 500 requests/minute in development?**
- Automated tests may trigger hundreds of requests rapidly
- Developer productivity: Avoid 429 errors during rapid iteration and debugging
- Environment-aware: Production security without development friction

**Monitoring and observability:**
- 429 responses include Retry-After header (slowapi automatic)
- Custom error handler provides structured JSON response with retry_after field
- Rate limit exceeded events should be logged (add logging middleware in future task)
- Metrics: Track 429 response rate, identify abuse patterns (Prometheus/Grafana in production)
