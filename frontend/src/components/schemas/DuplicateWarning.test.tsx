/**
 * DuplicateWarning Component Tests (Task #125 Phase 2)
 *
 * Tests all states and behaviors:
 * - Empty field name (silent)
 * - Loading state with spinner
 * - Duplicate exists with field details
 * - No duplicate (silent success)
 * - API error handling
 * - Network error handling
 * - Debouncing behavior
 * - Config preview formatting (select, rating, text, boolean)
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/mocks/server'

import { DuplicateWarning } from './DuplicateWarning'
import { CustomField } from '@/types/customFields'

// Uses shared MSW server from test/setup.ts (handlers reset automatically after each test)

// Helper to render with QueryClient
function renderWithQuery(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false, // Disable retries in tests
      },
    },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      {ui}
    </QueryClientProvider>
  )
}

describe('DuplicateWarning', () => {
  describe('Empty field name', () => {
    it('renders nothing when field name is empty', () => {
      const { container } = renderWithQuery(
        <DuplicateWarning
          fieldName=""
          listId="list-123"
        />
      )

      expect(container.firstChild).toBeNull()
    })

    it('renders nothing when field name is only whitespace', () => {
      const { container } = renderWithQuery(
        <DuplicateWarning
          fieldName="   "
          listId="list-123"
        />
      )

      expect(container.firstChild).toBeNull()
    })
  })

  describe('Loading state', () => {
    it('shows loading spinner while checking for duplicates', async () => {
      // Mock slow API response
      server.use(
        http.post('/api/lists/list-123/custom-fields/check-duplicate', async () => {
          await new Promise(resolve => setTimeout(resolve, 100))
          return HttpResponse.json({ exists: false, field: null })
        })
      )

      renderWithQuery(
        <DuplicateWarning
          fieldName="Rating"
          listId="list-123"
          debounceMs={0} // No debounce for testing
        />
      )

      // Should show loading state
      expect(screen.getByText('Prüfe auf Duplikate...')).toBeInTheDocument()
      expect(document.querySelector('.animate-spin')).toBeInTheDocument()
    })
  })

  describe('Duplicate exists', () => {
    it('shows warning when duplicate rating field exists', async () => {
      const existingField: CustomField = {
        id: 'field-123',
        list_id: 'list-123',
        name: 'Overall Rating',
        field_type: 'rating',
        config: { max_rating: 5 },
        created_at: '2025-11-12T10:00:00Z',
        updated_at: '2025-11-12T10:00:00Z',
      }

      server.use(
        http.post('/api/lists/list-123/custom-fields/check-duplicate', () => {
          return HttpResponse.json({
            exists: true,
            field: existingField,
          })
        })
      )

      renderWithQuery(
        <DuplicateWarning
          fieldName="Overall Rating"
          listId="list-123"
          debounceMs={0}
        />
      )

      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument()
      })

      expect(screen.getByText('Feld existiert bereits')).toBeInTheDocument()
      expect(screen.getByText(/"Overall Rating"/)).toBeInTheDocument()
      expect(screen.getByText(/Typ:/)).toBeInTheDocument()
      expect(screen.getByText(/Bewertung/)).toBeInTheDocument()
      expect(screen.getByText(/1-5 Sterne/)).toBeInTheDocument()
    })

    it('shows warning with select field config preview', async () => {
      const existingField: CustomField = {
        id: 'field-456',
        list_id: 'list-123',
        name: 'Quality',
        field_type: 'select',
        config: { options: ['bad', 'good', 'great'] },
        created_at: '2025-11-12T10:00:00Z',
        updated_at: '2025-11-12T10:00:00Z',
      }

      server.use(
        http.post('/api/lists/list-123/custom-fields/check-duplicate', () => {
          return HttpResponse.json({
            exists: true,
            field: existingField,
          })
        })
      )

      renderWithQuery(
        <DuplicateWarning
          fieldName="Quality"
          listId="list-123"
          debounceMs={0}
        />
      )

      await waitFor(() => {
        expect(screen.getByText(/Optionen: bad, good, great/)).toBeInTheDocument()
      })
    })

    it('truncates select options to 3 with +N more', async () => {
      const existingField: CustomField = {
        id: 'field-789',
        list_id: 'list-123',
        name: 'Status',
        field_type: 'select',
        config: { options: ['draft', 'review', 'approved', 'published', 'archived'] },
        created_at: '2025-11-12T10:00:00Z',
        updated_at: '2025-11-12T10:00:00Z',
      }

      server.use(
        http.post('/api/lists/list-123/custom-fields/check-duplicate', () => {
          return HttpResponse.json({
            exists: true,
            field: existingField,
          })
        })
      )

      renderWithQuery(
        <DuplicateWarning
          fieldName="Status"
          listId="list-123"
          debounceMs={0}
        />
      )

      await waitFor(() => {
        expect(screen.getByText(/Optionen: draft, review, approved \+2 weitere/)).toBeInTheDocument()
      })
    })

    it('shows text field with max_length', async () => {
      const existingField: CustomField = {
        id: 'field-abc',
        list_id: 'list-123',
        name: 'Notes',
        field_type: 'text',
        config: { max_length: 500 },
        created_at: '2025-11-12T10:00:00Z',
        updated_at: '2025-11-12T10:00:00Z',
      }

      server.use(
        http.post('/api/lists/list-123/custom-fields/check-duplicate', () => {
          return HttpResponse.json({
            exists: true,
            field: existingField,
          })
        })
      )

      renderWithQuery(
        <DuplicateWarning
          fieldName="Notes"
          listId="list-123"
          debounceMs={0}
        />
      )

      await waitFor(() => {
        expect(screen.getByText(/Max\. 500 Zeichen/)).toBeInTheDocument()
      })
    })

    it('shows text field without max_length', async () => {
      const existingField: CustomField = {
        id: 'field-def',
        list_id: 'list-123',
        name: 'Description',
        field_type: 'text',
        config: {},
        created_at: '2025-11-12T10:00:00Z',
        updated_at: '2025-11-12T10:00:00Z',
      }

      server.use(
        http.post('/api/lists/list-123/custom-fields/check-duplicate', () => {
          return HttpResponse.json({
            exists: true,
            field: existingField,
          })
        })
      )

      renderWithQuery(
        <DuplicateWarning
          fieldName="Description"
          listId="list-123"
          debounceMs={0}
        />
      )

      await waitFor(() => {
        expect(screen.getByText(/Unbegrenzte Länge/)).toBeInTheDocument()
      })
    })

    it('shows boolean field preview', async () => {
      const existingField: CustomField = {
        id: 'field-ghi',
        list_id: 'list-123',
        name: 'Recommended',
        field_type: 'boolean',
        config: {},
        created_at: '2025-11-12T10:00:00Z',
        updated_at: '2025-11-12T10:00:00Z',
      }

      server.use(
        http.post('/api/lists/list-123/custom-fields/check-duplicate', () => {
          return HttpResponse.json({
            exists: true,
            field: existingField,
          })
        })
      )

      renderWithQuery(
        <DuplicateWarning
          fieldName="Recommended"
          listId="list-123"
          debounceMs={0}
        />
      )

      await waitFor(() => {
        expect(screen.getByText(/Ja\/Nein/)).toBeInTheDocument()
      })
    })
  })

  describe('No duplicate', () => {
    it('renders nothing when field name is available', async () => {
      server.use(
        http.post('/api/lists/list-123/custom-fields/check-duplicate', () => {
          return HttpResponse.json({
            exists: false,
            field: null,
          })
        })
      )

      const { container } = renderWithQuery(
        <DuplicateWarning
          fieldName="New Field"
          listId="list-123"
          debounceMs={0}
        />
      )

      // Wait for loading to finish
      await waitFor(() => {
        expect(screen.queryByText('Prüfe auf Duplikate...')).not.toBeInTheDocument()
      })

      // Should render nothing (silent success)
      expect(container.querySelector('[role="alert"]')).not.toBeInTheDocument()
    })
  })

  describe('Error handling', () => {
    it('shows error message when API call fails', async () => {
      server.use(
        http.post('/api/lists/list-123/custom-fields/check-duplicate', () => {
          return new HttpResponse(null, { status: 500 })
        })
      )

      renderWithQuery(
        <DuplicateWarning
          fieldName="Rating"
          listId="list-123"
          debounceMs={0}
        />
      )

      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument()
      })

      expect(screen.getByText('Fehler beim Prüfen')).toBeInTheDocument()
      expect(screen.getByText(/Die Duplikatsprüfung konnte nicht durchgeführt werden/)).toBeInTheDocument()
    })

    it('shows error message on network error', async () => {
      server.use(
        http.post('/api/lists/list-123/custom-fields/check-duplicate', () => {
          return HttpResponse.error()
        })
      )

      renderWithQuery(
        <DuplicateWarning
          fieldName="Rating"
          listId="list-123"
          debounceMs={0}
        />
      )

      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument()
      })

      expect(screen.getByText('Fehler beim Prüfen')).toBeInTheDocument()
    })
  })

  describe('Debouncing', () => {
    it('debounces API calls with custom delay', async () => {
      const mockHandler = vi.fn(() => {
        return HttpResponse.json({ exists: false, field: null })
      })

      server.use(
        http.post('/api/lists/list-123/custom-fields/check-duplicate', mockHandler)
      )

      const { rerender } = renderWithQuery(
        <DuplicateWarning
          fieldName="R"
          listId="list-123"
          debounceMs={500}
        />
      )

      // Fast updates should not trigger API calls
      rerender(
        <QueryClientProvider client={new QueryClient()}>
          <DuplicateWarning
            fieldName="Ra"
            listId="list-123"
            debounceMs={500}
          />
        </QueryClientProvider>
      )

      rerender(
        <QueryClientProvider client={new QueryClient()}>
          <DuplicateWarning
            fieldName="Rat"
            listId="list-123"
            debounceMs={500}
          />
        </QueryClientProvider>
      )

      // API should not be called yet
      expect(mockHandler).not.toHaveBeenCalled()

      // Wait for debounce
      await new Promise(resolve => setTimeout(resolve, 600))

      // Now API should be called once
      await waitFor(() => {
        expect(mockHandler).toHaveBeenCalledTimes(1)
      })
    })
  })

  describe('Accessibility', () => {
    it('has proper ARIA roles for loading state', () => {
      server.use(
        http.post('/api/lists/list-123/custom-fields/check-duplicate', async () => {
          await new Promise(resolve => setTimeout(resolve, 100))
          return HttpResponse.json({ exists: false, field: null })
        })
      )

      renderWithQuery(
        <DuplicateWarning
          fieldName="Rating"
          listId="list-123"
          debounceMs={0}
        />
      )

      // Spinner should have aria-hidden
      const spinner = document.querySelector('.animate-spin')
      expect(spinner).toHaveAttribute('aria-hidden', 'true')
    })

    it('has role="alert" for duplicate warning', async () => {
      const existingField: CustomField = {
        id: 'field-123',
        list_id: 'list-123',
        name: 'Rating',
        field_type: 'rating',
        config: { max_rating: 5 },
        created_at: '2025-11-12T10:00:00Z',
        updated_at: '2025-11-12T10:00:00Z',
      }

      server.use(
        http.post('/api/lists/list-123/custom-fields/check-duplicate', () => {
          return HttpResponse.json({
            exists: true,
            field: existingField,
          })
        })
      )

      renderWithQuery(
        <DuplicateWarning
          fieldName="Rating"
          listId="list-123"
          debounceMs={0}
        />
      )

      await waitFor(() => {
        const alert = screen.getByRole('alert')
        expect(alert).toBeInTheDocument()
      })
    })

    it('has role="alert" for error state', async () => {
      server.use(
        http.post('/api/lists/list-123/custom-fields/check-duplicate', () => {
          return new HttpResponse(null, { status: 500 })
        })
      )

      renderWithQuery(
        <DuplicateWarning
          fieldName="Rating"
          listId="list-123"
          debounceMs={0}
        />
      )

      await waitFor(() => {
        const alert = screen.getByRole('alert')
        expect(alert).toBeInTheDocument()
      })
    })
  })
})
