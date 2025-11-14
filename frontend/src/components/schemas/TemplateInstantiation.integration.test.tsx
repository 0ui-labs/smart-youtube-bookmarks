import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { SchemaCreationDialog } from './SchemaCreationDialog'
import { SCHEMA_TEMPLATES } from '@/constants/schemaTemplates'

describe('Template Instantiation Integration', () => {
  let queryClient: QueryClient

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    vi.clearAllMocks()
  })

  it('should create schema from template end-to-end', async () => {
    const mockListId = 'test-list-id'
    const mockTemplate = SCHEMA_TEMPLATES[0] // Video Quality Assessment
    const mockOnSchemaCreated = vi.fn()

    // Mock API responses
    const mockFields = mockTemplate.fields.map((field, index) => ({
      id: `field-${index}`,
      list_id: mockListId,
      name: field.name,
      field_type: field.field_type,
      config: field.config,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }))

    const mockSchema = {
      id: 'schema-123',
      list_id: mockListId,
      name: mockTemplate.name,
      description: mockTemplate.description,
      schema_fields: mockTemplate.fields.map((field, index) => ({
        field_id: mockFields[index].id,
        schema_id: 'schema-123',
        display_order: field.display_order,
        show_on_card: field.show_on_card,
        field: mockFields[index],
      })),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    // Setup fetch mock
    global.fetch = vi.fn((url: string) => {
      if (url.includes('/custom-fields')) {
        const fieldIndex = mockFields.length - 1 // Last field created
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockFields[fieldIndex]),
        })
      }
      if (url.includes('/schemas')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockSchema),
        })
      }
      return Promise.reject(new Error('Unknown endpoint'))
    }) as any

    // Render dialog
    render(
      <QueryClientProvider client={queryClient}>
        <SchemaCreationDialog
          listId={mockListId}
          open={true}
          onOpenChange={vi.fn()}
          onSchemaCreated={mockOnSchemaCreated}
        />
      </QueryClientProvider>
    )

    // Should show template picker
    const useTemplateButtons = screen.getAllByRole('button', { name: 'Use Template' })
    expect(useTemplateButtons.length).toBeGreaterThan(0)

    // Click "Use Template" on first template
    fireEvent.click(useTemplateButtons[0])

    // Should show loading state
    await waitFor(() => {
      expect(screen.getByText(/Creating schema from template/i)).toBeInTheDocument()
    })

    // Wait for completion
    await waitFor(
      () => {
        expect(mockOnSchemaCreated).toHaveBeenCalledWith(mockSchema)
      },
      { timeout: 3000 }
    )

    // Verify API calls
    expect(global.fetch).toHaveBeenCalledTimes(mockTemplate.fields.length + 1) // Fields + Schema
  })

  it('should handle field creation errors gracefully', async () => {
    const mockListId = 'test-list-id'
    const mockTemplate = SCHEMA_TEMPLATES[0]

    // Mock field creation failure
    global.fetch = vi.fn(() =>
      Promise.reject(new Error('Network error'))
    ) as any

    render(
      <QueryClientProvider client={queryClient}>
        <SchemaCreationDialog
          listId={mockListId}
          open={true}
          onOpenChange={vi.fn()}
          onSchemaCreated={vi.fn()}
        />
      </QueryClientProvider>
    )

    // Click template
    const useTemplateButtons = screen.getAllByRole('button', { name: 'Use Template' })
    fireEvent.click(useTemplateButtons[0])

    // Should show error state
    await waitFor(() => {
      expect(screen.getByText(/Failed to create schema/i)).toBeInTheDocument()
    })
  })
})
