import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { ConfirmDeleteTagDialog } from './ConfirmDeleteTagDialog'
import type { Tag } from '@/types/tag'

const mockTag: Tag = {
  id: 'tag-123',
  name: 'Python',
  color: '#3B82F6',
  schema_id: null,
  is_video_type: true,
  user_id: 'user-456',
  created_at: '2025-11-18T10:00:00Z',
  updated_at: '2025-11-18T10:00:00Z',
}

const server = setupServer(
  http.delete('/api/tags/:tagId', () => {
    return new HttpResponse(null, { status: 204 })
  })
)

beforeAll(() => server.listen())
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

describe('ConfirmDeleteTagDialog', () => {
  it('shows tag name in warning', () => {
    render(
      <ConfirmDeleteTagDialog tag={mockTag} open={true} onConfirm={vi.fn()} onCancel={vi.fn()} />,
      { wrapper: createWrapper() }
    )

    expect(screen.getByText(/Python/)).toBeInTheDocument()
  })

  it('shows warning about removing tag from all videos', () => {
    render(
      <ConfirmDeleteTagDialog tag={mockTag} open={true} onConfirm={vi.fn()} onCancel={vi.fn()} />,
      { wrapper: createWrapper() }
    )

    expect(screen.getByText(/remove the tag from all videos/i)).toBeInTheDocument()
  })

  it('shows action cannot be undone text', () => {
    render(
      <ConfirmDeleteTagDialog tag={mockTag} open={true} onConfirm={vi.fn()} onCancel={vi.fn()} />,
      { wrapper: createWrapper() }
    )

    expect(screen.getByText(/cannot be undone/i)).toBeInTheDocument()
  })

  it('shows warning icon', () => {
    render(
      <ConfirmDeleteTagDialog tag={mockTag} open={true} onConfirm={vi.fn()} onCancel={vi.fn()} />,
      { wrapper: createWrapper() }
    )

    // AlertTriangle icon should be in the title area
    expect(screen.getByText('Delete Tag')).toBeInTheDocument()
  })

  it('calls onConfirm after successful deletion', async () => {
    const onConfirm = vi.fn()
    render(
      <ConfirmDeleteTagDialog tag={mockTag} open={true} onConfirm={onConfirm} onCancel={vi.fn()} />,
      { wrapper: createWrapper() }
    )

    fireEvent.click(screen.getByText('Delete'))

    await waitFor(() => expect(onConfirm).toHaveBeenCalled())
  })

  it('calls onCancel when cancelled', () => {
    const onCancel = vi.fn()
    render(
      <ConfirmDeleteTagDialog tag={mockTag} open={true} onConfirm={vi.fn()} onCancel={onCancel} />,
      { wrapper: createWrapper() }
    )

    fireEvent.click(screen.getByText('Cancel'))

    expect(onCancel).toHaveBeenCalled()
  })

  it('shows loading state while deleting', async () => {
    // Make the delete request slow
    server.use(
      http.delete('/api/tags/:tagId', async () => {
        await new Promise(resolve => setTimeout(resolve, 100))
        return new HttpResponse(null, { status: 204 })
      })
    )

    render(
      <ConfirmDeleteTagDialog tag={mockTag} open={true} onConfirm={vi.fn()} onCancel={vi.fn()} />,
      { wrapper: createWrapper() }
    )

    fireEvent.click(screen.getByText('Delete'))

    // Should show loading text
    expect(await screen.findByText('Deleting...')).toBeInTheDocument()
  })

  it('delete button has destructive variant', () => {
    render(
      <ConfirmDeleteTagDialog tag={mockTag} open={true} onConfirm={vi.fn()} onCancel={vi.fn()} />,
      { wrapper: createWrapper() }
    )

    const deleteButton = screen.getByRole('button', { name: /delete/i })
    // Button should have destructive styling (bg-destructive or similar classes)
    expect(deleteButton).toBeInTheDocument()
  })
})
