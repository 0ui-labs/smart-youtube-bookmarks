import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { FieldCoverageStats } from './FieldCoverageStats'
import type { FieldCoverageStat } from '@/types/analytics'

const mockData: FieldCoverageStat[] = [
  {
    field_id: 'field-1',
    field_name: 'Low Coverage Field',
    field_type: 'rating',
    videos_with_values: 5,
    total_videos: 100,
    coverage_percentage: 5.0,
  },
  {
    field_id: 'field-2',
    field_name: 'Medium Coverage Field',
    field_type: 'select',
    videos_with_values: 60,
    total_videos: 100,
    coverage_percentage: 60.0,
  },
  {
    field_id: 'field-3',
    field_name: 'High Coverage Field',
    field_type: 'text',
    videos_with_values: 90,
    total_videos: 100,
    coverage_percentage: 90.0,
  },
]

describe('FieldCoverageStats', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('renders table with data', () => {
    render(<FieldCoverageStats data={mockData} />)

    expect(screen.getByText('Field Coverage')).toBeInTheDocument()
    expect(screen.getByText('Coverage percentage for all custom fields')).toBeInTheDocument()
    expect(screen.getByText('Low Coverage Field')).toBeInTheDocument()
    expect(screen.getByText('Medium Coverage Field')).toBeInTheDocument()
    expect(screen.getByText('High Coverage Field')).toBeInTheDocument()
  })

  it('renders empty state when no data', () => {
    render(<FieldCoverageStats data={[]} />)

    expect(screen.getByText('All fields have good coverage')).toBeInTheDocument()
    expect(screen.getByText('No coverage issues found')).toBeInTheDocument()
  })

  it('displays low coverage badge for fields with <10% coverage', () => {
    render(<FieldCoverageStats data={mockData} />)

    expect(screen.getByText('Low Coverage')).toBeInTheDocument()
  })

  it('does not display low coverage badge for fields with >=10% coverage', () => {
    const highCoverageData: FieldCoverageStat[] = [
      {
        field_id: 'field-1',
        field_name: 'Good Coverage Field',
        field_type: 'rating',
        videos_with_values: 15,
        total_videos: 100,
        coverage_percentage: 15.0,
      },
    ]

    render(<FieldCoverageStats data={highCoverageData} />)

    expect(screen.queryByText('Low Coverage')).not.toBeInTheDocument()
  })

  it('displays correct coverage percentages', () => {
    render(<FieldCoverageStats data={mockData} />)

    expect(screen.getByText('5.0%')).toBeInTheDocument()
    expect(screen.getByText('60.0%')).toBeInTheDocument()
    expect(screen.getByText('90.0%')).toBeInTheDocument()
  })

  it('displays field types correctly', () => {
    render(<FieldCoverageStats data={mockData} />)

    expect(screen.getByText('rating')).toBeInTheDocument()
    expect(screen.getByText('select')).toBeInTheDocument()
    expect(screen.getByText('text')).toBeInTheDocument()
  })
})
