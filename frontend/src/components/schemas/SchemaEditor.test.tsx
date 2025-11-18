import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'
import { SchemaEditor } from './SchemaEditor'

// Mock useCustomFields hook and related exports
vi.mock('@/hooks/useCustomFields', () => ({
  useCustomFields: () => ({
    data: [],
    isLoading: false,
  }),
  useCheckDuplicateField: () => ({
    data: { exists: false, field: null },
    isLoading: false,
  }),
  useCreateCustomField: () => ({
    mutate: vi.fn(),
    isPending: false,
  }),
}))

describe('SchemaEditor', () => {
  let queryClient: QueryClient
  const mockOnSave = vi.fn()
  const mockOnCancel = vi.fn()

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    })
    vi.clearAllMocks()
  })

  const renderSchemaEditor = (props: {
    listId: string
    onSave: (data: any) => Promise<void>
    onCancel: () => void
    initialData?: any
  }) => {
    return render(
      <QueryClientProvider client={queryClient}>
        <SchemaEditor {...props} />
      </QueryClientProvider>
    )
  }

  it('renders schema metadata fields', () => {
    renderSchemaEditor({ listId: 'list-1', onSave: mockOnSave, onCancel: mockOnCancel })

    expect(screen.getByLabelText(/schema-name/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/beschreibung/i)).toBeInTheDocument()
  })

  it('shows validation error for empty schema name', async () => {
    const user = userEvent.setup()
    renderSchemaEditor({ listId: 'list-1', onSave: mockOnSave, onCancel: mockOnCancel })

    await user.click(screen.getByRole('button', { name: /schema erstellen/i }))

    await waitFor(() => {
      expect(screen.getByText(/schema-name ist erforderlich/i)).toBeInTheDocument()
    })
  })

  it('shows validation error for whitespace-only schema name', async () => {
    const user = userEvent.setup()
    renderSchemaEditor({ listId: 'list-1', onSave: mockOnSave, onCancel: mockOnCancel })

    await user.type(screen.getByLabelText(/schema-name/i), '   ')
    await user.click(screen.getByRole('button', { name: /schema erstellen/i }))

    await waitFor(() => {
      expect(screen.getByText(/darf nicht nur aus leerzeichen bestehen/i)).toBeInTheDocument()
    })
  })

  it('shows validation error for too long schema name', async () => {
    const user = userEvent.setup()
    renderSchemaEditor({ listId: 'list-1', onSave: mockOnSave, onCancel: mockOnCancel })

    const longName = 'a'.repeat(256) // 256 characters
    await user.type(screen.getByLabelText(/schema-name/i), longName)
    await user.click(screen.getByRole('button', { name: /schema erstellen/i }))

    await waitFor(() => {
      expect(screen.getByText(/maximal 255 zeichen/i)).toBeInTheDocument()
    })
  })

  it('calls onCancel when cancel button clicked', async () => {
    const user = userEvent.setup()
    renderSchemaEditor({ listId: 'list-1', onSave: mockOnSave, onCancel: mockOnCancel })

    await user.click(screen.getByRole('button', { name: /abbrechen/i }))

    expect(mockOnCancel).toHaveBeenCalledOnce()
  })

  it('shows new field form when "Neues Feld" clicked', async () => {
    const user = userEvent.setup()
    renderSchemaEditor({ listId: 'list-1', onSave: mockOnSave, onCancel: mockOnCancel })

    await user.click(screen.getByRole('button', { name: /neues feld/i }))

    expect(screen.getByText(/neues feld erstellen/i)).toBeInTheDocument()
    expect(screen.getByText(/newfieldform placeholder/i)).toBeInTheDocument()
  })

  it('hides new field form when close button clicked', async () => {
    const user = userEvent.setup()
    renderSchemaEditor({ listId: 'list-1', onSave: mockOnSave, onCancel: mockOnCancel })

    // Open form
    await user.click(screen.getByRole('button', { name: /neues feld/i }))
    expect(screen.getByText(/neues feld erstellen/i)).toBeInTheDocument()

    // Close form
    const closeButton = screen.getAllByRole('button', { name: /✕/i })[0]
    await user.click(closeButton)

    await waitFor(() => {
      expect(screen.queryByText(/neues feld erstellen/i)).not.toBeInTheDocument()
    })
  })

  it('shows empty state when no fields added', () => {
    renderSchemaEditor({ listId: 'list-1', onSave: mockOnSave, onCancel: mockOnCancel })

    expect(screen.getByText(/noch keine felder/i)).toBeInTheDocument()
    expect(screen.getByText(/felder \(0\)/i)).toBeInTheDocument()
  })

  it('shows field count in header', () => {
    const initialData = {
      fields: [
        { field_id: 'f1', display_order: 0, show_on_card: false },
        { field_id: 'f2', display_order: 1, show_on_card: true },
      ],
    }

    renderSchemaEditor({
      listId: 'list-1',
      onSave: mockOnSave,
      onCancel: mockOnCancel,
      initialData,
    })

    expect(screen.getByText(/felder \(2\)/i)).toBeInTheDocument()
  })

  it('renders field placeholders for initial data', () => {
    const initialData = {
      name: 'Test Schema',
      description: 'Test Description',
      fields: [
        { field_id: 'f1', display_order: 0, show_on_card: false },
        { field_id: 'f2', display_order: 1, show_on_card: true },
      ],
    }

    renderSchemaEditor({
      listId: 'list-1',
      onSave: mockOnSave,
      onCancel: mockOnCancel,
      initialData,
    })

    expect(screen.getByText(/field 1 \(placeholder/i)).toBeInTheDocument()
    expect(screen.getByText(/field 2 \(placeholder/i)).toBeInTheDocument()
    expect(screen.getByDisplayValue('Test Schema')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Test Description')).toBeInTheDocument()
  })

  it('allows removing fields via remove button', async () => {
    const user = userEvent.setup()
    const initialData = {
      fields: [
        { field_id: 'f1', display_order: 0, show_on_card: false },
      ],
    }

    renderSchemaEditor({
      listId: 'list-1',
      onSave: mockOnSave,
      onCancel: mockOnCancel,
      initialData,
    })

    expect(screen.getByText(/field 1 \(placeholder/i)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /entfernen/i }))

    await waitFor(() => {
      expect(screen.queryByText(/field 1 \(placeholder/i)).not.toBeInTheDocument()
      expect(screen.getByText(/noch keine felder/i)).toBeInTheDocument()
    })
  })

  it('shows loading state during form submission', async () => {
    const user = userEvent.setup()
    let resolvePromise: () => void
    const slowOnSave = vi.fn(() => new Promise<void>(resolve => {
      resolvePromise = resolve
    }))

    // Render with initial data that already has a field
    renderSchemaEditor({
      listId: 'list-1',
      onSave: slowOnSave,
      onCancel: mockOnCancel,
      initialData: {
        name: 'Test Schema',
        fields: [{ field_id: 'f1', display_order: 0, show_on_card: false }],
      },
    })

    const submitButton = screen.getByRole('button', { name: /schema erstellen/i })

    // Start submission (don't await yet)
    user.click(submitButton)

    // Check for loading state immediately
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /wird gespeichert/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /wird gespeichert/i })).toBeDisabled()
    })
  })

  it('shows validation error when submitting without fields', async () => {
    const user = userEvent.setup()
    renderSchemaEditor({ listId: 'list-1', onSave: mockOnSave, onCancel: mockOnCancel })

    await user.type(screen.getByLabelText(/schema-name/i), 'Test Schema')
    await user.click(screen.getByRole('button', { name: /schema erstellen/i }))

    await waitFor(() => {
      expect(screen.getByText(/mindestens ein feld ist erforderlich/i)).toBeInTheDocument()
    })
  })

  it('handles 409 conflict error from backend', async () => {
    const user = userEvent.setup()
    const errorOnSave = vi.fn().mockRejectedValue({
      response: { status: 409 },
    })

    renderSchemaEditor({
      listId: 'list-1',
      onSave: errorOnSave,
      onCancel: mockOnCancel,
      initialData: {
        fields: [{ field_id: 'f1', display_order: 0, show_on_card: false }],
      },
    })

    await user.type(screen.getByLabelText(/schema-name/i), 'Duplicate Schema')
    await user.click(screen.getByRole('button', { name: /schema erstellen/i }))

    await waitFor(
      () => {
        expect(screen.getByText(/schema mit diesem namen existiert bereits/i)).toBeInTheDocument()
      },
      { timeout: 3000 }
    )
  })

  it('handles 422 validation error from backend', async () => {
    const user = userEvent.setup()
    const errorOnSave = vi.fn().mockRejectedValue({
      response: {
        status: 422,
        data: { detail: 'Invalid schema configuration' },
      },
    })

    renderSchemaEditor({
      listId: 'list-1',
      onSave: errorOnSave,
      onCancel: mockOnCancel,
      initialData: {
        fields: [{ field_id: 'f1', display_order: 0, show_on_card: false }],
      },
    })

    await user.type(screen.getByLabelText(/schema-name/i), 'Test Schema')
    await user.click(screen.getByRole('button', { name: /schema erstellen/i }))

    await waitFor(
      () => {
        expect(screen.getByText(/invalid schema configuration/i)).toBeInTheDocument()
      },
      { timeout: 3000 }
    )
  })

  it('handles generic network error', async () => {
    const user = userEvent.setup()
    const errorOnSave = vi.fn().mockRejectedValue(new Error('Network error'))

    renderSchemaEditor({
      listId: 'list-1',
      onSave: errorOnSave,
      onCancel: mockOnCancel,
      initialData: {
        fields: [{ field_id: 'f1', display_order: 0, show_on_card: false }],
      },
    })

    await user.type(screen.getByLabelText(/schema-name/i), 'Test Schema')
    await user.click(screen.getByRole('button', { name: /schema erstellen/i }))

    await waitFor(
      () => {
        expect(screen.getByText(/fehler beim speichern/i)).toBeInTheDocument()
      },
      { timeout: 3000 }
    )
  })
})
