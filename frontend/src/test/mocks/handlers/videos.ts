import { http, HttpResponse } from 'msw'
import type {
  VideoResponse,
  BatchUpdateFieldValuesResponse,
  FieldValueUpdate,
  VideoFieldValue,
} from '@/types/video'

// Mock field metadata lookup for realistic test data
const mockFieldMetadata = new Map([
  ['field-1', { name: 'Overall Rating', field_type: 'rating' as const, config: { max_rating: 5 } }],
  ['field-2', { name: 'Quality', field_type: 'select' as const, config: { options: ['bad', 'good', 'great'] } }],
  ['field-3', { name: 'Notes', field_type: 'text' as const, config: { max_length: 500 } }],
  ['field-4', { name: 'Watched', field_type: 'boolean' as const, config: {} }],
])

// Mock data
const mockVideoFieldValues: VideoFieldValue[] = [
  {
    id: 'fv-1',
    video_id: 'video-123',
    field_id: 'field-1',
    field_name: 'Overall Rating',
    show_on_card: true,
    field: {
      id: 'field-1',
      list_id: 'list-123',
      name: 'Overall Rating',
      field_type: 'rating',
      config: { max_rating: 5 },
      created_at: '2025-11-06T10:00:00Z',
      updated_at: '2025-11-06T10:00:00Z',
    },
    value: 4,
    updated_at: '2025-11-06T10:30:00Z',
  },
  {
    id: 'fv-2',
    video_id: 'video-123',
    field_id: 'field-2',
    field_name: 'Quality',
    show_on_card: true,
    field: {
      id: 'field-2',
      list_id: 'list-123',
      name: 'Quality',
      field_type: 'select',
      config: { options: ['bad', 'good', 'great'] },
      created_at: '2025-11-06T10:00:00Z',
      updated_at: '2025-11-06T10:00:00Z',
    },
    value: 'great',
    updated_at: '2025-11-06T10:30:00Z',
  },
]

export const videosHandlers = [
  // GET /api/lists/:listId/custom-fields - Returns list of custom fields for a list
  http.get('/api/lists/:listId/custom-fields', () => {
    // Return empty array by default - tests can override with server.use()
    return HttpResponse.json([])
  }),

  // GET /api/lists/:listId/videos - Returns list of videos
  http.get('/api/lists/:listId/videos', () => {
    // Return empty array by default - tests can override with server.use()
    return HttpResponse.json([])
  }),

  // GET /api/videos/:videoId - Returns full video with field_values
  http.get('/api/videos/:videoId', ({ params }) => {
    const { videoId } = params

    // Handle 404 case
    if (videoId === 'video-404') {
      return HttpResponse.json({ detail: 'Video not found' }, { status: 404 })
    }

    // Handle empty field values case
    if (videoId === 'video-empty') {
      const emptyVideo: VideoResponse = {
        id: videoId as string,
        list_id: 'list-123',
        youtube_id: 'abc123',
        title: 'Empty Video',
        channel: 'Test Channel',
        duration: 300,
        thumbnail_url: 'https://example.com/thumb.jpg',
        published_at: null,
        tags: [],
        processing_status: 'completed',
        created_at: '2025-11-06T10:00:00Z',
        updated_at: '2025-11-06T10:00:00Z',
        field_values: [],
      }
      return HttpResponse.json(emptyVideo)
    }

    // Default: return video with field values
    const mockVideo: VideoResponse = {
      id: videoId as string,
      list_id: 'list-123',
      youtube_id: 'abc123',
      title: 'Test Video',
      channel: 'Test Channel',
      duration: 300,
      thumbnail_url: 'https://example.com/thumb.jpg',
      published_at: null,
      tags: [],
      processing_status: 'completed',
      created_at: '2025-11-06T10:00:00Z',
      updated_at: '2025-11-06T10:00:00Z',
      field_values: mockVideoFieldValues.map((fv) => ({
        ...fv,
        video_id: videoId as string,
      })),
    }

    return HttpResponse.json(mockVideo)
  }),

  // PUT /api/videos/:videoId/fields - Batch update field values
  http.put('/api/videos/:videoId/fields', async ({ params, request }) => {
    const { videoId } = params
    const body = (await request.json()) as { field_values: FieldValueUpdate[] }

    // Handle validation error case
    if (body.field_values.some((update) => update.field_id === 'field-invalid')) {
      return HttpResponse.json(
        {
          detail: {
            message: 'Field value validation failed',
            errors: [
              {
                field_id: 'field-invalid',
                field_name: 'Invalid Field',
                error: 'Validation error',
              },
            ],
          },
        },
        { status: 422 }
      )
    }

    // Simulate successful update
    const response: BatchUpdateFieldValuesResponse = {
      updated_count: body.field_values.length,
      field_values: body.field_values.map((update, index) => {
        const metadata = mockFieldMetadata.get(update.field_id) || {
          name: `Field ${index + 1}`,
          field_type: 'text' as const,
          config: {},
        }

        return {
          id: `fv-${index + 1}`,
          video_id: videoId as string,
          field_id: update.field_id,
          field_name: metadata.name,
          show_on_card: true,
          field: {
            id: update.field_id,
            list_id: 'list-123',
            name: metadata.name,
            field_type: metadata.field_type,
            config: metadata.config as Record<string, any>,
            created_at: '2025-11-06T10:00:00Z',
            updated_at: '2025-11-06T10:00:00Z',
          },
          value: update.value,
          updated_at: new Date().toISOString(),
        }
      }) as any,
    }

    return HttpResponse.json(response)
  }),
]
