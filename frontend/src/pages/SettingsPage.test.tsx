import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import { renderWithRouter } from '@/test/renderWithRouter'
import { SettingsPage } from './SettingsPage'
import type { FieldSchemaResponse } from '@/types/schema'

// Mock useSchemas and useLists hooks
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
        field_id: 'field-1',
        schema_id: 'schema-1',
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

describe('SettingsPage', () => {
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
  })

  it('renders page header', () => {
    vi.mocked(useSchemas).mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
    } as any)

    renderWithRouter(<SettingsPage />)

    expect(screen.getByText('Settings')).toBeInTheDocument()
  })

  it('renders tabs navigation', () => {
    vi.mocked(useSchemas).mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
    } as any)

    renderWithRouter(<SettingsPage />)

    expect(screen.getByRole('tab', { name: /schemas/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /fields/i })).toBeInTheDocument()
  })

  it('renders schemas tab by default', () => {
    vi.mocked(useSchemas).mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
    } as any)

    renderWithRouter(<SettingsPage />)

    expect(screen.getByRole('tabpanel')).toBeInTheDocument()
  })

  it('renders create schema button', () => {
    vi.mocked(useSchemas).mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
    } as any)

    renderWithRouter(<SettingsPage />)

    expect(screen.getByRole('button', { name: /create schema/i })).toBeInTheDocument()
  })

  // ✨ FIX #4: Test useLists loading state
  it('displays loading state when lists are loading', () => {
    vi.mocked(useLists).mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
    } as any)

    vi.mocked(useSchemas).mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: false,
    } as any)

    renderWithRouter(<SettingsPage />)

    expect(screen.getByText(/loading/i)).toBeInTheDocument()
  })

  it('displays loading state when schemas are loading', () => {
    vi.mocked(useSchemas).mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
    } as any)

    renderWithRouter(<SettingsPage />)

    expect(screen.getByText(/loading schemas/i)).toBeInTheDocument()
  })

  it('displays error state', () => {
    vi.mocked(useSchemas).mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
    } as any)

    renderWithRouter(<SettingsPage />)

    expect(screen.getByText(/error loading schemas/i)).toBeInTheDocument()
  })

  it('displays empty state when no schemas exist', () => {
    vi.mocked(useSchemas).mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
    } as any)

    renderWithRouter(<SettingsPage />)

    expect(screen.getByText(/no schemas yet/i)).toBeInTheDocument()
  })

  it('renders SchemasList when schemas exist', async () => {
    vi.mocked(useSchemas).mockReturnValue({
      data: mockSchemas,
      isLoading: false,
      isError: false,
    } as any)

    renderWithRouter(<SettingsPage />)

    await waitFor(() => {
      expect(screen.getByText('Makeup Tutorial Criteria')).toBeInTheDocument()
    })
  })
})
