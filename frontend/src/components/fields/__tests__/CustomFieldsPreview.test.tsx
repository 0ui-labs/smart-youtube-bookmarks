import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'
import { CustomFieldsPreview } from '../CustomFieldsPreview'
import type { VideoFieldValue } from '@/types/video'
import { api } from '@/lib/api'

// Mock API
vi.mock('@/lib/api', () => ({
  api: {
    put: vi.fn(),
  },
}))

// Helper to create test field values
const createRatingField = (overrides?: Partial<VideoFieldValue>): VideoFieldValue => ({
  id: 'rating-fv-123',
  video_id: 'video-123',
  field_id: 'rating-123',
  field_name: 'Quality Rating',
  show_on_card: true,
  field: {
    id: 'rating-123',
    list_id: 'list-123',
    name: 'Quality Rating',
    field_type: 'rating',
    config: { max_rating: 5 },
    created_at: '2025-11-01T00:00:00Z',
    updated_at: '2025-11-01T00:00:00Z',
  },
  value: 4,
  updated_at: '2025-11-01T00:00:00Z',
  ...overrides,
} as VideoFieldValue)

const createSelectField = (overrides?: Partial<VideoFieldValue>): VideoFieldValue => ({
  id: 'select-fv-456',
  video_id: 'video-123',
  field_id: 'select-456',
  field_name: 'Content Quality',
  show_on_card: true,
  field: {
    id: 'select-456',
    list_id: 'list-123',
    name: 'Content Quality',
    field_type: 'select',
    config: { options: ['bad', 'good', 'great'] },
    created_at: '2025-11-01T00:00:00Z',
    updated_at: '2025-11-01T00:00:00Z',
  },
  value: 'good',
  updated_at: '2025-11-01T00:00:00Z',
  ...overrides,
} as VideoFieldValue)

const createBooleanField = (overrides?: Partial<VideoFieldValue>): VideoFieldValue => ({
  id: 'boolean-fv-789',
  video_id: 'video-123',
  field_id: 'boolean-789',
  field_name: 'Recommended',
  show_on_card: true,
  field: {
    id: 'boolean-789',
    list_id: 'list-123',
    name: 'Recommended',
    field_type: 'boolean',
    config: {},
    created_at: '2025-11-01T00:00:00Z',
    updated_at: '2025-11-01T00:00:00Z',
  },
  value: true,
  updated_at: '2025-11-01T00:00:00Z',
  ...overrides,
} as VideoFieldValue)

const createTextField = (overrides?: Partial<VideoFieldValue>): VideoFieldValue => ({
  id: 'text-fv-101',
  video_id: 'video-123',
  field_id: 'text-101',
  field_name: 'Notes',
  show_on_card: true,
  field: {
    id: 'text-101',
    list_id: 'list-123',
    name: 'Notes',
    field_type: 'text',
    config: { max_length: 500 },
    created_at: '2025-11-01T00:00:00Z',
    updated_at: '2025-11-01T00:00:00Z',
  },
  value: 'Great tutorial!',
  updated_at: '2025-11-01T00:00:00Z',
  ...overrides,
} as VideoFieldValue)

// Render helper
const renderWithQuery = (component: React.ReactElement) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      {component}
    </QueryClientProvider>
  )
}

describe('CustomFieldsPreview - Rendering Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders nothing when no field values provided', () => {
    const { container } = renderWithQuery(
      <CustomFieldsPreview
        videoId="video-123"
        fieldValues={[]}
      />
    )

    expect(container.firstChild).toBeNull()
  })

  it('renders nothing when all fields have show_on_card=false', () => {
    const fieldValues = [
      createRatingField({ show_on_card: false }),
      createSelectField({ show_on_card: false }),
    ]

    const { container } = renderWithQuery(
      <CustomFieldsPreview
        videoId="video-123"
        fieldValues={fieldValues}
      />
    )

    expect(container.firstChild).toBeNull()
  })

  it('displays max 3 fields when more than 3 have show_on_card=true', () => {
    const fieldValues = [
      createRatingField(),
      createSelectField(),
      createBooleanField(),
      createTextField(),
    ]

    renderWithQuery(
      <CustomFieldsPreview
        videoId="video-123"
        fieldValues={fieldValues}
      />
    )

    // Should show exactly 3 field labels
    expect(screen.getByText('Quality Rating:')).toBeInTheDocument()
    expect(screen.getByText('Content Quality:')).toBeInTheDocument()
    expect(screen.getByText('Recommended:')).toBeInTheDocument()
    expect(screen.queryByText('Notes:')).not.toBeInTheDocument()
  })

  it('shows "More fields" indicator when total > 3', () => {
    const fieldValues = [
      createRatingField(),
      createSelectField(),
      createBooleanField(),
      createTextField(),
    ]

    renderWithQuery(
      <CustomFieldsPreview
        videoId="video-123"
        fieldValues={fieldValues}
      />
    )

    // Should show "+1 more" badge
    expect(screen.getByText('+1 more')).toBeInTheDocument()
    expect(screen.getByLabelText('View 1 more fields')).toBeInTheDocument()
  })

  it('does not show "More fields" when total <= 3', () => {
    const fieldValues = [
      createRatingField(),
      createSelectField(),
      createBooleanField(),
    ]

    renderWithQuery(
      <CustomFieldsPreview
        videoId="video-123"
        fieldValues={fieldValues}
      />
    )

    // Should NOT show "+X more" badge
    expect(screen.queryByText(/\+\d+ more/)).not.toBeInTheDocument()
  })
})

describe('CustomFieldsPreview - Interaction Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('calls onMoreClick when "More fields" badge is clicked', async () => {
    const user = userEvent.setup()
    const onMoreClick = vi.fn()

    const fieldValues = [
      createRatingField({ field_name: 'Rating 1' }),
      createSelectField({ field_name: 'Quality' }),
      createBooleanField({ field_name: 'Recommended' }),
      createTextField({ field_name: 'Notes' }),
    ]

    renderWithQuery(
      <CustomFieldsPreview
        videoId="video-123"
        fieldValues={fieldValues}
        onMoreClick={onMoreClick}
      />
    )

    const moreBadge = screen.getByText('+1 more')
    await user.click(moreBadge)

    expect(onMoreClick).toHaveBeenCalledTimes(1)
  })

  it('prevents event propagation when "More" badge is clicked', async () => {
    const user = userEvent.setup()
    const onMoreClick = vi.fn()
    const parentClick = vi.fn()

    const fieldValues = [
      createRatingField(),
      createSelectField(),
      createBooleanField(),
      createTextField(),
    ]

    const { container } = renderWithQuery(
      <div onClick={parentClick}>
        <CustomFieldsPreview
          videoId="video-123"
          fieldValues={fieldValues}
          onMoreClick={onMoreClick}
        />
      </div>
    )

    const moreBadge = screen.getByText('+1 more')
    await user.click(moreBadge)

    expect(onMoreClick).toHaveBeenCalledTimes(1)
    expect(parentClick).not.toHaveBeenCalled()
  })
})

describe('CustomFieldsPreview - Field Type Rendering', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders rating field with stars', () => {
    const fieldValues = [createRatingField({ value: 3 })]

    renderWithQuery(
      <CustomFieldsPreview
        videoId="video-123"
        fieldValues={fieldValues}
      />
    )

    // Check field label
    expect(screen.getByText('Quality Rating:')).toBeInTheDocument()

    // Check stars are rendered (5 star buttons)
    const stars = screen.getAllByRole('button').filter(btn =>
      btn.getAttribute('aria-label')?.includes('star')
    )
    expect(stars).toHaveLength(5)
  })

  it('renders select field with badge dropdown', () => {
    const fieldValues = [createSelectField({ value: 'great' })]

    renderWithQuery(
      <CustomFieldsPreview
        videoId="video-123"
        fieldValues={fieldValues}
      />
    )

    // Check field label
    expect(screen.getByText('Content Quality:')).toBeInTheDocument()

    // Check value is displayed
    expect(screen.getByText('great')).toBeInTheDocument()
  })

  it('renders boolean field with checkbox', () => {
    const fieldValues = [createBooleanField({ value: true })]

    renderWithQuery(
      <CustomFieldsPreview
        videoId="video-123"
        fieldValues={fieldValues}
      />
    )

    // Check field label
    expect(screen.getByText('Recommended:')).toBeInTheDocument()

    // Check checkbox is rendered and checked
    const checkbox = screen.getByRole('checkbox')
    expect(checkbox).toBeInTheDocument()
    expect(checkbox).toBeChecked()
  })

  it('renders text field with snippet badge', () => {
    const fieldValues = [createTextField({ value: 'Great tutorial!' })]

    renderWithQuery(
      <CustomFieldsPreview
        videoId="video-123"
        fieldValues={fieldValues}
      />
    )

    // Check field label
    expect(screen.getByText('Notes:')).toBeInTheDocument()

    // Check value is displayed (TextSnippet renders input element)
    expect(screen.getByDisplayValue('Great tutorial!')).toBeInTheDocument()
  })
})

describe('CustomFieldsPreview - Edge Cases', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('handles null values gracefully', () => {
    const fieldValues = [
      createRatingField({ value: null }),
      createSelectField({ value: null }),
      createBooleanField({ value: null }),
      createTextField({ value: null }),
    ]

    renderWithQuery(
      <CustomFieldsPreview
        videoId="video-123"
        fieldValues={fieldValues.slice(0, 3)} // Only render 3
      />
    )

    // Component should render without crashing
    expect(screen.getByText('Quality Rating:')).toBeInTheDocument()
    expect(screen.getByText('Content Quality:')).toBeInTheDocument()
    expect(screen.getByText('Recommended:')).toBeInTheDocument()

    // Rating should show 0 stars filled
    const stars = screen.getAllByRole('button').filter(btn =>
      btn.getAttribute('aria-label')?.includes('star')
    )
    expect(stars).toHaveLength(5)

    // Select should show "—" (em dash for null values)
    expect(screen.getByText('—')).toBeInTheDocument()

    // Boolean checkbox should be unchecked
    const checkbox = screen.getByRole('checkbox')
    expect(checkbox).not.toBeChecked()
  })

  it('handles empty field_values array', () => {
    const { container } = renderWithQuery(
      <CustomFieldsPreview
        videoId="video-123"
        fieldValues={[]}
      />
    )

    expect(container.firstChild).toBeNull()
  })

  it('correctly counts more fields with mixed show_on_card values', () => {
    const fieldValues = [
      createRatingField({ show_on_card: true }),
      createSelectField({ show_on_card: false }), // Hidden
      createBooleanField({ show_on_card: true }),
      createTextField({ show_on_card: true, field_id: 'text-102', id: 'text-fv-102' }),
      createTextField({ show_on_card: true, field_id: 'text-103', id: 'text-fv-103' }),
    ]

    renderWithQuery(
      <CustomFieldsPreview
        videoId="video-123"
        fieldValues={fieldValues}
      />
    )

    // Should show first 3 of 4 visible fields (show_on_card=true)
    expect(screen.getByText('Quality Rating:')).toBeInTheDocument()
    expect(screen.getByText('Recommended:')).toBeInTheDocument()
    expect(screen.getByText('Notes:')).toBeInTheDocument()

    // Should show "+1 more" (4 total - 3 displayed)
    expect(screen.getByText('+1 more')).toBeInTheDocument()

    // Content Quality should NOT be rendered (show_on_card=false)
    expect(screen.queryByText('Content Quality:')).not.toBeInTheDocument()
  })

  it('renders correctly with exactly 3 fields', () => {
    const fieldValues = [
      createRatingField(),
      createSelectField(),
      createBooleanField(),
    ]

    renderWithQuery(
      <CustomFieldsPreview
        videoId="video-123"
        fieldValues={fieldValues}
      />
    )

    // Should show all 3 fields
    expect(screen.getByText('Quality Rating:')).toBeInTheDocument()
    expect(screen.getByText('Content Quality:')).toBeInTheDocument()
    expect(screen.getByText('Recommended:')).toBeInTheDocument()

    // Should NOT show "+X more"
    expect(screen.queryByText(/\+\d+ more/)).not.toBeInTheDocument()
  })

  it('handles very long field names', () => {
    const longName = 'This Is A Very Long Field Name That Should Still Render Correctly'
    const fieldValues = [
      {
        ...createRatingField(),
        field_name: longName,
        field: {
          ...createRatingField().field,
          name: longName,
        },
      } as VideoFieldValue,
    ]

    renderWithQuery(
      <CustomFieldsPreview
        videoId="video-123"
        fieldValues={fieldValues}
      />
    )

    expect(
      screen.getByText('This Is A Very Long Field Name That Should Still Render Correctly:')
    ).toBeInTheDocument()
  })
})
