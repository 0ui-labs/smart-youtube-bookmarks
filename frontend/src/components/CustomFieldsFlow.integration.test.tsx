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

// Test data and handlers will go here
