import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock Vidstack before importing VideoPlayer
vi.mock("@vidstack/react", () => ({
  MediaPlayer: vi.fn(({ children, src, className, title }) => (
    <div
      className={className}
      data-src={src}
      data-testid="media-player"
      data-title={title}
    >
      {children}
    </div>
  )),
  MediaProvider: vi.fn(({ children }) => (
    <div data-testid="media-provider">{children}</div>
  )),
  Poster: vi.fn(({ src, alt }) => (
    <img alt={alt} data-testid="poster" src={src} />
  )),
  Track: vi.fn(({ src, kind, label }) => (
    <div data-label={label} data-src={src} data-testid={`track-${kind}`} />
  )),
}));

vi.mock("@vidstack/react/player/layouts/default", () => ({
  DefaultVideoLayout: vi.fn(() => <div data-testid="default-video-layout" />),
  defaultLayoutIcons: {},
}));

// Mock the stores and hooks
vi.mock("@/stores/playerSettingsStore", () => ({
  usePlayerSettingsStore: vi.fn(() => ({
    volume: 1,
    muted: false,
    playbackRate: 1,
    setVolume: vi.fn(),
    setMuted: vi.fn(),
    setPlaybackRate: vi.fn(),
  })),
}));

vi.mock("@/hooks/useWatchProgress", () => ({
  useUpdateWatchProgress: vi.fn(() => ({
    mutate: vi.fn(),
  })),
}));

// Mock Vidstack CSS imports
vi.mock("@vidstack/react/player/styles/default/theme.css", () => ({}));
vi.mock("@vidstack/react/player/styles/default/layouts/video.css", () => ({}));

import { VideoPlayer } from "../VideoPlayer";

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe("VideoPlayer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders loading state initially", () => {
    render(<VideoPlayer videoId="test-uuid" youtubeId="dQw4w9WgXcQ" />, {
      wrapper: createWrapper(),
    });

    // Should show loading spinner
    expect(document.querySelector(".animate-spin")).toBeInTheDocument();
  });

  it("renders MediaPlayer with youtube source", () => {
    render(<VideoPlayer videoId="test-uuid" youtubeId="dQw4w9WgXcQ" />, {
      wrapper: createWrapper(),
    });

    const mediaPlayer = screen.getByTestId("media-player");
    expect(mediaPlayer).toBeInTheDocument();
    expect(mediaPlayer).toHaveAttribute("data-src", "youtube/dQw4w9WgXcQ");
  });

  it("renders MediaProvider and DefaultVideoLayout", () => {
    render(<VideoPlayer videoId="test-uuid" youtubeId="dQw4w9WgXcQ" />, {
      wrapper: createWrapper(),
    });

    expect(screen.getByTestId("media-provider")).toBeInTheDocument();
    expect(screen.getByTestId("default-video-layout")).toBeInTheDocument();
  });

  it("shows resume indicator when initialPosition is provided", () => {
    render(
      <VideoPlayer
        initialPosition={120}
        videoId="test-uuid"
        youtubeId="dQw4w9WgXcQ"
      />,
      { wrapper: createWrapper() }
    );

    expect(screen.getByText("Fortsetzen bei 2:00")).toBeInTheDocument();
  });

  it("does not show resume indicator when initialPosition is 0", () => {
    render(
      <VideoPlayer
        initialPosition={0}
        videoId="test-uuid"
        youtubeId="dQw4w9WgXcQ"
      />,
      { wrapper: createWrapper() }
    );

    expect(screen.queryByText(/Fortsetzen bei/)).not.toBeInTheDocument();
  });

  it("does not show resume indicator when initialPosition is null", () => {
    render(
      <VideoPlayer
        initialPosition={null}
        videoId="test-uuid"
        youtubeId="dQw4w9WgXcQ"
      />,
      { wrapper: createWrapper() }
    );

    expect(screen.queryByText(/Fortsetzen bei/)).not.toBeInTheDocument();
  });

  it("formats time correctly for hours", () => {
    render(
      <VideoPlayer
        initialPosition={3661}
        videoId="test-uuid"
        youtubeId="dQw4w9WgXcQ" // 1:01:01
      />,
      { wrapper: createWrapper() }
    );

    expect(screen.getByText("Fortsetzen bei 1:01:01")).toBeInTheDocument();
  });

  it("renders with title prop", () => {
    render(
      <VideoPlayer
        title="Test Video Title"
        videoId="test-uuid"
        youtubeId="dQw4w9WgXcQ"
      />,
      { wrapper: createWrapper() }
    );

    const mediaPlayer = screen.getByTestId("media-player");
    expect(mediaPlayer).toHaveAttribute("data-title", "Test Video Title");
  });

  it("renders poster when provided", () => {
    render(
      <VideoPlayer
        poster="https://example.com/poster.jpg"
        title="Test Video"
        videoId="test-uuid"
        youtubeId="dQw4w9WgXcQ"
      />,
      { wrapper: createWrapper() }
    );

    const poster = screen.getByTestId("poster");
    expect(poster).toBeInTheDocument();
    expect(poster).toHaveAttribute("src", "https://example.com/poster.jpg");
  });

  it("renders text tracks when provided", () => {
    const textTracks = [
      {
        src: "/subs/en.vtt",
        label: "English",
        language: "en",
        kind: "subtitles" as const,
        default: true,
      },
      {
        src: "/chapters.vtt",
        language: "en",
        kind: "chapters" as const,
        default: true,
      },
    ];

    render(
      <VideoPlayer
        textTracks={textTracks}
        videoId="test-uuid"
        youtubeId="dQw4w9WgXcQ"
      />,
      { wrapper: createWrapper() }
    );

    expect(screen.getByTestId("track-subtitles")).toBeInTheDocument();
    expect(screen.getByTestId("track-subtitles")).toHaveAttribute(
      "data-label",
      "English"
    );
    expect(screen.getByTestId("track-chapters")).toBeInTheDocument();
  });
});
