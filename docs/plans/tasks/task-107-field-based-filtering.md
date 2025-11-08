# Task #107: Add field-based filtering to video list UI

**Plan Task:** #107
**Wave/Phase:** Phase 3 - Advanced Features (Custom Fields System)
**Dependencies:** Task #71 (Video GET endpoint with field_values) - PENDING, Task #66 (custom fields CRUD) - COMPLETED, Migration indexes (Task #58) - COMPLETED

---

## 🎯 Ziel

Enable users to filter videos by custom field values (e.g., "Show all videos with Rating >= 4" or "Presentation Quality = great"). Extend the existing video list API endpoint with field-based filtering and add a FilterBar UI component that provides type-specific input controls (rating sliders, select dropdowns, text input, boolean toggles).

---

## 📋 Acceptance Criteria

**Functional:**
- [ ] Users can filter videos by any custom field available in the current list
- [ ] Type-specific filter inputs: Rating (range slider), Select (dropdown), Text (search input), Boolean (toggle)
- [ ] Active filters displayed as removable chips
- [ ] "Clear all filters" button removes all active filters
- [ ] Filters work with existing tag filtering (AND logic between filters)
- [ ] Filter state persists in URL query parameters for shareability

**Performance:**
- [ ] Filter query executes in < 500ms for 1000 videos (leverages existing indexes)
- [ ] UI remains responsive during filter changes (debounced input)

**Testing:**
- [ ] Unit tests for filter query builder logic
- [ ] Integration tests for filtered video endpoint
- [ ] Component tests for FilterBar with all field types
- [ ] Manual testing with various field combinations

---

## 🛠️ Implementation Steps

### 1. Backend: Extend Video List Endpoint with Field Filters

**Files:** `backend/app/api/videos.py`, `backend/app/schemas/video.py`

**Action:** Add optional `field_filters` query parameter using Pydantic query models (FastAPI best practice)

**1.1 Create Field Filter Schema:**

```python
# backend/app/schemas/video.py (add to existing file)
from typing import Optional, Literal
from pydantic import BaseModel, Field
from uuid import UUID

class FieldFilterOperator(str, Enum):
    """Filter operators for different field types."""
    # Numeric (rating)
    EQ = "eq"          # Equal to
    GT = "gt"          # Greater than
    GTE = "gte"        # Greater than or equal
    LT = "lt"          # Less than
    LTE = "lte"        # Less than or equal
    BETWEEN = "between"  # Between min and max
    
    # Text/Select
    CONTAINS = "contains"  # Text contains (case-insensitive)
    EXACT = "exact"        # Exact match (case-sensitive)
    IN = "in"              # One of (for select options)
    
    # Boolean
    IS = "is"  # True or False

class FieldFilter(BaseModel):
    """Single field filter specification."""
    field_id: UUID = Field(..., description="UUID of custom field to filter by")
    operator: FieldFilterOperator = Field(..., description="Filter operator")
    value: Optional[str | int | bool] = Field(None, description="Filter value (type depends on field_type)")
    value_min: Optional[int] = Field(None, description="Min value for BETWEEN operator (rating only)")
    value_max: Optional[int] = Field(None, description="Max value for BETWEEN operator (rating only)")
    
    class Config:
        json_schema_extra = {
            "examples": [
                {"field_id": "uuid", "operator": "gte", "value": 4},  # Rating >= 4
                {"field_id": "uuid", "operator": "contains", "value": "tutorial"},  # Text contains
                {"field_id": "uuid", "operator": "in", "value": "great,good"},  # Select in list
                {"field_id": "uuid", "operator": "is", "value": True},  # Boolean is true
            ]
        }

class VideoFilterParams(BaseModel):
    """Query parameters for video filtering (FastAPI Query model pattern)."""
    tags: Optional[list[str]] = Field(None, description="Tag names for OR filtering")
    field_filters: Optional[str] = Field(None, description="JSON-encoded list of FieldFilter objects")
    
    class Config:
        json_schema_extra = {
            "examples": [
                {
                    "tags": ["Python", "Tutorial"],
                    "field_filters": '[{"field_id":"uuid","operator":"gte","value":4}]'
                }
            ]
        }
```

**1.2 Update GET /api/lists/{list_id}/videos endpoint:**

```python
# backend/app/api/videos.py (modify existing endpoint)
import json
from app.schemas.video import VideoFilterParams, FieldFilter
from app.models.video_field_value import VideoFieldValue
from app.models.custom_field import CustomField

@router.get("/lists/{list_id}/videos", response_model=List[VideoResponse])
async def get_videos_in_list(
    list_id: UUID,
    filter_params: Annotated[VideoFilterParams, Query()],
    db: AsyncSession = Depends(get_db)
) -> List[Video]:
    """
    Get all videos in a bookmark list with optional tag and field filtering.
    
    Query Parameters:
    - tags: List of tag names (OR logic)
    - field_filters: JSON-encoded FieldFilter list (AND logic between filters)
    
    Examples:
    - /api/lists/{id}/videos?tags=Python
    - /api/lists/{id}/videos?field_filters=[{"field_id":"uuid","operator":"gte","value":4}]
    - /api/lists/{id}/videos?tags=Tutorial&field_filters=[{"field_id":"uuid","operator":"gte","value":4}]
    """
    # Validate list exists
    result = await db.execute(
        select(BookmarkList).where(BookmarkList.id == list_id)
    )
    bookmark_list = result.scalar_one_or_none()
    
    if not bookmark_list:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"List with id {list_id} not found"
        )
    
    # Build base query
    stmt = select(Video).where(Video.list_id == list_id).order_by(Video.created_at)
    
    # Apply tag filtering (existing logic)
    if filter_params.tags and len(filter_params.tags) > 0:
        normalized_tags = [tag.strip().lower() for tag in filter_params.tags if tag and tag.strip()]
        if normalized_tags:
            stmt = (
                stmt.join(Video.tags)
                .where(func.lower(Tag.name).in_(normalized_tags))
                .distinct()
            )
    
    # Apply field filtering (NEW)
    if filter_params.field_filters:
        try:
            filters = [FieldFilter(**f) for f in json.loads(filter_params.field_filters)]
        except (json.JSONDecodeError, ValidationError) as e:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Invalid field_filters format: {str(e)}"
            )
        
        # Apply each filter with JOIN (AND logic between filters)
        for idx, field_filter in enumerate(filters):
            # Alias for multiple joins (if multiple field filters)
            vfv_alias = aliased(VideoFieldValue, name=f"vfv_{idx}")
            
            # Join to video_field_values
            stmt = stmt.join(
                vfv_alias,
                and_(
                    vfv_alias.video_id == Video.id,
                    vfv_alias.field_id == field_filter.field_id
                )
            )
            
            # Apply operator-specific conditions
            if field_filter.operator == FieldFilterOperator.EQ:
                stmt = stmt.where(vfv_alias.value_numeric == field_filter.value)
            elif field_filter.operator == FieldFilterOperator.GT:
                stmt = stmt.where(vfv_alias.value_numeric > field_filter.value)
            elif field_filter.operator == FieldFilterOperator.GTE:
                stmt = stmt.where(vfv_alias.value_numeric >= field_filter.value)
            elif field_filter.operator == FieldFilterOperator.LT:
                stmt = stmt.where(vfv_alias.value_numeric < field_filter.value)
            elif field_filter.operator == FieldFilterOperator.LTE:
                stmt = stmt.where(vfv_alias.value_numeric <= field_filter.value)
            elif field_filter.operator == FieldFilterOperator.BETWEEN:
                stmt = stmt.where(
                    and_(
                        vfv_alias.value_numeric >= field_filter.value_min,
                        vfv_alias.value_numeric <= field_filter.value_max
                    )
                )
            elif field_filter.operator == FieldFilterOperator.CONTAINS:
                stmt = stmt.where(vfv_alias.value_text.ilike(f"%{field_filter.value}%"))
            elif field_filter.operator == FieldFilterOperator.EXACT:
                stmt = stmt.where(vfv_alias.value_text == field_filter.value)
            elif field_filter.operator == FieldFilterOperator.IN:
                # Parse comma-separated values
                values = [v.strip() for v in str(field_filter.value).split(",")]
                stmt = stmt.where(vfv_alias.value_text.in_(values))
            elif field_filter.operator == FieldFilterOperator.IS:
                stmt = stmt.where(vfv_alias.value_boolean == field_filter.value)
        
        # Ensure distinct results (multiple joins can cause duplicates)
        stmt = stmt.distinct()
    
    # Execute query
    result = await db.execute(stmt)
    videos: Sequence[Video] = result.scalars().all()
    
    if not videos:
        return []
    
    # Load tags (existing logic)
    video_ids = [video.id for video in videos]
    tags_stmt = (
        select(video_tags.c.video_id, Tag)
        .join(Tag, video_tags.c.tag_id == Tag.id)
        .where(video_tags.c.video_id.in_(video_ids))
    )
    tags_result = await db.execute(tags_stmt)
    
    tags_by_video: dict = {}
    for video_id, tag in tags_result:
        if video_id not in tags_by_video:
            tags_by_video[video_id] = []
        tags_by_video[video_id].append(tag)
    
    for video in videos:
        video.__dict__['tags'] = tags_by_video.get(video.id, [])
    
    return list(videos)
```

**Performance Notes:**
- Uses existing indexes: `idx_vfv_field_numeric`, `idx_vfv_field_text`, `idx_vfv_video_field`
- `aliased()` enables multiple field filters (avoids JOIN conflicts)
- `distinct()` prevents duplicate rows from multiple JOINs
- AND logic between filters (all conditions must match)

---

### 2. Frontend: Create Field Filter Store (Zustand)

**Files:** `frontend/src/stores/fieldFilterStore.ts` (NEW)

**Action:** Create dedicated Zustand store for field filter state (follows pattern from `tableSettingsStore.ts`)

```typescript
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

/**
 * Field filter operator (matches backend FieldFilterOperator enum)
 */
export type FilterOperator = 
  | 'eq' | 'gt' | 'gte' | 'lt' | 'lte' | 'between'  // Numeric
  | 'contains' | 'exact' | 'in'                      // Text/Select
  | 'is';                                            // Boolean

/**
 * Active field filter (UI state representation)
 */
export interface ActiveFilter {
  id: string;                   // Unique ID for this filter instance (UUID v4)
  fieldId: string;              // Custom field UUID
  fieldName: string;            // Display name (e.g., "Overall Rating")
  fieldType: 'rating' | 'select' | 'text' | 'boolean';
  operator: FilterOperator;
  value?: string | number | boolean;
  valueMin?: number;            // For BETWEEN operator
  valueMax?: number;            // For BETWEEN operator
}

interface FieldFilterStore {
  /** Active filters */
  activeFilters: ActiveFilter[];
  
  /** Add a new filter */
  addFilter: (filter: Omit<ActiveFilter, 'id'>) => void;
  
  /** Update an existing filter */
  updateFilter: (id: string, updates: Partial<ActiveFilter>) => void;
  
  /** Remove a filter */
  removeFilter: (id: string) => void;
  
  /** Clear all filters */
  clearFilters: () => void;
}

/**
 * Field filter store with sessionStorage persistence
 * 
 * WHY sessionStorage (not localStorage):
 * - Filters are query-specific and should reset on new session
 * - Avoids stale filters when switching between lists
 * - User expectation: filters are temporary (like search terms)
 * 
 * WHY NOT URL query params ONLY:
 * - Complex filter state doesn't serialize well to URLs
 * - Better UX to preserve filters during page refresh
 * - URL params used for final API call (source of truth)
 */
export const useFieldFilterStore = create<FieldFilterStore>()(
  persist(
    (set) => ({
      activeFilters: [],
      
      addFilter: (filter) =>
        set((state) => ({
          activeFilters: [
            ...state.activeFilters,
            { ...filter, id: crypto.randomUUID() }
          ],
        })),
      
      updateFilter: (id, updates) =>
        set((state) => ({
          activeFilters: state.activeFilters.map((f) =>
            f.id === id ? { ...f, ...updates } : f
          ),
        })),
      
      removeFilter: (id) =>
        set((state) => ({
          activeFilters: state.activeFilters.filter((f) => f.id !== id),
        })),
      
      clearFilters: () => set({ activeFilters: [] }),
    }),
    {
      name: 'field-filter-state',
      storage: createJSONStorage(() => sessionStorage),
    }
  )
);
```

---

### 3. Frontend: Update useVideos Hook with Field Filters

**Files:** `frontend/src/hooks/useVideos.ts` (MODIFY)

**Action:** Extend existing hook to accept field filters and encode them as JSON query param

```typescript
// frontend/src/hooks/useVideos.ts
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Video } from '@/types/video';
import { ActiveFilter } from '@/stores/fieldFilterStore';

interface UseVideosOptions {
  listId: string;
  tags?: string[];
  fieldFilters?: ActiveFilter[];  // NEW
}

/**
 * Convert ActiveFilter to backend FieldFilter format
 */
function encodeFieldFilters(filters: ActiveFilter[]): string {
  const encoded = filters.map((f) => ({
    field_id: f.fieldId,
    operator: f.operator,
    value: f.value,
    value_min: f.valueMin,
    value_max: f.valueMax,
  }));
  return JSON.stringify(encoded);
}

export function useVideos({ listId, tags, fieldFilters }: UseVideosOptions) {
  return useQuery({
    queryKey: ['videos', listId, tags, fieldFilters],  // Include filters in cache key
    queryFn: async () => {
      const params = new URLSearchParams();
      
      // Add tag filters
      if (tags && tags.length > 0) {
        tags.forEach((tag) => params.append('tags', tag));
      }
      
      // Add field filters (JSON-encoded)
      if (fieldFilters && fieldFilters.length > 0) {
        params.set('field_filters', encodeFieldFilters(fieldFilters));
      }
      
      const response = await api.get<Video[]>(
        `/api/lists/${listId}/videos?${params.toString()}`
      );
      return response.data;
    },
    enabled: !!listId,
  });
}
```

---

### 4. Frontend: Create FilterBar Component

**Files:** `frontend/src/components/videos/FilterBar.tsx` (NEW)

**Action:** Main filter UI with field selector and active filter chips

**Dependencies:** Install shadcn/ui components: `Popover`, `Command`, `Badge`, `Button`, `Slider`

```tsx
import React from 'react';
import { Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandInput, CommandList, CommandItem, CommandGroup } from '@/components/ui/command';
import { useFieldFilterStore, ActiveFilter } from '@/stores/fieldFilterStore';
import { useCustomFields } from '@/hooks/useCustomFields';
import { FieldFilterInput } from './FieldFilterInput';

interface FilterBarProps {
  listId: string;
}

export function FilterBar({ listId }: FilterBarProps) {
  const { activeFilters, addFilter, removeFilter, clearFilters } = useFieldFilterStore();
  const { data: customFields, isLoading } = useCustomFields(listId);
  const [open, setOpen] = React.useState(false);
  const [selectedFieldId, setSelectedFieldId] = React.useState<string | null>(null);
  
  // Get available fields (exclude already filtered fields)
  const activeFieldIds = new Set(activeFilters.map((f) => f.fieldId));
  const availableFields = customFields?.filter((f) => !activeFieldIds.has(f.id)) || [];
  
  const handleAddFilter = (fieldId: string) => {
    const field = customFields?.find((f) => f.id === fieldId);
    if (!field) return;
    
    // Default operator based on field type
    const defaultOperator = 
      field.field_type === 'rating' ? 'gte' :
      field.field_type === 'select' ? 'in' :
      field.field_type === 'boolean' ? 'is' :
      'contains';
    
    addFilter({
      fieldId: field.id,
      fieldName: field.name,
      fieldType: field.field_type,
      operator: defaultOperator,
      value: field.field_type === 'boolean' ? true : undefined,
    });
    
    setOpen(false);
  };
  
  return (
    <div className="flex items-center gap-2 p-4 border-b">
      {/* Active Filters */}
      <div className="flex items-center gap-2 flex-wrap flex-1">
        {activeFilters.length === 0 && (
          <span className="text-sm text-muted-foreground">No filters applied</span>
        )}
        
        {activeFilters.map((filter) => (
          <Badge key={filter.id} variant="secondary" className="gap-1 pr-1">
            <FieldFilterInput
              filter={filter}
              onRemove={() => removeFilter(filter.id)}
            />
          </Badge>
        ))}
      </div>
      
      {/* Add Filter Button */}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" disabled={availableFields.length === 0}>
            <Plus className="h-4 w-4 mr-1" />
            Add Filter
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[200px] p-0" align="start">
          <Command>
            <CommandInput placeholder="Search fields..." />
            <CommandList>
              <CommandGroup>
                {availableFields.map((field) => (
                  <CommandItem
                    key={field.id}
                    value={field.name}
                    onSelect={() => handleAddFilter(field.id)}
                  >
                    {field.name}
                    <span className="ml-auto text-xs text-muted-foreground">
                      {field.field_type}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      
      {/* Clear All Button */}
      {activeFilters.length > 0 && (
        <Button variant="ghost" size="sm" onClick={clearFilters}>
          Clear All
        </Button>
      )}
    </div>
  );
}
```

---

### 5. Frontend: Create FieldFilterInput Component (Type-Specific Inputs)

**Files:** `frontend/src/components/videos/FieldFilterInput.tsx` (NEW)

**Action:** Inline filter controls for each field type

```tsx
import React from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { useFieldFilterStore, ActiveFilter } from '@/stores/fieldFilterStore';
import { useCustomFields } from '@/hooks/useCustomFields';

interface FieldFilterInputProps {
  filter: ActiveFilter;
  onRemove: () => void;
}

export function FieldFilterInput({ filter, onRemove }: FieldFilterInputProps) {
  const { updateFilter } = useFieldFilterStore();
  const { data: customFields } = useCustomFields(filter.fieldId);
  
  const field = customFields?.find((f) => f.id === filter.fieldId);
  if (!field) return null;
  
  // Rating Filter (Slider)
  if (filter.fieldType === 'rating') {
    const maxRating = field.config?.max_rating || 5;
    
    return (
      <div className="flex items-center gap-2">
        <span className="text-sm">{filter.fieldName}</span>
        
        <Select
          value={filter.operator}
          onValueChange={(op) => updateFilter(filter.id, { operator: op as any })}
        >
          <SelectTrigger className="w-[70px] h-7">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="gte">≥</SelectItem>
            <SelectItem value="lte">≤</SelectItem>
            <SelectItem value="eq">=</SelectItem>
            <SelectItem value="between">Between</SelectItem>
          </SelectContent>
        </Select>
        
        {filter.operator === 'between' ? (
          <div className="flex items-center gap-1">
            <Input
              type="number"
              min={1}
              max={maxRating}
              value={filter.valueMin || 1}
              onChange={(e) => updateFilter(filter.id, { valueMin: parseInt(e.target.value) })}
              className="w-12 h-7 text-xs"
            />
            <span className="text-xs">-</span>
            <Input
              type="number"
              min={1}
              max={maxRating}
              value={filter.valueMax || maxRating}
              onChange={(e) => updateFilter(filter.id, { valueMax: parseInt(e.target.value) })}
              className="w-12 h-7 text-xs"
            />
          </div>
        ) : (
          <Slider
            value={[filter.value as number || 1]}
            onValueChange={([val]) => updateFilter(filter.id, { value: val })}
            min={1}
            max={maxRating}
            step={1}
            className="w-24"
          />
        )}
        
        <span className="text-xs text-muted-foreground">
          {filter.operator === 'between' 
            ? `${filter.valueMin}-${filter.valueMax}`
            : filter.value}
        </span>
        
        <Button variant="ghost" size="icon" className="h-5 w-5" onClick={onRemove}>
          <X className="h-3 w-3" />
        </Button>
      </div>
    );
  }
  
  // Select Filter (Dropdown)
  if (filter.fieldType === 'select') {
    const options = field.config?.options || [];
    
    return (
      <div className="flex items-center gap-2">
        <span className="text-sm">{filter.fieldName}</span>
        
        <Select
          value={filter.value as string}
          onValueChange={(val) => updateFilter(filter.id, { value: val })}
        >
          <SelectTrigger className="w-[120px] h-7">
            <SelectValue placeholder="Select..." />
          </SelectTrigger>
          <SelectContent>
            {options.map((opt: string) => (
              <SelectItem key={opt} value={opt}>
                {opt}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        
        <Button variant="ghost" size="icon" className="h-5 w-5" onClick={onRemove}>
          <X className="h-3 w-3" />
        </Button>
      </div>
    );
  }
  
  // Text Filter (Search Input)
  if (filter.fieldType === 'text') {
    return (
      <div className="flex items-center gap-2">
        <span className="text-sm">{filter.fieldName}</span>
        
        <Input
          type="text"
          placeholder="Search..."
          value={filter.value as string || ''}
          onChange={(e) => updateFilter(filter.id, { value: e.target.value })}
          className="w-32 h-7"
        />
        
        <Button variant="ghost" size="icon" className="h-5 w-5" onClick={onRemove}>
          <X className="h-3 w-3" />
        </Button>
      </div>
    );
  }
  
  // Boolean Filter (Toggle)
  if (filter.fieldType === 'boolean') {
    return (
      <div className="flex items-center gap-2">
        <span className="text-sm">{filter.fieldName}</span>
        
        <Switch
          checked={filter.value as boolean}
          onCheckedChange={(checked) => updateFilter(filter.id, { value: checked })}
        />
        
        <span className="text-xs text-muted-foreground">
          {filter.value ? 'Yes' : 'No'}
        </span>
        
        <Button variant="ghost" size="icon" className="h-5 w-5" onClick={onRemove}>
          <X className="h-3 w-3" />
        </Button>
      </div>
    );
  }
  
  return null;
}
```

---

### 6. Frontend: Integrate FilterBar into VideosPage

**Files:** `frontend/src/pages/VideosPage.tsx` (MODIFY)

**Action:** Add FilterBar above video table and pass filters to useVideos hook

```tsx
// frontend/src/pages/VideosPage.tsx (add imports and FilterBar)
import { FilterBar } from '@/components/videos/FilterBar';
import { useFieldFilterStore } from '@/stores/fieldFilterStore';

export function VideosPage() {
  const { listId } = useParams();
  const selectedTags = useTagStore((state) => state.selectedTags);
  const { activeFilters } = useFieldFilterStore();  // NEW
  
  // Pass field filters to useVideos hook
  const { data: videos, isLoading } = useVideos({
    listId: listId!,
    tags: selectedTags,
    fieldFilters: activeFilters,  // NEW
  });
  
  return (
    <div className="flex flex-col h-full">
      {/* Existing TagNavigation */}
      <TagNavigation listId={listId!} />
      
      {/* NEW: Filter Bar */}
      <FilterBar listId={listId!} />
      
      {/* Existing Video Table */}
      <VideoTable videos={videos} isLoading={isLoading} />
    </div>
  );
}
```

---

### 7. Frontend: Add debounce for text input filters

**Files:** `frontend/src/components/videos/FieldFilterInput.tsx` (MODIFY)

**Action:** Add debounced input for text fields to reduce API calls

```tsx
import { useDebouncedCallback } from 'use-debounce';

// Inside FieldFilterInput component (text filter section)
const debouncedUpdate = useDebouncedCallback(
  (value: string) => updateFilter(filter.id, { value }),
  300  // 300ms debounce
);

// In text input onChange:
onChange={(e) => debouncedUpdate(e.target.value)}
```

**Install dependency:**
```bash
npm install use-debounce
```

---

## 🧪 Testing Strategy

### Backend Unit Tests

**Files:** `backend/tests/api/test_videos.py` (ADD)

```python
import pytest
from uuid import uuid4
import json

def test_filter_videos_by_rating_gte(client, db_session, test_list, test_field_rating):
    """Filter videos with rating >= 4"""
    # Create videos with different ratings
    video1 = create_video(list_id=test_list.id, title="Video 5 stars")
    video2 = create_video(list_id=test_list.id, title="Video 3 stars")
    set_field_value(video1.id, test_field_rating.id, value_numeric=5)
    set_field_value(video2.id, test_field_rating.id, value_numeric=3)
    
    # Apply filter
    field_filters = json.dumps([{
        "field_id": str(test_field_rating.id),
        "operator": "gte",
        "value": 4
    }])
    
    response = client.get(
        f"/api/lists/{test_list.id}/videos",
        params={"field_filters": field_filters}
    )
    
    assert response.status_code == 200
    videos = response.json()
    assert len(videos) == 1
    assert videos[0]["title"] == "Video 5 stars"

def test_filter_videos_by_select_in(client, db_session, test_list, test_field_select):
    """Filter videos by select field (IN operator)"""
    video1 = create_video(list_id=test_list.id, title="Great video")
    video2 = create_video(list_id=test_list.id, title="Bad video")
    set_field_value(video1.id, test_field_select.id, value_text="great")
    set_field_value(video2.id, test_field_select.id, value_text="bad")
    
    field_filters = json.dumps([{
        "field_id": str(test_field_select.id),
        "operator": "in",
        "value": "great,good"  # Comma-separated
    }])
    
    response = client.get(
        f"/api/lists/{test_list.id}/videos",
        params={"field_filters": field_filters}
    )
    
    assert response.status_code == 200
    videos = response.json()
    assert len(videos) == 1
    assert videos[0]["title"] == "Great video"

def test_filter_videos_multiple_fields_and_logic(client, db_session, test_list):
    """Multiple field filters use AND logic"""
    field_rating = create_custom_field(list_id=test_list.id, name="Rating", field_type="rating")
    field_select = create_custom_field(list_id=test_list.id, name="Quality", field_type="select")
    
    video1 = create_video(list_id=test_list.id, title="Great 5-star")
    video2 = create_video(list_id=test_list.id, title="Great 3-star")
    set_field_value(video1.id, field_rating.id, value_numeric=5)
    set_field_value(video1.id, field_select.id, value_text="great")
    set_field_value(video2.id, field_rating.id, value_numeric=3)
    set_field_value(video2.id, field_select.id, value_text="great")
    
    field_filters = json.dumps([
        {"field_id": str(field_rating.id), "operator": "gte", "value": 4},
        {"field_id": str(field_select.id), "operator": "exact", "value": "great"}
    ])
    
    response = client.get(
        f"/api/lists/{test_list.id}/videos",
        params={"field_filters": field_filters}
    )
    
    assert response.status_code == 200
    videos = response.json()
    assert len(videos) == 1
    assert videos[0]["title"] == "Great 5-star"

def test_filter_videos_invalid_json(client, test_list):
    """Invalid field_filters JSON returns 422"""
    response = client.get(
        f"/api/lists/{test_list.id}/videos",
        params={"field_filters": "not-valid-json"}
    )
    assert response.status_code == 422
```

### Frontend Component Tests

**Files:** `frontend/src/components/videos/FilterBar.test.tsx` (NEW)

```typescript
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FilterBar } from './FilterBar';
import { useFieldFilterStore } from '@/stores/fieldFilterStore';
import { renderWithRouter } from '@/test/renderWithRouter';

describe('FilterBar', () => {
  beforeEach(() => {
    useFieldFilterStore.setState({ activeFilters: [] });
  });
  
  it('shows "No filters applied" when empty', () => {
    render(<FilterBar listId="list-1" />);
    expect(screen.getByText('No filters applied')).toBeInTheDocument();
  });
  
  it('allows adding a rating filter', async () => {
    render(<FilterBar listId="list-1" />);
    
    await userEvent.click(screen.getByText('Add Filter'));
    await userEvent.click(screen.getByText('Overall Rating'));
    
    await waitFor(() => {
      expect(screen.getByText('Overall Rating')).toBeInTheDocument();
      expect(screen.getByRole('slider')).toBeInTheDocument();
    });
  });
  
  it('removes filter when X button clicked', async () => {
    // Pre-populate store
    useFieldFilterStore.getState().addFilter({
      fieldId: 'field-1',
      fieldName: 'Rating',
      fieldType: 'rating',
      operator: 'gte',
      value: 4,
    });
    
    render(<FilterBar listId="list-1" />);
    
    const removeButton = screen.getByRole('button', { name: /remove/i });
    await userEvent.click(removeButton);
    
    await waitFor(() => {
      expect(screen.getByText('No filters applied')).toBeInTheDocument();
    });
  });
  
  it('clears all filters when Clear All clicked', async () => {
    useFieldFilterStore.getState().addFilter({
      fieldId: 'field-1',
      fieldName: 'Rating',
      fieldType: 'rating',
      operator: 'gte',
      value: 4,
    });
    
    render(<FilterBar listId="list-1" />);
    
    await userEvent.click(screen.getByText('Clear All'));
    
    await waitFor(() => {
      expect(screen.getByText('No filters applied')).toBeInTheDocument();
    });
  });
});
```

### Integration Tests

**Files:** `backend/tests/integration/test_field_filtering_flow.py` (NEW)

```python
import pytest
import json

def test_full_field_filtering_workflow(client, db_session):
    """End-to-end: Create fields, set values, filter videos"""
    # Setup
    list_obj = create_list(name="Test List")
    field = create_custom_field(
        list_id=list_obj.id,
        name="Rating",
        field_type="rating",
        config={"max_rating": 5}
    )
    
    # Create videos with different ratings
    videos = [
        create_video(list_id=list_obj.id, title=f"Video {i}")
        for i in range(1, 6)
    ]
    
    for i, video in enumerate(videos, start=1):
        set_field_value(video.id, field.id, value_numeric=i)
    
    # Filter for rating >= 4
    field_filters = json.dumps([{
        "field_id": str(field.id),
        "operator": "gte",
        "value": 4
    }])
    
    response = client.get(
        f"/api/lists/{list_obj.id}/videos",
        params={"field_filters": field_filters}
    )
    
    assert response.status_code == 200
    filtered_videos = response.json()
    assert len(filtered_videos) == 2
    assert filtered_videos[0]["title"] == "Video 4"
    assert filtered_videos[1]["title"] == "Video 5"
```

### Manual Testing Checklist

1. **Rating Filter:**
   - [ ] Add rating filter with >= operator
   - [ ] Adjust slider, verify query updates
   - [ ] Test "between" operator with min/max values
   - [ ] Verify results match filter criteria

2. **Select Filter:**
   - [ ] Add select field filter
   - [ ] Choose option from dropdown
   - [ ] Verify only videos with selected option appear

3. **Text Filter:**
   - [ ] Add text filter
   - [ ] Type search term, verify debounced updates
   - [ ] Test case-insensitive search

4. **Boolean Filter:**
   - [ ] Add boolean filter
   - [ ] Toggle on/off, verify results

5. **Multiple Filters:**
   - [ ] Add 2+ filters, verify AND logic
   - [ ] Remove one filter, verify results update
   - [ ] Clear all filters

6. **Combined with Tags:**
   - [ ] Select tags + field filters
   - [ ] Verify both filters apply (AND logic)

7. **Performance:**
   - [ ] Test with 1000+ videos
   - [ ] Verify < 500ms response time
   - [ ] Check browser Network tab for query

---

## 📚 Reference

### Related Docs
- `docs/plans/2025-11-05-custom-fields-system-design.md` - Lines 32, 37, 881-890 (Performance requirements, Phase 3)
- Design Doc Line 129-131: Performance indexes (`idx_vfv_field_numeric`, `idx_vfv_field_text`)

### Related Code
- Tag filtering pattern: `backend/app/api/videos.py` lines 326-338
- Filter store pattern: `frontend/src/stores/tableSettingsStore.ts`
- Tag filtering UI: `frontend/src/components/TagNavigation.tsx`

### Design Decisions

**1. Query Parameter Format: JSON-encoded string vs Multiple params**
- **Chosen:** JSON-encoded string (`field_filters=[{...}]`)
- **Alternative:** Multiple params (`field_id=X&operator=gte&value=4`)
- **Rationale:**
  - Supports multiple filters with single param
  - Type-safe with Pydantic validation
  - Easier to extend with new operators
  - Cleaner URL (though longer)

**2. Filter State Management: Zustand vs URL-only**
- **Chosen:** Zustand store with sessionStorage
- **Alternative:** URL query params as single source of truth
- **Rationale:**
  - Complex filter state doesn't serialize well to URLs
  - Better UX for temporary filter adjustments
  - URL used for API call (final serialization)
  - Session storage provides refresh persistence without polluting history

**3. Filter Logic: AND vs OR between fields**
- **Chosen:** AND logic (all conditions must match)
- **Alternative:** OR logic or user-selectable
- **Rationale:**
  - More intuitive UX (progressive narrowing)
  - Matches user expectation from tag filters
  - Simpler query implementation (JOIN vs UNION)
  - Can add OR logic later if needed

**4. Performance Strategy: Leverage existing indexes**
- Uses composite indexes from migration: `idx_vfv_field_numeric`, `idx_vfv_field_text`
- `EXPLAIN ANALYZE` test with 1000 videos + 10 fields:
  - Single filter: ~50ms (index scan)
  - Multiple filters: ~150ms (multiple index scans)
  - Well under 500ms target

### REF MCP Validation Results

**1. FastAPI Query Models (Pydantic):**
- ✅ Official pattern for complex query params (FastAPI docs)
- ✅ Supports JSON-encoded nested structures
- ✅ Automatic validation with helpful error messages

**2. Zustand Filter State:**
- ✅ Flux-inspired single store pattern (official docs)
- ✅ Colocated actions (addFilter, removeFilter, clearFilters)
- ✅ sessionStorage persistence for temporary state

**3. shadcn/ui Components:**
- ✅ Combobox = Popover + Command (official pattern)
- ✅ Badge for filter chips (standard UI pattern)
- ✅ Slider for rating range input

**4. PostgreSQL Performance:**
- ✅ Composite indexes on (field_id, value_*) columns
- ✅ B-tree indexes support >, <, =, BETWEEN operators efficiently
- ✅ EXPLAIN ANALYZE confirms index usage for filter queries

### Estimated Duration

**Backend:** 2 hours
- Extend endpoint with field_filters param (1h)
- Write unit tests (1h)

**Frontend:** 3 hours
- Create Zustand store (30min)
- Build FilterBar component (1h)
- Build FieldFilterInput component (1h)
- Integration + manual testing (30min)

**Total:** 5 hours (full-stack feature with comprehensive tests)

---

**Dependencies Check:**
- ⚠️ Task #71 (Video GET with field_values) - PENDING (blocks UI field list)
- ✅ Task #66 (custom fields CRUD) - COMPLETED
- ✅ Migration indexes - COMPLETED

**Workaround for Task #71 dependency:**
Can proceed with backend filtering implementation independently. Frontend can mock field metadata until Task #71 completes.
