import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

// Mock Vidstack before importing VideoPlayer
vi.mock('@vidstack/react', () => ({
  MediaPlayer: vi.fn(({ children, src, className, title }) => (
    <div data-testid="media-player" data-src={src} data-title={title} className={className}>
      {children}
    </div>
  )),
  MediaProvider: vi.fn(({ children }) => <div data-testid="media-provider">{children}</div>),
  Poster: vi.fn(({ src, alt }) => <img data-testid="poster" src={src} alt={alt} />),
  Track: vi.fn(({ src, kind, label }) => (
    <div data-testid={`track-${kind}`} data-src={src} data-label={label} />
  )),
}))

vi.mock('@vidstack/react/player/layouts/default', () => ({
  DefaultVideoLayout: vi.fn(() => <div data-testid="default-video-layout" />),
  defaultLayoutIcons: {},
}))

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

// Mock Vidstack CSS imports
vi.mock('@vidstack/react/player/styles/default/theme.css', () => ({}))
vi.mock('@vidstack/react/player/styles/default/layouts/video.css', () => ({}))

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

  it('renders MediaPlayer with youtube source', () => {
    render(
      <VideoPlayer
        youtubeId="dQw4w9WgXcQ"
        videoId="test-uuid"
      />,
      { wrapper: createWrapper() }
    )

    const mediaPlayer = screen.getByTestId('media-player')
    expect(mediaPlayer).toBeInTheDocument()
    expect(mediaPlayer).toHaveAttribute('data-src', 'youtube/dQw4w9WgXcQ')
  })

  it('renders MediaProvider and DefaultVideoLayout', () => {
    render(
      <VideoPlayer
        youtubeId="dQw4w9WgXcQ"
        videoId="test-uuid"
      />,
      { wrapper: createWrapper() }
    )

    expect(screen.getByTestId('media-provider')).toBeInTheDocument()
    expect(screen.getByTestId('default-video-layout')).toBeInTheDocument()
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

  it('renders with title prop', () => {
    render(
      <VideoPlayer
        youtubeId="dQw4w9WgXcQ"
        videoId="test-uuid"
        title="Test Video Title"
      />,
      { wrapper: createWrapper() }
    )

    const mediaPlayer = screen.getByTestId('media-player')
    expect(mediaPlayer).toHaveAttribute('data-title', 'Test Video Title')
  })

  it('renders poster when provided', () => {
    render(
      <VideoPlayer
        youtubeId="dQw4w9WgXcQ"
        videoId="test-uuid"
        poster="https://example.com/poster.jpg"
        title="Test Video"
      />,
      { wrapper: createWrapper() }
    )

    const poster = screen.getByTestId('poster')
    expect(poster).toBeInTheDocument()
    expect(poster).toHaveAttribute('src', 'https://example.com/poster.jpg')
  })

  it('renders text tracks when provided', () => {
    const textTracks = [
      { src: '/subs/en.vtt', label: 'English', language: 'en', kind: 'subtitles' as const, default: true },
      { src: '/chapters.vtt', language: 'en', kind: 'chapters' as const, default: true },
    ]

    render(
      <VideoPlayer
        youtubeId="dQw4w9WgXcQ"
        videoId="test-uuid"
        textTracks={textTracks}
      />,
      { wrapper: createWrapper() }
    )

    expect(screen.getByTestId('track-subtitles')).toBeInTheDocument()
    expect(screen.getByTestId('track-subtitles')).toHaveAttribute('data-label', 'English')
    expect(screen.getByTestId('track-chapters')).toBeInTheDocument()
  })
})
