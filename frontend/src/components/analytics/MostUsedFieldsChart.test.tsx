import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MostUsedFieldsChart } from './MostUsedFieldsChart'
import type { MostUsedFieldStat } from '@/types/analytics'

const mockData: MostUsedFieldStat[] = [
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
  {
    field_id: 'field-3',
    field_name: 'Notes',
    field_type: 'text',
    usage_count: 30,
    total_videos: 100,
    usage_percentage: 30.0,
  },
]

describe('MostUsedFieldsChart', () => {
  it('renders chart with data', () => {
    render(<MostUsedFieldsChart data={mockData} />)

    expect(screen.getByText('Most-Used Fields')).toBeInTheDocument()
    expect(screen.getByText(/Top \d+ fields by usage count/)).toBeInTheDocument()
  })

  it('renders empty state when no data', () => {
    render(<MostUsedFieldsChart data={[]} />)

    expect(screen.getByText('No field values set yet')).toBeInTheDocument()
    expect(screen.getByText('Start rating videos to see usage statistics')).toBeInTheDocument()
  })

  it('displays correct number of fields in description', () => {
    render(<MostUsedFieldsChart data={mockData} />)

    expect(screen.getByText('Top 3 fields by usage count')).toBeInTheDocument()
  })

  it('limits description to max 10 fields', () => {
    const manyFields = Array.from({ length: 15 }, (_, i) => ({
      ...mockData[0],
      field_id: `field-${i}`,
      field_name: `Field ${i}`,
    }))

    render(<MostUsedFieldsChart data={manyFields} />)

    expect(screen.getByText('Top 10 fields by usage count')).toBeInTheDocument()
  })
})
