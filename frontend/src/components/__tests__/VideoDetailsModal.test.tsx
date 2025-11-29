import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { VideoResponse } from "@/types/video";
import { VideoDetailsModal } from "../VideoDetailsModal";

// Mock CustomFieldsSection (already tested in Task 2)
vi.mock("../CustomFieldsSection", () => ({
  CustomFieldsSection: ({ onFieldChange }: any) => (
    <div data-testid="custom-fields-section">
      <button onClick={() => onFieldChange("field-1", 5)}>Change Field</button>
    </div>
  ),
}));

// Mock CategorySelector (already tested separately)
vi.mock("../CategorySelector", () => ({
  CategorySelector: () => (
    <div data-testid="category-selector">CategorySelector</div>
  ),
}));

// Mock hooks to avoid API calls
vi.mock("@/hooks/useVideoDetail", () => ({
  useVideoDetail: () => ({ data: null, isLoading: false }),
}));

vi.mock("@/hooks/useVideos", () => ({
  useSetVideoCategory: () => ({
    mutate: vi.fn(),
    isPending: false,
  }),
}));

// Test wrapper with QueryClient
function renderWithProviders(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
  );
}

describe("VideoDetailsModal", () => {
  const mockOnOpenChange = vi.fn();
  const mockOnFieldChange = vi.fn();

  const mockVideo: VideoResponse = {
    id: "video-1",
    title: "Test Video Title",
    youtube_id: "abc123",
    list_id: "list-1",
    thumbnail_url: "https://example.com/thumb.jpg",
    duration: 300, // 5 minutes
    channel: "Test Channel",
    published_at: "2024-01-01T00:00:00Z",
    processing_status: "completed",
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
    tags: [
      {
        id: "tag-1",
        name: "Tutorial",
        list_id: "list-1",
        schema_id: null,
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-01T00:00:00Z",
      },
      {
        id: "tag-2",
        name: "React",
        list_id: "list-1",
        schema_id: null,
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-01T00:00:00Z",
      },
    ],
    field_values: [],
    available_fields: [],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ============================================================================
  // Controlled Modal Tests (3 tests)
  // ============================================================================

  it("renders modal when open=true", () => {
    renderWithProviders(
      <VideoDetailsModal
        listId="list-1"
        onFieldChange={mockOnFieldChange}
        onOpenChange={mockOnOpenChange}
        open={true}
        video={mockVideo}
      />
    );

    expect(screen.getByText("Test Video Title")).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("does not render when open=false", () => {
    renderWithProviders(
      <VideoDetailsModal
        listId="list-1"
        onFieldChange={mockOnFieldChange}
        onOpenChange={mockOnOpenChange}
        open={false}
        video={mockVideo}
      />
    );

    expect(screen.queryByText("Test Video Title")).not.toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("calls onOpenChange(false) when close button clicked", async () => {
    const user = userEvent.setup();

    renderWithProviders(
      <VideoDetailsModal
        listId="list-1"
        onFieldChange={mockOnFieldChange}
        onOpenChange={mockOnOpenChange}
        open={true}
        video={mockVideo}
      />
    );

    // Find close button (X icon with sr-only "Close" text)
    const closeButton = screen.getByRole("button", { name: /close/i });
    await user.click(closeButton);

    expect(mockOnOpenChange).toHaveBeenCalledWith(false);
  });

  // ============================================================================
  // Video Header Tests (2 tests)
  // ============================================================================

  it("displays video title in DialogTitle", () => {
    renderWithProviders(
      <VideoDetailsModal
        listId="list-1"
        onFieldChange={mockOnFieldChange}
        onOpenChange={mockOnOpenChange}
        open={true}
        video={mockVideo}
      />
    );

    expect(screen.getByText("Test Video Title")).toBeInTheDocument();
  });

  it("renders thumbnail with correct src and alt", () => {
    renderWithProviders(
      <VideoDetailsModal
        listId="list-1"
        onFieldChange={mockOnFieldChange}
        onOpenChange={mockOnOpenChange}
        open={true}
        video={mockVideo}
      />
    );

    const thumbnail = screen.getByRole("img", { name: /test video title/i });
    expect(thumbnail).toHaveAttribute("src", "https://example.com/thumb.jpg");
    expect(thumbnail).toHaveAttribute("alt", "Test Video Title");
  });

  // ============================================================================
  // Metadata Tests (3 tests)
  // ============================================================================

  it("displays duration with formatDuration", () => {
    renderWithProviders(
      <VideoDetailsModal
        listId="list-1"
        onFieldChange={mockOnFieldChange}
        onOpenChange={mockOnOpenChange}
        open={true}
        video={mockVideo}
      />
    );

    // 300 seconds = 5:00
    expect(screen.getByText("5:00")).toBeInTheDocument();
  });

  it("displays channel name", () => {
    renderWithProviders(
      <VideoDetailsModal
        listId="list-1"
        onFieldChange={mockOnFieldChange}
        onOpenChange={mockOnOpenChange}
        open={true}
        video={mockVideo}
      />
    );

    expect(screen.getByText("Test Channel")).toBeInTheDocument();
  });

  it("hides metadata when duration and channel are null", () => {
    const videoWithoutMetadata: VideoResponse = {
      ...mockVideo,
      duration: null,
      channel: null,
    };

    renderWithProviders(
      <VideoDetailsModal
        listId="list-1"
        onFieldChange={mockOnFieldChange}
        onOpenChange={mockOnOpenChange}
        open={true}
        video={videoWithoutMetadata}
      />
    );

    // Metadata section should exist but be empty
    expect(screen.queryByText("5:00")).not.toBeInTheDocument();
    expect(screen.queryByText("Test Channel")).not.toBeInTheDocument();
  });

  // ============================================================================
  // Tags Tests (2 tests)
  // ============================================================================

  it("renders all video tags as Badges", () => {
    renderWithProviders(
      <VideoDetailsModal
        listId="list-1"
        onFieldChange={mockOnFieldChange}
        onOpenChange={mockOnOpenChange}
        open={true}
        video={mockVideo}
      />
    );

    expect(screen.getByText("Tutorial")).toBeInTheDocument();
    expect(screen.getByText("React")).toBeInTheDocument();
  });

  it("hides tags section when video has no tags", () => {
    const videoWithoutTags: VideoResponse = {
      ...mockVideo,
      tags: [],
    };

    renderWithProviders(
      <VideoDetailsModal
        listId="list-1"
        onFieldChange={mockOnFieldChange}
        onOpenChange={mockOnOpenChange}
        open={true}
        video={videoWithoutTags}
      />
    );

    // Tags should not be rendered
    expect(screen.queryByText("Tutorial")).not.toBeInTheDocument();
    expect(screen.queryByText("React")).not.toBeInTheDocument();
  });

  // ============================================================================
  // CustomFieldsSection Integration Tests (2 tests)
  // ============================================================================

  it("passes correct props to CustomFieldsSection", () => {
    const videoWithFields: VideoResponse = {
      ...mockVideo,
      available_fields: [
        {
          field_id: "field-1",
          field_name: "Rating",
          field_type: "rating",
          schema_name: "Test Schema",
          display_order: 0,
          show_on_card: true,
          config: { max_rating: 5 },
        },
      ],
      field_values: [],
    };

    renderWithProviders(
      <VideoDetailsModal
        listId="list-1"
        onFieldChange={mockOnFieldChange}
        onOpenChange={mockOnOpenChange}
        open={true}
        video={videoWithFields}
      />
    );

    // CustomFieldsSection should be rendered (mocked)
    expect(screen.getByTestId("custom-fields-section")).toBeInTheDocument();
  });

  it("calls onFieldChange when field changes in CustomFieldsSection", async () => {
    const user = userEvent.setup();

    renderWithProviders(
      <VideoDetailsModal
        listId="list-1"
        onFieldChange={mockOnFieldChange}
        onOpenChange={mockOnOpenChange}
        open={true}
        video={mockVideo}
      />
    );

    // Click the mocked "Change Field" button
    const changeButton = screen.getByText("Change Field");
    await user.click(changeButton);

    expect(mockOnFieldChange).toHaveBeenCalledWith("field-1", 5);
  });

  // ============================================================================
  // Edge Cases (2 tests)
  // ============================================================================

  it("returns null when video is null", () => {
    const { container } = renderWithProviders(
      <VideoDetailsModal
        listId="list-1"
        onFieldChange={mockOnFieldChange}
        onOpenChange={mockOnOpenChange}
        open={true}
        video={null}
      />
    );

    expect(container.firstChild).toBeNull();
  });

  it("handles video with null thumbnail_url gracefully", () => {
    const videoWithoutThumbnail: VideoResponse = {
      ...mockVideo,
      thumbnail_url: null,
    };

    renderWithProviders(
      <VideoDetailsModal
        listId="list-1"
        onFieldChange={mockOnFieldChange}
        onOpenChange={mockOnOpenChange}
        open={true}
        video={videoWithoutThumbnail}
      />
    );

    // When thumbnail_url is null, alt still uses video.title
    const thumbnail = screen.getByRole("img", { name: /test video title/i });
    expect(thumbnail).toHaveAttribute("src", "");
  });
});
