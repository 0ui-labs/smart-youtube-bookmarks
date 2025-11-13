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
