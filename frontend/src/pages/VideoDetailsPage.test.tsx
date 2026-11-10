import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithRouter } from "@/test/renderWithRouter";
import type {
  AvailableFieldResponse,
  VideoFieldValue,
  VideoResponse,
} from "@/types/video";
import { VideoDetailsPage } from "./VideoDetailsPage";

// Mock react-router-dom
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useParams: vi.fn(() => ({ videoId: "test-video-id" })),
    useNavigate: vi.fn(() => vi.fn()),
  };
});

// Mock useTags hooks (for CategorySelector)
// Categories include Tutorial (from mockVideo.tags) so CategorySelector can display it
vi.mock("@/hooks/useTags", () => ({
  useTags: vi.fn(() => ({
    data: [
      {
        id: "cat-1",
        name: "Tutorial",
        color: "#3B82F6",
        is_video_type: true,
        schema_id: null,
        user_id: "user-1",
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-01T00:00:00Z",
      },
    ],
    isLoading: false,
    error: null,
  })),
  useCategories: vi.fn(() => ({
    data: [
      {
        id: "cat-1",
        name: "Tutorial",
        color: "#3B82F6",
        is_video_type: true,
        schema_id: null,
        user_id: "user-1",
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-01T00:00:00Z",
      },
    ],
    isLoading: false,
    error: null,
  })),
  useLabels: vi.fn(() => ({
    data: [],
    isLoading: false,
    error: null,
  })),
}));

vi.mock("@/hooks/useVideoEnrichment", () => ({
  useVideoEnrichment: () => ({ data: null, isLoading: false, error: null }),
  useRetryEnrichment: () => ({ mutate: vi.fn(), isPending: false }),
}));

// Mock useSetVideoCategory hook (for CategorySelector)
vi.mock("@/hooks/useVideos", () => ({
  useSetVideoCategory: vi.fn(() => ({
    mutateAsync: vi.fn(),
    isPending: false,
    isError: false,
    error: null,
  })),
}));

// Mock @tanstack/react-query
const mockUseQuery = vi.fn();
const mockUseMutation = vi.fn();
const mockInvalidateQueries = vi.fn();

vi.mock("@tanstack/react-query", async () => {
  const actual = await vi.importActual("@tanstack/react-query");
  return {
    ...actual,
    useQuery: (options: any) => mockUseQuery(options),
    useMutation: (options: any) => mockUseMutation(options),
    useQueryClient: () => ({
      invalidateQueries: mockInvalidateQueries,
    }),
  };
});

// ============================================================================
// Test Data Factory
// ============================================================================

const createRatingField = (
  overrides?: Partial<VideoFieldValue>
): VideoFieldValue =>
  ({
    id: "rating-fv-1",
    video_id: "test-video-id",
    field_id: "field-1",
    field_name: "Rating",
    show_on_card: true,
    field: {
      id: "field-1",
      list_id: "list-123",
      name: "Rating",
      field_type: "rating",
      config: { max_rating: 5 },
      created_at: "2025-11-12T00:00:00Z",
      updated_at: "2025-11-12T00:00:00Z",
    },
    value: 4,
    updated_at: "2025-11-12T00:00:00Z",
    ...overrides,
  }) as VideoFieldValue;

const createSelectField = (
  overrides?: Partial<VideoFieldValue>
): VideoFieldValue =>
  ({
    id: "select-fv-2",
    video_id: "test-video-id",
    field_id: "field-2",
    field_name: "Quality",
    show_on_card: true,
    field: {
      id: "field-2",
      list_id: "list-123",
      name: "Quality",
      field_type: "select",
      config: { options: ["Low", "Medium", "High"] },
      created_at: "2025-11-12T00:00:00Z",
      updated_at: "2025-11-12T00:00:00Z",
    },
    value: "High",
    updated_at: "2025-11-12T00:00:00Z",
    ...overrides,
  }) as VideoFieldValue;

const createAvailableField = (
  overrides?: Partial<AvailableFieldResponse>
): AvailableFieldResponse => ({
  field_id: "field-1",
  field_name: "Rating",
  field_type: "rating",
  schema_name: "Tutorial Schema",
  display_order: 0,
  show_on_card: true,
  config: { max_rating: 5 },
  ...overrides,
});

const mockVideo: VideoResponse = {
  id: "test-video-id",
  list_id: "list-123",
  youtube_id: "dQw4w9WgXcQ",
  title: "Test Video Title",
  channel: "Test Channel",
  duration: 600,
  thumbnail_url: "https://example.com/thumb.jpg",
  published_at: "2024-01-01T00:00:00Z",
  tags: [
    {
      id: "cat-1",
      name: "Tutorial",
      color: "#3B82F6",
      is_video_type: true,
      schema_id: null,
      user_id: "user-1",
      created_at: "2024-01-01T00:00:00Z",
      updated_at: "2024-01-01T00:00:00Z",
    },
    {
      id: "label-1",
      name: "Python",
      color: "#10B981",
      is_video_type: false,
      schema_id: null,
      user_id: "user-1",
      created_at: "2024-01-01T00:00:00Z",
      updated_at: "2024-01-01T00:00:00Z",
    },
  ],
  processing_status: "completed",
  created_at: "2024-01-01T00:00:00Z",
  updated_at: "2024-01-01T00:00:00Z",
  field_values: [createRatingField(), createSelectField()],
  available_fields: [
    createAvailableField({
      field_id: "field-1",
      field_name: "Rating",
      field_type: "rating",
      display_order: 0,
    }),
    createAvailableField({
      field_id: "field-2",
      field_name: "Quality",
      field_type: "select",
      display_order: 1,
      config: { options: ["Low", "Medium", "High"] },
    }),
    createAvailableField({
      field_id: "field-3",
      field_name: "Notes",
      field_type: "text",
      display_order: 2,
      config: { max_length: 500 },
      show_on_card: false,
    }),
  ],
};

// ============================================================================
// Tests
// ============================================================================

vi.mock("@/components/VideoPlayer", () => ({
  VideoPlayer: (props: Record<string, unknown>) => (
    <div data-props={JSON.stringify(props)} data-testid="video-player" />
  ),
}));

describe("VideoDetailsPage", () => {
  const mutate = vi.fn();
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseQuery.mockReturnValue({
      data: mockVideo,
      isLoading: false,
      error: null,
    });
    mockUseMutation.mockReturnValue({ mutate, isPending: false });
  });
  const show = () => renderWithRouter(<VideoDetailsPage />);
  const showFields = async () => {
    show();
    await userEvent.click(
      screen.getByRole("button", { name: "Mehr Informationen" })
    );
    return screen.getByRole("dialog", { name: "Video Informationen" });
  };
  it.each([
    [{ data: null, isLoading: true }, "Lädt Video..."],
    [
      { data: null, error: new Error("offline") },
      "Fehler beim Laden des Videos.",
    ],
    [{ data: null, isLoading: false }, "Video nicht gefunden."],
  ])("renders query state %j", (state, message) => {
    mockUseQuery.mockReturnValue(state);
    show();
    expect(screen.getByText(message)).toBeVisible();
  });
  it("renders the title, channel, category and labels", () => {
    show();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      mockVideo.title!
    );
    for (const text of ["Test Channel", "Tutorial", "Python"])
      expect(screen.getByText(text)).toBeVisible();
  });
  it("passes playback identity and thumbnail to the player", () => {
    show();
    expect(
      JSON.parse(screen.getByTestId("video-player").dataset.props!)
    ).toMatchObject({
      videoId: mockVideo.id,
      youtubeId: mockVideo.youtube_id,
      thumbnailUrl: mockVideo.thumbnail_url,
    });
  });
  it("keeps fields in the information dialog until requested", async () => {
    show();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.queryByText("Rating")).not.toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", { name: "Mehr Informationen" })
    );
    expect(
      screen.getByRole("dialog", { name: "Video Informationen" })
    ).toBeVisible();
    for (const name of ["Rating", "Quality", "Notes"])
      expect(screen.getByText(name)).toBeVisible();
  });
  it("closes and reopens the information dialog", async () => {
    await showFields();
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", { name: "Mehr Informationen" })
    );
    expect(screen.getByText("Rating")).toBeVisible();
  });
  it("shows existing and empty values in display order", async () => {
    await showFields();
    expect(screen.getByText("High")).toBeVisible();
    expect(screen.getByRole("textbox")).toHaveTextContent("");
    const labels = ["Rating", "Quality", "Notes"].map((name) =>
      screen.getByText(name)
    );
    expect(
      labels[0]!.compareDocumentPosition(labels[1]!) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
    expect(
      labels[1]!.compareDocumentPosition(labels[2]!) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  });
  it("sends a rating change with its field identity", async () => {
    await showFields();
    await userEvent.click(screen.getAllByRole("radio")[0]!);
    expect(mutate).toHaveBeenCalledWith({ fieldId: "field-1", value: 1 });
  });
  it("sends the selected value with its field identity", async () => {
    await showFields();
    await userEvent.click(screen.getByText("High"));
    await userEvent.click(screen.getByRole("menuitemradio", { name: "Low" }));
    expect(mutate).toHaveBeenCalledWith({ fieldId: "field-2", value: "Low" });
  });
  it("invalidates detail data after a successful save", () => {
    show();
    mockUseMutation.mock.calls[0][0].onSuccess();
    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ["videos"],
    });
  });
  it("returns to the video overview", async () => {
    const { useNavigate } = await import("react-router-dom");
    const navigate = vi.fn();
    vi.mocked(useNavigate).mockReturnValue(navigate);
    show();
    await userEvent.click(
      screen.getByRole("button", { name: /Zurück zur Übersicht/i })
    );
    expect(navigate).toHaveBeenCalledWith("/videos");
  });
  it.each([
    null,
    [],
  ])("hides the field action for unavailable fields %j", (fields) => {
    mockUseQuery.mockReturnValue({
      data: { ...mockVideo, available_fields: fields },
      isLoading: false,
    });
    show();
    expect(
      screen.queryByRole("button", { name: "Mehr Informationen" })
    ).not.toBeInTheDocument();
  });
  it.each(["thumbnail_url", "channel", "title"])("handles absent %s", (key) => {
    mockUseQuery.mockReturnValue({
      data: { ...mockVideo, [key]: null },
      isLoading: false,
    });
    show();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      key === "title" ? "Untitled Video" : mockVideo.title!
    );
  });
  it("handles a video without tags", () => {
    mockUseQuery.mockReturnValue({
      data: { ...mockVideo, tags: [] },
      isLoading: false,
    });
    show();
    expect(screen.queryByText("Python")).not.toBeInTheDocument();
  });
});
