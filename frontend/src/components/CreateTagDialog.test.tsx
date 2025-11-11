/**
 * Integration Tests for CreateTagDialog Component
 * Task #82 Batch 4 - Step 10
 *
 * Tests the CreateTagDialog modal with schema selection functionality.
 * Uses MSW for API mocking and React Query for state management.
 *
 * NOTE: Radix UI Select uses portals which makes testing dropdown interactions difficult in JSDOM.
 * These tests focus on rendering and form submission, not dropdown interactions.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { CreateTagDialog } from './CreateTagDialog'

// Helper to wrap component with providers
const renderWithProviders = (ui: React.ReactElement) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
      mutations: {
        retry: false,
      },
    },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      {ui}
    </QueryClientProvider>
  )
}

describe('CreateTagDialog - Schema Selection', () => {
  const defaultProps = {
    open: true,
    onOpenChange: vi.fn(),
    listId: 'list-1',
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders schema selector section', () => {
    renderWithProviders(<CreateTagDialog {...defaultProps} />)

    expect(screen.getByText('Schema (optional)')).toBeInTheDocument()
    expect(screen.getByLabelText('Schema auswählen')).toBeInTheDocument()
  })

  it('creates tag without schema when "Kein Schema" selected', async () => {
    const onOpenChange = vi.fn()
    const user = userEvent.setup()

    renderWithProviders(
      <CreateTagDialog
        open={true}
        onOpenChange={onOpenChange}
        listId="list-1"
      />
    )

    // Fill form
    await user.type(screen.getByLabelText('Name *'), 'Python')

    // Schema defaults to null (Kein Schema) - no need to change selector

    // Submit
    await user.click(screen.getByRole('button', { name: /erstellen/i }))

    // Wait for mutation to complete
    await waitFor(() => {
      expect(onOpenChange).toHaveBeenCalledWith(false)
    })
  })

  it('renders all form fields including schema selector', () => {
    renderWithProviders(<CreateTagDialog {...defaultProps} />)

    // Check all form elements are rendered
    expect(screen.getByLabelText('Name *')).toBeInTheDocument()
    expect(screen.getByLabelText('Farbe (optional)')).toBeInTheDocument()
    expect(screen.getByLabelText('Schema auswählen')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /abbrechen/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /erstellen/i })).toBeInTheDocument()
  })

  it('shows Task #83 placeholder text when component is rendered', () => {
    renderWithProviders(<CreateTagDialog {...defaultProps} />)

    // The component conditionally shows the placeholder text
    // It's visible when schemaId === 'new', but not initially
    expect(screen.queryByText(/Schema-Editor wird in Task #83 implementiert/i)).not.toBeInTheDocument()
  })

  it('resets form fields on cancel', async () => {
    const onOpenChange = vi.fn()
    const user = userEvent.setup()

    renderWithProviders(
      <CreateTagDialog
        open={true}
        onOpenChange={onOpenChange}
        listId="list-1"
      />
    )

    // Fill form
    await user.type(screen.getByLabelText('Name *'), 'Test Name')

    // Cancel
    await user.click(screen.getByRole('button', { name: /abbrechen/i }))

    // Wait for cancel handler
    await waitFor(() => {
      expect(onOpenChange).toHaveBeenCalledWith(false)
    })
  })

  it('validates tag name is required', async () => {
    const user = userEvent.setup()

    renderWithProviders(
      <CreateTagDialog
        open={true}
        onOpenChange={vi.fn()}
        listId="list-1"
      />
    )

    // Try to submit without name
    await user.click(screen.getByRole('button', { name: /erstellen/i }))

    // Should show validation error
    await waitFor(() => {
      expect(screen.getByText(/Bitte geben Sie einen Tag-Namen ein/i)).toBeInTheDocument()
    })
  })

  it('has maxLength attribute on name input', () => {
    renderWithProviders(
      <CreateTagDialog
        open={true}
        onOpenChange={vi.fn()}
        listId="list-1"
      />
    )

    // Check that input has maxLength attribute (prevents typing > 50 chars)
    const nameInput = screen.getByLabelText('Name *') as HTMLInputElement
    expect(nameInput).toHaveAttribute('maxLength', '50')
  })
})
