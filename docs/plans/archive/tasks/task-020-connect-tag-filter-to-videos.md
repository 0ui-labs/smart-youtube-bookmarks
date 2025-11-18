Looking at this plan for Task #20, I can see it's well-structured but needs some optimization based on the codebase context. Let me examine the current implementation to provide specific improvements.Now let me check the current tag store implementation to understand the state management:Perfect! Now I have a complete understanding of the current implementation. Let me provide an optimized version of the plan:

# Task #20: Connect Tag Filter State to useVideos Hook (Optimized)

**Plan Task:** #20 (Implementation Plan Task 1.11)
**Wave/Phase:** Wave 1 Frontend
**Dependencies:** Task #16 (Tag Store), Task #17 (TagNavigation Component), Task #19 (TagNavigation Integration)

---

## 🎯 Ziel

Enable video filtering by selected tags in the VideosPage. When users select tags in the TagNavigation sidebar, the videos table should automatically filter to show only videos with ANY of the selected tags (OR logic). The useVideos hook needs to accept tag names as a parameter and pass them to the backend API which already supports tag filtering at `/api/lists/{list_id}/videos` with `tags` query parameters.

**Expected Result:** Clicking tags in sidebar immediately filters videos table without page reload, with proper loading states and query caching.

---

## 📋 Acceptance Criteria

- [ ] `useVideos` hook accepts optional `tagNames` parameter (string array)
- [ ] QueryKey includes `tagNames` for proper cache invalidation
- [ ] VideosPage passes selected tag names from store to useVideos hook  
- [ ] Videos table shows filtered results when tags are selected
- [ ] Clearing tags (via "Filter entfernen" button) shows all videos
- [ ] Loading state displays during filter changes
- [ ] React Query caches results per tag combination
- [ ] Tests passing (unit + integration tests for filtering behavior)
- [ ] Code reviewed (Semgrep + CodeRabbit)
- [ ] Documentation updated (JSDoc for useVideos changes)

---

## 🛠️ Implementation Steps

### 1. Update useVideos Hook to Accept Tag Names Parameter

**Files:** `frontend/src/hooks/useVideos.ts`

**Action:** Modify `useVideos` hook to accept optional `tagNames` parameter and include in queryKey and API call.

**Key Changes:**
- Add `tagNames?: string[]` parameter to existing `useVideos(listId: string)` function
- Update queryKey from `['videos', listId]` to `['videos', listId, tagNames || []]`
- Build query string with URLSearchParams for proper encoding
- Backend expects `/api/lists/{list_id}/videos?tags=A&tags=B` format (NOT the global `/api/videos` endpoint)

**Code:**
```typescript
// frontend/src/hooks/useVideos.ts
// Modify existing useVideos function (around line 35):

/**
 * Fetch videos for a list with optional tag filtering
 *
 * @param listId - UUID of the list to fetch videos from
 * @param tagNames - Optional array of tag names for OR filtering
 * @returns Query result with videos array
 *
 * @example
 * ```tsx
 * // All videos
 * const { data: videos } = useVideos(listId)
 *
 * // Filter by tags (OR logic: videos with Python OR JavaScript)
 * const { data: videos } = useVideos(listId, ['Python', 'JavaScript'])
 * ```
 */
export const useVideos = (listId: string, tagNames?: string[]) => {
  return useQuery({
    queryKey: ['videos', listId, tagNames || []], // Include tags in queryKey for proper caching
    queryFn: async () => {
      // Build query params for tag filtering
      const params = new URLSearchParams()

      // Add multiple 'tags' query params for OR filtering
      // Backend expects: ?tags=Python&tags=JavaScript
      if (tagNames && tagNames.length > 0) {
        tagNames.forEach(tag => params.append('tags', tag))
      }

      const queryString = params.toString()
      const url = `/lists/${listId}/videos${queryString ? `?${queryString}` : ''}`

      const { data } = await api.get<VideoResponse[]>(url)
      return VideoResponseSchema.array().parse(data)
    },
    // Existing options unchanged
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
    staleTime: 5 * 60 * 1000, // 5 minutes - data stays fresh
  })
}

// Note: All other functions (useCreateVideo, useDeleteVideo, etc.) remain unchanged
```

**Why This Approach:**
- **Existing API Compatible:** Uses `/api/lists/{list_id}/videos` endpoint (line 364 in backend/app/api/videos.py), NOT the global `/api/videos` endpoint  
- **QueryKey with Arrays:** React Query handles array serialization correctly for caching
- **URLSearchParams:** Handles encoding and multiple params correctly
- **Backward Compatible:** `tagNames` is optional, existing calls continue to work

**CRITICAL FIX from Original Plan:**
- ❌ Original plan used wrong endpoint (`/api/videos`) 
- ✅ Correct endpoint is `/api/lists/{list_id}/videos` with `tags` query params
- ❌ Original plan missed that backend implementation is in `get_videos_in_list()`, not `list_all_videos()`

---

### 2. Update VideosPage to Pass Selected Tag Names to useVideos

**Files:** `frontend/src/components/VideosPage.tsx`

**Action:** Extract selected tag names from tags array using selectedTagIds, pass to useVideos hook.

**Key Changes:**
- Replace existing `useVideos(listId)` call (around line 66) 
- Add logic to convert selectedTagIds to selectedTagNames
- Pass tagNames to useVideos hook

**Code:**
```typescript
// frontend/src/components/VideosPage.tsx
// Around line 66, replace this line:
// const { data: videos = [], isLoading, error } = useVideos(listId)

// With this updated block:
export const VideosPage = ({ listId, onBack }: VideosPageProps) => {
  // ... existing state ...

  // Tag integration (already exists in current code)
  const { data: tags = [], isLoading: tagsLoading, error: tagsError } = useTags()
  const { selectedTagIds, toggleTag, clearTags } = useTagStore()

  // Compute selected tags (already exists in current code)
  const selectedTags = tags.filter(tag => selectedTagIds.includes(tag.id))

  // NEW: Extract tag names for API filtering
  const selectedTagNames = selectedTags.map(tag => tag.name)

  // UPDATED: Fetch videos filtered by selected tag names
  const { data: videos = [], isLoading, error } = useVideos(
    listId,
    selectedTagNames.length > 0 ? selectedTagNames : undefined
  )

  // ... rest of component unchanged ...
}
```

**Why This Approach:**
- **Reuses Existing Logic:** `selectedTags` computation already exists, just add `.map(tag => tag.name)`
- **Pass undefined for Empty:** Clear API call when no tags selected (cleaner than empty array)
- **Automatic Reactivity:** selectedTagIds change → selectedTagNames recomputes → useVideos refetches → table updates

**Minor Optimization from Original Plan:**
- ✅ No useMemo needed - simple `.map()` is fast enough per React docs
- ✅ Leverage existing `selectedTags` computation instead of recalculating

---

### 3. Update Cache Invalidation in Mutation Hooks

**Files:** `frontend/src/hooks/useVideos.ts`

**Action:** Update `useCreateVideo` and `useDeleteVideo` to invalidate all tag combinations.

**Key Changes:**
- Current invalidation: `['videos', listId]` only invalidates unfiltered cache
- New invalidation: `{ queryKey: ['videos', listId] }` invalidates ALL combinations

**Code:**
```typescript
// frontend/src/hooks/useVideos.ts
// Update useCreateVideo (around line 45):
export const useCreateVideo = (listId: string) => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (videoData: VideoCreate) => {
      const { data } = await api.post<VideoResponse>(
        `/lists/${listId}/videos`,
        videoData
      )
      return data
    },
    onSuccess: () => {
      // UPDATED: Invalidate all tag combinations for this list
      queryClient.invalidateQueries({ queryKey: ['videos', listId] })
    },
  })
}

// Update useDeleteVideo (around line 85):
export const useDeleteVideo = (listId: string) => {
  const queryClient = useQueryClient()

  return useMutation({
    // ... existing mutationFn and onMutate unchanged ...
    onError: (err, _videoId, context) => {
      console.error('Failed to delete video:', err)
      if (context?.previous) {
        queryClient.setQueryData(['videos', listId], context.previous)
      }
    },
    onSettled: () => {
      // UPDATED: Invalidate all tag combinations for this list  
      queryClient.invalidateQueries({ queryKey: ['videos', listId] })
    },
  })
}

// Note: useBulkUploadVideos also needs same update (line ~150)
```

**Why This Change:**
- **React Query Partial Matching:** `{ queryKey: ['videos', listId] }` matches ALL queries starting with those keys
- **Prevents Stale Cache:** After adding/deleting video, all filtered views update correctly
- **Existing Optimistic Updates:** `onMutate` optimistic update remains unchanged

**IMPORTANT FIX from Original Plan:**
- ❌ Original plan missed cache invalidation for mutations
- ✅ Without this, adding/deleting videos won't update filtered views

---

### 4. Add Integration Tests for Tag Filtering Behavior

**Files:** `frontend/src/components/VideosPage.integration.test.tsx`

**Action:** Add test cases for video filtering by tags (OR logic).

**Optimized Test Strategy:**
- Focus on integration behavior rather than implementation details
- Test user flow: click tag → see filtered results → clear → see all results
- Use existing test infrastructure (MSW, testing-library)

**Code:**
```typescript
// frontend/src/components/VideosPage.integration.test.tsx
// Add to existing test suite:

describe('Tag Filtering Integration', () => {
  const mockVideosWithTags = [
    {
      ...mockVideo1,
      title: 'Python Tutorial',
      tags: [{ id: 'tag-1', name: 'Python' }]
    },
    {
      ...mockVideo2, 
      title: 'JavaScript Basics',
      tags: [{ id: 'tag-2', name: 'JavaScript' }]
    },
    {
      ...mockVideo3,
      title: 'React Advanced',
      tags: [{ id: 'tag-2', name: 'JavaScript' }, { id: 'tag-3', name: 'React' }]
    },
  ]

  beforeEach(() => {
    // Mock tags endpoint
    server.use(
      http.get('/api/tags', () => {
        return HttpResponse.json([
          { id: 'tag-1', name: 'Python' },
          { id: 'tag-2', name: 'JavaScript' },
          { id: 'tag-3', name: 'React' },
        ])
      })
    )

    // Mock videos endpoint with tag filtering
    server.use(
      http.get('/api/lists/:listId/videos', ({ request }) => {
        const url = new URL(request.url)
        const tagFilters = url.searchParams.getAll('tags')

        // No filters = all videos
        if (tagFilters.length === 0) {
          return HttpResponse.json(mockVideosWithTags)
        }

        // Filter videos that have ANY of the specified tags (OR logic)
        const filtered = mockVideosWithTags.filter(video =>
          video.tags.some(tag => 
            tagFilters.some(filter => 
              tag.name.toLowerCase() === filter.toLowerCase()
            )
          )
        )
        return HttpResponse.json(filtered)
      })
    )
  })

  it('filters videos when tag is selected', async () => {
    const user = userEvent.setup()

    render(<VideosPage listId={mockListId} onBack={vi.fn()} />)

    // Wait for initial load - all videos visible
    await waitFor(() => {
      expect(screen.getByText('Python Tutorial')).toBeInTheDocument()
      expect(screen.getByText('JavaScript Basics')).toBeInTheDocument() 
      expect(screen.getByText('React Advanced')).toBeInTheDocument()
    })

    // Click Python tag
    const pythonTag = screen.getByRole('button', { name: /python/i })
    await user.click(pythonTag)

    // Wait for filtered results - only Python video visible
    await waitFor(() => {
      expect(screen.getByText('Python Tutorial')).toBeInTheDocument()
      expect(screen.queryByText('JavaScript Basics')).not.toBeInTheDocument()
      expect(screen.queryByText('React Advanced')).not.toBeInTheDocument()
    })

    // Header should show filter status
    expect(screen.getByText(/Gefiltert nach: Python/)).toBeInTheDocument()
  })

  it('shows all videos when filter is cleared', async () => {
    const user = userEvent.setup()

    render(<VideosPage listId={mockListId} onBack={vi.fn()} />)

    // Select a tag first
    const pythonTag = screen.getByRole('button', { name: /python/i })
    await user.click(pythonTag)

    // Wait for filtered state
    await waitFor(() => {
      expect(screen.queryByText('JavaScript Basics')).not.toBeInTheDocument()
    })

    // Click "Filter entfernen"
    const clearButton = screen.getByRole('button', { name: /filter entfernen/i })
    await user.click(clearButton)

    // All videos should reappear
    await waitFor(() => {
      expect(screen.getByText('Python Tutorial')).toBeInTheDocument()
      expect(screen.getByText('JavaScript Basics')).toBeInTheDocument()
      expect(screen.getByText('React Advanced')).toBeInTheDocument()
    })

    // Filter status should be gone
    expect(screen.queryByText(/Gefiltert nach:/)).not.toBeInTheDocument()
  })

  it('handles multiple tag selection with OR logic', async () => {
    const user = userEvent.setup()

    render(<VideosPage listId={mockListId} onBack={vi.fn()} />)

    // Select Python and React tags
    const pythonTag = screen.getByRole('button', { name: /python/i })
    const reactTag = screen.getByRole('button', { name: /react/i })
    
    await user.click(pythonTag)
    await user.click(reactTag)

    // Should show videos with Python OR React (2 videos)
    await waitFor(() => {
      expect(screen.getByText('Python Tutorial')).toBeInTheDocument()    