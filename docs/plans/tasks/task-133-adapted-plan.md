# Task #133: TagEditDialog Schema Selector Tests (Adapted Plan)

**Status:** In Progress
**Priority:** P1 (Custom Fields MVP - Phase 1 Frontend)
**Estimated Time:** 2-3 hours (reduced from 6-8 hours due to Discovery findings)

## Discovery Findings (2025-11-13)

✅ **CustomFieldsPreview**: 16/16 tests passing (Task #129 - already complete)
✅ **FieldDisplay**: 28/28 tests passing (Task #128 - already complete)
❌ **TagEditDialog**: No tests found → **Primary work for Task #133**

## Adjusted Scope

**Original Plan:** Test 3 components (TagEditDialog, CustomFieldsPreview, FieldDisplay)
**Adapted Plan:** Test 1 component (TagEditDialog Schema Selector Extension only)

**Reason:** CustomFieldsPreview and FieldDisplay are already fully tested with excellent coverage.

---

## 🎯 Goal

Write comprehensive tests for TagEditDialog Schema Selector Extension (Task #120 implementation):

1. **Schema Selector Rendering** - Dropdown with "Kein Schema", existing schemas, "+ Neues Schema erstellen"
2. **Selection Behavior** - Form state updates, API request validation
3. **Keyboard Navigation** - Arrow keys, Enter, Tab accessibility
4. **Error Handling** - Loading states, API failures
5. **Backwards Compatibility** - Tags without schema_id work correctly

**Test Count Target:** 15 tests (comprehensive coverage for schema selector feature)

---

## 📋 Acceptance Criteria

- [ ] 15+ tests passing for TagEditDialog schema selector
- [ ] Test coverage ≥90% for schema selector code paths
- [ ] TypeScript strict mode compliance (no `any` types)
- [ ] Follows existing project patterns (vi.mock, inline factories, userEvent.setup({ delay: null }))
- [ ] Tests use React Testing Library best practices (getByRole, user interactions)
- [ ] All tests deterministic (no flaky tests)
- [ ] Zero console errors during test run

---

## 🛠️ Implementation Tasks

### Task 1: Create Test File with Setup

**File:** `frontend/src/components/TagEditDialog.test.tsx`

**Action:** Create test file with proper setup following project patterns

**Requirements:**
- Use `vi.mock('@/hooks/useSchemas')` for hook mocking (NOT MSW - Component test pattern)
- Use `renderWithRouter()` helper (TagEditDialog uses React Router)
- Use `QueryClientProvider` wrapper (TagEditDialog uses mutations)
- Use `userEvent.setup({ delay: null })` (project pattern for fast tests)
- Create inline factory functions for mock data (project pattern, NOT separate mockData.ts)

**Example Setup:**
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderWithRouter } from '@/test/renderWithRouter'
import { TagEditDialog } from './TagEditDialog'

// Mock useSchemas hook (Component test pattern - NOT MSW)
vi.mock('@/hooks/useSchemas', () => ({
  useSchemas: vi.fn(() => ({
    data: [
      { id: 'schema-1', name: 'Video Quality', list_id: 'list-123' },
      { id: 'schema-2', name: 'Content Rating', list_id: 'list-123' },
    ],
    isLoading: false,
    error: null,
  })),
}))

// Mock useTags hook
vi.mock('@/hooks/useTags', () => ({
  useTags: vi.fn(() => ({
    data: [],
    isLoading: false,
  })),
  useCreateTag: vi.fn(() => ({
    mutate: vi.fn(),
    isPending: false,
  })),
  useUpdateTag: vi.fn(() => ({
    mutate: vi.fn(),
    isPending: false,
  })),
}))

// Inline factory function (project pattern)
const createMockTag = (overrides = {}) => ({
  id: 'tag-123',
  name: 'Test Tag',
  color: '#3B82F6',
  schema_id: null,
  list_id: 'list-123',
  user_id: 'user-123',
  created_at: '2025-01-01T00:00:00Z',
  updated_at: '2025-01-01T00:00:00Z',
  ...overrides,
})

describe('TagEditDialog - Schema Selector Extension', () => {
  let queryClient: QueryClient

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    })
    vi.clearAllMocks()
  })

  const renderDialog = (props = {}) => {
    const defaultProps = {
      open: true,
      onOpenChange: vi.fn(),
      listId: 'list-123',
      mode: 'create' as const,
      ...props,
    }

    return renderWithRouter(
      <QueryClientProvider client={queryClient}>
        <TagEditDialog {...defaultProps} />
      </QueryClientProvider>
    )
  }

  // Tests go here...
})
```

**Deliverable:** Test file skeleton with proper setup (0 tests initially)

---

### Task 2: Schema Selector Rendering Tests (5 tests)

**Action:** Test that schema dropdown renders correctly with all options

**Tests to implement:**
1. Renders schema selector dropdown below color picker
2. Shows "Kein Schema" as first option
3. Shows existing schemas from useSchemas hook
4. Shows "+ Neues Schema erstellen" as last option
5. Schema dropdown is disabled when schemas are loading

**Example Test:**
```typescript
it('renders schema selector dropdown below color picker', () => {
  renderDialog()

  // Schema selector should be present
  expect(screen.getByRole('combobox', { name: /schema/i })).toBeInTheDocument()

  // Should be below color picker (check DOM order)
  const colorPicker = screen.getByLabelText(/farbe/i)
  const schemaSelector = screen.getByRole('combobox', { name: /schema/i })

  // colorPicker should come before schemaSelector in DOM
  expect(colorPicker.compareDocumentPosition(schemaSelector)).toBe(4) // DOCUMENT_POSITION_FOLLOWING
})
```

**Deliverable:** 5 passing tests for rendering logic

---

### Task 3: Schema Selection Behavior Tests (5 tests)

**Action:** Test form state updates and API request validation

**Tests to implement:**
1. Defaults to "Kein Schema" (schema_id: null) for new tags
2. Updates form state when existing schema selected
3. Sets schema_id to null when "Kein Schema" selected
4. Includes schema_id in POST request when creating tag
5. Omits schema_id when "Kein Schema" selected (backwards compatible)

**Example Test:**
```typescript
it('includes schema_id in POST request when creating tag', async () => {
  const user = userEvent.setup({ delay: null })
  const { useCreateTag } = await import('@/hooks/useTags')
  const mockMutate = vi.fn()
  vi.mocked(useCreateTag).mockReturnValue({
    mutate: mockMutate,
    isPending: false,
  } as any)

  renderDialog()

  // Fill in tag name
  const nameInput = screen.getByLabelText(/name/i)
  await user.type(nameInput, 'Tutorial')

  // Select schema
  const schemaSelector = screen.getByRole('combobox', { name: /schema/i })
  await user.click(schemaSelector)

  const videoQualityOption = await screen.findByRole('option', { name: /video quality/i })
  await user.click(videoQualityOption)

  // Submit form
  const submitButton = screen.getByRole('button', { name: /erstellen|create/i })
  await user.click(submitButton)

  // Verify mutation called with schema_id
  await waitFor(() => {
    expect(mockMutate).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Tutorial',
        schema_id: 'schema-1',
      })
    )
  })
})
```

**Deliverable:** 5 passing tests for selection behavior

---

### Task 4: Keyboard Navigation Tests (3 tests)

**Action:** Test accessibility with keyboard-only navigation

**Tests to implement:**
1. Opens schema dropdown with Enter key
2. Navigates options with Arrow keys
3. Selects option with Enter key

**Example Test:**
```typescript
it('navigates options with Arrow keys and selects with Enter', async () => {
  const user = userEvent.setup({ delay: null })
  renderDialog()

  const schemaSelector = screen.getByRole('combobox', { name: /schema/i })

  // Focus and open dropdown
  schemaSelector.focus()
  await user.keyboard('{Enter}')

  // Navigate down 2 times (skip "Kein Schema", select "Video Quality")
  await user.keyboard('{ArrowDown}')
  await user.keyboard('{ArrowDown}')

  // Select with Enter
  await user.keyboard('{Enter}')

  // Verify selection
  await waitFor(() => {
    expect(schemaSelector).toHaveValue('schema-1')
  })
})
```

**Deliverable:** 3 passing tests for keyboard navigation

---

### Task 5: Error Handling & Edge Cases Tests (2+ tests)

**Action:** Test error states and edge cases

**Tests to implement:**
1. Shows error message when schema loading fails
2. Renders correctly for tag without schema_id (existing tags - backwards compatibility)

**Example Test:**
```typescript
it('shows error message when schema loading fails', () => {
  const { useSchemas } = await import('@/hooks/useSchemas')
  vi.mocked(useSchemas).mockReturnValue({
    data: undefined,
    isLoading: false,
    error: new Error('Failed to load schemas'),
  } as any)

  renderDialog()

  // Should show error or disable selector
  expect(screen.queryByRole('combobox', { name: /schema/i })).toBeDisabled()
  // OR
  expect(screen.getByText(/fehler.*schema/i)).toBeInTheDocument()
})
```

**Deliverable:** 2+ passing tests for error handling

---

### Task 6: Run Full Test Suite & Verify Coverage

**Action:** Run all TagEditDialog tests and check coverage

**Commands:**
```bash
cd frontend
npm test -- TagEditDialog --run
npm test -- TagEditDialog --coverage
```

**Expected Output:**
```
✓ TagEditDialog - Schema Selector Extension (15 tests)

Test Files  1 passed (1)
     Tests  15 passed (15)

Coverage:
File                    | % Stmts | % Branch | % Funcs | % Lines
TagEditDialog.tsx       |   92.3  |   87.5   |   100.0 |   91.8
```

**Deliverable:** 15/15 tests passing, ≥90% coverage for schema selector code

---

### Task 7: Update CLAUDE.md Documentation

**File:** `CLAUDE.md`

**Action:** Document TagEditDialog test patterns in "Testing Patterns" section

**Addition:**
```markdown
### TagEditDialog Testing

**Test File:** `frontend/src/components/TagEditDialog.test.tsx`

**Test Patterns:**
- Mock `useSchemas` and `useTags` hooks with `vi.mock()` (Component test pattern)
- Use `renderWithRouter()` for React Router context
- Use `QueryClientProvider` wrapper for mutations
- Use `userEvent.setup({ delay: null })` for fast, deterministic tests
- Test Radix UI Select with `getByRole('combobox')` and `getByRole('option')`
- Verify mutation calls with `vi.mocked(useCreateTag).mockReturnValue()`

**Schema Selector Coverage:**
- Rendering with all options (Kein Schema, existing schemas, + Neues Schema)
- Form state updates on selection
- API request validation (includes/omits schema_id)
- Keyboard navigation (Arrow keys, Enter)
- Error handling (loading failures)
- Backwards compatibility (tags without schema_id)
```

**Deliverable:** CLAUDE.md updated with TagEditDialog test documentation

---

### Task 8: Git Commit

**Action:** Commit tests with comprehensive message

**Command:**
```bash
git add frontend/src/components/TagEditDialog.test.tsx CLAUDE.md
git commit -m "test(tags): add comprehensive tests for TagEditDialog schema selector

Task #133: Write frontend component tests (adapted plan)

DISCOVERY FINDINGS:
- CustomFieldsPreview: 16/16 tests passing (Task #129 - already complete)
- FieldDisplay: 28/28 tests passing (Task #128 - already complete)
- TagEditDialog: No tests → PRIMARY WORK FOR TASK #133

IMPLEMENTATION:
- TagEditDialog.test.tsx: 15 tests for schema selector extension
  - 5 rendering tests (dropdown options, loading states)
  - 5 selection behavior tests (form state, API validation)
  - 3 keyboard navigation tests (Arrow keys, Enter)
  - 2+ error handling tests (failures, edge cases)

TEST PATTERNS FOLLOWED:
- vi.mock() for Component tests (NOT MSW - project pattern)
- renderWithRouter() for React Router context
- userEvent.setup({ delay: null }) for fast tests
- Inline factory functions (project pattern)
- Radix UI Select testing with getByRole('combobox')

COVERAGE:
- 15/15 tests passing (100% pass rate)
- ≥90% coverage for schema selector code paths
- Zero console errors or warnings

REF MCP VALIDATIONS:
- Query priority: getByRole > getByLabelText > getByText
- User interactions: userEvent.setup() + await user.click()
- Component mocking: vi.mock() for hooks (not MSW overhead)
- Accessibility: ARIA roles and keyboard navigation tested

TESTING SCOPE:
- Schema selector dropdown with 3 modes (none, existing, new)
- Form state management and API request validation
- Keyboard accessibility (Tab, Arrow keys, Enter)
- Error handling and backwards compatibility

NEXT STEPS:
- Task #134: Integration test for full create tag+schema+field flow
- Manual E2E testing in browser
- Consider Playwright E2E tests (future enhancement)

🤖 Generated with Claude Code (https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

**Deliverable:** Committed changes with comprehensive commit message

---

## 📚 Project Patterns Reference (from REF MCP Validation)

### Mocking Strategy (CRITICAL)

**Component Tests: Use vi.mock() NOT MSW**
```typescript
// ✅ CORRECT for Component tests
vi.mock('@/hooks/useSchemas', () => ({
  useSchemas: vi.fn(() => ({ data: mockSchemas }))
}))

// ❌ WRONG for Component tests (unnecessary overhead)
// Using MSW server.use(http.get('/api/schemas')) for every component test
```

**Hook Tests: Use MSW**
```typescript
// ✅ CORRECT for Hook tests (realistic HTTP interception)
import { server } from '@/test/mocks/server'
import { http, HttpResponse } from 'msw'
```

### Factory Functions

**Use inline factories (project pattern):**
```typescript
// ✅ CORRECT (project pattern from CustomFieldsPreview.test.tsx)
const createMockTag = (overrides = {}) => ({
  id: 'tag-123',
  name: 'Test Tag',
  ...overrides,
})

// ❌ WRONG (plan suggested separate mockData.ts - not project pattern)
// import { createMockTag } from '@/test/mockData'
```

### userEvent Setup

**Use { delay: null } option:**
```typescript
// ✅ CORRECT (project pattern from FieldEditor.test.tsx line 82)
const user = userEvent.setup({ delay: null })

// ❌ MISSING optimization
// const user = userEvent.setup() // Uses realistic delays, slower tests
```

### Test Organization

**Prefer co-location:**
```typescript
// ✅ PREFERRED
components/TagEditDialog.test.tsx

// ✅ ALSO VALID (but don't create new __tests__ folders)
components/__tests__/TagEditDialog.test.tsx
```

---

## ⏱️ Time Estimate

**Total: 2-3 hours** (reduced from original 6-8 hours)

- Task 1: Test file setup (20 min)
- Task 2: Rendering tests (30 min)
- Task 3: Selection behavior tests (40 min)
- Task 4: Keyboard navigation tests (20 min)
- Task 5: Error handling tests (15 min)
- Task 6: Coverage verification (10 min)
- Task 7: CLAUDE.md update (10 min)
- Task 8: Git commit (5 min)
- Buffer for debugging (30 min)

**Risk Mitigation:**
- REF MCP validation completed (patterns confirmed)
- Existing project patterns identified (no guesswork)
- Discovery phase completed (scope clarity)
- Similar tests exist as reference (FieldEditor, CustomFieldsPreview)

---

## 🎯 Success Metrics

- [x] Discovery phase completed (15/15 tests passing, 100% pass rate)
- [ ] TagEditDialog tests: 15/15 passing
- [ ] Test coverage ≥90% for schema selector
- [ ] Zero console errors during test run
- [ ] TypeScript strict mode (no `any` types)
- [ ] All tests deterministic (5 consecutive runs pass)
- [ ] CLAUDE.md updated with test patterns
- [ ] Code committed with comprehensive message

---

## 📝 Notes

**Discovery Findings (2025-11-13 16:06):**
- CustomFieldsPreview.test.tsx: 16 tests, 471 lines, 100% passing ✅
- FieldDisplay.test.tsx: 28 tests, 449 lines, 100% passing ✅
- TagEditDialog tests: Not found ❌

**Adapted Plan Rationale:**
- Original plan assumed all 3 components needed tests
- Discovery revealed 2/3 already complete with excellent coverage
- Focused plan on TagEditDialog saves ~4-5 hours
- REF MCP validation prevents anti-patterns (MSW for components, separate mockData.ts)

**Key Learnings Applied:**
1. MSW infrastructure exists but use vi.mock() for Component tests
2. Inline factory functions (not separate mockData.ts)
3. userEvent.setup({ delay: null }) for fast tests
4. Co-locate test files with components
5. Discovery phase prevents wasted effort
