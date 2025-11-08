# Task #95: Write Frontend Component Tests (TagEditDialog Extension, CustomFieldsPreview, FieldDisplay)

**Status:** Planning Complete
**Priority:** P1 (Custom Fields MVP - Phase 1 Frontend)
**Estimated Time:** 6-8 hours
**Dependencies:**
- Task #82-94 (Frontend components must be implemented first)
- Task #89 (CustomFieldsPreview component)
- Task #90 (FieldDisplay component)
- Task #82 (TagEditDialog schema selector extension)

**Related Files:**
- Design Doc: `/Users/philippbriese/Documents/dev/projects/by IDE/Claude Code/Smart Youtube Bookmarks/docs/plans/2025-11-05-custom-fields-system-design.md` (lines 656-706)
- Existing Test Patterns: `frontend/src/components/VideoCard.test.tsx`, `frontend/src/components/TableSettingsDropdown.test.tsx`
- Test Helper: `frontend/src/test/renderWithRouter.tsx`

---

## 🎯 Goal

Write comprehensive unit and integration tests for three critical custom fields UI components:

1. **TagEditDialog Extension** - Schema selector dropdown with "No Schema", "Existing Schema", and "Create New" modes
2. **CustomFieldsPreview** - Inline field display on VideoCard (max 3 fields, "More fields" indicator)
3. **FieldDisplay** - Type-specific field renderers (Rating, Select, Boolean, Text)

**Scope:** This task focuses ONLY on writing tests. Components are assumed to be implemented in Tasks #82-94.

**Out of Scope:**
- Component implementation (already done in prior tasks)
- Integration test for full create tag+schema+field flow (Task #96)
- Backend API testing (covered in Task #76-77)

---

## 📋 Acceptance Criteria

### General
- [ ] All 60+ tests passing with Vitest
- [ ] Test coverage ≥90% for target components
- [ ] TypeScript strict mode compliance (no `any` types in tests)
- [ ] Follows existing test patterns (renderWithRouter, userEvent, MSW)
- [ ] Tests use React Testing Library best practices (user interactions, not implementation details)
- [ ] REF MCP validation for testing patterns completed
- [ ] No console errors or warnings during test run
- [ ] Tests are deterministic (no flaky tests)

### TagEditDialog Extension Tests (15+ tests)
- [ ] Schema selector dropdown renders with correct options
- [ ] "Kein Schema" (No Schema) selection sets schema_id to null
- [ ] Existing schema selection updates form state with UUID
- [ ] "+ Neues Schema erstellen" selection triggers inline editor (placeholder test)
- [ ] Form submission includes schema_id in API request
- [ ] Schema dropdown is keyboard navigable (Arrow keys, Enter)
- [ ] Existing tag edit mode shows currently bound schema
- [ ] Schema change updates tag correctly (PUT request)
- [ ] Error handling for schema loading failure
- [ ] Backwards compatibility (tags without schema_id still work)

### CustomFieldsPreview Tests (20+ tests)
- [ ] Renders nothing when no field values provided
- [ ] Renders nothing when all fields have show_on_card=false
- [ ] Displays max 3 fields even when more have show_on_card=true
- [ ] Shows "More fields" indicator when total > 3 (with correct count)
- [ ] "More fields" badge calls onMoreClick handler
- [ ] Event propagation prevented on "More fields" click (doesn't trigger video click)
- [ ] Rating field renders with stars and correct value
- [ ] Select field renders as badge with correct value
- [ ] Boolean field renders as checkbox with correct state
- [ ] Text field renders truncated snippet
- [ ] Inline editing calls onChange with correct field_id and value
- [ ] Optimistic update mutates query cache immediately
- [ ] Error rollback restores previous cache state
- [ ] Null values handled gracefully for all field types
- [ ] Loading state displayed during mutation
- [ ] Multiple field edits in sequence work correctly

### FieldDisplay Tests (25+ tests)
- [ ] Rating type: renders RatingStars with correct max_rating
- [ ] Rating type: click changes value, onChange called with number
- [ ] Rating type: keyboard navigation (Arrow keys) works
- [ ] Rating type: hover preview shows filled stars
- [ ] Rating type: read-only mode prevents editing
- [ ] Select type: renders SelectBadge with current value
- [ ] Select type: dropdown opens with all options
- [ ] Select type: selection calls onChange with string
- [ ] Select type: checkmark shows on selected option
- [ ] Select type: keyboard navigation works
- [ ] Boolean type: renders checkbox with correct checked state
- [ ] Boolean type: click toggles value, onChange called with boolean
- [ ] Boolean type: Space key toggles checkbox
- [ ] Boolean type: label displays field name correctly
- [ ] Text type: short text displays without truncation
- [ ] Text type: long text truncates with ellipsis
- [ ] Text type: expand button appears when truncated
- [ ] Text type: onExpand callback fires when expand clicked
- [ ] Text type: inline input works in editable mode
- [ ] Text type: maxLength enforced on input
- [ ] Null values handled for all field types
- [ ] Custom className applied to wrapper
- [ ] Read-only default when onChange omitted
- [ ] Component does NOT crash with invalid field type (error boundary)

---

## 🛠️ Implementation Steps

### Step 1: REF MCP Validation for React Testing Library Best Practices

**Action:** Research latest 2024 best practices before writing tests

**REF MCP Queries:**
1. React Testing Library 2024 best practices (query priorities, user interactions)
2. Vitest component testing patterns (setup, mocking, async handling)
3. @testing-library/user-event v14 API (setup, async methods)
4. MSW (Mock Service Worker) v2 for API mocking
5. Testing Radix UI components (DropdownMenu, Select, Dialog)

**Expected Findings:**
- Query priority: `getByRole` > `getByLabelText` > `getByText` > `getByTestId`
- User interactions: Always use `userEvent.setup()` + `await user.click()` (not `fireEvent`)
- Async: Use `waitFor()` for assertions that depend on async state changes
- MSW: Use `http` handlers (not `rest` - deprecated in v2)
- Mocking: Prefer MSW for API, `vi.mock()` for modules

**Deliverable:** Document 5-10 key best practices to follow

---

### Step 2: Setup Test Utilities and Mocks

**Files:**
- `frontend/src/test/mockData.ts` (NEW)
- `frontend/src/test/mswHandlers.ts` (NEW)

**Action:** Create reusable test data and API mocks

#### 2.1 Create Mock Data Factory

**File:** `frontend/src/test/mockData.ts`

```typescript
import type { VideoResponse, VideoFieldValue } from '@/types/video'
import type { Tag } from '@/types/tag'
import type { FieldSchema } from '@/hooks/useSchemas'

/**
 * Factory functions for creating test data
 *
 * Pattern: Each factory creates a complete object with sensible defaults,
 * accepts partial overrides for test-specific customization.
 */

export const createMockVideo = (overrides?: Partial<VideoResponse>): VideoResponse => ({
  id: 'video-123',
  list_id: 'list-456',
  youtube_id: 'dQw4w9WgXcQ',
  title: 'Test Video Title',
  channel: 'Test Channel',
  duration: 240,
  thumbnail_url: 'https://img.youtube.com/vi/dQw4w9WgXcQ/maxresdefault.jpg',
  published_at: '2025-01-01T00:00:00Z',
  tags: [],
  field_values: [],
  processing_status: 'completed',
  error_message: null,
  created_at: '2025-01-01T00:00:00Z',
  updated_at: '2025-01-01T00:00:00Z',
  ...overrides,
})

export const createMockTag = (overrides?: Partial<Tag>): Tag => ({
  id: 'tag-123',
  name: 'Test Tag',
  color: '#3B82F6',
  schema_id: null,
  user_id: 'user-123',
  created_at: '2025-01-01T00:00:00Z',
  updated_at: '2025-01-01T00:00:00Z',
  ...overrides,
})

export const createMockFieldSchema = (overrides?: Partial<FieldSchema>): FieldSchema => ({
  id: 'schema-123',
  list_id: 'list-456',
  name: 'Video Quality',
  description: 'Standard video quality metrics',
  created_at: '2025-01-01T00:00:00Z',
  updated_at: '2025-01-01T00:00:00Z',
  ...overrides,
})

// Field value factories with discriminated unions
export const createMockRatingField = (overrides?: Partial<VideoFieldValue>): VideoFieldValue => ({
  field_id: 'rating-123',
  field: {
    name: 'Overall Rating',
    field_type: 'rating',
    config: { max_rating: 5 },
  },
  value: 4,
  schema_name: 'Video Quality',
  show_on_card: true,
  ...overrides,
} as VideoFieldValue)

export const createMockSelectField = (overrides?: Partial<VideoFieldValue>): VideoFieldValue => ({
  field_id: 'select-456',
  field: {
    name: 'Presentation',
    field_type: 'select',
    config: { options: ['bad', 'good', 'great'] },
  },
  value: 'great',
  schema_name: 'Video Quality',
  show_on_card: true,
  ...overrides,
} as VideoFieldValue)

export const createMockBooleanField = (overrides?: Partial<VideoFieldValue>): VideoFieldValue => ({
  field_id: 'bool-789',
  field: {
    name: 'Verified',
    field_type: 'boolean',
    config: {},
  },
  value: true,
  schema_name: 'Metadata',
  show_on_card: true,
  ...overrides,
} as VideoFieldValue)

export const createMockTextField = (overrides?: Partial<VideoFieldValue>): VideoFieldValue => ({
  field_id: 'text-101',
  field: {
    name: 'Notes',
    field_type: 'text',
    config: { max_length: 200 },
  },
  value: 'Great tutorial',
  schema_name: 'Metadata',
  show_on_card: true,
  ...overrides,
} as VideoFieldValue)
```

**Why Factory Functions:**
- Reduces test boilerplate (don't repeat full objects in every test)
- Centralized test data means easier updates when types change
- Partial overrides allow test-specific customization
- Follows existing pattern from `VideosPage.integration.test.tsx` lines 24-38

---

#### 2.2 Create MSW API Handlers

**File:** `frontend/src/test/mswHandlers.ts`

```typescript
import { http, HttpResponse } from 'msw'
import { createMockFieldSchema } from './mockData'

/**
 * Mock Service Worker (MSW) handlers for API mocking
 *
 * Pattern: Use http.get/post/put/delete (MSW v2 API)
 * Returns HttpResponse.json() with mock data
 */

export const handlers = [
  // GET /api/lists/:listId/schemas - List schemas
  http.get('/api/lists/:listId/schemas', () => {
    return HttpResponse.json([
      createMockFieldSchema({ id: 'schema-1', name: 'Video Quality' }),
      createMockFieldSchema({ id: 'schema-2', name: 'Content Rating' }),
    ])
  }),

  // POST /api/lists/:listId/tags - Create tag with schema_id
  http.post('/api/lists/:listId/tags', async ({ request }) => {
    const body = await request.json()
    return HttpResponse.json({
      id: 'new-tag-123',
      ...body,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
  }),

  // PUT /api/videos/:videoId/fields/:fieldId - Update field value
  http.put('/api/videos/:videoId/fields/:fieldId', async ({ request, params }) => {
    const body = await request.json()
    return HttpResponse.json({
      field_id: params.fieldId,
      value: body.value,
      updated_at: new Date().toISOString(),
    })
  }),
]
```

**Why MSW:**
- Intercepts real HTTP requests (more realistic than mocking axios directly)
- Reusable across all tests (setup once in vitest.setup.ts)
- Supports error scenarios (return HttpResponse.error() for 500s)
- Follows existing project pattern (if MSW already installed)

---

### Step 3: Write TagEditDialog Extension Tests

**File:** `frontend/src/components/TagEditDialog.customfields.test.tsx` (NEW)

**Test Suite Structure:**
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithRouter } from '@/test/renderWithRouter'
import { TagEditDialog } from './TagEditDialog'
import { createMockTag, createMockFieldSchema } from '@/test/mockData'

// Mock useSchemas hook
vi.mock('@/hooks/useSchemas', () => ({
  useSchemas: vi.fn(() => ({
    data: [
      createMockFieldSchema({ id: 'schema-1', name: 'Video Quality' }),
      createMockFieldSchema({ id: 'schema-2', name: 'Content Rating' }),
    ],
    isLoading: false,
    error: null,
  })),
}))

describe('TagEditDialog - Schema Selector Extension (Task #82)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Schema Selector Rendering', () => {
    it('renders schema selector dropdown below color picker', () => {
      // Test implementation
    })

    it('shows "Kein Schema" as first option', () => {
      // Test implementation
    })

    it('shows existing schemas in dropdown', () => {
      // Test implementation
    })

    it('shows "+ Neues Schema erstellen" as last option', () => {
      // Test implementation
    })
  })

  describe('Schema Selection Behavior', () => {
    it('defaults to "Kein Schema" (schema_id: null) for new tags', () => {
      // Test implementation
    })

    it('updates form state when existing schema selected', async () => {
      // Test implementation
    })

    it('sets schema_id to null when "Kein Schema" selected', async () => {
      // Test implementation
    })

    it('triggers inline schema editor when "+ Neues Schema" selected', async () => {
      // Placeholder test - full implementation in Task #83
      // Just verify state change to 'new' mode
    })
  })

  describe('Form Submission with Schema', () => {
    it('includes schema_id in POST request when creating tag', async () => {
      // Test implementation with MSW verification
    })

    it('omits schema_id when "Kein Schema" selected (backwards compatible)', async () => {
      // Test implementation
    })

    it('includes schema_id in PUT request when editing tag', async () => {
      // Test implementation
    })
  })

  describe('Keyboard Accessibility', () => {
    it('opens schema dropdown with Enter key', async () => {
      // Test implementation
    })

    it('navigates options with Arrow keys', async () => {
      // Test implementation
    })

    it('selects option with Enter key', async () => {
      // Test implementation
    })
  })

  describe('Error Handling', () => {
    it('shows error message when schema loading fails', () => {
      // Mock useSchemas to return error state
      // Test implementation
    })

    it('disables schema dropdown when schemas are loading', () => {
      // Mock useSchemas to return isLoading: true
      // Test implementation
    })
  })

  describe('Backwards Compatibility', () => {
    it('renders correctly for tag without schema_id (existing tags)', () => {
      // Test with createMockTag({ schema_id: null })
      // Test implementation
    })
  })
})
```

**Estimated Test Count:** 15 tests

**Key Testing Patterns:**
- Use `renderWithRouter()` for dialog with React Router context
- Mock `useSchemas` hook with `vi.mock()` at file level
- Use `userEvent.setup()` + `await user.click()` for interactions
- Verify API requests with MSW spy or manual request capture
- Test keyboard navigation with `await user.keyboard('{ArrowDown}{Enter}')`

---

### Step 4: Write CustomFieldsPreview Tests

**File:** `frontend/src/components/fields/CustomFieldsPreview.test.tsx` (NEW)

**Test Suite Structure:**
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { CustomFieldsPreview } from './CustomFieldsPreview'
import {
  createMockRatingField,
  createMockSelectField,
  createMockBooleanField,
  createMockTextField,
} from '@/test/mockData'

// Mock useUpdateFieldValue hook
vi.mock('@/hooks/useVideoFieldValues', () => ({
  useUpdateFieldValue: vi.fn(() => ({
    mutate: vi.fn(),
    isPending: false,
    isError: false,
  })),
}))

const renderWithQuery = (component: React.ReactElement) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>{component}</QueryClientProvider>
  )
}

describe('CustomFieldsPreview (Task #89)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Rendering Logic', () => {
    it('renders nothing when no field values provided', () => {
      // Test implementation
    })

    it('renders nothing when all fields have show_on_card=false', () => {
      // Test implementation
    })

    it('displays max 3 fields when more than 3 have show_on_card=true', () => {
      // Test with 5 fields, verify only 3 rendered
    })

    it('shows all fields when less than 3 have show_on_card=true', () => {
      // Test with 2 fields
    })
  })

  describe('"More Fields" Indicator', () => {
    it('shows "+X more" badge when total fields > 3', () => {
      // Test with 5 fields, verify "+2 more" badge
    })

    it('does not show "More" badge when total fields <= 3', () => {
      // Test implementation
    })

    it('calls onMoreClick when "More" badge is clicked', async () => {
      // Test implementation
    })

    it('prevents event propagation on "More" badge click', async () => {
      // Test with parent onClick handler, verify not called
    })
  })

  describe('Field Type Rendering', () => {
    it('renders rating field with stars', () => {
      // Test implementation
    })

    it('renders select field with badge', () => {
      // Test implementation
    })

    it('renders boolean field with checkbox', () => {
      // Test implementation
    })

    it('renders text field with snippet', () => {
      // Test implementation
    })
  })

  describe('Inline Editing', () => {
    it('calls onChange with correct videoId, fieldId, and value', async () => {
      // Test star click, verify mutation called with correct params
    })

    it('updates rating field value on star click', async () => {
      // Test implementation
    })

    it('updates select field value on dropdown selection', async () => {
      // Test implementation
    })

    it('updates boolean field value on checkbox toggle', async () => {
      // Test implementation
    })

    it('updates text field value on input change', async () => {
      // Test implementation
    })
  })

  describe('Optimistic Updates', () => {
    it('immediately updates UI before API response', async () => {
      // Test implementation with controlled query cache
    })

    it('rolls back on error', async () => {
      // Mock mutation to fail, verify rollback
    })
  })

  describe('Edge Cases', () => {
    it('handles null values gracefully for all field types', () => {
      // Test with all null values
    })

    it('handles missing field config gracefully', () => {
      // Test with incomplete field data
    })
  })
})
```

**Estimated Test Count:** 20 tests

**Key Testing Patterns:**
- Wrap in `QueryClientProvider` for React Query mutations
- Mock `useUpdateFieldValue` hook at file level
- Test optimistic updates by inspecting query cache state
- Use `waitFor()` for async mutation completion
- Test event propagation with parent click handlers

---

### Step 5: Write FieldDisplay Tests

**File:** `frontend/src/components/fields/FieldDisplay.test.tsx` (NEW)

**Test Suite Structure:**
```typescript
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { FieldDisplay } from './FieldDisplay'
import type { CustomField } from '@/types/customField'

describe('FieldDisplay (Task #90)', () => {
  describe('Rating Field Type', () => {
    const ratingField: CustomField = {
      id: 'field-1',
      list_id: 'list-1',
      name: 'Overall Rating',
      field_type: 'rating',
      config: { max_rating: 5 },
      created_at: '2025-01-01T00:00:00Z',
      updated_at: '2025-01-01T00:00:00Z',
    }

    it('renders RatingStars component', () => {
      // Test implementation
    })

    it('passes max_rating from config to RatingStars', () => {
      // Test implementation
    })

    it('calls onChange with number value on star click', async () => {
      // Test implementation
    })

    it('supports keyboard navigation (Arrow keys)', async () => {
      // Test implementation
    })

    it('shows hover preview in editable mode', async () => {
      // Test implementation
    })

    it('renders read-only when onChange omitted', () => {
      // Test implementation
    })
  })

  describe('Select Field Type', () => {
    // 6 tests for select field (similar structure)
  })

  describe('Boolean Field Type', () => {
    // 4 tests for boolean field
  })

  describe('Text Field Type', () => {
    // 5 tests for text field
  })

  describe('Edge Cases', () => {
    it('handles null values for all field types', () => {
      // Test with null values
    })

    it('applies custom className to wrapper', () => {
      // Test implementation
    })

    it('defaults to read-only when onChange not provided', () => {
      // Test implementation
    })

    it('does not crash with unknown field type', () => {
      // Test with invalid field_type (should render error or fallback)
    })
  })
})
```

**Estimated Test Count:** 25 tests

**Key Testing Patterns:**
- Test each field type in separate describe block
- Use `createMockCustomField()` helper for type-specific fields
- Verify correct sub-component rendered with `screen.getByRole()`
- Test onChange callbacks with correct value types (number, string, boolean)
- Test keyboard interactions with `await user.keyboard()`

---

### Step 6: Run All Tests and Fix Failures

**Action:** Execute test suite and fix any issues

**Command:**
```bash
cd frontend
npm test -- --run CustomFieldsPreview FieldDisplay TagEditDialog
```

**Expected Output:**
```
✓ TagEditDialog - Schema Selector Extension (15 tests)
✓ CustomFieldsPreview (20 tests)
✓ FieldDisplay (25 tests)

Tests: 60 passed
Time: ~15s
```

**Debugging Strategy:**
1. If test fails with "Unable to find element":
   - Check query priority (prefer getByRole over getByText)
   - Verify component actually renders (use `screen.debug()`)
   - Check for async issues (add `await waitFor()`)

2. If test fails with "TypeError: Cannot read property":
   - Check mock data completeness (all required fields present?)
   - Verify hook mocks return correct shape
   - Check TypeScript types match runtime data

3. If test is flaky (sometimes passes, sometimes fails):
   - Add `await waitFor()` for async state changes
   - Use `userEvent.setup()` at test start (not global)
   - Clear mocks in `beforeEach()` (prevent test pollution)

4. If "Warning: ReactDOM.render is no longer supported":
   - Check React 18 compatibility
   - Use `renderWithRouter()` helper (already React 18 compatible)

---

### Step 7: Check Test Coverage

**Action:** Generate coverage report and verify ≥90% coverage

**Command:**
```bash
npm test -- --coverage CustomFieldsPreview FieldDisplay TagEditDialog
```

**Expected Coverage Report:**
```
File                              | % Stmts | % Branch | % Funcs | % Lines
----------------------------------|---------|----------|---------|--------
CustomFieldsPreview.tsx           |   95.2  |   91.7   |  100.0  |   94.8
FieldDisplay.tsx                  |   94.1  |   87.5   |  100.0  |   93.6
TagEditDialog.tsx (extension)     |   88.9  |   83.3   |   92.3  |   88.5
----------------------------------|---------|----------|---------|--------
All files                         |   92.7  |   87.5   |   97.4  |   92.3
```

**Coverage Gaps to Address:**
- If % Branch < 90: Add tests for edge cases (null checks, error paths)
- If % Funcs < 100: Add tests calling uncovered callbacks
- If % Lines < 90: Check for untested conditional branches

---

### Step 8: Manual Testing Checklist

**Browser Testing (http://localhost:5173):**

**TagEditDialog Extension:**
- [ ] Open "New Tag" dialog - schema dropdown present below color picker
- [ ] Dropdown shows "Kein Schema", existing schemas, "+ Neues Schema"
- [ ] Select existing schema - form state updates
- [ ] Create tag with schema - API call includes schema_id
- [ ] Edit existing tag with schema - current schema pre-selected
- [ ] Keyboard navigation works (Tab, Arrow keys, Enter)
- [ ] VoiceOver/NVDA announces schema selector correctly

**CustomFieldsPreview on VideoCard:**
- [ ] Card with 0 custom fields - no preview section
- [ ] Card with 1-3 fields - all displayed correctly
- [ ] Card with 5+ fields - only 3 visible + "+X more" badge
- [ ] Click star rating - immediate update (optimistic)
- [ ] Click select dropdown - value changes
- [ ] Click checkbox - toggles state
- [ ] Edit text field - input appears inline
- [ ] Click "+2 more" badge - modal opens (or console log for now)
- [ ] Network throttle to Slow 3G - optimistic updates still instant

**FieldDisplay Component:**
- [ ] Rating field: stars render correctly (1-10 max_rating)
- [ ] Rating field: hover preview shows filled stars
- [ ] Rating field: keyboard navigation changes value
- [ ] Select field: badge shows current value
- [ ] Select field: dropdown opens with options
- [ ] Boolean field: checkbox reflects true/false state
- [ ] Boolean field: Space key toggles checkbox
- [ ] Text field: long text truncates with "..."
- [ ] Text field: expand button appears when truncated
- [ ] Read-only mode prevents all editing

---

### Step 9: Update CLAUDE.md

**File:** `CLAUDE.md`

**Action:** Document test patterns in Testing Patterns section

**Addition:**
```markdown
### Custom Fields Component Testing

**Test Files:**
- `frontend/src/components/fields/CustomFieldsPreview.test.tsx` - Inline field preview tests
- `frontend/src/components/fields/FieldDisplay.test.tsx` - Type-specific renderer tests
- `frontend/src/components/TagEditDialog.customfields.test.tsx` - Schema selector tests

**Test Utilities:**
- `frontend/src/test/mockData.ts` - Factory functions for test data
- `frontend/src/test/mswHandlers.ts` - MSW API mock handlers

**Test Patterns:**
- Use `renderWithRouter()` for components with React Router
- Use `QueryClientProvider` wrapper for React Query mutations
- Mock hooks with `vi.mock()` at file level (not inline)
- Test user interactions with `userEvent.setup()` + `await user.click()`
- Verify optimistic updates by inspecting query cache state
- Test keyboard navigation with `await user.keyboard('{ArrowDown}{Enter}')`
- Use factory functions from `mockData.ts` for consistent test data
```

---

### Step 10: Git Commit

**Action:** Commit tests with comprehensive message

**Command:**
```bash
git add frontend/src/components/fields/*.test.tsx frontend/src/components/TagEditDialog.customfields.test.tsx frontend/src/test/mockData.ts frontend/src/test/mswHandlers.ts CLAUDE.md
git commit -m "test(custom-fields): add comprehensive component tests for TagEditDialog, CustomFieldsPreview, FieldDisplay

Task #95: Write frontend component tests for custom fields MVP

IMPLEMENTATION:
- TagEditDialog.customfields.test.tsx: 15 tests for schema selector extension
- CustomFieldsPreview.test.tsx: 20 tests for inline field preview with optimistic updates
- FieldDisplay.test.tsx: 25 tests for type-specific field renderers
- mockData.ts: Factory functions for reusable test data (videos, tags, fields)
- mswHandlers.ts: MSW v2 API mock handlers for HTTP requests

COVERAGE:
- 60 total tests (all passing)
- Test coverage ≥90% for all target components
- All field types covered (rating, select, boolean, text)
- Edge cases: null values, empty states, error handling
- Keyboard navigation and accessibility verified

TEST PATTERNS FOLLOWED:
- React Testing Library best practices (query priorities, user interactions)
- userEvent v14 API (setup() + async methods)
- Vitest component testing (renderWithRouter, QueryClientProvider)
- MSW v2 for API mocking (http handlers, not deprecated rest)
- Factory functions for DRY test data
- beforeEach cleanup to prevent test pollution

REF MCP VALIDATIONS:
- Query priority: getByRole > getByLabelText > getByText > getByTestId
- User interactions: userEvent.setup() + await user.click() (not fireEvent)
- Async assertions: waitFor() for state changes
- Accessibility: ARIA labels and keyboard navigation tested
- Optimistic updates: Query cache inspection for instant UI updates

TESTING SCOPE:
- TagEditDialog: Schema selector dropdown with 3 modes (none, existing, new)
- CustomFieldsPreview: Max 3 fields on card, "More fields" indicator, inline editing
- FieldDisplay: Type-specific renderers for rating/select/boolean/text fields
- Edge cases: null values, loading states, error rollback, event propagation

MANUAL TESTING:
- Browser testing checklist completed (Chrome, Firefox, Safari)
- VoiceOver/NVDA screen reader compatibility verified
- Keyboard-only navigation works (Tab, Arrow keys, Enter, Space)
- Optimistic updates instant even with throttled network
- All interactive elements accessible and functional

DEPENDENCIES:
- @testing-library/react v14
- @testing-library/user-event v14
- vitest (existing)
- msw v2 (if not installed: npm install -D msw@latest)

NEXT STEPS:
- Task #96: Integration test for full create tag+schema+field+set value flow
- Manual E2E testing in browser with real backend
- Playwright E2E tests (future enhancement)

🤖 Generated with Claude Code (https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## 🧪 Testing Strategy

### Test Pyramid
- **Unit Tests:** 60 tests (TagEditDialog 15, CustomFieldsPreview 20, FieldDisplay 25)
- **Integration Tests:** Task #96 (separate plan, full workflow test)
- **E2E Tests:** Manual browser testing (automated E2E future enhancement)

### Test Organization
```
frontend/src/
├── components/
│   ├── fields/
│   │   ├── CustomFieldsPreview.test.tsx (20 tests)
│   │   ├── FieldDisplay.test.tsx (25 tests)
│   │   ├── RatingStars.test.tsx (already in Task #90)
│   │   ├── SelectBadge.test.tsx (already in Task #90)
│   │   ├── BooleanCheckbox.test.tsx (already in Task #90)
│   │   └── TextSnippet.test.tsx (already in Task #90)
│   └── TagEditDialog.customfields.test.tsx (15 tests)
└── test/
    ├── mockData.ts (factory functions)
    ├── mswHandlers.ts (API mocks)
    └── renderWithRouter.tsx (existing helper)
```

### Coverage Targets
- **Line Coverage:** ≥90% for CustomFieldsPreview, FieldDisplay, TagEditDialog extension
- **Branch Coverage:** ≥85% (conditional logic, edge cases)
- **Function Coverage:** 100% (all callbacks tested)

### Testing Tools
- **Vitest:** Test runner (existing in project)
- **@testing-library/react:** Component testing (existing)
- **@testing-library/user-event:** User interaction simulation (existing)
- **MSW (Mock Service Worker):** API mocking (check if installed, add if missing)
- **renderWithRouter:** Custom helper for React Router context (existing)

---

## 📚 Reference

### Related Docs
- **Design Doc:** `docs/plans/2025-11-05-custom-fields-system-design.md` (lines 656-706)
- **REF MCP:** React Testing Library docs, Vitest component testing guide
- **Existing Tests:** `VideoCard.test.tsx`, `TableSettingsDropdown.test.tsx`, `VideosPage.integration.test.tsx`

### Related Code
- **Components to Test:**
  - `frontend/src/components/fields/CustomFieldsPreview.tsx` (Task #89)
  - `frontend/src/components/fields/FieldDisplay.tsx` (Task #90)
  - `frontend/src/components/TagEditDialog.tsx` (Task #82 extension)

- **Test Helpers:**
  - `frontend/src/test/renderWithRouter.tsx` (existing)
  - `frontend/src/test/mockData.ts` (to be created)

- **Similar Test Patterns:**
  - `frontend/src/components/VideoCard.test.tsx` (lines 1-159)
  - `frontend/src/components/TableSettingsDropdown.test.tsx` (lines 1-408)
  - `frontend/src/components/ConfirmDeleteModal.test.tsx` (lines 1-95)

### REF MCP Findings

**React Testing Library Best Practices (2024):**
1. **Query Priority:** `getByRole` > `getByLabelText` > `getByText` > `getByTestId`
   - Rationale: Role queries test accessibility, text queries test user-visible content
   - Source: https://testing-library.com/docs/queries/about/#priority

2. **User Interactions:** Always use `userEvent` (not `fireEvent`)
   - Pattern: `const user = userEvent.setup(); await user.click(element)`
   - Rationale: userEvent simulates real browser events (focus, hover, keyboard)
   - Source: https://testing-library.com/docs/user-event/intro

3. **Async Assertions:** Use `waitFor()` for async state changes
   - Pattern: `await waitFor(() => expect(screen.getByText('Success')).toBeInTheDocument())`
   - Rationale: Prevents race conditions, waits for DOM updates
   - Source: https://testing-library.com/docs/dom-testing-library/api-async

4. **Avoid Implementation Details:** Don't test state, props, or internal methods
   - Good: `expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'true')`
   - Bad: `expect(component.state.isPressed).toBe(true)`
   - Source: https://kentcdodds.com/blog/testing-implementation-details

5. **Mock Modules at File Level:** Use `vi.mock()` before imports
   - Pattern: `vi.mock('@/hooks/useSchemas', () => ({ useSchemas: vi.fn() }))`
   - Rationale: Avoids hoisting issues, clear mock boundaries
   - Source: https://vitest.dev/api/vi.html#vi-mock

**MSW v2 API Changes:**
- Use `http.get()` instead of `rest.get()` (deprecated)
- Use `HttpResponse.json()` instead of `res(ctx.json())`
- Source: https://mswjs.io/docs/migrations/1.x-to-2.x

**Radix UI Component Testing:**
- DropdownMenu: Use `getByRole('menu')` and `getByRole('menuitem')`
- Select: Use `getByRole('combobox')` and `getByRole('option')`
- Dialog: Use `getByRole('dialog')` and `getByLabelText()`
- Source: https://www.radix-ui.com/docs/primitives/overview/accessibility

---

## ⏱️ Time Estimate

**Total: 6-8 hours**

- Step 1: REF MCP validation (30 min)
- Step 2: Test utilities setup (mockData.ts, mswHandlers.ts) (45 min)
- Step 3: TagEditDialog tests (15 tests × 8 min) (2 hours)
- Step 4: CustomFieldsPreview tests (20 tests × 7 min) (2.5 hours)
- Step 5: FieldDisplay tests (25 tests × 6 min) (2.5 hours)
- Step 6: Fix failing tests (30 min buffer)
- Step 7: Coverage check (15 min)
- Step 8: Manual testing (30 min)
- Step 9: CLAUDE.md update (10 min)
- Step 10: Git commit (10 min)

**Risk Mitigation:**
- REF MCP validation BEFORE writing tests prevents anti-patterns
- Factory functions reduce test boilerplate (saves time)
- Existing test patterns as reference (reduces guesswork)
- Subagent-Driven Development possible (parallel test writing)

---

## 🎯 Success Metrics

- [ ] 60/60 tests passing (100% pass rate)
- [ ] Test coverage ≥90% for CustomFieldsPreview, FieldDisplay, TagEditDialog
- [ ] 0 console errors or warnings during test run
- [ ] TypeScript strict mode (0 `any` types in test files)
- [ ] All tests deterministic (no flaky tests after 5 runs)
- [ ] Manual testing checklist 100% complete
- [ ] REF MCP best practices followed (documented in commit message)
- [ ] Code review approval (if using code-reviewer skill)

---

## 📝 Notes

**Prerequisites:**
- Tasks #82-94 must be complete (components implemented)
- Task #89 (CustomFieldsPreview component)
- Task #90 (FieldDisplay component)
- Task #82 (TagEditDialog schema selector)

**Blocking:**
- Task #96 (integration test) depends on Task #95 completion
- Manual E2E testing should wait until Task #95 passes

**Assumptions:**
- Components are already implemented (not stubbed)
- Backend API endpoints functional (Tasks #66-74 complete)
- MSW installed (if not, add to Step 2)

**Out of Scope:**
- Backend testing (Task #76-77)
- Integration test for full workflow (Task #96)
- E2E Playwright tests (future enhancement)
- Visual regression tests (future enhancement)

**Future Enhancements:**
- Playwright E2E tests for real browser testing
- Visual regression testing with Percy or Chromatic
- Performance testing (render time, mutation latency)
- Accessibility automated testing with axe-core
