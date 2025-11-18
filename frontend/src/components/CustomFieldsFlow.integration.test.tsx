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
 *
 * ADAPTED: Uses global MSW server from @/test/mocks/server (Task #133 pattern)
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event' // ✅ Default import
import { http, HttpResponse } from 'msw'
import { server } from '@/test/mocks/server' // ✅ Use global server
import { renderWithRouter } from '@/test/renderWithRouter'
import { VideosPage } from '@/components/VideosPage'

// ============================================================================
// Mock Data Fixtures (Inline factories - Task #133 pattern)
// ============================================================================

const API_BASE = 'http://localhost:8000/api'

const MOCK_LIST_ID = '123e4567-e89b-12d3-a456-426614174000'
const MOCK_VIDEO_ID = '223e4567-e89b-12d3-a456-426614174001'
const MOCK_TAG_ID = '323e4567-e89b-12d3-a456-426614174002'
const MOCK_SCHEMA_ID = '423e4567-e89b-12d3-a456-426614174003'
const MOCK_FIELD_ID = '523e4567-e89b-12d3-a456-426614174004'

interface MockVideo {
  id: string
  list_id: string
  youtube_id: string
  title: string | null
  channel: string | null
  duration: number | null
  thumbnail_url: string | null
  published_at: string | null
  processing_status: 'completed'
  tags: any[]
  field_values?: any[]
  error_message: string | null
  created_at: string
  updated_at: string
}

const createMockVideo = (overrides: Partial<MockVideo> = {}): MockVideo => ({
  id: MOCK_VIDEO_ID,
  list_id: MOCK_LIST_ID,
  youtube_id: 'dQw4w9WgXcQ',
  title: 'How to Apply Perfect Eyeliner',
  channel: 'Makeup Mastery',
  duration: 360,
  thumbnail_url: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/default.jpg',
  published_at: '2025-11-07T12:00:00Z',
  processing_status: 'completed',
  tags: [],
  field_values: [],
  error_message: null,
  created_at: '2025-11-08T10:00:00Z',
  updated_at: '2025-11-08T10:00:00Z',
  ...overrides,
})

const createMockTag = (overrides: any = {}) => ({
  id: MOCK_TAG_ID,
  user_id: '623e4567-e89b-12d3-a456-426614174005',
  list_id: MOCK_LIST_ID,
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

// Mutable state for test data (reset in beforeEach)
let mockVideos: MockVideo[] = []
let mockTags: any[] = []
let mockSchemas: any[] = []
let mockFields: any[] = []

// ============================================================================
// Test Lifecycle (Uses global MSW server from setup.ts)
// ============================================================================

describe('Custom Fields Flow Integration (Task #134)', () => {
  beforeEach(() => {
    // Reset test data before each test (clear arrays instead of replacing them)
    mockVideos.length = 0
    mockVideos.push(createMockVideo())
    mockTags.length = 0
    mockSchemas.length = 0
    mockFields.length = 0

    // Extend global MSW server with test-specific handlers
    server.use(
      // GET /api/tags
      http.get('/api/tags', () => {
        return HttpResponse.json(mockTags)
      }),

      // GET /api/lists/{listId}/videos
      http.get('/api/lists/:listId/videos', () => {
        return HttpResponse.json(mockVideos)
      }),

      // POST /api/lists/{listId}/tags
      http.post('/api/lists/:listId/tags', async ({ request }) => {
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
      http.get('/api/lists/:listId/schemas', () => {
        return HttpResponse.json(mockSchemas)
      }),

      // POST /api/lists/{listId}/schemas
      http.post('/api/lists/:listId/schemas', async ({ request }) => {
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
      http.get('/api/lists/:listId/custom-fields', () => {
        return HttpResponse.json(mockFields)
      }),

      // POST /api/lists/{listId}/custom-fields
      http.post('/api/lists/:listId/custom-fields', async ({ request }) => {
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
      http.post('/api/lists/:listId/custom-fields/check-duplicate', async ({ request }) => {
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
      http.put('/api/videos/:videoId/tags', async ({ request, params }) => {
        const body = await request.json() as any
        const video = mockVideos.find(v => v.id === params.videoId)
        if (video) {
          video.tags = mockTags.filter(t => body.tag_ids.includes(t.id))
        }
        return HttpResponse.json(video || createMockVideo())
      }),

      // PUT /api/videos/{videoId}/fields
      http.put('/api/videos/:videoId/fields', async ({ request, params }) => {
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
      })
    )
  })

  afterEach(() => {
    // Reset handlers (inherited from global setup.ts)
    // Also reset mutable state to prevent test pollution
    mockVideos.length = 0
    mockTags.length = 0
    mockSchemas.length = 0
    mockFields.length = 0
  })

  describe('Test 1: Create tag with new schema and custom field', () => {
    it('creates tag with schema containing rating field (outcome-based)', async () => {
      const user = userEvent.setup({ delay: null }) // ✅ Project standard

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
      const tagNameInput = screen.getByLabelText(/tag.*name/i)
      await user.type(tagNameInput, 'Makeup Tutorials')

      // STEP 3: Create schema (outcome-based assertion)
      // Note: JSDOM limitations prevent testing Radix UI Select interactions
      // Instead, we verify the form submission contains correct schema data

      // Fill schema form fields that ARE testable in JSDOM
      const schemaNameInput = screen.getByLabelText(/schema.*name/i)
      await user.type(schemaNameInput, 'Video Quality')

      // STEP 4: Add field (focus on form data, not UI interactions)
      const addFieldButton = screen.getByRole('button', { name: /feld.*hinzufügen/i })
      await user.click(addFieldButton)

      const fieldNameInput = screen.getByLabelText(/feld.*name/i)
      await user.type(fieldNameInput, 'Overall Rating')

      // STEP 5: Save tag
      const saveTagButton = screen.getByRole('button', { name: /speichern|save/i })
      await user.click(saveTagButton)

      // STEP 6: Verify API calls (outcome-based)
      await waitFor(() => {
        expect(mockFields).toHaveLength(1)
        expect(mockFields[0].name).toBe('Overall Rating')
        expect(mockFields[0].field_type).toBe('rating')
      })

      await waitFor(() => {
        expect(mockSchemas).toHaveLength(1)
        expect(mockSchemas[0].name).toBe('Video Quality')
      })

      await waitFor(() => {
        expect(mockTags).toHaveLength(1)
        expect(mockTags[0].name).toBe('Makeup Tutorials')
        expect(mockTags[0].schema_id).toBe(MOCK_SCHEMA_ID)
      })

      // STEP 7: Verify UI updated (tag appears in list)
      expect(screen.getByText('Makeup Tutorials')).toBeInTheDocument()
    })
  })

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
      const user = userEvent.setup({ delay: null })

      renderWithRouter(<VideosPage listId={MOCK_LIST_ID} />)

      // Wait for video to render
      await waitFor(() => {
        expect(screen.getByText('How to Apply Perfect Eyeliner')).toBeInTheDocument()
      })

      // STEP 1: Open video actions menu
      const videoCard = screen.getByTestId(`video-card-${MOCK_VIDEO_ID}`)
      const menuButton = within(videoCard).getByLabelText(/aktionen|actions/i)
      await user.click(menuButton)

      // STEP 2: Click "Assign Tags"
      const assignTagsButton = screen.getByRole('menuitem', { name: /tags.*zuweisen|assign.*tags/i })
      await user.click(assignTagsButton)

      // STEP 3: Select tag
      const tagCheckbox = screen.getByRole('checkbox', { name: /makeup tutorials/i })
      await user.click(tagCheckbox)

      // STEP 4: Save tag assignment
      const saveButton = screen.getByRole('button', { name: /zuweisen|assign/i })
      await user.click(saveButton)

      // STEP 5: Verify tag appears on card
      await waitFor(() => {
        expect(within(videoCard).getByText('Makeup Tutorials')).toBeInTheDocument()
      })

      // STEP 6: Verify field appears and set value
      await waitFor(() => {
        const ratingField = within(videoCard).getByLabelText(/overall rating/i)
        expect(ratingField).toBeInTheDocument()
      })

      // Click 5th star
      const stars = within(videoCard).getAllByRole('button', { name: /stern|star/i })
      await user.click(stars[4]) // 5th star (0-indexed)

      // STEP 7: Verify outcome (field value saved)
      await waitFor(() => {
        expect(mockVideos[0].field_values).toHaveLength(1)
        expect(mockVideos[0].field_values[0].value).toBe(5)
      })
    })
  })

  describe('Test 3: Error handling for API failures', () => {
    it('shows error toast when field creation fails', async () => {
      const user = userEvent.setup({ delay: null })

      // Override handler to return error (using global server)
      server.use(
        http.post('/api/lists/:listId/custom-fields', () => {
          return HttpResponse.json(
            { detail: 'Validation error: Invalid field_type' },
            { status: 400 }
          )
        })
      )

      renderWithRouter(<VideosPage listId={MOCK_LIST_ID} />)

      // Open new tag dialog and try to create field
      const newTagButton = screen.getByRole('button', { name: /neuer tag/i })
      await user.click(newTagButton)

      const addFieldButton = screen.getByRole('button', { name: /feld.*hinzufügen/i })
      await user.click(addFieldButton)

      const fieldNameInput = screen.getByLabelText(/feld.*name/i)
      await user.type(fieldNameInput, 'Test Field')

      const saveFieldButton = screen.getByRole('button', { name: /feld.*speichern/i })
      await user.click(saveFieldButton)

      // Verify error toast appears
      await waitFor(() => {
        expect(screen.getByText(/fehler|error/i)).toBeInTheDocument()
      })

      // Verify field was NOT added
      expect(mockFields).toHaveLength(0)
    })
  })
})
