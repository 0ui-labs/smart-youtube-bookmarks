import { http, HttpResponse } from 'msw'
import type { DuplicateCheckResponse } from '@/types/customField'
import type { CustomField } from '@/types/customFields'

// Mock custom fields handlers for testing

export const customFieldsHandlers = [
  // POST /api/lists/:listId/custom-fields/check-duplicate
  http.post('/api/lists/:listId/custom-fields/check-duplicate', async ({ params, request }) => {
    const { listId } = params
    const body = (await request.json()) as { name: string }

    // Default: no duplicate (tests override with server.use())
    const response: DuplicateCheckResponse = {
      exists: false,
      field: null
    }

    return HttpResponse.json(response)
  }),
]
