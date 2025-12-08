import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock VideoPlayer component to avoid Plyr complexity
vi.mock("@/components/VideoPlayer", () => ({
  VideoPlayer: vi.fn(({ youtubeId, videoId, initialPosition }) => (
    <div
      data-initial-position={initialPosition}
      data-testid="video-player-mock"
      data-video-id={videoId}
      data-youtube-id={youtubeId}
    >
      Mocked VideoPlayer
    </div>
  )),
}));

// Mock stores and hooks
vi.mock("@/hooks/useVideos", () => ({
  useSetVideoCategory: vi.fn(() => ({
    mutate: vi.fn(),
    isPending: false,
  })),
}));

vi.mock("@/hooks/useTags", () => ({
  useTags: vi.fn(() => ({
    data: [],
    isLoading: false,
  })),
  useCategories: vi.fn(() => ({
    data: [],
    isLoading: false,
  })),
  useLabels: vi.fn(() => ({
    data: [],
    isLoading: false,
  })),
}));

// Mock video data
const mockVideoData = {
  id: "test-video-uuid",
  list_id: "test-list-uuid",
  youtube_id: "dQw4w9WgXcQ",
  title: "Test Video Title",
  channel: "Test Channel",
  thumbnail_url: "https://example.com/thumb.jpg",
  duration: 300,
  published_at: "2024-01-01T00:00:00Z",
  tags: [],
  processing_status: "completed" as const,
  created_at: "2024-01-01T00:00:00Z",
  updated_at: "2024-01-01T00:00:00Z",
  field_values: [],
  available_fields: [],
  watch_position: 120,
  watch_position_updated_at: "2024-01-01T00:05:00Z",
};

// Mock tanstack query
vi.mock("@tanstack/react-query", async () => {
  const actual = await vi.importActual("@tanstack/react-query");
  return {
    ...actual,
    useQuery: vi.fn(() => ({
      data: mockVideoData,
      isLoading: false,
      error: null,
    })),
    useMutation: vi.fn(() => ({
      mutate: vi.fn(),
      isPending: false,
    })),
    useQueryClient: vi.fn(() => ({
      invalidateQueries: vi.fn(),
    })),
  };
});

import { VideoPlayer } from "@/components/VideoPlayer";
import { VideoDetailsPage } from "../VideoDetailsPage";

const createWrapper = (videoId: string) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[`/videos/${videoId}`]}>
        <Routes>
          <Route element={children} path="/videos/:videoId" />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
};

describe("VideoDetailsPage Integration with VideoPlayer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders VideoPlayer component", () => {
    render(<VideoDetailsPage />, { wrapper: createWrapper("test-video-uuid") });

    expect(screen.getByTestId("video-player-mock")).toBeInTheDocument();
  });

  it("passes youtubeId to VideoPlayer", () => {
    render(<VideoDetailsPage />, { wrapper: createWrapper("test-video-uuid") });

    const player = screen.getByTestId("video-player-mock");
    expect(player).toHaveAttribute("data-youtube-id", "dQw4w9WgXcQ");
  });

  it("passes videoId to VideoPlayer", () => {
    render(<VideoDetailsPage />, { wrapper: createWrapper("test-video-uuid") });

    const player = screen.getByTestId("video-player-mock");
    expect(player).toHaveAttribute("data-video-id", "test-video-uuid");
  });

  it("passes watch_position as initialPosition to VideoPlayer", () => {
    render(<VideoDetailsPage />, { wrapper: createWrapper("test-video-uuid") });

    const player = screen.getByTestId("video-player-mock");
    expect(player).toHaveAttribute("data-initial-position", "120");
  });

  it("displays video title", () => {
    render(<VideoDetailsPage />, { wrapper: createWrapper("test-video-uuid") });

    expect(screen.getByText("Test Video Title")).toBeInTheDocument();
  });

  it("displays channel name", () => {
    render(<VideoDetailsPage />, { wrapper: createWrapper("test-video-uuid") });

    expect(screen.getByText("Test Channel")).toBeInTheDocument();
  });

  it("renders back button", () => {
    render(<VideoDetailsPage />, { wrapper: createWrapper("test-video-uuid") });

    expect(screen.getByText("Zurück zur Übersicht")).toBeInTheDocument();
  });

  it("calls VideoPlayer component with correct props", () => {
    render(<VideoDetailsPage />, { wrapper: createWrapper("test-video-uuid") });

    // VideoPlayer should have been called
    expect(VideoPlayer).toHaveBeenCalled();

    // Check it was called with correct props
    expect(VideoPlayer).toHaveBeenCalledWith(
      expect.objectContaining({
        youtubeId: "dQw4w9WgXcQ",
        videoId: "test-video-uuid",
        initialPosition: 120,
      }),
      expect.anything()
    );
  });
});
