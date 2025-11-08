# Task #44: Auto-Tagging on Upload Based on Selected Tags

**Plan Task:** #44
**Wave/Phase:** Phase 4 - Video Import (Consumer App Roadmap)
**Dependencies:** Task #16 (Tag Store), Task #8 (Bulk Tag Assignment), CSV Upload (completed)

---

## 🎯 Ziel

Wenn User Videos hochladen (CSV, URL Drag & Drop, Paste), werden automatisch die aktuell in der TagNavigation ausgewählten Tags auf alle importierten Videos angewendet. Die UI zeigt eine Vorschau der Tags vor dem Upload.

---

## 📋 Acceptance Criteria

- [ ] Backend: `POST /api/lists/{id}/videos/bulk` akzeptiert optionalen `tag_ids` Parameter (list[UUID])
- [ ] Worker: Videos erhalten automatisch Tags während der Verarbeitung (bulk insert into `video_tags`)
- [ ] Frontend: CSVUpload-Komponente liest `selectedTagIds` aus tagStore
- [ ] Frontend: UI zeigt Tag-Vorschau vor Upload ("Diese Tags werden angewendet: Python, Tutorial")
- [ ] Edge Case: Wenn Tags während Upload gelöscht werden, werden nur existierende Tags zugewiesen
- [ ] Edge Case: Wenn Video bereits Tags hat, werden neue Tags HINZUGEFÜGT (nicht ersetzt)
- [ ] Tests: 8+ Unit Tests (Backend Schema, Worker Logic, Frontend UI)
- [ ] Tests: 3+ Integration Tests (Full Upload Flow with Tag Assignment)

---

## 🛠️ Implementation Steps

### 1. Backend: Extend BulkUploadRequest Schema
**Files:** `backend/app/api/videos.py`
**Action:** Add optional `tag_ids` field to request body using Pydantic BaseModel

```python
# Add new request schema BEFORE bulk_upload_videos endpoint (line ~643)
from pydantic import BaseModel

class BulkUploadRequest(BaseModel):
    """Request body for bulk video upload with optional tag assignment."""
    tag_ids: list[UUID] | None = None  # Optional list of tag IDs to auto-assign
```

**Rationale:** 
- FastAPI automatically handles optional fields with `None` default
- REF MCP validation confirms: "The same as when declaring query parameters, when a model attribute has a default value, it is not required"
- Using BaseModel + UploadFile requires `Form()` + `File()` dependencies

### 2. Backend: Update bulk_upload_videos Endpoint Signature
**Files:** `backend/app/api/videos.py` (line 643-652)
**Action:** Change endpoint to accept both file AND request body

```python
from fastapi import Form
import json

@router.post(
    "/lists/{list_id}/videos/bulk",
    response_model=BulkUploadResponse,
    status_code=status.HTTP_201_CREATED
)
async def bulk_upload_videos(
    list_id: UUID,
    file: UploadFile = File(...),
    tag_ids: str = Form(None),  # JSON string to handle list[UUID]
    db: AsyncSession = Depends(get_db)
) -> BulkUploadResponse:
    """
    Bulk upload videos from CSV file with optional tag auto-assignment.
    
    Args:
        list_id: UUID of the bookmark list
        file: CSV file with YouTube URLs
        tag_ids: Optional JSON array of tag UUIDs to auto-assign (e.g., '["uuid1","uuid2"]')
        db: Database session
    
    Returns:
        BulkUploadResponse: Statistics and failure details
    """
    # Parse tag_ids from JSON string
    parsed_tag_ids: list[UUID] | None = None
    if tag_ids:
        try:
            tag_id_list = json.loads(tag_ids)
            parsed_tag_ids = [UUID(tid) for tid in tag_id_list]
        except (json.JSONDecodeError, ValueError) as e:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Invalid tag_ids format: {str(e)}"
            )
    
    # ... existing validation code ...
```

**Rationale:**
- Cannot use Pydantic BaseModel directly with `UploadFile` (FastAPI limitation)
- `Form(None)` makes parameter optional (default None)
- JSON string encoding handles complex types (list[UUID]) in multipart/form-data

### 3. Backend: Validate Tag IDs Exist and Belong to User
**Files:** `backend/app/api/videos.py` (after line 691 - list validation)
**Action:** Pre-validate tags before processing videos

```python
# Add validation after list existence check (line ~691)
validated_tag_ids: list[UUID] = []
if parsed_tag_ids:
    # Get first user (for testing - in production, use get_current_user dependency)
    user_result = await db.execute(select(User))
    current_user = user_result.scalars().first()
    
    if not current_user:
        raise HTTPException(status_code=400, detail="No user found")
    
    # Validate tags exist and belong to user (security check)
    tag_count = await db.scalar(
        select(func.count()).select_from(Tag)
        .where(Tag.id.in_(parsed_tag_ids), Tag.user_id == current_user.id)
    )
    
    if tag_count != len(parsed_tag_ids):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Some tags not found or do not belong to user"
        )
    
    validated_tag_ids = parsed_tag_ids
```

**Rationale:**
- Validates ALL tags upfront (fail-fast approach)
- Security: Prevents users from assigning other users' tags
- Uses existing pattern from `bulk_assign_tags_to_videos` (line 951-967)

### 4. Backend: Pass Tag IDs to Worker via Job Context
**Files:** `backend/app/api/videos.py` (line 802 - after commit success)
**Action:** Enqueue job with tag_ids parameter

```python
# Modify _enqueue_video_processing call (line ~802)
# Change from:
await _enqueue_video_processing(db, list_id, len(videos_to_create))

# To:
await _enqueue_video_processing(db, list_id, len(videos_to_create), validated_tag_ids)
```

### 5. Backend: Update _enqueue_video_processing Helper
**Files:** `backend/app/api/videos.py` (line 80-142)
**Action:** Add tag_ids parameter and pass to ARQ job

```python
async def _enqueue_video_processing(
    db: AsyncSession,
    list_id: int,
    total_videos: int,
    tag_ids: list[UUID] | None = None  # NEW PARAMETER
) -> Optional[ProcessingJob]:
    """
    Helper to create ProcessingJob and enqueue ARQ task.
    
    NEW: Supports auto-tagging via tag_ids parameter.
    """
    if total_videos == 0:
        return None
    
    # ... existing schema loading code ...
    
    # Enqueue ARQ job with schema AND tag_ids
    arq_pool = await get_arq_pool()
    await arq_pool.enqueue_job(
        "process_video_list",
        str(job.id),
        str(list_id),
        video_ids,
        schema_fields,
        [str(tid) for tid in (tag_ids or [])]  # NEW: Pass tag IDs as strings
    )
    
    return job
```

**Rationale:**
- Minimal change to existing helper function
- Serializes UUIDs to strings for ARQ (Redis compatibility)
- Default empty list if no tags provided (backwards compatible)

### 6. Worker: Update process_video_list Signature
**Files:** `backend/app/workers/video_processor.py` (line 146-152)
**Action:** Add tag_ids parameter

```python
async def process_video_list(
    ctx: dict,
    job_id: str,
    list_id: str,
    video_ids: list[str],
    schema: dict,
    tag_ids: list[str] = []  # NEW PARAMETER with default
) -> dict:
    """
    Process a list of videos in batch (for CSV bulk upload).
    
    NEW: Auto-assigns tags to all videos if tag_ids provided.
    """
    db: AsyncSession = ctx['db']
    logger.info(f"Processing video list job {job_id} with {len(video_ids)} videos")
    
    # Convert tag_ids from strings to UUIDs
    parsed_tag_ids = [UUID(tid) for tid in tag_ids] if tag_ids else []
    
    # ... existing processing loop ...
```

### 7. Worker: Bulk Insert Video-Tag Associations After Processing
**Files:** `backend/app/workers/video_processor.py` (line 196-207 - after loop ends)
**Action:** Use PostgreSQL's INSERT ... ON CONFLICT for bulk tag assignment

```python
# Add AFTER processing loop completes (line ~196)
# Bulk assign tags to all successfully processed videos
if parsed_tag_ids and processed_count > 0:
    try:
        from app.models.tag import video_tags
        from sqlalchemy.dialects.postgresql import insert as pg_insert
        
        # Create cartesian product: all videos × all tags
        # Only assign to successfully processed videos
        video_result = await db.execute(
            select(Video.id).where(
                Video.list_id == UUID(list_id),
                Video.processing_status == "completed"
            )
        )
        completed_video_ids = video_result.scalars().all()
        
        if completed_video_ids:
            assignments = [
                {"video_id": vid, "tag_id": tag}
                for vid in completed_video_ids
                for tag in parsed_tag_ids
            ]
            
            # Bulk insert with conflict resolution (idempotent)
            stmt = pg_insert(video_tags).values(assignments)
            stmt = stmt.on_conflict_do_nothing(constraint="uq_video_tags_video_tag")
            await db.execute(stmt)
            await db.commit()
            
            logger.info(
                f"Bulk assigned {len(parsed_tag_ids)} tags to "
                f"{len(completed_video_ids)} videos in job {job_id}"
            )
    except Exception as e:
        logger.exception(f"Failed to bulk assign tags in job {job_id}")
        # Don't fail job if tag assignment fails (video processing succeeded)
```

**Rationale:**
- REF MCP validation: SQLAlchemy docs recommend bulk insert for many-to-many with ON CONFLICT
- Single query for all assignments (N×M complexity, max 10K limit handled by existing endpoint)
- Only tags completed videos (respects processing_status)
- Idempotent: ON CONFLICT DO NOTHING prevents duplicate assignments
- Error isolation: Tag assignment failure doesn't fail video processing

### 8. Frontend: Read selectedTagIds from Store
**Files:** `frontend/src/components/CSVUpload.tsx` (line 31-35)
**Action:** Access Zustand store to get selected tag IDs

```typescript
import { useTagStore } from '@/stores/tagStore'

export const CSVUpload = ({ listId, onCancel, onSuccess }: CSVUploadProps) => {
  // Existing state
  const [file, setFile] = useState<File | null>(null)
  const [uploadResult, setUploadResult] = useState<BulkUploadResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const bulkUpload = useBulkUploadVideos(listId)
  
  // NEW: Get selected tags from store
  const selectedTagIds = useTagStore((state) => state.selectedTagIds)
  const tags = useTagStore((state) => state.tags)
  
  // NEW: Derive selected tag names for preview
  const selectedTags = tags.filter(tag => selectedTagIds.includes(tag.id))
```

**Rationale:**
- REF MCP validation: Zustand docs show `useStore(store, selector)` pattern for accessing state
- Selector function `(state) => state.selectedTagIds` prevents unnecessary re-renders
- Derives tag names from tags array for UI display

### 9. Frontend: Display Tag Preview in Upload Form
**Files:** `frontend/src/components/CSVUpload.tsx` (line 139 - after file format description)
**Action:** Show selected tags with visual chips

```typescript
{/* Add AFTER format description (line ~139) */}
{selectedTags.length > 0 && (
  <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
    <p className="text-sm font-medium text-blue-900 mb-2">
      Diese Tags werden automatisch zugewiesen:
    </p>
    <div className="flex flex-wrap gap-2">
      {selectedTags.map((tag) => (
        <span
          key={tag.id}
          className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
        >
          {tag.name}
        </span>
      ))}
    </div>
  </div>
)}
```

**Rationale:**
- Visual feedback BEFORE upload (user knows what will happen)
- Blue color scheme differentiates from error (red) and success (green)
- Chip design matches existing tag UI patterns in TagNavigation

### 10. Frontend: Update Upload Mutation to Send Tag IDs
**Files:** `frontend/src/hooks/useVideos.ts` (bulk upload mutation)
**Action:** Include tag_ids in FormData

```typescript
// Find useBulkUploadVideos hook and update mutation
export const useBulkUploadVideos = (listId: string) => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (file: File, tagIds?: string[]) => {  // NEW: tagIds parameter
      const formData = new FormData()
      formData.append('file', file)
      
      // NEW: Include tag_ids if provided
      if (tagIds && tagIds.length > 0) {
        formData.append('tag_ids', JSON.stringify(tagIds))
      }

      const { data } = await api.post<BulkUploadResponse>(
        `/lists/${listId}/videos/bulk`,
        formData,
        {
          headers: { 'Content-Type': 'multipart/form-data' },
        }
      )
      return data
    },
    // ... rest unchanged ...
  })
}
```

### 11. Frontend: Update CSVUpload to Pass Tag IDs on Upload
**Files:** `frontend/src/components/CSVUpload.tsx` (line 68-86 - handleUpload function)
**Action:** Pass selectedTagIds to mutation

```typescript
const handleUpload = async (e: React.FormEvent) => {
  e.preventDefault()
  setError(null)

  if (!file) {
    setError('Bitte wählen Sie eine Datei aus')
    return
  }

  try {
    // NEW: Pass selectedTagIds to mutation
    const result = await bulkUpload.mutateAsync(file, selectedTagIds)
    setUploadResult(result)

    // If all succeeded, close form
    if (result.failed_count === 0) {
      setTimeout(() => {
        onSuccess()
      }, 1500)
    }
  } catch (err) {
    // ... existing error handling ...
  }
}
```

### 12. Frontend: Update Success Message to Mention Tags
**Files:** `frontend/src/components/CSVUpload.tsx` (line 147-170 - uploadResult display)
**Action:** Add tag assignment confirmation to success message

```typescript
{uploadResult && (
  <div className={`p-4 rounded-lg ${
    uploadResult.failed_count === 0
      ? 'bg-green-50 border border-green-200'
      : 'bg-yellow-50 border border-yellow-200'
  }`}>
    <p className="font-semibold mb-2">
      {uploadResult.created_count} Video{uploadResult.created_count !== 1 ? 's' : ''} erfolgreich hinzugefügt
    </p>
    {/* NEW: Show tag assignment confirmation */}
    {selectedTags.length > 0 && (
      <p className="text-sm text-green-700 mb-2">
        {selectedTags.length} Tag{selectedTags.length !== 1 ? 's' : ''} zugewiesen: {selectedTags.map(t => t.name).join(', ')}
      </p>
    )}
    {/* ... existing failure display ... */}
  </div>
)}
```

---

## 🧪 Testing Strategy

### Unit Tests (Backend)

**File:** `backend/tests/api/test_videos.py`

1. **Test optional tag_ids parameter parsing**
   - Valid JSON array → parsed correctly
   - Empty string → None
   - Invalid JSON → 422 error
   - Invalid UUID format → 422 error

2. **Test tag validation logic**
   - Valid tags belonging to user → passes
   - Tags not found → 404 error
   - Tags belonging to other user → 404 error
   - Empty tag list → skips validation

3. **Test _enqueue_video_processing with tag_ids**
   - tag_ids passed to ARQ job correctly
   - Empty list when tag_ids=None
   - UUIDs serialized to strings

**File:** `backend/tests/workers/test_video_processor.py`

4. **Test process_video_list with tag_ids**
   - tag_ids parameter defaults to empty list (backwards compatible)
   - Parses tag_id strings to UUIDs correctly
   - Skips tag assignment if tag_ids empty

5. **Test bulk tag assignment in worker**
   - Creates cartesian product (N videos × M tags)
   - Only assigns to completed videos (skips failed/pending)
   - Idempotent: duplicate assignments ignored
   - Handles edge case: video already has tags (adds, not replaces)

6. **Test tag assignment error handling**
   - Invalid tag UUID → logs error, doesn't fail job
   - Database error → logs error, doesn't fail job
   - Video processing succeeds even if tag assignment fails

### Integration Tests

**File:** `backend/tests/integration/test_video_bulk_upload_with_tags.py`

7. **Test full CSV upload with tag auto-assignment**
   - Upload CSV with 3 videos + 2 selected tags
   - Verify: 3 videos created, each has 2 tags assigned
   - Verify: video_tags table has 6 entries (3×2)

8. **Test CSV upload with no tags selected**
   - Upload CSV without tag_ids parameter
   - Verify: videos created, no tags assigned
   - Verify: backwards compatible (existing behavior)

9. **Test CSV upload with deleted tags**
   - Create 2 tags, delete 1 tag, upload CSV with both tag IDs
   - Verify: 404 error (validation prevents partial assignment)
   - Alternative: Allow partial assignment? (Design decision)

### Frontend Unit Tests

**File:** `frontend/src/components/CSVUpload.test.tsx`

10. **Test tag preview display**
    - selectedTagIds=[] → preview not shown
    - selectedTagIds=['id1', 'id2'] → shows 2 tag chips
    - Tag names rendered correctly

11. **Test tag IDs passed to mutation**
    - Mock bulkUpload.mutateAsync
    - Upload file with selectedTagIds=['id1']
    - Verify: mutateAsync called with (file, ['id1'])

**File:** `frontend/src/hooks/useVideos.test.ts`

12. **Test useBulkUploadVideos with tag_ids**
    - Mock axios.post
    - Call mutation with (file, ['id1', 'id2'])
    - Verify: FormData contains 'tag_ids' field with JSON array

### Manual Testing Checklist

1. **Happy Path: CSV Upload with Tags**
   - Select 2 tags in TagNavigation
   - Upload CSV with 5 videos
   - Expected: Preview shows 2 tags, success message shows "2 Tags zugewiesen"
   - Verify: VideoGrid shows all 5 videos with both tags

2. **Empty Selection: CSV Upload without Tags**
   - Clear all tag selections
   - Upload CSV with 3 videos
   - Expected: No preview shown, videos created without tags
   - Verify: VideoGrid shows videos with no tags

3. **Edge Case: Change Tags During Upload**
   - Select Tag A
   - Start CSV upload (slow network simulation)
   - Immediately select Tag B (deselect Tag A)
   - Expected: Only Tag A assigned (tag_ids captured at upload time)
   - Rationale: selectedTagIds read when handleUpload called (closure)

4. **Edge Case: Delete Tag During Upload**
   - Select Tag A (id: 'uuid1')
   - Start CSV upload
   - Delete Tag A from database (direct SQL or API)
   - Expected: Upload fails with 404 "Tags not found"
   - Rationale: Tag validation happens BEFORE processing

5. **Edge Case: Video Already Has Tags**
   - Create Video 1 with Tag A
   - Select Tag B
   - Upload CSV containing Video 1
   - Expected: 409 "Video already exists" (duplicate detection)
   - Alternative: If duplicate detection bypassed, Video 1 has both Tag A and Tag B

6. **Performance: Large Batch**
   - Select 5 tags
   - Upload CSV with 100 videos
   - Expected: Worker completes in <2 minutes
   - Verify: Single bulk INSERT for 500 tag assignments (100×5)

7. **Accessibility: Tag Preview**
   - Use screen reader
   - Navigate to CSV upload form with tags selected
   - Expected: Hears "Diese Tags werden automatisch zugewiesen: Python, Tutorial"

8. **Visual Consistency: Tag Chips**
   - Compare tag chips in preview with TagNavigation
   - Expected: Same visual style (rounded-full, consistent spacing)

9. **Error Recovery: Invalid Tag ID**
   - Manually modify localStorage to include invalid tag UUID
   - Upload CSV
   - Expected: 404 error "Some tags not found"

10. **Backwards Compatibility: Old Frontend + New Backend**
    - Use old frontend (without tag_ids parameter)
    - Upload CSV to new backend
    - Expected: Videos created without tags (tag_ids=None handled)

---

## 📚 Reference

### REF MCP Findings

**1. FastAPI Optional Parameters (REF: FastAPI Docs - Request Body)**
- **Evidence:** "The same as when declaring query parameters, when a model attribute has a default value, it is not required."
- **Pattern:** `tag_ids: list[UUID] | None = None` makes field optional
- **Trade-off:** Cannot use Pydantic BaseModel with UploadFile → Use `Form(None)` + JSON encoding

**2. Zustand State Access (REF: Zustand Docs - useStore)**
- **Evidence:** "useStore(store, selectorFn) returns any data based on current state depending on the selector function"
- **Pattern:** `const selectedTagIds = useTagStore((state) => state.selectedTagIds)`
- **Benefit:** Prevents unnecessary re-renders (only subscribes to selectedTagIds)

**3. SQLAlchemy Bulk Many-to-Many (REF: SQLAlchemy 2.0 Docs - Large Collections)**
- **Evidence:** "Bulk insert rows into a collection of this type using WriteOnlyCollection"
- **Pattern:** `pg_insert(video_tags).values(assignments).on_conflict_do_nothing()`
- **Performance:** Single query for N×M assignments vs N×M individual INSERTs

**4. UX Upload Preview Patterns (REF: uxpatterns.dev)**
- **Evidence:** File upload previews commonly show metadata before submission
- **Pattern:** Display selected options (tags) as removable chips in preview area
- **User Benefit:** Confirms intent before action (prevents accidental bulk tagging)

**5. React FormData with JSON Arrays (REF: MDN FormData)**
- **Evidence:** FormData values must be strings or Blobs → serialize complex types
- **Pattern:** `formData.append('tag_ids', JSON.stringify(tagIds))`
- **Backend Parsing:** `json.loads(tag_ids)` in FastAPI endpoint

### Related Code

**Existing Bulk Tag Assignment:**
- Pattern: `backend/app/api/videos.py` lines 912-993 (`bulk_assign_tags_to_videos`)
- Uses: PostgreSQL INSERT with ON CONFLICT DO NOTHING
- Validation: Pre-checks all videos and tags exist (fail-fast)

**Existing CSV Upload:**
- Implementation: `frontend/src/components/CSVUpload.tsx`
- Pattern: FormData upload with file validation
- Success Feedback: Shows created_count and failures

**Existing Tag Store:**
- Implementation: `frontend/src/stores/tagStore.ts`
- State: `selectedTagIds: string[]` (persisted in localStorage)
- Actions: `toggleTag()`, `clearTags()`, `setSelectedTagIds()`

### Design Decisions

**Decision 1: When to Assign Tags?**
- **Options:**
  - A) During video creation (inline in bulk_upload_videos)
  - B) After processing (in worker after metadata fetch)
  - C) Separate background job (after worker completes)
- **Chosen:** B (After processing in worker)
- **Rationale:**
  - Only tags successfully processed videos (respects processing_status)
  - Bulk insert happens once (not per video)
  - Error isolation: Tag failure doesn't block video creation
- **Trade-off:** Tags appear after processing completes (not instant)
- **Validation:** Status.md shows Tasks #8, #66 use post-processing pattern

**Decision 2: Tag Assignment Idempotency**
- **Options:**
  - A) Fail on duplicate (INSERT without ON CONFLICT)
  - B) Ignore duplicates (ON CONFLICT DO NOTHING)
  - C) Update timestamp (ON CONFLICT DO UPDATE)
- **Chosen:** B (Ignore duplicates)
- **Rationale:**
  - Idempotent: Re-uploading same CSV with same tags is safe
  - Matches existing bulk_assign_tags_to_videos behavior (line 983)
  - No timestamp tracking needed (video_tags is pure association table)
- **Trade-off:** Cannot detect "tag was already assigned" vs "just assigned"
- **Validation:** REF MCP confirms SQLAlchemy recommends ON CONFLICT for bulk inserts

**Decision 3: Tag Validation Timing**
- **Options:**
  - A) Validate before CSV processing (fail-fast)
  - B) Validate during worker execution (late validation)
  - C) Skip validation (rely on foreign key constraints)
- **Chosen:** A (Validate before CSV processing)
- **Rationale:**
  - Fails immediately if tags deleted (better UX than partial failure)
  - Prevents enqueuing job that will fail during tagging
  - Security: Ensures tags belong to user (prevents cross-user tagging)
- **Trade-off:** Additional query before processing (minimal latency)
- **Validation:** Matches existing pattern from bulk_assign_tags_to_videos (line 951-967)

**Decision 4: Frontend Tag State Capture**
- **Options:**
  - A) Read selectedTagIds when form opens (closure in useState)
  - B) Read selectedTagIds when upload button clicked (closure in handleUpload)
  - C) Subscribe to selectedTagIds changes (reactive)
- **Chosen:** B (Read when upload button clicked)
- **Rationale:**
  - Captures most recent selection (user can change tags before clicking)
  - Matches user mental model: "Tags I selected when I clicked Upload"
  - No complex synchronization needed
- **Trade-off:** If user changes tags during upload, old tags are used
- **Validation:** Manual Test #3 documents this edge case

**Decision 5: Partial Tag Assignment on Validation Failure**
- **Options:**
  - A) Fail entire upload if any tag invalid (atomic)
  - B) Assign valid tags, skip invalid ones (partial)
- **Chosen:** A (Fail entire upload)
- **Rationale:**
  - Clearer error feedback: "Tag X not found" is actionable
  - Prevents unexpected behavior: "Why is only 1 of 2 tags assigned?"
  - Consistent with bulk_assign_tags_to_videos pattern (404 if any tag invalid)
- **Trade-off:** User must fix tag selection and re-upload
- **Validation:** Integration Test #9 covers this scenario

**Decision 6: Tag Assignment for Failed Videos**
- **Options:**
  - A) Assign tags to all videos (including failed)
  - B) Assign tags only to completed videos
  - C) Assign tags to pending videos (before processing)
- **Chosen:** B (Only completed videos)
- **Rationale:**
  - Failed videos are incomplete (may not have basic metadata)
  - Tagging logic happens AFTER metadata fetch (Step 7 in worker)
  - User expectation: Tags represent categorization of valid content
- **Trade-off:** Failed videos need manual re-upload + re-tagging
- **Validation:** Worker query filters by `processing_status == "completed"` (Step 7)

---

## ⏱️ Time Estimate

**Based on Similar Tasks:**
- Task #66 (Custom Fields CRUD Endpoints): 32 min implementation + 179 min report = 211 min
- Task #67 (Duplicate Check Endpoint): 67 min implementation + 8 min report = 75 min
- Task #8 (Bulk Tag Assignment): ~60 min (estimated from complexity)

**Estimated Breakdown:**
- Backend Changes (Steps 1-7): 45 minutes
  - Schema + endpoint modification: 15 min
  - Worker bulk insert logic: 20 min
  - Testing (5 backend unit tests): 10 min
- Frontend Changes (Steps 8-12): 35 minutes
  - Store integration + UI preview: 20 min
  - Testing (3 frontend unit tests): 15 min
- Integration Tests (3 tests): 20 minutes
- Manual Testing (10 scenarios): 25 minutes
- Documentation (this plan): 35 minutes (already complete)

**Total Estimate:** 160 minutes (2 hours 40 minutes)

**Confidence:** HIGH (all dependencies exist, clear implementation path, validated with REF MCP)
