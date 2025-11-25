import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

// Mock Plyr before importing VideoPlayer
vi.mock('plyr', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      on: vi.fn(),
      destroy: vi.fn(),
      volume: 1,
      muted: false,
      speed: 1,
      currentTime: 0,
      duration: 300,
      playing: false,
    })),
  }
})

// Mock the stores and hooks
vi.mock('@/stores/playerSettingsStore', () => ({
  usePlayerSettingsStore: vi.fn(() => ({
    volume: 1,
    muted: false,
    playbackRate: 1,
    setVolume: vi.fn(),
    setMuted: vi.fn(),
    setPlaybackRate: vi.fn(),
  })),
}))

vi.mock('@/hooks/useWatchProgress', () => ({
  useUpdateWatchProgress: vi.fn(() => ({
    mutate: vi.fn(),
  })),
}))

import { VideoPlayer } from '../VideoPlayer'

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

describe('VideoPlayer', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders loading state initially', () => {
    render(
      <VideoPlayer
        youtubeId="dQw4w9WgXcQ"
        videoId="test-uuid"
      />,
      { wrapper: createWrapper() }
    )

    // Should show loading spinner
    expect(document.querySelector('.animate-spin')).toBeInTheDocument()
  })

  it('renders with youtube id in data attribute', () => {
    render(
      <VideoPlayer
        youtubeId="dQw4w9WgXcQ"
        videoId="test-uuid"
      />,
      { wrapper: createWrapper() }
    )

    const container = document.querySelector('[data-plyr-embed-id="dQw4w9WgXcQ"]')
    expect(container).toBeInTheDocument()
  })

  it('shows resume indicator when initialPosition is provided', () => {
    render(
      <VideoPlayer
        youtubeId="dQw4w9WgXcQ"
        videoId="test-uuid"
        initialPosition={120}
      />,
      { wrapper: createWrapper() }
    )

    expect(screen.getByText('Fortsetzen bei 2:00')).toBeInTheDocument()
  })

  it('does not show resume indicator when initialPosition is 0', () => {
    render(
      <VideoPlayer
        youtubeId="dQw4w9WgXcQ"
        videoId="test-uuid"
        initialPosition={0}
      />,
      { wrapper: createWrapper() }
    )

    expect(screen.queryByText(/Fortsetzen bei/)).not.toBeInTheDocument()
  })

  it('does not show resume indicator when initialPosition is null', () => {
    render(
      <VideoPlayer
        youtubeId="dQw4w9WgXcQ"
        videoId="test-uuid"
        initialPosition={null}
      />,
      { wrapper: createWrapper() }
    )

    expect(screen.queryByText(/Fortsetzen bei/)).not.toBeInTheDocument()
  })

  it('formats time correctly for hours', () => {
    render(
      <VideoPlayer
        youtubeId="dQw4w9WgXcQ"
        videoId="test-uuid"
        initialPosition={3661} // 1:01:01
      />,
      { wrapper: createWrapper() }
    )

    expect(screen.getByText('Fortsetzen bei 1:01:01')).toBeInTheDocument()
  })
})
