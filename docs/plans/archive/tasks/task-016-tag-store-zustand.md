# Task #16: Create Tag store with Zustand for multi-select filtering

**Plan Task:** #16
**Wave/Phase:** Wave 1 Frontend
**Dependencies:** None (backend tag system already complete)

---

## 🎯 Ziel

Create a Zustand store to manage tag selection state for filtering videos. The store should support multi-select functionality where users can select multiple tags to filter videos with OR logic.

## 📋 Acceptance Criteria

- [ ] Zustand store created with tag state management
- [ ] Multi-select tag filtering implemented (toggle individual tags)
- [ ] Clear all tags functionality
- [ ] Store can hold list of all available tags
- [ ] All tests passing (minimum 3 test cases)
- [ ] TypeScript types properly defined

---

## 🛠️ Implementation Steps

### 1. Create stores directory structure
**Files:** `frontend/src/stores/` (new directory)
**Action:** Create the stores directory if it doesn't exist yet

```bash
mkdir -p frontend/src/stores
```

### 2. Write failing tests first (TDD approach)
**Files:** `frontend/src/stores/tagStore.test.ts`
**Action:** Create comprehensive test suite before implementation

```typescript
import { renderHook, act } from '@testing-library/react';
import { useTagStore } from './tagStore';

describe('useTagStore', () => {
  beforeEach(() => {
    // Reset store before each test
    useTagStore.setState({ tags: [], selectedTagIds: [] });
  });

  it('toggles tag selection', () => {
    const { result } = renderHook(() => useTagStore());

    act(() => {
      result.current.toggleTag('tag-1');
    });

    expect(result.current.selectedTagIds).toEqual(['tag-1']);

    act(() => {
      result.current.toggleTag('tag-1');
    });

    expect(result.current.selectedTagIds).toEqual([]);
  });

  it('can select multiple tags', () => {
    const { result } = renderHook(() => useTagStore());

    act(() => {
      result.current.toggleTag('tag-1');
      result.current.toggleTag('tag-2');
    });

    expect(result.current.selectedTagIds).toEqual(['tag-1', 'tag-2']);
  });

  it('clears all selected tags', () => {
    const { result } = renderHook(() => useTagStore());

    act(() => {
      result.current.toggleTag('tag-1');
      result.current.toggleTag('tag-2');
    });

    expect(result.current.selectedTagIds).toHaveLength(2);

    act(() => {
      result.current.clearTags();
    });

    expect(result.current.selectedTagIds).toEqual([]);
  });

  it('sets tags list', () => {
    const { result } = renderHook(() => useTagStore());

    const mockTags = [
      { id: '1', name: 'Python', color: '#3B82F6', user_id: 'user1', created_at: '2025-01-01', updated_at: '2025-01-01' },
      { id: '2', name: 'Tutorial', color: '#10B981', user_id: 'user1', created_at: '2025-01-01', updated_at: '2025-01-01' },
    ];

    act(() => {
      result.current.setTags(mockTags);
    });

    expect(result.current.tags).toEqual(mockTags);
  });
});
```

### 3. Run tests to verify they fail
**Files:** N/A
**Action:** Confirm TDD red phase

```bash
cd frontend
npm test -- tagStore.test.ts
```

Expected: FAIL - store doesn't exist yet

### 4. Implement Zustand tag store
**Files:** `frontend/src/stores/tagStore.ts`
**Action:** Create the store with all required state and actions

```typescript
import { create } from 'zustand';

export interface Tag {
  id: string;
  name: string;
  color: string | null;
  user_id: string;
  created_at: string;
  updated_at: string;
}

interface TagStore {
  tags: Tag[];
  selectedTagIds: string[];
  setTags: (tags: Tag[]) => void;
  toggleTag: (tagId: string) => void;
  clearTags: () => void;
}

export const useTagStore = create<TagStore>((set) => ({
  tags: [],
  selectedTagIds: [],

  setTags: (tags) => set({ tags }),

  toggleTag: (tagId) => set((state) => ({
    selectedTagIds: state.selectedTagIds.includes(tagId)
      ? state.selectedTagIds.filter(id => id !== tagId)
      : [...state.selectedTagIds, tagId]
  })),

  clearTags: () => set({ selectedTagIds: [] }),
}));
```

### 5. Run tests to verify they pass
**Files:** N/A
**Action:** Confirm TDD green phase

```bash
cd frontend
npm test -- tagStore.test.ts
```

Expected: PASS - all 4 tests passing

### 6. Commit changes
**Files:** `frontend/src/stores/tagStore.ts`, `frontend/src/stores/tagStore.test.ts`
**Action:** Commit with descriptive message

```bash
git add frontend/src/stores/tagStore.ts frontend/src/stores/tagStore.test.ts
git commit -m "feat: add tag store with Zustand

- Tag state management with multi-select
- Toggle individual tags for filtering
- Clear all tags functionality
- setTags to populate from API
- Tests passing (4/4)

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## 🧪 Testing Strategy

**Unit Tests:**
- Toggle tag selection (add and remove)
- Multi-select multiple tags
- Clear all selected tags
- Set tags list from API data

**Integration Tests:**
- Not needed at this stage (will be tested when integrated with TagNavigation component in Task #17)

**Manual Testing:**
Not applicable - pure state management, will be tested in browser when connected to UI components

---

## 📚 Reference

**Related Docs:**
- `docs/plans/2025-10-31-ID-05-ux-optimization-implementation-plan.md` - Task 1.8
- Zustand docs: https://github.com/pmndrs/zustand

**Related Code:**
- Backend Tag API: `backend/app/api/tags.py` (already implemented)
- Tag schemas: `backend/app/schemas/tag.py` (matches Tag interface)

**Design Decisions:**
- Using Zustand instead of Context API for better performance and simpler API
- Multi-select with array of IDs instead of Set for easier JSON serialization
- No persistence needed - filter state is session-only
- `tags` array stores all available tags (populated by API)
- `selectedTagIds` array tracks which tags are currently selected for filtering
