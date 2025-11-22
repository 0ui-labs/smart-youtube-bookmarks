import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { EditTagDialog } from './EditTagDialog'
import type { Tag } from '@/types/tag'

const mockTag: Tag = {
  id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  name: 'Python',
  color: '#3B82F6',
  schema_id: null,
  is_video_type: true,
  user_id: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
  created_at: '2025-11-18T10:00:00Z',
  updated_at: '2025-11-18T10:00:00Z',
}

const mockSchemas = [
  {
    id: 'c3d4e5f6-a7b8-9012-cdef-123456789012',
    name: 'Tutorial Schema',
    description: 'For tutorials',
    list_id: 'd4e5f6a7-b8c9-0123-def1-234567890123',
    created_at: '2025-11-18T10:00:00Z',
    updated_at: '2025-11-18T10:00:00Z',
    schema_fields: [],
  },
  {
    id: 'e5f6a7b8-c9d0-1234-ef12-345678901234',
    name: 'Course Schema',
    description: 'For courses',
    list_id: 'd4e5f6a7-b8c9-0123-def1-234567890123',
    created_at: '2025-11-18T11:00:00Z',
    updated_at: '2025-11-18T11:00:00Z',
    schema_fields: [],
  },
]

const server = setupServer(
  http.put('/api/tags/:tagId', async ({ request }) => {
    const body = await request.json() as Record<string, unknown>
    return HttpResponse.json({
      ...mockTag,
      name: body.name || mockTag.name,
      color: body.color || mockTag.color,
      schema_id: body.schema_id !== undefined ? body.schema_id : mockTag.schema_id,
    })
  }),
  http.get('/api/lists/:listId/schemas', () => {
    return HttpResponse.json(mockSchemas)
  })
)

beforeAll(() => server.listen())
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false }
    },
  })
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

describe('EditTagDialog', () => {
  it('pre-fills form with tag data', () => {
    render(
      <EditTagDialog tag={mockTag} open={true} onClose={vi.fn()} listId="list-1" />,
      { wrapper: createWrapper() }
    )

    expect(screen.getByDisplayValue('Python')).toBeInTheDocument()
    expect(screen.getByDisplayValue('#3B82F6')).toBeInTheDocument()
  })

  it('shows validation error when name is empty', async () => {
    render(
      <EditTagDialog tag={mockTag} open={true} onClose={vi.fn()} listId="list-1" />,
      { wrapper: createWrapper() }
    )

    const nameInput = screen.getByLabelText(/name/i)
    fireEvent.change(nameInput, { target: { value: '' } })
    fireEvent.click(screen.getByText('Save'))

    expect(await screen.findByText(/name is required/i)).toBeInTheDocument()
  })

  it('shows validation error for invalid color hex', async () => {
    render(
      <EditTagDialog tag={mockTag} open={true} onClose={vi.fn()} listId="list-1" />,
      { wrapper: createWrapper() }
    )

    // Find the text input for color (not the color picker)
    const colorInputs = screen.getAllByDisplayValue('#3B82F6')
    const textColorInput = colorInputs.find(el => el.getAttribute('type') !== 'color')
    if (textColorInput) {
      fireEvent.change(textColorInput, { target: { value: 'invalid' } })
      fireEvent.click(screen.getByText('Save'))

      expect(await screen.findByText(/invalid color format/i)).toBeInTheDocument()
    }
  })

  it('calls onClose after successful update', async () => {
    const onClose = vi.fn()
    render(
      <EditTagDialog tag={mockTag} open={true} onClose={onClose} listId="list-1" />,
      { wrapper: createWrapper() }
    )

    const nameInput = screen.getByLabelText(/name/i)
    fireEvent.change(nameInput, { target: { value: 'Updated Name' } })
    fireEvent.click(screen.getByText('Save'))

    await waitFor(() => expect(onClose).toHaveBeenCalled())
  })

  it('shows loading state on Save button while saving', async () => {
    // Delay the response to see loading state
    server.use(
      http.put('/api/tags/:tagId', async () => {
        await new Promise(resolve => setTimeout(resolve, 100))
        return HttpResponse.json({ ...mockTag, name: 'Updated' })
      })
    )

    render(
      <EditTagDialog tag={mockTag} open={true} onClose={vi.fn()} listId="list-1" />,
      { wrapper: createWrapper() }
    )

    const nameInput = screen.getByLabelText(/name/i)
    fireEvent.change(nameInput, { target: { value: 'Updated Name' } })
    fireEvent.click(screen.getByText('Save'))

    // Should show loading text
    expect(await screen.findByText('Saving...')).toBeInTheDocument()
  })

  it('displays schema dropdown with No Schema option', async () => {
    render(
      <EditTagDialog tag={mockTag} open={true} onClose={vi.fn()} listId="list-1" />,
      { wrapper: createWrapper() }
    )

    // The Select component should show "No Schema" as the default value
    // Find it within the select trigger button
    const selectTrigger = screen.getByRole('combobox')
    expect(selectTrigger).toHaveTextContent('No Schema')
  })

  it('resets form when dialog closes', async () => {
    const { rerender } = render(
      <EditTagDialog tag={mockTag} open={true} onClose={vi.fn()} listId="list-1" />,
      { wrapper: createWrapper() }
    )

    // Change the name
    const nameInput = screen.getByLabelText(/name/i)
    fireEvent.change(nameInput, { target: { value: 'Changed Name' } })

    // Close the dialog
    rerender(
      <EditTagDialog tag={mockTag} open={false} onClose={vi.fn()} listId="list-1" />
    )

    // Reopen
    rerender(
      <EditTagDialog tag={mockTag} open={true} onClose={vi.fn()} listId="list-1" />
    )

    // Should be back to original value
    await waitFor(() => {
      expect(screen.getByDisplayValue('Python')).toBeInTheDocument()
    })
  })

  it('handles API error gracefully', async () => {
    server.use(
      http.put('/api/tags/:tagId', () => {
        return HttpResponse.json(
          { detail: 'Tag name already exists' },
          { status: 409 }
        )
      })
    )

    const onClose = vi.fn()
    render(
      <EditTagDialog tag={mockTag} open={true} onClose={onClose} listId="list-1" />,
      { wrapper: createWrapper() }
    )

    const nameInput = screen.getByLabelText(/name/i)
    fireEvent.change(nameInput, { target: { value: 'Duplicate Name' } })
    fireEvent.click(screen.getByText('Save'))

    // Should show error message and NOT close
    await waitFor(() => {
      expect(screen.getByText(/tag name already exists/i)).toBeInTheDocument()
    })
    expect(onClose).not.toHaveBeenCalled()
  })
})
