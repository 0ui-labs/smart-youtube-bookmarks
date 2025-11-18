# Task #134: Write Integration Test - Custom Fields Flow

**Status:** Planning
**Phase:** Phase 1 MVP - Custom Fields System
**Dependencies:** Tasks #64 (CustomField schemas), #65 (FieldSchema schemas), Backend API endpoints
**Related:** Custom Fields System Design (docs/plans/2025-11-05-custom-fields-system-design.md)

---

## Goal

Create a comprehensive frontend integration test that verifies the complete custom fields user flow:
1. Create a tag with a new schema
2. Define custom field with configuration
3. Assign tag to video
4. Set field value on video
5. Verify persistence and UI updates

This test serves as the acceptance criteria for Phase 1 MVP, ensuring all custom fields components work together correctly.

---

## Architecture

### Test Structure

**File:** `frontend/src/tests/CustomFieldsFlow.integration.test.tsx`

**Approach:**
- Integration test using Vitest + React Testing Library
- MSW (Mock Service Worker) for API mocking
- Real React Router + TanStack Query (no mocks)
- Real Zustand stores with cleanup between tests
- User event simulation for realistic interactions

**Test Scope:**
- Happy path: Complete flow works end-to-end
- Error handling: API failures, validation errors
- State persistence: Zustand store + TanStack Query cache
- UI feedback: Loading states, success messages, error toasts

---

## Tech Stack

**Testing:**
- Vitest 1.2.1 (test runner)
- React Testing Library 14.1.2 (component testing)
- @testing-library/user-event 14.6.1 (user interactions)
- @testing-library/jest-dom 6.2.0 (custom matchers)

**API Mocking:**
- MSW (Mock Service Worker) - inline handlers (no separate setup file)
- Mock handlers for: tags, schemas, custom-fields, videos

**State Management:**
- Real TanStack Query (via renderWithRouter)
- Real Zustand stores (with cleanup)

**Router:**
- MemoryRouter (via renderWithRouter helper)

---

## Implementation Tasks

### Task 1: Create Test File Structure (2 min)

**File:** `frontend/src/tests/CustomFieldsFlow.integration.test.tsx`

**Code:**
```typescript
/**
 * Integration Test: Custom Fields Flow (Task #134)
 *
 * Tests the complete user journey for custom fields:
 * 1. Create tag with new schema
 * 2. Define custom field with configuration
 * 3. Assign tag to video
 * 4. Set field value on video
 * 5. Verify persistence and UI updates
 *
 * This test validates Phase 1 MVP acceptance criteria.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { renderWithRouter } from '@/test/renderWithRouter'
import { VideosPage } from '@/components/VideosPage'

// Test data and mocks will go here
```

**Verification:**
```bash
npm test -- CustomFieldsFlow.integration.test.tsx
# Should fail with "No tests found" (file has no tests yet)
```

**Commit:**
```bash
git add frontend/src/tests/CustomFieldsFlow.integration.test.tsx
git commit -m "test(custom-fields): add integration test file structure (Task #134)"
```

---

### Task 2: Create Mock Data Fixtures (3 min)

**File:** Same file as Task 1

**Code (add below imports):**
```typescript
// ============================================================================
// Mock Data Fixtures
// ============================================================================

const MOCK_LIST_ID = 'list-123e4567-e89b-12d3-a456-426614174000'
const MOCK_VIDEO_ID = 'video-123e4567-e89b-12d3-a456-426614174001'
const MOCK_TAG_ID = 'tag-123e4567-e89b-12d3-a456-426614174002'
const MOCK_SCHEMA_ID = 'schema-123e4567-e89b-12d3-a456-426614174003'
const MOCK_FIELD_ID = 'field-123e4567-e89b-12d3-a456-426614174004'

interface MockVideo {
  id: string
  list_id: string
  youtube_id: string
  title: string
  channel: string
  duration: number
  thumbnail_url: string
  processing_status: 'completed'
  tags: any[]
  field_values: any[]
  created_at: string
  updated_at: string
  published_at: string
}

const createMockVideo = (overrides: Partial<MockVideo> = {}): MockVideo => ({
  id: MOCK_VIDEO_ID,
  list_id: MOCK_LIST_ID,
  youtube_id: 'dQw4w9WgXcQ',
  title: 'How to Apply Perfect Eyeliner',
  channel: 'Makeup Mastery',
  duration: 360,
  thumbnail_url: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/default.jpg',
  processing_status: 'completed',
  tags: [],
  field_values: [],
  created_at: '2025-11-08T10:00:00Z',
  updated_at: '2025-11-08T10:00:00Z',
  published_at: '2025-11-07T12:00:00Z',
  ...overrides,
})

const createMockTag = (overrides: any = {}) => ({
  id: MOCK_TAG_ID,
  user_id: 'user-uuid',
  name: 'Makeup Tutorials',
  color: '#FF69B4',
  schema_id: null,
  created_at: '2025-11-08T10:00:00Z',
  updated_at: '2025-11-08T10:00:00Z',
  ...overrides,
})

const createMockSchema = (overrides: any = {}) => ({
  id: MOCK_SCHEMA_ID,
  list_id: MOCK_LIST_ID,
  name: 'Video Quality',
  description: 'Standard quality metrics',
  schema_fields: [],
  created_at: '2025-11-08T10:00:00Z',
  updated_at: '2025-11-08T10:00:00Z',
  ...overrides,
})

const createMockField = (overrides: any = {}) => ({
  id: MOCK_FIELD_ID,
  list_id: MOCK_LIST_ID,
  name: 'Overall Rating',
  field_type: 'rating',
  config: { max_rating: 5 },
  created_at: '2025-11-08T10:00:00Z',
  updated_at: '2025-11-08T10:00:00Z',
  ...overrides,
})
```

**Verification:**
```bash
npm test -- CustomFieldsFlow.integration.test.tsx
# Should still fail (no tests yet), but fixtures are ready
```

**Commit:**
```bash
git add frontend/src/tests/CustomFieldsFlow.integration.test.tsx
git commit -m "test(custom-fields): add mock data fixtures for integration test"
```

---

### Task 3: Set Up MSW Server and Base Handlers (5 min)

**File:** Same file as Task 2

**Code (add below fixtures):**
```typescript
// ============================================================================
// MSW Server Setup
// ============================================================================

const API_BASE = 'http://localhost:8000/api'

// Mutable state for test data (reset in beforeEach)
let mockVideos: MockVideo[] = []
let mockTags: any[] = []
let mockSchemas: any[] = []
let mockFields: any[] = []

const server = setupServer(
  // GET /api/lists/{listId}/videos
  http.get(`${API_BASE}/lists/:listId/videos`, ({ params }) => {
    return HttpResponse.json(mockVideos)
  }),

  // GET /api/lists/{listId}/tags
  http.get(`${API_BASE}/lists/:listId/tags`, ({ params }) => {
    return HttpResponse.json(mockTags)
  }),

  // POST /api/lists/{listId}/tags
  http.post(`${API_BASE}/lists/:listId/tags`, async ({ request, params }) => {
    const body = await request.json() as any
    const newTag = createMockTag({
      id: MOCK_TAG_ID,
      name: body.name,
      color: body.color,
      schema_id: body.schema_id || null,
    })
    mockTags.push(newTag)
    return HttpResponse.json(newTag, { status: 201 })
  }),

  // GET /api/lists/{listId}/schemas
  http.get(`${API_BASE}/lists/:listId/schemas`, ({ params }) => {
    return HttpResponse.json(mockSchemas)
  }),

  // POST /api/lists/{listId}/schemas
  http.post(`${API_BASE}/lists/:listId/schemas`, async ({ request, params }) => {
    const body = await request.json() as any
    const newSchema = createMockSchema({
      id: MOCK_SCHEMA_ID,
      name: body.name,
      description: body.description,
      schema_fields: body.fields?.map((f: any, index: number) => ({
        field_id: f.field_id,
        schema_id: MOCK_SCHEMA_ID,
        display_order: f.display_order ?? index,
        show_on_card: f.show_on_card ?? false,
        field: mockFields.find(field => field.id === f.field_id) || createMockField({ id: f.field_id }),
      })) || [],
    })
    mockSchemas.push(newSchema)
    return HttpResponse.json(newSchema, { status: 201 })
  }),

  // GET /api/lists/{listId}/custom-fields
  http.get(`${API_BASE}/lists/:listId/custom-fields`, ({ params }) => {
    return HttpResponse.json(mockFields)
  }),

  // POST /api/lists/{listId}/custom-fields
  http.post(`${API_BASE}/lists/:listId/custom-fields`, async ({ request, params }) => {
    const body = await request.json() as any
    const newField = createMockField({
      id: MOCK_FIELD_ID,
      name: body.name,
      field_type: body.field_type,
      config: body.config,
    })
    mockFields.push(newField)
    return HttpResponse.json(newField, { status: 201 })
  }),

  // POST /api/lists/{listId}/custom-fields/check-duplicate
  http.post(`${API_BASE}/lists/:listId/custom-fields/check-duplicate`, async ({ request, params }) => {
    const body = await request.json() as any
    const existingField = mockFields.find(
      f => f.name.toLowerCase() === body.name.toLowerCase()
    )
    return HttpResponse.json({
      exists: !!existingField,
      field: existingField || null,
    })
  }),

  // PUT /api/videos/{videoId}/tags
  http.put(`${API_BASE}/videos/:videoId/tags`, async ({ request, params }) => {
    const body = await request.json() as any
    const video = mockVideos.find(v => v.id === params.videoId)
    if (video) {
      video.tags = mockTags.filter(t => body.tag_ids.includes(t.id))
    }
    return HttpResponse.json(video || createMockVideo())
  }),

  // PUT /api/videos/{videoId}/fields
  http.put(`${API_BASE}/videos/:videoId/fields`, async ({ request, params }) => {
    const body = await request.json() as any
    const video = mockVideos.find(v => v.id === params.videoId)
    if (video) {
      video.field_values = body.field_values.map((fv: any) => ({
        id: `value-${fv.field_id}`,
        video_id: params.videoId,
        field_id: fv.field_id,
        field: mockFields.find(f => f.id === fv.field_id) || createMockField({ id: fv.field_id }),
        value: fv.value,
        show_on_card: true,
        updated_at: new Date().toISOString(),
      }))
    }
    return HttpResponse.json(video || createMockVideo())
  }),
)

// Start server before all tests
beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }))

// Reset handlers and test data after each test
afterEach(() => {
  server.resetHandlers()
  mockVideos = []
  mockTags = []
  mockSchemas = []
  mockFields = []
})

// Clean up after all tests
afterAll(() => server.close())
```

**Verification:**
```bash
npm test -- CustomFieldsFlow.integration.test.tsx
# Should import MSW successfully (no import errors)
```

**Note:** If MSW is not installed, run:
```bash
cd frontend
npm install -D msw
```

**Commit:**
```bash
git add frontend/src/tests/CustomFieldsFlow.integration.test.tsx
git commit -m "test(custom-fields): set up MSW server with base handlers"
```

---

### Task 4: Write Test 1 - Create Tag with Schema and Field (10 min)

**File:** Same file as Task 3

**Code (add below MSW setup):**
```typescript
// ============================================================================
// Integration Tests
// ============================================================================

describe('Custom Fields Flow Integration (Task #134)', () => {
  beforeEach(() => {
    // Reset test data before each test
    mockVideos = [createMockVideo()]
    mockTags = []
    mockSchemas = []
    mockFields = []
  })

  describe('Test 1: Create tag with new schema and custom field', () => {
    it('creates tag with schema containing rating field', async () => {
      const user = userEvent.setup()

      // Render VideosPage
      renderWithRouter(<VideosPage listId={MOCK_LIST_ID} />)

      // Wait for page to load
      await waitFor(() => {
        expect(screen.getByText('How to Apply Perfect Eyeliner')).toBeInTheDocument()
      })

      // STEP 1: Click "New Tag" button
      const newTagButton = screen.getByRole('button', { name: /neuer tag/i })
      await user.click(newTagButton)

      // STEP 2: Fill in tag name
      const tagNameInput = screen.getByLabelText(/tag-name/i)
      await user.type(tagNameInput, 'Makeup Tutorials')

      // STEP 3: Click "Create New Schema" option
      const createSchemaButton = screen.getByRole('button', { name: /schema erstellen/i })
      await user.click(createSchemaButton)

      // STEP 4: Fill in schema details
      const schemaNameInput = screen.getByLabelText(/schema-name/i)
      await user.type(schemaNameInput, 'Video Quality')

      const schemaDescInput = screen.getByLabelText(/beschreibung/i)
      await user.type(schemaDescInput, 'Standard quality metrics')

      // STEP 5: Click "Add Field" to create new field
      const addFieldButton = screen.getByRole('button', { name: /feld hinzufügen/i })
      await user.click(addFieldButton)

      // STEP 6: Fill in field details
      const fieldNameInput = screen.getByLabelText(/feld-name/i)
      await user.type(fieldNameInput, 'Overall Rating')

      // STEP 7: Select field type "Rating"
      const fieldTypeSelect = screen.getByLabelText(/feld-typ/i)
      await user.click(fieldTypeSelect)
      const ratingOption = screen.getByRole('option', { name: /bewertung/i })
      await user.click(ratingOption)

      // STEP 8: Configure max rating (should default to 5)
      // Verify config form shows max_rating input
      const maxRatingInput = screen.getByLabelText(/maximale bewertung/i)
      expect(maxRatingInput).toHaveValue(5)

      // STEP 9: Toggle "Show on Card"
      const showOnCardCheckbox = screen.getByLabelText(/auf karte anzeigen/i)
      await user.click(showOnCardCheckbox)
      expect(showOnCardCheckbox).toBeChecked()

      // STEP 10: Save field
      const saveFieldButton = screen.getByRole('button', { name: /feld speichern/i })
      await user.click(saveFieldButton)

      // STEP 11: Verify field appears in schema fields list
      await waitFor(() => {
        expect(screen.getByText('Overall Rating')).toBeInTheDocument()
      })

      // STEP 12: Save tag
      const saveTagButton = screen.getByRole('button', { name: /tag speichern/i })
      await user.click(saveTagButton)

      // STEP 13: Verify tag appears in tag list
      await waitFor(() => {
        expect(screen.getByText('Makeup Tutorials')).toBeInTheDocument()
      })

      // Verify API calls were made
      expect(mockFields).toHaveLength(1)
      expect(mockFields[0].name).toBe('Overall Rating')
      expect(mockFields[0].field_type).toBe('rating')

      expect(mockSchemas).toHaveLength(1)
      expect(mockSchemas[0].name).toBe('Video Quality')
      expect(mockSchemas[0].schema_fields).toHaveLength(1)

      expect(mockTags).toHaveLength(1)
      expect(mockTags[0].name).toBe('Makeup Tutorials')
      expect(mockTags[0].schema_id).toBe(MOCK_SCHEMA_ID)
    })
  })
})
```

**Verification:**
```bash
npm test -- CustomFieldsFlow.integration.test.tsx
# Expected: RED - Test fails (components don't exist yet)
```

**Commit:**
```bash
git add frontend/src/tests/CustomFieldsFlow.integration.test.tsx
git commit -m "test(custom-fields): add Test 1 - create tag with schema and field (RED)"
```

---

### Task 5: Write Test 2 - Assign Tag to Video and Set Field Value (8 min)

**File:** Same file as Task 4

**Code (add below Test 1):**
```typescript
  describe('Test 2: Assign tag to video and set field value', () => {
    beforeEach(() => {
      // Pre-populate with existing tag, schema, and field
      const field = createMockField()
      const schema = createMockSchema({
        schema_fields: [{
          field_id: MOCK_FIELD_ID,
          schema_id: MOCK_SCHEMA_ID,
          display_order: 0,
          show_on_card: true,
          field,
        }],
      })
      const tag = createMockTag({ schema_id: MOCK_SCHEMA_ID })

      mockFields = [field]
      mockSchemas = [schema]
      mockTags = [tag]
    })

    it('assigns tag to video and sets rating field value to 5 stars', async () => {
      const user = userEvent.setup()

      // Render VideosPage
      renderWithRouter(<VideosPage listId={MOCK_LIST_ID} />)

      // Wait for video to render
      await waitFor(() => {
        expect(screen.getByText('How to Apply Perfect Eyeliner')).toBeInTheDocument()
      })

      // STEP 1: Open video card menu (three-dot menu)
      const videoCard = screen.getByTestId(`video-card-${MOCK_VIDEO_ID}`)
      const menuButton = within(videoCard).getByLabelText(/aktionen/i)
      await user.click(menuButton)

      // STEP 2: Click "Assign Tags"
      const assignTagsButton = screen.getByRole('menuitem', { name: /tags zuweisen/i })
      await user.click(assignTagsButton)

      // STEP 3: Select "Makeup Tutorials" tag
      const tagCheckbox = screen.getByRole('checkbox', { name: /makeup tutorials/i })
      await user.click(tagCheckbox)
      expect(tagCheckbox).toBeChecked()

      // STEP 4: Save tag assignment
      const saveButton = screen.getByRole('button', { name: /zuweisen/i })
      await user.click(saveButton)

      // STEP 5: Wait for tag to appear on video card
      await waitFor(() => {
        expect(within(videoCard).getByText('Makeup Tutorials')).toBeInTheDocument()
      })

      // STEP 6: Verify custom field appears on card
      await waitFor(() => {
        const ratingField = within(videoCard).getByLabelText(/overall rating/i)
        expect(ratingField).toBeInTheDocument()
      })

      // STEP 7: Click 5th star to set rating
      const stars = within(videoCard).getAllByRole('button', { name: /stern/i })
      await user.click(stars[4]) // 5th star (0-indexed)

      // STEP 8: Verify rating is updated (should show 5 filled stars)
      await waitFor(() => {
        const filledStars = within(videoCard).getAllByRole('img', { name: /gefüllt/i })
        expect(filledStars).toHaveLength(5)
      })

      // Verify API calls
      expect(mockVideos[0].tags).toHaveLength(1)
      expect(mockVideos[0].tags[0].id).toBe(MOCK_TAG_ID)

      expect(mockVideos[0].field_values).toHaveLength(1)
      expect(mockVideos[0].field_values[0].field_id).toBe(MOCK_FIELD_ID)
      expect(mockVideos[0].field_values[0].value).toBe(5)
    })
  })
```

**Verification:**
```bash
npm test -- CustomFieldsFlow.integration.test.tsx
# Expected: RED - Test 2 fails (components don't exist yet)
```

**Commit:**
```bash
git add frontend/src/tests/CustomFieldsFlow.integration.test.tsx
git commit -m "test(custom-fields): add Test 2 - assign tag and set field value (RED)"
```

---

### Task 6: Write Test 3 - Duplicate Field Name Validation (5 min)

**File:** Same file as Task 5

**Code (add below Test 2):**
```typescript
  describe('Test 3: Duplicate field name validation', () => {
    beforeEach(() => {
      // Pre-populate with existing field named "Overall Rating"
      mockFields = [createMockField({ name: 'Overall Rating' })]
    })

    it('shows warning when creating field with duplicate name (case-insensitive)', async () => {
      const user = userEvent.setup()

      renderWithRouter(<VideosPage listId={MOCK_LIST_ID} />)

      // Open new tag dialog
      const newTagButton = screen.getByRole('button', { name: /neuer tag/i })
      await user.click(newTagButton)

      // Create new schema
      const createSchemaButton = screen.getByRole('button', { name: /schema erstellen/i })
      await user.click(createSchemaButton)

      // Add new field
      const addFieldButton = screen.getByRole('button', { name: /feld hinzufügen/i })
      await user.click(addFieldButton)

      // Type duplicate name (different case)
      const fieldNameInput = screen.getByLabelText(/feld-name/i)
      await user.type(fieldNameInput, 'overall rating')

      // Wait for duplicate check API call
      await waitFor(() => {
        expect(screen.getByText(/feld existiert bereits/i)).toBeInTheDocument()
      }, { timeout: 3000 })

      // Verify suggestion to reuse existing field
      expect(screen.getByText(/verwenden sie das vorhandene feld/i)).toBeInTheDocument()

      // Verify "Reuse Field" button appears
      const reuseButton = screen.getByRole('button', { name: /vorhandenes feld verwenden/i })
      expect(reuseButton).toBeInTheDocument()

      // Click reuse button
      await user.click(reuseButton)

      // Verify existing field is selected instead of creating new one
      await waitFor(() => {
        expect(screen.getByText('Overall Rating')).toBeInTheDocument()
        expect(screen.queryByLabelText(/feld-name/i)).not.toBeInTheDocument()
      })
    })
  })
```

**Verification:**
```bash
npm test -- CustomFieldsFlow.integration.test.tsx
# Expected: RED - Test 3 fails (duplicate check not implemented)
```

**Commit:**
```bash
git add frontend/src/tests/CustomFieldsFlow.integration.test.tsx
git commit -m "test(custom-fields): add Test 3 - duplicate field validation (RED)"
```

---

### Task 7: Write Test 4 - Error Handling for API Failures (5 min)

**File:** Same file as Task 6

**Code (add below Test 3):**
```typescript
  describe('Test 4: Error handling for API failures', () => {
    it('shows error toast when field creation fails', async () => {
      const user = userEvent.setup()

      // Override POST /custom-fields to return error
      server.use(
        http.post(`${API_BASE}/lists/:listId/custom-fields`, () => {
          return HttpResponse.json(
            { detail: 'Validation error: Invalid field_type' },
            { status: 400 }
          )
        })
      )

      renderWithRouter(<VideosPage listId={MOCK_LIST_ID} />)

      // Open new tag dialog
      const newTagButton = screen.getByRole('button', { name: /neuer tag/i })
      await user.click(newTagButton)

      // Create schema and add field
      const createSchemaButton = screen.getByRole('button', { name: /schema erstellen/i })
      await user.click(createSchemaButton)

      const addFieldButton = screen.getByRole('button', { name: /feld hinzufügen/i })
      await user.click(addFieldButton)

      // Fill in field details
      const fieldNameInput = screen.getByLabelText(/feld-name/i)
      await user.type(fieldNameInput, 'Test Field')

      // Try to save (should fail)
      const saveFieldButton = screen.getByRole('button', { name: /feld speichern/i })
      await user.click(saveFieldButton)

      // Verify error toast appears
      await waitFor(() => {
        expect(screen.getByText(/fehler beim erstellen/i)).toBeInTheDocument()
        expect(screen.getByText(/validation error/i)).toBeInTheDocument()
      })

      // Verify field was NOT added to list
      expect(mockFields).toHaveLength(0)
    })

    it('shows error when schema creation fails due to > 3 show_on_card fields', async () => {
      const user = userEvent.setup()

      // Pre-populate with 4 fields
      mockFields = [
        createMockField({ id: 'field-1', name: 'Field 1' }),
        createMockField({ id: 'field-2', name: 'Field 2' }),
        createMockField({ id: 'field-3', name: 'Field 3' }),
        createMockField({ id: 'field-4', name: 'Field 4' }),
      ]

      // Override POST /schemas to return validation error
      server.use(
        http.post(`${API_BASE}/lists/:listId/schemas`, () => {
          return HttpResponse.json(
            { detail: 'At most 3 fields can have show_on_card=true' },
            { status: 400 }
          )
        })
      )

      renderWithRouter(<VideosPage listId={MOCK_LIST_ID} />)

      // Create tag with schema
      const newTagButton = screen.getByRole('button', { name: /neuer tag/i })
      await user.click(newTagButton)

      const createSchemaButton = screen.getByRole('button', { name: /schema erstellen/i })
      await user.click(createSchemaButton)

      // Select all 4 fields and mark them all as show_on_card
      const selectFieldButton = screen.getByRole('button', { name: /vorhandene felder/i })
      await user.click(selectFieldButton)

      for (let i = 1; i <= 4; i++) {
        const checkbox = screen.getByRole('checkbox', { name: new RegExp(`Field ${i}`) })
        await user.click(checkbox)
      }

      // Try to save (should fail)
      const saveButton = screen.getByRole('button', { name: /schema speichern/i })
      await user.click(saveButton)

      // Verify validation error appears
      await waitFor(() => {
        expect(screen.getByText(/höchstens 3 felder/i)).toBeInTheDocument()
      })
    })
  })
```

**Verification:**
```bash
npm test -- CustomFieldsFlow.integration.test.tsx
# Expected: RED - Test 4 fails (error handling not implemented)
```

**Commit:**
```bash
git add frontend/src/tests/CustomFieldsFlow.integration.test.tsx
git commit -m "test(custom-fields): add Test 4 - API error handling (RED)"
```

---

### Task 8: Write Test 5 - Multiple Field Types (6 min)

**File:** Same file as Task 7

**Code (add below Test 4):**
```typescript
  describe('Test 5: Multiple field types (select, rating, boolean, text)', () => {
    it('creates schema with all 4 field types and sets values', async () => {
      const user = userEvent.setup()

      renderWithRouter(<VideosPage listId={MOCK_LIST_ID} />)

      // Create tag with multi-field schema
      const newTagButton = screen.getByRole('button', { name: /neuer tag/i })
      await user.click(newTagButton)

      await user.type(screen.getByLabelText(/tag-name/i), 'Tutorial')

      const createSchemaButton = screen.getByRole('button', { name: /schema erstellen/i })
      await user.click(createSchemaButton)

      await user.type(screen.getByLabelText(/schema-name/i), 'Tutorial Metrics')

      // FIELD 1: Rating (1-5 stars)
      const addFieldButton = screen.getByRole('button', { name: /feld hinzufügen/i })
      await user.click(addFieldButton)
      await user.type(screen.getByLabelText(/feld-name/i), 'Quality Rating')
      await user.selectOptions(screen.getByLabelText(/feld-typ/i), 'rating')
      await user.click(screen.getByLabelText(/auf karte anzeigen/i))
      await user.click(screen.getByRole('button', { name: /feld speichern/i }))

      // FIELD 2: Select (dropdown options)
      await user.click(addFieldButton)
      await user.type(screen.getByLabelText(/feld-name/i), 'Difficulty')
      await user.selectOptions(screen.getByLabelText(/feld-typ/i), 'select')
      
      // Add options
      const optionsInput = screen.getByLabelText(/optionen/i)
      await user.type(optionsInput, 'Beginner{Enter}Intermediate{Enter}Advanced')
      
      await user.click(screen.getByLabelText(/auf karte anzeigen/i))
      await user.click(screen.getByRole('button', { name: /feld speichern/i }))

      // FIELD 3: Boolean (checkbox)
      await user.click(addFieldButton)
      await user.type(screen.getByLabelText(/feld-name/i), 'Has Subtitles')
      await user.selectOptions(screen.getByLabelText(/feld-typ/i), 'boolean')
      await user.click(screen.getByLabelText(/auf karte anzeigen/i))
      await user.click(screen.getByRole('button', { name: /feld speichern/i }))

      // FIELD 4: Text (not shown on card, only in modal)
      await user.click(addFieldButton)
      await user.type(screen.getByLabelText(/feld-name/i), 'Notes')
      await user.selectOptions(screen.getByLabelText(/feld-typ/i), 'text')
      // Don't check show_on_card (should stay false)
      await user.click(screen.getByRole('button', { name: /feld speichern/i }))

      // Save tag
      await user.click(screen.getByRole('button', { name: /tag speichern/i }))

      // Verify all 4 fields were created
      await waitFor(() => {
        expect(mockFields).toHaveLength(4)
      })

      expect(mockFields.map(f => f.field_type)).toEqual(['rating', 'select', 'boolean', 'text'])

      // Assign tag to video
      const videoCard = screen.getByTestId(`video-card-${MOCK_VIDEO_ID}`)
      const menuButton = within(videoCard).getByLabelText(/aktionen/i)
      await user.click(menuButton)

      await user.click(screen.getByRole('menuitem', { name: /tags zuweisen/i }))
      await user.click(screen.getByRole('checkbox', { name: /tutorial/i }))
      await user.click(screen.getByRole('button', { name: /zuweisen/i }))

      // Wait for fields to appear on card
      await waitFor(() => {
        expect(within(videoCard).getByLabelText(/quality rating/i)).toBeInTheDocument()
      })

      // Set field values
      // 1. Rating: Click 4 stars
      const stars = within(videoCard).getAllByRole('button', { name: /stern/i })
      await user.click(stars[3]) // 4th star

      // 2. Select: Choose "Intermediate"
      const difficultySelect = within(videoCard).getByLabelText(/difficulty/i)
      await user.click(difficultySelect)
      await user.click(screen.getByRole('option', { name: /intermediate/i }))

      // 3. Boolean: Check "Has Subtitles"
      const subtitlesCheckbox = within(videoCard).getByLabelText(/has subtitles/i)
      await user.click(subtitlesCheckbox)

      // Verify only 3 fields shown on card (not "Notes")
      expect(within(videoCard).queryByLabelText(/notes/i)).not.toBeInTheDocument()

      // Open video details modal to see all fields
      await user.click(within(videoCard).getByRole('button', { name: /details/i }))

      // Verify modal shows all 4 fields
      const modal = screen.getByRole('dialog', { name: /video details/i })
      expect(within(modal).getByLabelText(/quality rating/i)).toBeInTheDocument()
      expect(within(modal).getByLabelText(/difficulty/i)).toBeInTheDocument()
      expect(within(modal).getByLabelText(/has subtitles/i)).toBeInTheDocument()
      expect(within(modal).getByLabelText(/notes/i)).toBeInTheDocument()

      // Set text field value in modal
      const notesInput = within(modal).getByLabelText(/notes/i)
      await user.type(notesInput, 'Great tutorial with clear explanations')

      // Save modal
      await user.click(within(modal).getByRole('button', { name: /speichern/i }))

      // Verify all field values were saved
      await waitFor(() => {
        expect(mockVideos[0].field_values).toHaveLength(4)
      })

      const fieldValues = mockVideos[0].field_values
      expect(fieldValues.find((fv: any) => fv.field.name === 'Quality Rating')?.value).toBe(4)
      expect(fieldValues.find((fv: any) => fv.field.name === 'Difficulty')?.value).toBe('Intermediate')
      expect(fieldValues.find((fv: any) => fv.field.name === 'Has Subtitles')?.value).toBe(true)
      expect(fieldValues.find((fv: any) => fv.field.name === 'Notes')?.value).toBe('Great tutorial with clear explanations')
    })
  })
})
```

**Verification:**
```bash
npm test -- CustomFieldsFlow.integration.test.tsx
# Expected: RED - Test 5 fails (components don't exist yet)
```

**Commit:**
```bash
git add frontend/src/tests/CustomFieldsFlow.integration.test.tsx
git commit -m "test(custom-fields): add Test 5 - multiple field types (RED)"
```

---

### Task 9: Add Missing Imports and Fix TypeScript Errors (3 min)

**File:** Same file as Task 8

**Code (update imports at top):**
```typescript
/**
 * Integration Test: Custom Fields Flow (Task #134)
 *
 * Tests the complete user journey for custom fields:
 * 1. Create tag with new schema
 * 2. Define custom field with configuration
 * 3. Assign tag to video
 * 4. Set field value on video
 * 5. Verify persistence and UI updates
 *
 * This test validates Phase 1 MVP acceptance criteria.
 */
import { describe, it, expect, vi, beforeEach, afterEach, beforeAll, afterAll } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { renderWithRouter } from '@/test/renderWithRouter'
import { VideosPage } from '@/components/VideosPage'

// If MSW types are missing, install:
// npm install -D msw@latest
```

**Verification:**
```bash
npm test -- CustomFieldsFlow.integration.test.tsx
# Should compile without TypeScript errors
# Tests should fail (RED) with expected failures (components not implemented)
```

**Commit:**
```bash
git add frontend/src/tests/CustomFieldsFlow.integration.test.tsx
git commit -m "test(custom-fields): fix imports and TypeScript errors"
```

---

### Task 10: Run Full Test Suite and Document Expected Failures (2 min)

**Commands:**
```bash
cd frontend
npm test -- CustomFieldsFlow.integration.test.tsx --reporter=verbose
```

**Expected Output:**
```
FAIL  src/tests/CustomFieldsFlow.integration.test.tsx
  Custom Fields Flow Integration (Task #134)
    Test 1: Create tag with new schema and custom field
      ✕ creates tag with schema containing rating field (XXms)
    Test 2: Assign tag to video and set field value
      ✕ assigns tag to video and sets rating field value to 5 stars (XXms)
    Test 3: Duplicate field name validation
      ✕ shows warning when creating field with duplicate name (XXms)
    Test 4: Error handling for API failures
      ✕ shows error toast when field creation fails (XXms)
      ✕ shows error when schema creation fails due to > 3 show_on_card fields (XXms)
    Test 5: Multiple field types
      ✕ creates schema with all 4 field types and sets values (XXms)

Tests Failed: 6 of 6
```

**Create Test Report:**

**File:** `docs/reports/task-134-test-report.md`

**Code:**
```markdown
# Task #134 Test Report: Custom Fields Integration Test

**Date:** 2025-11-08
**Status:** RED (Tests written, awaiting implementation)

## Summary

Created comprehensive integration test suite for custom fields flow with 6 test scenarios covering:
- Tag creation with schema and fields
- Tag assignment and field value setting
- Duplicate field validation
- Error handling
- Multiple field types

## Test Results

All 6 tests currently FAIL as expected (RED phase of TDD).

**Failures:**
- Components not yet implemented (TagEditDialog schema section, SchemaEditor, FieldSelector, etc.)
- API hooks not yet created (useSchemas, useCustomFields, useVideoFieldValues)
- UI interactions not yet wired up

## Next Steps

**Implementation Order:**
1. Task #118: Create useSchemas and useCustomFields hooks
2. Task #120: Extend TagEditDialog with schema selector
3. Task #121: Create SchemaEditor component
4. Task #123: Create NewFieldForm component
5. Task #125: Create DuplicateWarning component
6. Task #127: Create CustomFieldsPreview component
7. Task #128: Create FieldDisplay component
8. Task #130: Create VideoDetailsModal component

**Expected Timeline:**
- Hooks: 1-2 days
- Components: 3-4 days
- Integration: 1 day
- **Total: 5-7 days to GREEN**

## Test Coverage

**Scenarios Covered:**
- ✅ Happy path: Complete end-to-end flow
- ✅ Validation: Duplicate field names (case-insensitive)
- ✅ Error handling: API failures with user feedback
- ✅ Field types: Rating, Select, Boolean, Text
- ✅ UI constraints: Max 3 fields on card
- ✅ Modal vs Card: Field visibility logic

**Not Yet Covered (Future Tasks):**
- Multi-tag field unions
- Field name conflicts with different types
- Schema editing/deletion
- Field filtering and sorting
- Bulk operations

## Commands

Run tests:
```bash
cd frontend
npm test -- CustomFieldsFlow.integration.test.tsx
```

Run with watch mode:
```bash
npm test -- CustomFieldsFlow.integration.test.tsx --watch
```

Run with coverage:
```bash
npm test -- CustomFieldsFlow.integration.test.tsx --coverage
```
```

**Commit:**
```bash
git add frontend/src/tests/CustomFieldsFlow.integration.test.tsx
git add docs/reports/task-134-test-report.md
git commit -m "test(custom-fields): complete integration test suite (Task #134)

- Add 6 comprehensive test scenarios
- Cover happy path, validation, errors, and field types
- Document expected failures in test report
- Ready for implementation phase (Tasks #118-#132)

All tests currently RED (as expected in TDD).
Implementation will make tests GREEN over next 5-7 days."
```

---

## Verification Commands

**Run tests (expect failures):**
```bash
cd frontend
npm test -- CustomFieldsFlow.integration.test.tsx --reporter=verbose
```

**Check TypeScript compilation:**
```bash
npx tsc --noEmit
```

**Run all frontend tests:**
```bash
npm test
```

**Check test coverage:**
```bash
npm test -- CustomFieldsFlow.integration.test.tsx --coverage
```

---

## Expected Test Output After Implementation

Once all components are implemented (Tasks #118-#132), tests should output:

```
PASS  src/tests/CustomFieldsFlow.integration.test.tsx
  Custom Fields Flow Integration (Task #134)
    Test 1: Create tag with new schema and custom field
      ✓ creates tag with schema containing rating field (245ms)
    Test 2: Assign tag to video and set field value
      ✓ assigns tag to video and sets rating field value to 5 stars (189ms)
    Test 3: Duplicate field name validation
      ✓ shows warning when creating field with duplicate name (156ms)
    Test 4: Error handling for API failures
      ✓ shows error toast when field creation fails (98ms)
      ✓ shows error when schema creation fails due to > 3 show_on_card fields (112ms)
    Test 5: Multiple field types
      ✓ creates schema with all 4 field types and sets values (387ms)

Tests Passed: 6 of 6
Time: 2.145s
```

---

## Notes

### Why Integration Test First?

**Benefits of TDD Approach:**
1. **Clear acceptance criteria:** Tests define what "done" looks like
2. **Component contracts:** Tests reveal API surface before implementation
3. **Regression prevention:** Prevents breaking existing flow during refactors
4. **Documentation:** Tests serve as living documentation of user flows

### MSW vs Component Mocks

**Why MSW?**
- Tests real HTTP requests (more realistic than mocks)
- Catches serialization/deserialization bugs
- Reusable handlers for other tests
- No need to mock TanStack Query

**Alternative (not chosen):**
- Mock all hooks: More fragile, tests implementation details
- Mock API client: Misses request/response validation

### Test Data Management

**Mutable state pattern:**
```typescript
let mockVideos: MockVideo[] = []

beforeEach(() => {
  mockVideos = [createMockVideo()] // Reset before each test
})
```

**Why not MSW database?**
- Simpler for integration tests (no persistent state)
- Each test starts with clean slate
- Easier to debug (state visible in test file)

### Future Enhancements

**Additional test scenarios (Phase 2+):**
- Multi-tag field unions (same name, different types)
- Schema editing with field reordering
- Bulk tag assignment with field defaults
- Field-based filtering and sorting
- CSV export with custom fields
- Performance test with 1000+ videos

---

## Dependencies

**NPM Packages:**
- `msw@latest` (Mock Service Worker)
- `@testing-library/react@14.1.2`
- `@testing-library/user-event@14.6.1`
- `vitest@1.2.1`

**Install if missing:**
```bash
cd frontend
npm install -D msw@latest
```

**TypeScript Types:**
```bash
npm install -D @types/node  # For MSW node environment
```

---

## Success Criteria

**Definition of Done:**
- ✅ All 6 tests written and committed
- ✅ Tests currently fail (RED phase)
- ✅ Test report documented
- ✅ No TypeScript compilation errors
- ✅ MSW server set up correctly
- ✅ Fixtures cover all field types
- ✅ Error handling scenarios included

**Ready for Implementation:**
- Tasks #118-#132 can now reference this test file
- Each component implementation should make subset of tests pass
- Final PR should make all tests GREEN

---

**End of Implementation Plan**
