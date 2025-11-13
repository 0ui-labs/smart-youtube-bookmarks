import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithRouter } from '@/test/renderWithRouter'
import { SettingsPage } from './SettingsPage'
import type { FieldSchemaResponse } from '@/types/schema'

// Mock the hooks
vi.mock('@/hooks/useSchemas', () => ({
  useSchemas: vi.fn(),
}))

vi.mock('@/hooks/useLists', () => ({
  useLists: vi.fn(),
}))

import { useSchemas } from '@/hooks/useSchemas'
import { useLists } from '@/hooks/useLists'

const mockLists = [
  { id: 'list-1', name: 'My List', created_at: '2025-01-01', updated_at: '2025-01-01' }
]

const mockSchemas: FieldSchemaResponse[] = [
  {
    id: 'schema-1',
    list_id: 'list-1',
    name: 'Makeup Tutorial Criteria',
    description: 'Fields for rating makeup tutorials',
    created_at: '2025-11-08T10:00:00Z',
    updated_at: '2025-11-08T10:00:00Z',
    schema_fields: [
      {
        id: 'sf-1',
        schema_id: 'schema-1',
        field_id: 'field-1',
        display_order: 1,
        show_on_card: true,
        field: {
          id: 'field-1',
          list_id: 'list-1',
          name: 'Presentation Quality',
          field_type: 'rating',
          config: { max_rating: 5 },
          created_at: '2025-11-08T09:00:00Z',
          updated_at: '2025-11-08T09:00:00Z',
        },
      },
    ],
  },
]

describe('SettingsPage Integration', () => {
  // ✨ FIX #2: Added afterEach cleanup
  afterEach(() => {
    vi.clearAllMocks()
  })

  beforeEach(() => {
    // Default mock setup
    vi.mocked(useLists).mockReturnValue({
      data: mockLists,
      isLoading: false,
      isError: false,
    } as any)

    vi.mocked(useSchemas).mockReturnValue({
      data: mockSchemas,
      isLoading: false,
      isError: false,
    } as any)
  })

  it('renders complete settings page with schemas', async () => {
    renderWithRouter(<SettingsPage />)

    // Page header
    expect(screen.getByText('Settings')).toBeInTheDocument()

    // Tabs
    expect(screen.getByRole('tab', { name: /schemas/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /fields/i })).toBeInTheDocument()

    // Create button
    expect(screen.getByRole('button', { name: /create schema/i })).toBeInTheDocument()

    // Wait for schemas to load
    await waitFor(() => {
      expect(screen.getByText('Makeup Tutorial Criteria')).toBeInTheDocument()
    })
  })

  it('switches between tabs', async () => {
    vi.mocked(useSchemas).mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
    } as any)

    // ✨ FIX #1: Use userEvent.setup({ delay: null })
    const user = userEvent.setup({ delay: null })
    renderWithRouter(<SettingsPage />)

    // Initially on Schemas tab
    await waitFor(() => {
      expect(screen.getByText(/no schemas yet/i)).toBeInTheDocument()
    })

    // Click Fields tab
    await user.click(screen.getByRole('tab', { name: /fields/i }))

    // Fields placeholder shown
    expect(screen.getByText(/fields management coming soon/i)).toBeInTheDocument()
  })

  it('handles create schema button click', async () => {
    vi.mocked(useSchemas).mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
    } as any)

    const consoleSpy = vi.spyOn(console, 'log')
    // ✨ FIX #1: Use userEvent.setup({ delay: null })
    const user = userEvent.setup({ delay: null })
    renderWithRouter(<SettingsPage />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /create schema/i })).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: /create schema/i }))

    expect(consoleSpy).toHaveBeenCalledWith('Create schema clicked - to be implemented')
  })

  it('handles schema action menu interactions', async () => {
    const consoleSpy = vi.spyOn(console, 'log')
    // ✨ FIX #1: Use userEvent.setup({ delay: null })
    const user = userEvent.setup({ delay: null })
    renderWithRouter(<SettingsPage />)

    await waitFor(() => {
      expect(screen.getByText('Makeup Tutorial Criteria')).toBeInTheDocument()
    })

    // Open action menu
    const actionButton = screen.getByRole('button', { name: /actions for makeup tutorial criteria/i })
    await user.click(actionButton)

    // Click Edit
    await user.click(screen.getByText('Edit'))

    expect(consoleSpy).toHaveBeenCalledWith('Edit schema:', 'schema-1')
  })

  // ✨ FIX #7 (Optional): Error handling test
  it('handles network error gracefully', async () => {
    vi.mocked(useSchemas).mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
    } as any)

    renderWithRouter(<SettingsPage />)

    await waitFor(() => {
      expect(screen.getByText(/error loading schemas/i)).toBeInTheDocument()
    })
  })
})
