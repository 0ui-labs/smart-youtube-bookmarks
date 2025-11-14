import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AnalyticsView } from './AnalyticsView'
import type { AnalyticsResponse } from '@/types/analytics'
import type { BookmarkListResponse } from '@/types/list'

// Mock hooks
vi.mock('@/hooks/useAnalytics')
vi.mock('@/hooks/useLists')

// Mock child components
vi.mock('./MostUsedFieldsChart', () => ({
  MostUsedFieldsChart: ({ data }: any) => (
    <div data-testid="most-used-fields-chart">MostUsedFieldsChart: {data.length} items</div>
  ),
}))
vi.mock('./UnusedSchemasTable', () => ({
  UnusedSchemasTable: ({ data }: any) => (
    <div data-testid="unused-schemas-table">UnusedSchemasTable: {data.length} items</div>
  ),
}))
vi.mock('./FieldCoverageStats', () => ({
  FieldCoverageStats: ({ data }: any) => (
    <div data-testid="field-coverage-stats">FieldCoverageStats: {data.length} items</div>
  ),
}))
vi.mock('./SchemaEffectivenessChart', () => ({
  SchemaEffectivenessChart: ({ data }: any) => (
    <div data-testid="schema-effectiveness-chart">SchemaEffectivenessChart: {data.length} items</div>
  ),
}))

import { useAnalytics } from '@/hooks/useAnalytics'
import { useLists } from '@/hooks/useLists'

// Mock data
const mockList: BookmarkListResponse = {
  id: 'list-1',
  name: 'Test List',
  description: 'Test description',
  created_at: '2025-01-01T00:00:00Z',
  updated_at: '2025-01-01T00:00:00Z',
}

const mockAnalytics: AnalyticsResponse = {
  most_used_fields: [
    {
      field_id: 'field-1',
      field_name: 'Overall Rating',
      field_type: 'rating',
      usage_count: 90,
      total_videos: 100,
      usage_percentage: 90.0,
    },
    {
      field_id: 'field-2',
      field_name: 'Presentation',
      field_type: 'select',
      usage_count: 60,
      total_videos: 100,
      usage_percentage: 60.0,
    },
  ],
  unused_schemas: [
    {
      schema_id: 'schema-1',
      schema_name: 'Educational',
      field_count: 3,
      tag_count: 0,
      last_used: null,
      reason: 'no_tags',
    },
  ],
  field_coverage: [
    {
      field_id: 'field-1',
      field_name: 'Overall Rating',
      field_type: 'rating',
      videos_with_values: 90,
      total_videos: 100,
      coverage_percentage: 90.0,
    },
  ],
  schema_effectiveness: [
    {
      schema_id: 'schema-2',
      schema_name: 'Tutorial',
      field_count: 5,
      avg_fields_filled: 4.2,
      completion_percentage: 84.0,
      video_count: 20,
    },
  ],
}

describe('AnalyticsView', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  function renderAnalyticsView() {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    })

    return render(
      <QueryClientProvider client={queryClient}>
        <AnalyticsView />
      </QueryClientProvider>
    )
  }

  it('renders loading state while fetching data', () => {
    vi.mocked(useLists).mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
    } as any)
    vi.mocked(useAnalytics).mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
    } as any)

    const { container } = renderAnalyticsView()

    // Should show 4 loading skeleton cards with grid layout
    const gridContainer = container.querySelector('.grid.grid-cols-1.lg\\:grid-cols-2')
    expect(gridContainer).toBeInTheDocument()

    // Should show 4 skeleton cards with animate-pulse
    const skeletonElements = container.querySelectorAll('.animate-pulse')
    expect(skeletonElements.length).toBeGreaterThanOrEqual(4)
  })

  it('renders error state when lists fetch fails', () => {
    vi.mocked(useLists).mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
    } as any)
    vi.mocked(useAnalytics).mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: false,
    } as any)

    renderAnalyticsView()

    expect(screen.getByText('Error loading analytics')).toBeInTheDocument()
    expect(screen.getByText(/Unable to fetch analytics data/)).toBeInTheDocument()
  })

  it('renders error state when analytics fetch fails', () => {
    vi.mocked(useLists).mockReturnValue({
      data: [mockList],
      isLoading: false,
      isError: false,
    } as any)
    vi.mocked(useAnalytics).mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
    } as any)

    renderAnalyticsView()

    expect(screen.getByText('Error loading analytics')).toBeInTheDocument()
    expect(screen.getByText(/Unable to fetch analytics data/)).toBeInTheDocument()
  })

  it('renders all 4 analytics components with data', () => {
    vi.mocked(useLists).mockReturnValue({
      data: [mockList],
      isLoading: false,
      isError: false,
    } as any)
    vi.mocked(useAnalytics).mockReturnValue({
      data: mockAnalytics,
      isLoading: false,
      isError: false,
    } as any)

    renderAnalyticsView()

    // Verify all 4 components are rendered
    expect(screen.getByTestId('most-used-fields-chart')).toBeInTheDocument()
    expect(screen.getByTestId('unused-schemas-table')).toBeInTheDocument()
    expect(screen.getByTestId('field-coverage-stats')).toBeInTheDocument()
    expect(screen.getByTestId('schema-effectiveness-chart')).toBeInTheDocument()

    // Verify data is passed correctly
    expect(screen.getByText('MostUsedFieldsChart: 2 items')).toBeInTheDocument()
    expect(screen.getByText('UnusedSchemasTable: 1 items')).toBeInTheDocument()
    expect(screen.getByText('FieldCoverageStats: 1 items')).toBeInTheDocument()
    expect(screen.getByText('SchemaEffectivenessChart: 1 items')).toBeInTheDocument()
  })
})
