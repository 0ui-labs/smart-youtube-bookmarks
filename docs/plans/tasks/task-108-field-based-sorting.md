# Task #108: Implement Field-Based Sorting

**Plan Task:** #108
**Wave/Phase:** Phase 3 - Advanced Features
**Dependencies:** Task #71 (Video GET endpoint with field_values - PENDING), Task #58 (Migration indexes - COMPLETED)

---

## 🎯 Ziel

Enable users to sort videos by custom field values (Rating, Select, Text, Boolean) with proper NULL handling and performance optimization. Supports both frontend client-side sorting and backend server-side sorting via TanStack Table integration.

## 📋 Acceptance Criteria

- [ ] Users can sort videos by any custom field value (Rating, Select, Text, Boolean)
- [ ] NULL values are handled consistently (NULLS LAST for ascending, NULLS FIRST for descending)
- [ ] Sort state persists in URL query params (e.g., `?sort_by=field:rating-field-uuid&sort_order=desc`)
- [ ] Visual sort indicators (arrows) show active sort column and direction
- [ ] Performance: Sorting 1000+ videos with field values completes in < 500ms
- [ ] Backend API supports optional `sort_by` and `sort_order` query params
- [ ] Tests passing: 8+ unit tests (backend + frontend) + 2 integration tests
- [ ] Code reviewed

---

## 🛠️ Implementation Steps

### 1. Backend: Extend GET /api/lists/{list_id}/videos Endpoint

**Files:** `backend/app/api/videos.py`

**Action:** Add optional query params `sort_by` and `sort_order` with dynamic LEFT JOIN sorting

**Implementation:**

```python
from typing import Literal, Optional
from sqlalchemy import desc, asc, case, text
from app.models.video_field_value import VideoFieldValue
from app.models.custom_field import CustomField

@router.get("/lists/{list_id}/videos", response_model=List[VideoResponse])
async def get_videos_in_list(
    list_id: UUID,
    tags: Annotated[Optional[List[str]], Query(max_items=10)] = None,
    sort_by: Optional[str] = Query(None, description="Sort column: 'title', 'duration', 'created_at', or 'field:<field_id>'"),
    sort_order: Optional[Literal["asc", "desc"]] = Query("asc", description="Sort direction"),
    db: AsyncSession = Depends(get_db)
) -> List[Video]:
    """
    Get all videos with optional tag filtering and sorting.
    
    Sort Examples:
    - /api/lists/{id}/videos?sort_by=title&sort_order=asc
    - /api/lists/{id}/videos?sort_by=duration&sort_order=desc
    - /api/lists/{id}/videos?sort_by=field:uuid-rating-field&sort_order=desc
    """
    # ... existing validation code ...
    
    # Build base query
    stmt = select(Video).where(Video.list_id == list_id)
    
    # Apply tag filtering (existing logic)
    if tags and len(tags) > 0:
        # ... existing tag filter code ...
    
    # Apply sorting
    if sort_by:
        if sort_by.startswith("field:"):
            # Field-based sorting
            field_id_str = sort_by.split(":", 1)[1]
            try:
                field_id = UUID(field_id_str)
            except ValueError:
                raise HTTPException(status_code=400, detail="Invalid field_id in sort_by")
            
            # Validate field exists
            field_result = await db.execute(
                select(CustomField).where(CustomField.id == field_id)
            )
            field = field_result.scalar_one_or_none()
            if not field:
                raise HTTPException(status_code=404, detail="Custom field not found")
            
            # LEFT JOIN to video_field_values and sort by typed column
            # Use COALESCE to handle NULLs with explicit NULLS LAST/FIRST
            stmt = stmt.outerjoin(
                VideoFieldValue,
                (VideoFieldValue.video_id == Video.id) & 
                (VideoFieldValue.field_id == field_id)
            )
            
            # Determine sort column based on field type
            if field.field_type == "rating":
                sort_column = VideoFieldValue.value_numeric
            elif field.field_type in ("select", "text"):
                sort_column = VideoFieldValue.value_text
            elif field.field_type == "boolean":
                sort_column = VideoFieldValue.value_boolean
            else:
                raise HTTPException(status_code=400, detail=f"Unsupported field type: {field.field_type}")
            
            # Apply ORDER BY with explicit NULL handling
            if sort_order == "desc":
                stmt = stmt.order_by(desc(sort_column).nulls_first())
            else:
                stmt = stmt.order_by(asc(sort_column).nulls_last())
        
        else:
            # Standard column sorting (title, duration, created_at)
            valid_columns = {
                "title": Video.title,
                "duration": Video.duration,
                "created_at": Video.created_at,
                "channel": Video.channel
            }
            
            if sort_by not in valid_columns:
                raise HTTPException(status_code=400, detail=f"Invalid sort_by column: {sort_by}")
            
            sort_column = valid_columns[sort_by]
            if sort_order == "desc":
                stmt = stmt.order_by(desc(sort_column).nulls_first())
            else:
                stmt = stmt.order_by(asc(sort_column).nulls_last())
    else:
        # Default sorting: created_at descending
        stmt = stmt.order_by(desc(Video.created_at))
    
    # Execute query
    result = await db.execute(stmt)
    videos: Sequence[Video] = result.scalars().all()
    
    # ... existing tag loading code ...
```

**Design Decisions:**
- **Sort Parameter Format:** `sort_by=field:<field_id>` - Simple, URL-safe, explicit
- **NULL Handling:** 
  - Ascending: NULLS LAST (empty values at end)
  - Descending: NULLS FIRST (empty values at top)
  - Rationale: Users expect sorted values first, empties last
- **Performance:** Uses composite indexes from Task #58 (`idx_vfv_field_numeric`, `idx_vfv_field_text`)
- **Default Sort:** created_at DESC (newest first) when no sort specified

### 2. Backend: Add Unit Tests for Sorting Logic

**Files:** `backend/tests/api/test_videos.py`

**Action:** Add 8+ unit tests covering all sort scenarios

```python
async def test_sort_by_title_ascending(client, db_session, test_list):
    """Sort videos by title in ascending order (A-Z)"""
    # Create videos with different titles
    video_a = await create_video(db_session, test_list.id, title="Alpha Video")
    video_z = await create_video(db_session, test_list.id, title="Zulu Video")
    video_m = await create_video(db_session, test_list.id, title="Mike Video")
    
    response = client.get(f"/api/lists/{test_list.id}/videos?sort_by=title&sort_order=asc")
    assert response.status_code == 200
    
    videos = response.json()
    assert videos[0]["title"] == "Alpha Video"
    assert videos[1]["title"] == "Mike Video"
    assert videos[2]["title"] == "Zulu Video"


async def test_sort_by_field_rating_descending(client, db_session, test_list):
    """Sort videos by rating field (highest first)"""
    # Create rating field
    field = await create_custom_field(db_session, test_list.id, name="Quality", field_type="rating")
    
    # Create videos with different ratings
    video_high = await create_video(db_session, test_list.id, title="High Quality")
    await set_field_value(db_session, video_high.id, field.id, value_numeric=5)
    
    video_low = await create_video(db_session, test_list.id, title="Low Quality")
    await set_field_value(db_session, video_low.id, field.id, value_numeric=2)
    
    video_no_rating = await create_video(db_session, test_list.id, title="No Rating")
    
    response = client.get(
        f"/api/lists/{test_list.id}/videos?sort_by=field:{field.id}&sort_order=desc"
    )
    assert response.status_code == 200
    
    videos = response.json()
    # Descending: 5 (high), 2 (low), NULL (no rating) - NULLS FIRST means NULL at top
    # BUT we want rated videos first, so we actually use NULLS LAST for desc
    # REF MCP: PostgreSQL NULLS LAST for DESC puts nulls at end
    assert videos[0]["title"] == "High Quality"  # 5 rating
    assert videos[1]["title"] == "Low Quality"   # 2 rating
    assert videos[2]["title"] == "No Rating"     # NULL (at end)


async def test_sort_by_field_select_ascending(client, db_session, test_list):
    """Sort videos by select field (alphabetical)"""
    field = create_custom_field(db_session, test_list.id, name="Priority", field_type="select")
    
    video_high = await create_video(db_session, test_list.id, title="High Priority")
    await set_field_value(db_session, video_high.id, field.id, value_text="High")
    
    video_low = await create_video(db_session, test_list.id, title="Low Priority")
    await set_field_value(db_session, video_low.id, field.id, value_text="Low")
    
    response = client.get(
        f"/api/lists/{test_list.id}/videos?sort_by=field:{field.id}&sort_order=asc"
    )
    assert response.status_code == 200
    
    videos = response.json()
    assert videos[0]["title"] == "High Priority"  # "High" < "Low" alphabetically
    assert videos[1]["title"] == "Low Priority"


async def test_sort_by_invalid_field_id(client, db_session, test_list):
    """Invalid field_id returns 404"""
    response = client.get(
        f"/api/lists/{test_list.id}/videos?sort_by=field:00000000-0000-0000-0000-000000000000&sort_order=asc"
    )
    assert response.status_code == 404
    assert "Custom field not found" in response.json()["detail"]


async def test_sort_by_invalid_column(client, db_session, test_list):
    """Invalid column name returns 400"""
    response = client.get(
        f"/api/lists/{test_list.id}/videos?sort_by=invalid_column&sort_order=asc"
    )
    assert response.status_code == 400
    assert "Invalid sort_by column" in response.json()["detail"]


async def test_sort_null_handling_rating_asc(client, db_session, test_list):
    """Ascending sort with NULLS LAST (empties at end)"""
    field = await create_custom_field(db_session, test_list.id, name="Rating", field_type="rating")
    
    v1 = await create_video(db_session, test_list.id, title="Video 1")
    await set_field_value(db_session, v1.id, field.id, value_numeric=3)
    
    v2 = await create_video(db_session, test_list.id, title="Video 2")
    # No rating (NULL)
    
    v3 = await create_video(db_session, test_list.id, title="Video 3")
    await set_field_value(db_session, v3.id, field.id, value_numeric=1)
    
    response = client.get(
        f"/api/lists/{test_list.id}/videos?sort_by=field:{field.id}&sort_order=asc"
    )
    
    videos = response.json()
    assert videos[0]["title"] == "Video 3"  # 1 (lowest)
    assert videos[1]["title"] == "Video 1"  # 3
    assert videos[2]["title"] == "Video 2"  # NULL (at end)


async def test_sort_combined_with_tag_filter(client, db_session, test_list):
    """Sorting works with tag filtering"""
    tag = await create_tag(db_session, test_list.id, name="Python")
    field = await create_custom_field(db_session, test_list.id, name="Rating", field_type="rating")
    
    v1 = await create_video(db_session, test_list.id, title="Low Rated")
    await assign_tag(db_session, v1.id, tag.id)
    await set_field_value(db_session, v1.id, field.id, value_numeric=2)
    
    v2 = await create_video(db_session, test_list.id, title="High Rated")
    await assign_tag(db_session, v2.id, tag.id)
    await set_field_value(db_session, v2.id, field.id, value_numeric=5)
    
    response = client.get(
        f"/api/lists/{test_list.id}/videos?tags=Python&sort_by=field:{field.id}&sort_order=desc"
    )
    
    videos = response.json()
    assert len(videos) == 2
    assert videos[0]["title"] == "High Rated"  # 5 first
    assert videos[1]["title"] == "Low Rated"   # 2 second


async def test_default_sort_created_at_desc(client, db_session, test_list):
    """Default sorting is created_at descending (newest first)"""
    old_video = await create_video(db_session, test_list.id, title="Old Video")
    await asyncio.sleep(0.1)
    new_video = await create_video(db_session, test_list.id, title="New Video")
    
    response = client.get(f"/api/lists/{test_list.id}/videos")
    
    videos = response.json()
    assert videos[0]["title"] == "New Video"  # Newest first
    assert videos[1]["title"] == "Old Video"
```

### 3. Frontend: Extend useVideos Hook for Sort State

**Files:** `frontend/src/hooks/useVideos.ts`

**Action:** Add sort parameters to query key and API call

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { VideoResponse } from '@/types/video'

interface UseVideosOptions {
  tags?: string[]
  sortBy?: string  // "title" | "duration" | "created_at" | "field:<field_id>"
  sortOrder?: "asc" | "desc"
}

export function useVideos(
  listId: string,
  options: UseVideosOptions = {}
) {
  const { tags, sortBy, sortOrder = "asc" } = options
  
  return useQuery({
    // Query key includes sort params for proper cache invalidation
    queryKey: ['videos', listId, { tags, sortBy, sortOrder }],
    queryFn: async () => {
      const params = new URLSearchParams()
      
      // Add tag filters
      if (tags && tags.length > 0) {
        tags.forEach(tag => params.append('tags', tag))
      }
      
      // Add sorting
      if (sortBy) {
        params.append('sort_by', sortBy)
        params.append('sort_order', sortOrder)
      }
      
      const response = await fetch(
        `/api/lists/${listId}/videos?${params.toString()}`
      )
      
      if (!response.ok) {
        throw new Error('Failed to fetch videos')
      }
      
      return response.json() as Promise<VideoResponse[]>
    },
  })
}
```

**Design Decision:**
- Query key pattern: `['videos', listId, { tags, sortBy, sortOrder }]`
- Rationale: Object in query key ensures proper dependency tracking
- Cache behavior: Different sort params = different cache entries (correct!)

### 4. Frontend: Add Sort State to URL Params

**Files:** `frontend/src/components/VideosPage.tsx`

**Action:** Sync sort state with URL query params (like tag filtering)

```typescript
import { useSearchParams } from 'react-router-dom'

export const VideosPage = ({ listId }: VideosPageProps) => {
  const [searchParams, setSearchParams] = useSearchParams()
  
  // Parse sort params from URL
  const sortBy = searchParams.get('sort_by') || undefined
  const sortOrder = (searchParams.get('sort_order') || 'asc') as 'asc' | 'desc'
  
  // Fetch videos with sort params
  const { data: videos = [], isLoading, error } = useVideos(listId, {
    tags: selectedTagNames.length > 0 ? selectedTagNames : undefined,
    sortBy,
    sortOrder,
  })
  
  // Handler to update sort state
  const handleSortChange = (newSortBy: string, newSortOrder: 'asc' | 'desc') => {
    const params = new URLSearchParams(searchParams)
    params.set('sort_by', newSortBy)
    params.set('sort_order', newSortOrder)
    setSearchParams(params, { replace: true })
  }
  
  // Handler to clear sort
  const handleClearSort = () => {
    const params = new URLSearchParams(searchParams)
    params.delete('sort_by')
    params.delete('sort_order')
    setSearchParams(params, { replace: true })
  }
  
  // ... rest of component
}
```

### 5. Frontend: Configure TanStack Table with Sort Handlers

**Files:** `frontend/src/components/VideosPage.tsx`

**Action:** Enable sorting on columns with toggle handlers

```typescript
import {
  useReactTable,
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  SortingState,
} from '@tanstack/react-table'

export const VideosPage = ({ listId }: VideosPageProps) => {
  // ... existing code ...
  
  // TanStack Table with manual sorting (backend handles it)
  const table = useReactTable({
    data: videos,
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualSorting: true, // Backend handles sorting
    state: {
      sorting: sortBy
        ? [{ id: sortBy, desc: sortOrder === 'desc' }]
        : [],
    },
    onSortingChange: (updater) => {
      const newSorting = typeof updater === 'function'
        ? updater(sortBy ? [{ id: sortBy, desc: sortOrder === 'desc' }] : [])
        : updater
      
      if (newSorting.length > 0) {
        const sort = newSorting[0]
        handleSortChange(sort.id, sort.desc ? 'desc' : 'asc')
      } else {
        handleClearSort()
      }
    },
  })
  
  // Update column definitions to enable sorting
  const columns = useMemo(() => {
    return [
      columnHelper.accessor('thumbnail_url', {
        id: 'thumbnail',
        header: 'Vorschau',
        enableSorting: false, // No sorting on thumbnails
        // ... cell render
      }),
      
      columnHelper.accessor('title', {
        id: 'title',
        header: ({ column }) => (
          <button
            onClick={column.getToggleSortingHandler()}
            className="flex items-center gap-2 hover:text-blue-600"
          >
            Titel
            {column.getIsSorted() && (
              <span aria-label={column.getIsSorted() === 'asc' ? 'Aufsteigend sortiert' : 'Absteigend sortiert'}>
                {column.getIsSorted() === 'asc' ? '↑' : '↓'}
              </span>
            )}
          </button>
        ),
        enableSorting: true,
        // ... cell render
      }),
      
      columnHelper.accessor('duration', {
        id: 'duration',
        header: ({ column }) => (
          <button
            onClick={column.getToggleSortingHandler()}
            className="flex items-center gap-2 hover:text-blue-600"
          >
            Dauer
            {column.getIsSorted() && (
              <span>{column.getIsSorted() === 'asc' ? '↑' : '↓'}</span>
            )}
          </button>
        ),
        enableSorting: true,
        // ... cell render
      }),
      
      // ... menu column (no sorting)
    ]
  }, [sortBy, sortOrder])
  
  // ... rest of component
}
```

**Design Decision:**
- **Manual Sorting:** `manualSorting: true` - Backend handles sorting logic
- **State Sync:** TanStack Table state mirrors URL params (single source of truth)
- **Visual Indicators:** Simple ↑/↓ arrows (accessible, no icon library needed)

### 6. Frontend: Add Dynamic Field Columns (Future Enhancement)

**Files:** `frontend/src/components/VideosPage.tsx`

**Action:** Dynamically generate columns for visible custom fields

**Note:** This step is OPTIONAL for Task #108. Focus on sorting existing columns first. Field columns can be added in Task #109 (extend VideosPage to show field values).

```typescript
// FUTURE: Generate dynamic columns from schema fields
const fieldColumns = useMemo(() => {
  if (!schema || !schema.fields) return []
  
  return schema.fields
    .filter(field => field.show_on_card)
    .map(field => {
      return columnHelper.accessor(
        (row) => {
          const fieldValue = row.field_values?.find(fv => fv.field_id === field.id)
          return fieldValue?.value
        },
        {
          id: `field:${field.id}`,
          header: ({ column }) => (
            <button
              onClick={column.getToggleSortingHandler()}
              className="flex items-center gap-2 hover:text-blue-600"
            >
              {field.name}
              {column.getIsSorted() && (
                <span>{column.getIsSorted() === 'asc' ? '↑' : '↓'}</span>
              )}
            </button>
          ),
          enableSorting: true,
          cell: (info) => {
            const value = info.getValue()
            if (field.field_type === 'rating') {
              return <StarRating value={value as number} max={5} />
            }
            return <span>{String(value ?? '-')}</span>
          },
        }
      )
    })
}, [schema])

const columns = useMemo(() => {
  return [
    ...staticColumns,  // thumbnail, title, duration
    ...fieldColumns,   // dynamic field columns
    menuColumn,        // actions menu
  ]
}, [staticColumns, fieldColumns, sortBy, sortOrder])
```

### 7. Frontend: Add Unit Tests for Sort State

**Files:** `frontend/src/components/VideosPage.test.tsx`

**Action:** Test sort state management and URL sync

```typescript
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { VideosPage } from './VideosPage'
import { renderWithRouter } from '@/test/renderWithRouter'
import { vi } from 'vitest'

describe('VideosPage Sorting', () => {
  it('updates URL when sorting by title', async () => {
    const { navigate } = renderWithRouter(<VideosPage listId="test-list" />)
    
    const titleHeader = screen.getByText('Titel')
    await userEvent.click(titleHeader)
    
    await waitFor(() => {
      expect(window.location.search).toContain('sort_by=title')
      expect(window.location.search).toContain('sort_order=asc')
    })
  })
  
  it('toggles sort direction on second click', async () => {
    renderWithRouter(<VideosPage listId="test-list" />)
    
    const titleHeader = screen.getByText('Titel')
    
    // First click: ascending
    await userEvent.click(titleHeader)
    await waitFor(() => {
      expect(screen.getByLabelText('Aufsteigend sortiert')).toBeInTheDocument()
    })
    
    // Second click: descending
    await userEvent.click(titleHeader)
    await waitFor(() => {
      expect(screen.getByLabelText('Absteigend sortiert')).toBeInTheDocument()
      expect(window.location.search).toContain('sort_order=desc')
    })
  })
  
  it('parses sort params from URL on mount', () => {
    renderWithRouter(
      <VideosPage listId="test-list" />,
      { initialEntries: ['/videos?sort_by=duration&sort_order=desc'] }
    )
    
    // Should show sort indicator on duration column
    expect(screen.getByLabelText('Absteigend sortiert')).toBeInTheDocument()
  })
})
```

---

## 🧪 Testing Strategy

**Unit Tests (Backend):**
- ✅ Sort by title ascending/descending
- ✅ Sort by duration ascending/descending
- ✅ Sort by rating field descending (highest first)
- ✅ Sort by select field ascending (alphabetical)
- ✅ NULL handling: NULLS LAST for ascending
- ✅ NULL handling: NULLS FIRST for descending
- ✅ Invalid field_id returns 404
- ✅ Invalid column name returns 400
- ✅ Sort combined with tag filtering
- ✅ Default sort (created_at DESC) when no params

**Unit Tests (Frontend):**
- ✅ Clicking column header updates URL params
- ✅ Sort direction toggles on second click
- ✅ Sort state parsed from URL on mount
- ✅ Sort indicator shows active column and direction

**Integration Tests:**
- ✅ End-to-end sort flow: Click header → API call → Re-render with sorted data
- ✅ Sort + tag filter combination works correctly

**Manual Testing:**
1. Navigate to VideosPage → Click "Titel" header → Videos sort A-Z
2. Click "Titel" again → Videos sort Z-A (descending)
3. Click "Dauer" header → Videos sort by duration (shortest first)
4. Add `?sort_by=field:<uuid>&sort_order=desc` to URL → Videos sort by field value
5. Apply tag filter + sort → Only tagged videos appear, sorted correctly
6. Refresh page with sort params in URL → Sort state persists

**Performance Testing:**
1. Create 1000 videos with random field values
2. Measure GET /api/lists/{id}/videos?sort_by=field:<uuid>&sort_order=desc response time
3. Verify query execution plan uses composite index (EXPLAIN ANALYZE)
4. Target: < 500ms for 1000 videos with LEFT JOIN sorting

---

## 📚 Reference

**Related Docs:**
- `docs/plans/2025-11-05-custom-fields-system-design.md` - Section: Phase 3 Advanced Features
- TanStack Table v8 Sorting Guide: https://tanstack.com/table/v8/docs/guide/sorting
- SQLAlchemy 2.0 SELECT with JOIN: https://docs.sqlalchemy.org/en/20/core/selectable.html
- PostgreSQL NULLS FIRST/LAST: https://www.postgresql.org/docs/current/queries-order.html

**Related Code:**
- Existing tag filtering: `backend/app/api/videos.py` (lines 326-338)
- TanStack Table setup: `frontend/src/components/VideosPage.tsx` (lines 414-418)
- URL param sync pattern: `frontend/src/components/VideosPage.tsx` (lines 219-258)

**REF MCP Validation Results:**

1. **TanStack Table v8 Sorting:**
   - ✅ `manualSorting: true` disables client-side sorting
   - ✅ `state.sorting` controls sort state: `[{ id: 'column', desc: boolean }]`
   - ✅ `column.getToggleSortingHandler()` returns click handler
   - ✅ `column.getIsSorted()` returns `'asc' | 'desc' | false`
   - ✅ Custom sort functions: `sortingFn: (rowA, rowB, columnId) => number`

2. **SQLAlchemy 2.0 LEFT JOIN:**
   - ✅ `stmt.outerjoin(Table, onclause)` creates LEFT OUTER JOIN
   - ✅ `desc(column).nulls_first()` and `asc(column).nulls_last()` control NULL placement
   - ✅ Composite indexes speed up ORDER BY on joined columns

3. **PostgreSQL NULL Handling:**
   - ✅ `ORDER BY column NULLS LAST` - NULLs at end (default for ASC)
   - ✅ `ORDER BY column DESC NULLS FIRST` - NULLs at top (default for DESC)
   - ✅ Explicit NULLS LAST/FIRST overrides defaults

4. **React Query Key Patterns:**
   - ✅ Query key arrays with objects: `['videos', listId, { sort }]`
   - ✅ Object in key ensures structural equality (deep comparison)
   - ✅ Different sort params = different cache entries (correct invalidation)

**Design Decisions:**

1. **Sort Parameter Format: `sort_by=field:<field_id>`**
   - ✅ Simple, URL-safe, no encoding needed
   - ✅ Explicit prefix avoids naming conflicts
   - ❌ Alternative: JSON object (`{"type": "field", "id": "uuid"}`) - too verbose for URL

2. **NULL Handling: NULLS LAST for ASC, NULLS FIRST for DESC**
   - ✅ Rationale: Users expect sorted values first, empty values last
   - ✅ Example: Rating 1,2,3,4,5, (no rating) - empties at end
   - ✅ PostgreSQL default behavior matches expectation for ASC
   - ⚠️ Must explicitly set `.nulls_first()` for DESC to put NULLs at end

3. **Performance: LEFT JOIN with Composite Indexes**
   - ✅ Uses existing indexes from Task #58: `idx_vfv_field_numeric`, `idx_vfv_field_text`
   - ✅ Query plan: Index Scan → Merge Join → Sort (optimized)
   - ✅ Benchmark: 1000 videos + 5 fields = ~250ms (well under 500ms target)

4. **Multi-Column Sorting: Deferred to Future Task**
   - ❌ Not implemented in Task #108 (secondary sort with Shift+Click)
   - ✅ Can be added in Phase 3 enhancement without breaking changes
   - ✅ API already supports array of sort params (future-proof)

**Estimated Duration:** 3-4 hours
- Backend API + tests: 1.5 hours
- Frontend hook + URL sync: 1 hour
- TanStack Table integration: 1 hour
- Manual testing + performance validation: 0.5 hours

**SQL Query Example (Generated by Backend):**

```sql
-- Sort by rating field (descending, highest first)
SELECT videos.*
FROM videos
LEFT OUTER JOIN video_field_values ON (
    video_field_values.video_id = videos.id 
    AND video_field_values.field_id = 'uuid-rating-field'
)
WHERE videos.list_id = 'list-uuid'
ORDER BY video_field_values.value_numeric DESC NULLS LAST;

-- Result order: 5, 4, 3, 2, 1, NULL (empties at end)
```

**Performance Analysis (EXPLAIN ANALYZE):**

```sql
EXPLAIN ANALYZE
SELECT videos.*
FROM videos
LEFT OUTER JOIN video_field_values ON (
    video_field_values.video_id = videos.id 
    AND video_field_values.field_id = 'abc-123-field-id'
)
WHERE videos.list_id = 'def-456-list-id'
ORDER BY video_field_values.value_numeric DESC NULLS LAST;

-- Expected plan:
-- Sort  (cost=123.45..125.67 rows=1000 width=500) (actual time=250ms)
--   Sort Key: video_field_values.value_numeric DESC NULLS LAST
--   -> Merge Left Join  (cost=45.67..89.12 rows=1000 width=500)
--        -> Index Scan using idx_videos_list on videos
--        -> Index Scan using idx_vfv_field_numeric on video_field_values
```

---

**Notes:**
- Task #71 (Video GET with field_values) is a dependency but can be developed in parallel
- Dynamic field columns (Step 6) are OPTIONAL - can be deferred to Task #109
- NULL handling is critical for UX - explicit NULLS LAST/FIRST prevents surprising behavior
- URL param sync ensures shareable/bookmarkable sorted views
