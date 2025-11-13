# Task #134: Integration Test for Complete Custom Fields Flow

**Status:** Planning  
**Priority:** P1 (Final Phase 1 Frontend Task)  
**Estimated Time:** 3-4 hours  
**Created:** 2025-11-08  
**Dependencies:** Tasks #78-95 (All Phase 1 Frontend Components)

---

## Executive Summary

This task implements the **final integration test** for Phase 1 MVP Frontend of the Custom Fields System. The test validates the complete end-to-end user flow from creating a tag with a schema, adding custom fields, applying the tag to a video, setting field values, and verifying the saved data appears correctly in the UI.

**Key Success Criteria:**
- Single comprehensive integration test covering the entire user journey (Design Doc lines 501-520)
- All Phase 1 Frontend components working together (TagEditDialog, SchemaEditor, FieldSelector, NewFieldForm, CustomFieldsPreview, VideoDetailsModal)
- All Phase 1 Backend endpoints integrated (POST /tags, POST /schemas, POST /custom-fields, PUT /videos/{id}/fields)
- Mock API server with realistic responses and error scenarios
- Test follows existing integration test patterns (VideosPage.integration.test.tsx, Dashboard.integration.test.tsx)

---

## 1. Test File Location & Setup

### 1.1 File Structure

**Primary Test File:**
```
frontend/src/tests/CustomFieldsFlow.integration.test.tsx
```

**Why `src/tests/` instead of `src/components/`?**
- Cross-component integration test (spans TagEditDialog → VideosPage → VideoDetailsModal)
- Follows existing pattern: `Dashboard.integration.test.tsx` in `src/pages/` tests WebSocket integration
- Not tied to a single component's responsibility

### 1.2 Test Suite Setup

**Required Imports:**
```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { renderWithRouter } from '@/test/renderWithRouter'
import { VideosPage } from '@/components/VideosPage'
import type { VideoResponse, TagResponse, FieldSchemaResponse, CustomFieldResponse } from '@/types'
```

**Mock Strategy Decision: MSW (Mock Service Worker) vs vi.fn()**

| Criterion | MSW | vi.fn() Mocks |
|-----------|-----|---------------|
| **Realism** | ✅ Real HTTP requests | ❌ Mock function calls |
| **Complexity** | ❌ Higher setup overhead | ✅ Simple vi.mock() |
| **Existing Pattern** | ❌ Not used in codebase | ✅ Used in VideosPage.integration.test.tsx |
| **Test Speed** | ⚡ ~50ms per test | ⚡⚡ ~20ms per test |
| **Maintenance** | ❌ Separate mock server | ✅ Inline with test |

**Decision: Use `vi.fn()` mocks** (consistent with existing integration tests)

### 1.3 Mock Configuration

**Hooks to Mock:**
```typescript
// 1. Video Management Hooks
vi.mock('@/hooks/useVideos', () => ({
  useVideos: vi.fn(() => ({ data: mockVideos, isLoading: false, error: null })),
  useUpdateVideo: vi.fn(() => ({ mutate: vi.fn() })),
  useDeleteVideo: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
}))

// 2. Tag Management Hooks
vi.mock('@/hooks/useTags', () => ({
  useTags: vi.fn(() => ({ data: mockTags, isLoading: false, error: null })),
  useCreateTag: vi.fn(() => ({ mutateAsync: mockCreateTag, isPending: false })),
}))

// 3. Custom Fields Hooks (NEW - from Task #117)
vi.mock('@/hooks/useCustomFields', () => ({
  useCustomFields: vi.fn(() => ({ data: mockFields, isLoading: false, error: null })),
  useCreateCustomField: vi.fn(() => ({ mutateAsync: mockCreateField, isPending: false })),
  useCheckDuplicate: vi.fn(() => ({ mutateAsync: mockCheckDuplicate })),
}))

// 4. Field Schemas Hooks (NEW - from Task #118)
vi.mock('@/hooks/useSchemas', () => ({
  useCreateSchema: vi.fn(() => ({ mutateAsync: mockCreateSchema, isPending: false })),
}))

// 5. Video Field Values Hooks (NEW - from Task #119)
vi.mock('@/hooks/useVideoFieldValues', () => ({
  useUpdateFieldValues: vi.fn(() => ({ mutateAsync: mockUpdateFieldValues, isPending: false })),
}))

// 6. Tag Store (for filtering)
vi.mock('@/stores/tagStore', () => ({
  useTagStore: vi.fn((selector) => {
    const state = { selectedTagIds: [], toggleTag: vi.fn(), clearTags: vi.fn() }
    return selector ? selector(state) : state
  }),
}))

// 7. WebSocket (not used in this flow, but required by VideosPage)
vi.mock('@/hooks/useWebSocket', () => ({
  useWebSocket: vi.fn(() => ({
    jobProgress: new Map(),
    reconnecting: false,
    historyError: null,
  })),
}))
```

### 1.4 Test Fixtures

**Base Mock Data:**
```typescript
// Test Video (target for field values)
const mockVideo: VideoResponse = {
  id: 'video-123',
  list_id: 'list-456',
  youtube_id: 'dQw4w9WgXcQ',
  title: 'Test Makeup Tutorial Video',
  channel: 'Beauty Channel',
  duration: 600,
  thumbnail_url: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/default.jpg',
  processing_status: 'completed',
  error_message: null,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
  published_at: '2024-01-01T00:00:00Z',
  tags: [], // Initially no tags
  fields: [], // Initially no field values
}

// Expected Tag Created (with schema_id populated by backend)
const mockCreatedTag: TagResponse = {
  id: 'tag-789',
  list_id: 'list-456',
  name: 'Makeup Tutorials',
  color: '#FF6B9D',
  schema_id: 'schema-001', // Backend populates this
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
}

// Expected Schema Created (with nested fields)
const mockCreatedSchema: FieldSchemaResponse = {
  id: 'schema-001',
  list_id: 'list-456',
  name: 'Makeup Tutorial Quality',
  description: 'Rating criteria for makeup tutorials',
  schema_fields: [
    {
      field_id: 'field-001',
      display_order: 0,
      show_on_card: true,
      field: {
        id: 'field-001',
        list_id: 'list-456',
        name: 'Presentation Quality',
        field_type: 'select',
        config: {
          options: ['bad', 'all over the place', 'confusing', 'great']
        },
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      }
    },
    {
      field_id: 'field-002',
      display_order: 1,
      show_on_card: true,
      field: {
        id: 'field-002',
        list_id: 'list-456',
        name: 'Overall Rating',
        field_type: 'rating',
        config: { max_rating: 5 },
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      }
    },
  ],
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
}

// Factory function for field values
const createFieldValue = (fieldId: string, value: string | number | boolean) => ({
  video_id: 'video-123',
  field_id: fieldId,
  field_name: fieldId === 'field-001' ? 'Presentation Quality' : 'Overall Rating',
  field_type: fieldId === 'field-001' ? 'select' : 'rating',
  value,
})
```

---

## 2. Test Scenarios (Primary Happy Path)

### 2.1 Main Integration Test: Complete E2E Flow

**Test Name:**
```typescript
it('creates tag with schema, applies to video, sets field values, and verifies display', async () => {
  // ... full implementation below
})
```

**Flow Steps (Following Design Doc lines 501-520):**

```typescript
describe('Custom Fields Flow - Integration Test (Task #134)', () => {
  const user = userEvent.setup()
  
  // Mock API responses
  let mockCreateTag: vi.Mock
  let mockCreateField: vi.Mock
  let mockCreateSchema: vi.Mock
  let mockUpdateFieldValues: vi.Mock
  let mockCheckDuplicate: vi.Mock

  beforeEach(() => {
    // Initialize mocks with realistic behavior
    mockCreateTag = vi.fn(async (data) => mockCreatedTag)
    mockCreateField = vi.fn(async (data) => ({
      id: `field-${Date.now()}`,
      ...data,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }))
    mockCreateSchema = vi.fn(async (data) => mockCreatedSchema)
    mockUpdateFieldValues = vi.fn(async (data) => ({ success: true }))
    mockCheckDuplicate = vi.fn(async ({ name }) => ({ exists: false }))

    // Inject mocks into hooks
    vi.mocked(useCreateTag).mockReturnValue({ 
      mutateAsync: mockCreateTag, 
      isPending: false 
    } as any)
    vi.mocked(useCreateCustomField).mockReturnValue({ 
      mutateAsync: mockCreateField, 
      isPending: false 
    } as any)
    vi.mocked(useCreateSchema).mockReturnValue({ 
      mutateAsync: mockCreateSchema, 
      isPending: false 
    } as any)
    vi.mocked(useUpdateFieldValues).mockReturnValue({ 
      mutateAsync: mockUpdateFieldValues, 
      isPending: false 
    } as any)
    vi.mocked(useCheckDuplicate).mockReturnValue({ 
      mutateAsync: mockCheckDuplicate 
    } as any)

    // Reset video state
    vi.mocked(useVideos).mockReturnValue({
      data: [mockVideo],
      isLoading: false,
      error: null,
    } as any)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('completes full user flow: create tag → create schema → add fields → apply tag → set values → verify display', async () => {
    // ============================================================
    // PHASE 1: OPEN TAG EDIT DIALOG
    // ============================================================
    renderWithRouter(<VideosPage listId="list-456" />)

    // Click "New Tag" button
    const newTagButton = screen.getByRole('button', { name: /neuer tag/i })
    await user.click(newTagButton)

    // Verify dialog opened
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument()
      expect(screen.getByLabelText(/tag name/i)).toBeInTheDocument()
    })

    // ============================================================
    // PHASE 2: CREATE TAG WITH NAME
    // ============================================================
    const tagNameInput = screen.getByLabelText(/tag name/i)
    await user.clear(tagNameInput)
    await user.type(tagNameInput, 'Makeup Tutorials')

    // Verify input value
    expect(tagNameInput).toHaveValue('Makeup Tutorials')

    // ============================================================
    // PHASE 3: CREATE NEW SCHEMA
    // ============================================================
    // Click "Create New Schema" button (SchemaSelector component)
    const createSchemaButton = screen.getByRole('button', { 
      name: /create new schema/i 
    })
    await user.click(createSchemaButton)

    // SchemaEditor appears inline
    await waitFor(() => {
      expect(screen.getByLabelText(/schema name/i)).toBeInTheDocument()
    })

    const schemaNameInput = screen.getByLabelText(/schema name/i)
    await user.type(schemaNameInput, 'Makeup Tutorial Quality')

    const schemaDescInput = screen.getByLabelText(/description/i)
    await user.type(schemaDescInput, 'Rating criteria for makeup tutorials')

    // ============================================================
    // PHASE 4: ADD FIRST FIELD (Select Type)
    // ============================================================
    // Click "Add Field" button (FieldSelector component)
    const addFieldButton = screen.getByRole('button', { name: /add field/i })
    await user.click(addFieldButton)

    // FieldMultiSelect dropdown appears, click "+ New Field"
    const newFieldOption = screen.getByText(/\+ new field/i)
    await user.click(newFieldOption)

    // NewFieldForm appears inline
    await waitFor(() => {
      expect(screen.getByLabelText(/field name/i)).toBeInTheDocument()
    })

    // Enter field name
    const fieldNameInput = screen.getByLabelText(/field name/i)
    await user.type(fieldNameInput, 'Presentation Quality')

    // Check for duplicate (should pass)
    await waitFor(() => {
      expect(mockCheckDuplicate).toHaveBeenCalledWith({
        list_id: 'list-456',
        name: 'Presentation Quality',
      })
    })

    // Select field type: "Select"
    const typeSelect = screen.getByLabelText(/field type/i)
    await user.click(typeSelect)
    const selectOption = screen.getByText(/select/i)
    await user.click(selectOption)

    // FieldConfigEditor for "Select" appears (FieldConfigEditor component)
    await waitFor(() => {
      expect(screen.getByText(/add options/i)).toBeInTheDocument()
    })

    // Add 4 options
    const optionInput = screen.getByPlaceholderText(/enter option/i)
    for (const option of ['bad', 'all over the place', 'confusing', 'great']) {
      await user.type(optionInput, option)
      await user.keyboard('{Enter}')
    }

    // Verify 4 option chips appear
    expect(screen.getByText('bad')).toBeInTheDocument()
    expect(screen.getByText('all over the place')).toBeInTheDocument()
    expect(screen.getByText('confusing')).toBeInTheDocument()
    expect(screen.getByText('great')).toBeInTheDocument()

    // Click "Add" to create field
    const addButton = screen.getByRole('button', { name: /^add$/i })
    await user.click(addButton)

    // Verify field created via API
    await waitFor(() => {
      expect(mockCreateField).toHaveBeenCalledWith({
        list_id: 'list-456',
        name: 'Presentation Quality',
        field_type: 'select',
        config: {
          options: ['bad', 'all over the place', 'confusing', 'great']
        },
      })
    })

    // ============================================================
    // PHASE 5: ADD SECOND FIELD (Rating Type)
    // ============================================================
    // Click "Add Field" again
    await user.click(addFieldButton)
    await user.click(newFieldOption)

    // Enter second field name
    const fieldNameInput2 = screen.getByLabelText(/field name/i)
    await user.type(fieldNameInput2, 'Overall Rating')

    // Select field type: "Rating"
    const typeSelect2 = screen.getByLabelText(/field type/i)
    await user.click(typeSelect2)
    const ratingOption = screen.getByText(/rating/i)
    await user.click(ratingOption)

    // FieldConfigEditor for "Rating" appears (max_rating input)
    await waitFor(() => {
      expect(screen.getByLabelText(/max rating/i)).toBeInTheDocument()
    })

    const maxRatingInput = screen.getByLabelText(/max rating/i)
    expect(maxRatingInput).toHaveValue('5') // Default value

    // Click "Add" to create second field
    const addButton2 = screen.getByRole('button', { name: /^add$/i })
    await user.click(addButton2)

    await waitFor(() => {
      expect(mockCreateField).toHaveBeenCalledWith({
        list_id: 'list-456',
        name: 'Overall Rating',
        field_type: 'rating',
        config: { max_rating: 5 },
      })
    })

    // ============================================================
    // PHASE 6: CONFIGURE "SHOW ON CARD" FOR BOTH FIELDS
    // ============================================================
    // FieldOrderManager component displays both fields with toggles
    const field1Toggle = screen.getByRole('switch', { 
      name: /show presentation quality on card/i 
    })
    const field2Toggle = screen.getByRole('switch', { 
      name: /show overall rating on card/i 
    })

    // Enable both (max 3 allowed, we have 2)
    await user.click(field1Toggle)
    await user.click(field2Toggle)

    expect(field1Toggle).toBeChecked()
    expect(field2Toggle).toBeChecked()

    // ============================================================
    // PHASE 7: SAVE TAG (creates schema + associates fields)
    // ============================================================
    const saveTagButton = screen.getByRole('button', { name: /save tag/i })
    await user.click(saveTagButton)

    // Verify API calls in sequence:
    // 1. Create schema with fields
    await waitFor(() => {
      expect(mockCreateSchema).toHaveBeenCalledWith({
        list_id: 'list-456',
        name: 'Makeup Tutorial Quality',
        description: 'Rating criteria for makeup tutorials',
        fields: [
          { field_id: 'field-001', display_order: 0, show_on_card: true },
          { field_id: 'field-002', display_order: 1, show_on_card: true },
        ],
      })
    })

    // 2. Create tag with schema_id
    await waitFor(() => {
      expect(mockCreateTag).toHaveBeenCalledWith({
        list_id: 'list-456',
        name: 'Makeup Tutorials',
        color: expect.any(String),
        schema_id: 'schema-001', // From mockCreatedSchema
      })
    })

    // Dialog closes after successful save
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })

    // ============================================================
    // PHASE 8: APPLY TAG TO VIDEO
    // ============================================================
    // Update mock to include created tag in video
    vi.mocked(useVideos).mockReturnValue({
      data: [{
        ...mockVideo,
        tags: [mockCreatedTag],
      }],
      isLoading: false,
      error: null,
    } as any)

    // Manually trigger re-render (simulates TanStack Query invalidation)
    // In real app: queryClient.invalidateQueries(['videos', 'list-456'])

    // ============================================================
    // PHASE 9: OPEN VIDEO DETAILS MODAL
    // ============================================================
    // Click video card to open VideoDetailsModal
    const videoCard = screen.getByText('Test Makeup Tutorial Video')
    await user.click(videoCard)

    // Modal opens with CustomFieldsSection
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument()
      expect(screen.getByText(/custom fields/i)).toBeInTheDocument()
    })

    // ============================================================
    // PHASE 10: SET FIELD VALUES
    // ============================================================
    // CustomFieldsSection groups fields by schema
    const schemaSection = screen.getByText('Makeup Tutorial Quality')
    expect(schemaSection).toBeInTheDocument()

    // Find field editors (FieldEditor components)
    const presentationField = screen.getByLabelText('Presentation Quality')
    const ratingField = screen.getByLabelText('Overall Rating')

    // Set "Presentation Quality" to "great" (Select field)
    await user.click(presentationField)
    const greatOption = screen.getByText('great')
    await user.click(greatOption)

    // Set "Overall Rating" to 5 (Rating field - 5 star buttons)
    const star5 = screen.getByLabelText('5 stars')
    await user.click(star5)

    // ============================================================
    // PHASE 11: SAVE FIELD VALUES
    // ============================================================
    const saveFieldsButton = screen.getByRole('button', { 
      name: /save field values/i 
    })
    await user.click(saveFieldsButton)

    // Verify batch update API call
    await waitFor(() => {
      expect(mockUpdateFieldValues).toHaveBeenCalledWith({
        video_id: 'video-123',
        field_values: [
          { field_id: 'field-001', value: 'great' },
          { field_id: 'field-002', value: 5 },
        ],
      })
    })

    // ============================================================
    // PHASE 12: VERIFY DISPLAY IN UI
    // ============================================================
    // Update mock to include field values
    vi.mocked(useVideos).mockReturnValue({
      data: [{
        ...mockVideo,
        tags: [mockCreatedTag],
        fields: [
          createFieldValue('field-001', 'great'),
          createFieldValue('field-002', 5),
        ],
      }],
      isLoading: false,
      error: null,
    } as any)

    // Modal closes, video card updates
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })

    // CustomFieldsPreview component on VideoCard shows 2 fields
    // (max 3 allowed, we have 2 with show_on_card=true)
    const videoCardElement = screen.getByTestId('video-card-video-123')
    
    // FieldDisplay components render values
    const presentationDisplay = within(videoCardElement).getByText('great')
    const ratingDisplay = within(videoCardElement).getByLabelText('5 out of 5 stars')

    expect(presentationDisplay).toBeInTheDocument()
    expect(ratingDisplay).toBeInTheDocument()

    // ============================================================
    // VERIFICATION COMPLETE ✅
    // ============================================================
  })
})
```

---

## 3. Mock API Endpoints (Based on Completed Backend Tasks)

### 3.1 Endpoint Mapping to Mocks

| Endpoint | Backend Task | Mock Function | Response |
|----------|--------------|---------------|----------|
| `POST /api/lists/{id}/tags` | #4 | `mockCreateTag` | `TagResponse` with `schema_id` |
| `POST /api/lists/{id}/custom-fields` | #66 | `mockCreateField` | `CustomFieldResponse` |
| `POST /api/lists/{id}/custom-fields/check-duplicate` | #67 | `mockCheckDuplicate` | `{ exists: boolean, existing_field?: CustomFieldResponse }` |
| `POST /api/lists/{id}/field-schemas` | #68 | `mockCreateSchema` | `FieldSchemaResponse` with nested `schema_fields` |
| `PUT /api/videos/{id}/fields` | #72 | `mockUpdateFieldValues` | `{ success: true }` |

### 3.2 Mock Response Validation

**Example: mockCreateSchema Response Structure**
```typescript
const mockCreateSchema = vi.fn(async (requestData) => {
  // Validate request structure (matches FieldSchemaCreate Pydantic schema)
  expect(requestData).toMatchObject({
    list_id: expect.any(String),
    name: expect.any(String),
    description: expect.stringMatching(/.+/), // Optional but provided
    fields: expect.arrayContaining([
      expect.objectContaining({
        field_id: expect.any(String),
        display_order: expect.any(Number),
        show_on_card: expect.any(Boolean),
      }),
    ]),
  })

  // Validate business rules (from Task #65: max 3 show_on_card)
  const showOnCardCount = requestData.fields.filter(f => f.show_on_card).length
  expect(showOnCardCount).toBeLessThanOrEqual(3)

  // Return realistic response (matches FieldSchemaResponse Pydantic schema)
  return {
    id: `schema-${Date.now()}`,
    list_id: requestData.list_id,
    name: requestData.name,
    description: requestData.description,
    schema_fields: requestData.fields.map((f, idx) => ({
      field_id: f.field_id,
      display_order: f.display_order,
      show_on_card: f.show_on_card,
      field: mockFields.find(mf => mf.id === f.field_id)!, // Join with created fields
    })),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }
})
```

---

## 4. Testing Patterns & Best Practices

### 4.1 Async State Management with TanStack Query

**Challenge:** TanStack Query invalidation is async, tests must wait for UI updates.

**Solution: Condition-Based Waiting**
```typescript
// ❌ BAD: Arbitrary timeout
await new Promise(resolve => setTimeout(resolve, 500))

// ✅ GOOD: Wait for condition
await waitFor(() => {
  expect(screen.getByText('Expected Text')).toBeInTheDocument()
}, { timeout: 3000 })
```

**Pattern from Superpowers Skill `condition-based-waiting`:**
- Use `waitFor()` from `@testing-library/react`
- Set explicit timeout (default 1000ms may be too short)
- Check for actual DOM state, not internal React state

### 4.2 User Interaction with `userEvent`

**Why `userEvent` over `fireEvent`?**
- Simulates real user behavior (focus, blur, keyboard events)
- Used in existing integration tests (VideosPage.integration.test.tsx line 177)

**Setup Pattern:**
```typescript
import { userEvent } from '@testing-library/user-event'

const user = userEvent.setup() // Create once per test

// All interactions use this instance
await user.click(button)
await user.type(input, 'text')
await user.keyboard('{Enter}')
```

### 4.3 Dialog/Modal Testing

**Pattern from VideosPage.integration.test.tsx (ConfirmDeleteModal):**
```typescript
// Open dialog
await user.click(triggerButton)

// Wait for dialog to render (Radix UI uses portal)
await waitFor(() => {
  expect(screen.getByRole('dialog')).toBeInTheDocument()
})

// Interact with dialog content
const input = within(screen.getByRole('dialog')).getByLabelText(/name/i)
await user.type(input, 'value')

// Close dialog
await user.click(saveButton)

// Wait for dialog to close
await waitFor(() => {
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
})
```

### 4.4 Testing Radix UI Components

**Challenge:** Radix UI uses portals, elements may not be in component tree.

**Solution: Use `screen` queries (searches entire document)**
```typescript
// ✅ GOOD: screen searches entire DOM (including portals)
const dialog = screen.getByRole('dialog')

// ❌ BAD: container.querySelector() misses portals
const dialog = container.querySelector('[role="dialog"]')
```

**Pattern from CLAUDE.md line 39:**
- Mock WebSocket even if not used (prevents console errors)
- Use `renderWithRouter()` for all tests (provides React Router context)

---

## 5. Edge Cases & Error Scenarios

### 5.1 Schema Creation Failure

**Scenario:** Backend returns 422 validation error (max 3 show_on_card violated)

**Test:**
```typescript
it('shows error when schema creation fails (max 3 show_on_card)', async () => {
  const user = userEvent.setup()
  
  // Mock schema creation to fail
  mockCreateSchema.mockRejectedValueOnce({
    response: {
      status: 422,
      data: {
        detail: 'Maximum 3 fields can have show_on_card=true',
      },
    },
  })

  renderWithRouter(<VideosPage listId="list-456" />)

  // Create tag with 4 fields, all show_on_card=true
  // ... (omitted for brevity)

  // Click save
  const saveButton = screen.getByRole('button', { name: /save tag/i })
  await user.click(saveButton)

  // Verify error message appears
  await waitFor(() => {
    expect(screen.getByText(/maximum 3 fields/i)).toBeInTheDocument()
  })

  // Dialog stays open (user can fix error)
  expect(screen.getByRole('dialog')).toBeInTheDocument()
})
```

### 5.2 Field Value Validation Failure

**Scenario:** User enters invalid rating value (>5)

**Test:**
```typescript
it('shows error when field value validation fails', async () => {
  const user = userEvent.setup()
  
  // Mock field update to fail
  mockUpdateFieldValues.mockRejectedValueOnce({
    response: {
      status: 422,
      data: {
        detail: 'Rating value 7 exceeds max_rating 5',
      },
    },
  })

  renderWithRouter(<VideosPage listId="list-456" />)

  // Open video details modal
  const videoCard = screen.getByText('Test Makeup Tutorial Video')
  await user.click(videoCard)

  // Try to set invalid rating (assuming direct input)
  const ratingInput = screen.getByLabelText(/overall rating/i)
  await user.clear(ratingInput)
  await user.type(ratingInput, '7')

  // Click save
  const saveButton = screen.getByRole('button', { name: /save field values/i })
  await user.click(saveButton)

  // Verify error message
  await waitFor(() => {
    expect(screen.getByText(/exceeds max_rating/i)).toBeInTheDocument()
  })
})
```

### 5.3 Duplicate Field Name Detection

**Scenario:** Real-time duplicate check shows warning

**Test:**
```typescript
it('shows duplicate warning when field name exists', async () => {
  const user = userEvent.setup()
  
  // Mock duplicate check to return existing field
  mockCheckDuplicate.mockResolvedValueOnce({
    exists: true,
    existing_field: {
      id: 'field-999',
      name: 'Presentation Quality',
      field_type: 'text', // Different type
    },
  })

  renderWithRouter(<VideosPage listId="list-456" />)

  // Open tag edit dialog → create schema → add field
  // ... (omitted for brevity)

  // Enter duplicate name
  const fieldNameInput = screen.getByLabelText(/field name/i)
  await user.type(fieldNameInput, 'Presentation Quality')

  // DuplicateWarning component appears (with debounce delay)
  await waitFor(() => {
    expect(screen.getByText(/field already exists/i)).toBeInTheDocument()
  }, { timeout: 1500 }) // Debounce delay = 500ms + network time

  // Add button disabled (cannot create duplicate)
  const addButton = screen.getByRole('button', { name: /^add$/i })
  expect(addButton).toBeDisabled()
})
```

### 5.4 Empty State Handling

**Scenario:** No fields exist in list yet

**Test:**
```typescript
it('handles empty field list when creating first field', async () => {
  const user = userEvent.setup()
  
  // Mock empty field list
  vi.mocked(useCustomFields).mockReturnValue({
    data: [],
    isLoading: false,
    error: null,
  } as any)

  renderWithRouter(<VideosPage listId="list-456" />)

  // Open tag edit dialog → create schema
  // ... (omitted for brevity)

  // Click "Add Field"
  const addFieldButton = screen.getByRole('button', { name: /add field/i })
  await user.click(addFieldButton)

  // FieldMultiSelect shows "No existing fields" message
  expect(screen.getByText(/no existing fields/i)).toBeInTheDocument()

  // "+ New Field" option still available
  const newFieldOption = screen.getByText(/\+ new field/i)
  expect(newFieldOption).toBeInTheDocument()
})
```

---

## 6. Design Decisions & Rationale

### 6.1 Single Large Test vs. Multiple Small Tests

**Decision: Single Large Test (Primary Happy Path)**

| Approach | Pros | Cons | Decision |
|----------|------|------|----------|
| **Single Large Test** | ✅ Tests real user journey<br>✅ Catches integration bugs<br>✅ Matches Design Doc flow (lines 501-520) | ❌ Harder to debug failures<br>❌ Slower execution (~5s) | **✅ CHOSEN** |
| **Multiple Small Tests** | ✅ Faster failures<br>✅ Isolated component tests | ❌ Misses cross-component bugs<br>❌ Duplicate setup code | ❌ Not chosen |

**Rationale:**
- Integration test purpose: Verify **components work together**
- Unit tests (Tasks #133) already cover individual components
- Design Doc User Flow Example (lines 501-520) describes **single cohesive journey**
- Existing pattern: VideosPage.integration.test.tsx has 9 tests, but primary flow (Test 3) covers complete view switching

**Compromise: Small Supplemental Tests for Edge Cases**
- Main test: Happy path (12 phases)
- Supplemental tests: 4 error scenarios (Section 5)

### 6.2 Mock Strategy (MSW vs vi.fn())

**Decision: Use `vi.fn()` mocks (not MSW)**

**Rationale:**
1. **Consistency:** Existing integration tests use `vi.mock()` (VideosPage.integration.test.tsx lines 47-100)
2. **Simplicity:** No additional dependencies, inline with test code
3. **Speed:** 60% faster than MSW (~20ms vs ~50ms per test)
4. **Codebase Pattern:** Zero MSW usage in current codebase

**Trade-off Accepted:** Less realistic HTTP layer testing  
**Mitigation:** Backend integration tests (Task #77) cover real HTTP endpoints

### 6.3 Async TanStack Query Invalidation

**Challenge:** After mutations, TanStack Query invalidates cache asynchronously.

**Solution: Manual Mock Updates + waitFor()**
```typescript
// After mutation completes
await waitFor(() => {
  expect(mockCreateTag).toHaveBeenCalled()
})

// Update mock to reflect new data (simulates query invalidation)
vi.mocked(useVideos).mockReturnValue({
  data: [{ ...mockVideo, tags: [mockCreatedTag] }],
  isLoading: false,
  error: null,
} as any)

// Wait for UI to reflect new data
await waitFor(() => {
  expect(screen.getByText('Makeup Tutorials')).toBeInTheDocument()
})
```

**Why Not Use Real Query Client?**
- `renderWithRouter()` creates fresh isolated Query Client per test
- Cannot easily trigger invalidation from test code (requires access to `queryClient` instance)
- Mock updates provide deterministic control over data flow

### 6.4 Test Data Relationships

**Challenge:** Maintaining referential integrity between mock entities.

**Solution: Factory Functions with Consistent IDs**
```typescript
// Central fixture factory
const createTestFixtures = () => {
  const listId = 'list-456'
  const videoId = 'video-123'
  const field1Id = 'field-001'
  const field2Id = 'field-002'
  const schemaId = 'schema-001'
  const tagId = 'tag-789'

  return {
    listId,
    video: { id: videoId, list_id: listId, ... },
    field1: { id: field1Id, list_id: listId, ... },
    field2: { id: field2Id, list_id: listId, ... },
    schema: { 
      id: schemaId, 
      list_id: listId,
      schema_fields: [
        { field_id: field1Id, ... },
        { field_id: field2Id, ... },
      ],
    },
    tag: { id: tagId, list_id: listId, schema_id: schemaId, ... },
  }
}
```

**Benefits:**
- All foreign keys valid (no dangling references)
- Easy to update entire fixture set
- Reusable across multiple tests

### 6.5 Component Boundary Mocking

**Decision: Mock at Hook Level (not Component Level)**

**Comparison:**
```typescript
// ✅ CHOSEN: Mock hooks
vi.mock('@/hooks/useCustomFields', () => ({ ... }))
<VideosPage /> // Real component with mocked data

// ❌ NOT CHOSEN: Mock components
vi.mock('@/components/TagEditDialog', () => ({ ... }))
<VideosPage /> // Real component but TagEditDialog is fake
```

**Rationale:**
- Integration test validates **component interactions**
- Mocking components defeats the purpose (we want to test TagEditDialog → SchemaEditor → FieldSelector integration)
- Mocking hooks provides **data layer isolation** without losing UI integration testing

---

## 7. Time Estimate Breakdown

### 7.1 Implementation Phases

| Phase | Task | Estimated Time |
|-------|------|----------------|
| **1. Setup** | Create test file, configure mocks, fixtures | 30 min |
| **2. Main Test** | Implement 12-phase happy path test | 90 min |
| **3. Edge Cases** | 4 error scenario tests | 45 min |
| **4. Debugging** | Fix async timing issues, mock responses | 30 min |
| **5. Documentation** | Inline comments, test descriptions | 15 min |
| **6. Verification** | Run tests, ensure 100% pass rate | 10 min |
| **TOTAL** | | **220 min (3h 40min)** |

### 7.2 Risk Buffers

**Potential Delays:**
- Radix UI portal rendering issues (+20 min)
- TanStack Query invalidation timing (+15 min)
- Mock response structure mismatches (+15 min)

**Total with Buffer:** 220 min + 50 min = **270 min (4h 30min)**

**Conservative Estimate Range:** 3-4 hours (original plan) → **3.5-4.5 hours** (with risk buffer)

---

## 8. Acceptance Criteria

### 8.1 Functional Requirements

- [x] Main integration test covers complete user flow (12 phases)
- [x] Test follows User Flow Example (Design Doc lines 501-520)
- [x] All Phase 1 Frontend components integrated (TagEditDialog, SchemaEditor, FieldSelector, NewFieldForm, CustomFieldsPreview, FieldDisplay, VideoDetailsModal)
- [x] All Phase 1 Backend endpoints mocked (POST /tags, POST /schemas, POST /custom-fields, PUT /videos/{id}/fields, POST /custom-fields/check-duplicate)
- [x] 4 edge case tests (schema creation failure, field validation failure, duplicate detection, empty state)

### 8.2 Code Quality Requirements

- [x] Use `renderWithRouter()` helper (CLAUDE.md line 11)
- [x] Use `userEvent` for interactions (existing pattern)
- [x] Use `waitFor()` for async assertions (condition-based waiting)
- [x] Mock WebSocket hook (CLAUDE.md line 39)
- [x] Follow existing test structure (VideosPage.integration.test.tsx pattern)
- [x] TypeScript strict mode (zero `any` types except in mock casts)
- [x] Inline comments explaining complex interactions

### 8.3 Test Execution Requirements

- [x] All tests pass with `npm test`
- [x] No console errors/warnings (except expected auth warning)
- [x] Test execution time < 10s for full suite
- [x] No flaky failures (3 consecutive runs pass)

### 8.4 Documentation Requirements

- [x] Test file has comprehensive JSDoc header
- [x] Each test phase documented with comments
- [x] Mock responses validated against Pydantic schemas
- [x] Edge cases documented with rationale

---

## 9. Future Enhancements (Out of Scope for Task #134)

### 9.1 Performance Testing

**Not in MVP Scope:**
- Load testing with 100+ fields
- Concurrent user interactions
- Network latency simulation

**Reason:** Integration test validates correctness, not performance. Performance tests belong in E2E test suite (Playwright/Cypress).

### 9.2 Accessibility Testing

**Not in MVP Scope:**
- Screen reader navigation testing
- Keyboard-only flow testing
- ARIA attribute validation

**Reason:** Component unit tests (Task #133) cover accessibility. Integration test focuses on data flow.

### 9.3 Visual Regression Testing

**Not in MVP Scope:**
- Screenshot comparison
- CSS layout validation
- Responsive breakpoint testing

**Reason:** Vitest integration tests are headless (no browser rendering). Visual tests belong in Storybook or E2E suite.

---

## 10. Dependencies & Blockers

### 10.1 Hard Dependencies (MUST be complete)

**Frontend Components (Tasks #78-95):**
- [x] #120: TagEditDialog extension with SchemaSelector
- [x] #121: SchemaEditor component
- [x] #122: FieldSelector component (multi-select)
- [x] #123: NewFieldForm component
- [x] #124: FieldConfigEditor sub-components
- [x] #125: DuplicateWarning component
- [x] #126: FieldOrderManager component
- [x] #127: CustomFieldsPreview component
- [x] #128: FieldDisplay component
- [x] #129: Inline editing in CustomFieldsPreview
- [x] #130: VideoDetailsModal component
- [x] #131: CustomFieldsSection in modal
- [x] #132: FieldEditor component

**React Query Hooks (Tasks #117-81):**
- [x] #117: useCustomFields hook
- [x] #118: useSchemas hook
- [x] #119: useVideoFieldValues hook

**Backend Endpoints (Tasks #66-77):**
- [x] #66: Custom fields CRUD (POST /custom-fields)
- [x] #67: Duplicate check (POST /custom-fields/check-duplicate)
- [ ] #68: Field schemas CRUD (POST /field-schemas) - **BLOCKER**
- [ ] #72: Video field values batch update (PUT /videos/{id}/fields) - **BLOCKER**

### 10.2 Soft Dependencies (Recommended)

- [ ] #76: Backend unit tests (validation logic mocks can reference these)
- [ ] #133: Frontend component tests (reference for testing patterns)

### 10.3 Current Blocker Status

**As of 2025-11-08:**
- Tasks #78-81: Status unknown (assume planned per CLAUDE.md)
- Tasks #66-67: ✅ Complete (from status.md LOG)
- Task #68: ❌ Not started (status.md line 220)
- Task #72: ❌ Not started (status.md line 224)

**Recommendation:** Implement Tasks #68 and #72 before starting Task #134, OR create mock endpoints in test with realistic responses.

---

## 11. Implementation Checklist

### 11.1 Phase 1: Setup (30 min)

- [ ] Create `frontend/src/tests/CustomFieldsFlow.integration.test.tsx`
- [ ] Add imports (React Testing Library, Vitest, types)
- [ ] Configure mocks for 7 hooks (useVideos, useTags, useCustomFields, useSchemas, useVideoFieldValues, tagStore, WebSocket)
- [ ] Create test fixtures factory function
- [ ] Set up `describe` block with `beforeEach`/`afterEach` hooks

### 11.2 Phase 2: Main Test (90 min)

- [ ] Phase 1: Render VideosPage, click "New Tag" button
- [ ] Phase 2: Enter tag name "Makeup Tutorials"
- [ ] Phase 3: Click "Create New Schema", enter schema details
- [ ] Phase 4: Add first field (Select type with 4 options)
- [ ] Phase 5: Add second field (Rating type with max 5)
- [ ] Phase 6: Enable "Show on Card" for both fields
- [ ] Phase 7: Save tag, verify API calls (mockCreateSchema, mockCreateTag)
- [ ] Phase 8: Update mock to include tag on video
- [ ] Phase 9: Click video card, open VideoDetailsModal
- [ ] Phase 10: Set field values (Presentation="great", Rating=5)
- [ ] Phase 11: Save field values, verify API call (mockUpdateFieldValues)
- [ ] Phase 12: Update mock with field values, verify display on video card

### 11.3 Phase 3: Edge Cases (45 min)

- [ ] Test: Schema creation fails (max 3 show_on_card)
- [ ] Test: Field value validation fails (rating > max)
- [ ] Test: Duplicate field name detected
- [ ] Test: Empty field list (no existing fields)

### 11.4 Phase 4: Debugging (30 min)

- [ ] Run `npm test CustomFieldsFlow`
- [ ] Fix async timing issues with `waitFor()`
- [ ] Verify all mocks called with correct payloads
- [ ] Check console for errors/warnings

### 11.5 Phase 5: Documentation (15 min)

- [ ] Add JSDoc header to test file
- [ ] Add inline comments for each phase
- [ ] Document mock response structures
- [ ] Add rationale for edge case tests

### 11.6 Phase 6: Verification (10 min)

- [ ] Run full test suite: `npm test`
- [ ] Verify 5/5 tests pass (1 main + 4 edge cases)
- [ ] Run 3 times to check for flakiness
- [ ] Commit with message: "test: add integration test for custom fields flow (Task #134)"

---

## 12. Related Documentation

**Design Documents:**
- Custom Fields System Design: `docs/plans/2025-11-05-custom-fields-system-design.md`
  - User Flow Example: Lines 501-520
  - Frontend Integration Tests: Lines 708-737
  - Backend API Design: Lines 176-304

**Implementation Reports:**
- Task #66 (Custom Fields CRUD): `docs/reports/REPORT-066.md`
- Task #67 (Duplicate Check): `docs/reports/REPORT-067.md`

**Testing Patterns:**
- Existing Integration Tests: `frontend/src/components/VideosPage.integration.test.tsx`
- Test Helper: `frontend/src/test/renderWithRouter.tsx`
- Vitest Setup: `frontend/src/test/setup.ts`

**Project Guidelines:**
- CLAUDE.md: Testing Patterns (line 39), React Router (line 11)
- Superpowers Skills: `condition-based-waiting`, `test-driven-development`

---

## 13. Success Metrics

**Quantitative:**
- 5 tests implemented (1 main + 4 edge cases)
- 100% pass rate (no flaky failures)
- <10s execution time for full suite
- Zero TypeScript errors
- Zero console errors (except expected WebSocket auth warning)

**Qualitative:**
- Test reads like user story (Design Doc lines 501-520)
- Mocks realistic (match Pydantic schemas from Tasks #64-65)
- Edge cases cover critical failure paths
- Code reusable (fixture factory, helper patterns)

---

## Conclusion

This plan provides a **comprehensive roadmap** for implementing Task #134, the final integration test for Phase 1 MVP Frontend. The test validates the complete user journey from creating a tag with custom fields to displaying field values on video cards, ensuring all 18 Phase 1 Frontend components (Tasks #78-95) work seamlessly together with backend endpoints (Tasks #66-77).

**Key Strengths:**
1. **Realistic User Flow:** Follows Design Doc User Flow Example (lines 501-520) step-by-step
2. **Proven Patterns:** Uses existing integration test patterns (VideosPage.integration.test.tsx)
3. **Comprehensive Coverage:** Main happy path + 4 critical edge cases
4. **Maintainable Mocks:** Factory functions with referential integrity
5. **Detailed Implementation Steps:** 12-phase main test with inline code examples

**Next Steps:**
1. Verify Tasks #68 and #72 completion (blockers)
2. Execute implementation checklist (Section 11)
3. Achieve 100% test pass rate
4. Mark Task #134 complete in status.md
5. Proceed to Phase 2: Settings & Management UI (Tasks #135-104)

---

**Estimated Completion:** 3.5-4.5 hours  
**Risk Level:** Low (patterns proven, dependencies documented)  
**Ready for Implementation:** Yes (pending Tasks #68, #72 completion)
