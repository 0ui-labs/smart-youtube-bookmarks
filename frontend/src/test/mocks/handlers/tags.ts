import { http, HttpResponse } from 'msw'
import type { Tag, TagCreate } from '@/types/tag'

// Simple UUID generator for tests
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

// Mock data
const mockTags: Tag[] = []

// Reset function for test isolation
export function resetMockTags() {
  mockTags.length = 0
}

export const tagsHandlers = [
  // POST /tags
  http.post('/api/tags', async ({ request }) => {
    const body = (await request.json()) as TagCreate

    // Check duplicate name (case-insensitive)
    const exists = mockTags.some(
      (t) => t.name.toLowerCase() === body.name.toLowerCase()
    )
    if (exists) {
      return HttpResponse.json(
        { detail: `Tag '${body.name}' already exists` },
        { status: 409 }
      )
    }

    const newTag: Tag = {
      id: generateUUID(),
      name: body.name,
      color: body.color || null,
      schema_id: body.schema_id || null,
      user_id: generateUUID(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    mockTags.push(newTag)
    return HttpResponse.json(newTag, { status: 201 })
  }),
]
