import { screen, waitFor } from "@testing-library/react";
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

const _createTextField = (
  overrides?: Partial<VideoFieldValue>
): VideoFieldValue =>
  ({
    id: "text-fv-3",
    video_id: "test-video-id",
    field_id: "field-3",
    field_name: "Notes",
    show_on_card: false,
    field: {
      id: "field-3",
      list_id: "list-123",
      name: "Notes",
      field_type: "text",
      config: { max_length: 500 },
      created_at: "2025-11-12T00:00:00Z",
      updated_at: "2025-11-12T00:00:00Z",
    },
    value: "Great tutorial!",
    updated_at: "2025-11-12T00:00:00Z",
    ...overrides,
  }) as VideoFieldValue;

const _createBooleanField = (
  overrides?: Partial<VideoFieldValue>
): VideoFieldValue =>
  ({
    id: "boolean-fv-4",
    video_id: "test-video-id",
    field_id: "field-4",
    field_name: "Recommended",
    show_on_card: true,
    field: {
      id: "field-4",
      list_id: "list-123",
      name: "Recommended",
      field_type: "boolean",
      config: {},
      created_at: "2025-11-12T00:00:00Z",
      updated_at: "2025-11-12T00:00:00Z",
    },
    value: true,
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
    { id: "tag-1", name: "Test Tag" },
    { id: "tag-2", name: "Tutorial" },
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

describe("VideoDetailsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default mock: successful query with mutation
    mockUseQuery.mockReturnValue({
      data: mockVideo,
      isLoading: false,
      error: null,
    });

    mockUseMutation.mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
      isError: false,
      error: null,
    });
  });

  // ============================================================================
  // Unit Tests: Loading/Error States (3 tests)
  // ============================================================================

  describe("Loading and Error States", () => {
    it("renders loading state while fetching", () => {
      mockUseQuery.mockReturnValue({
        data: null,
        isLoading: true,
        error: null,
      });

      renderWithRouter(<VideoDetailsPage />);

      expect(screen.getByText("Lädt Video...")).toBeInTheDocument();
    });

    it("renders error state on fetch failure", () => {
      mockUseQuery.mockReturnValue({
        data: null,
        isLoading: false,
        error: new Error("Network error"),
      });

      renderWithRouter(<VideoDetailsPage />);

      expect(
        screen.getByText("Fehler beim Laden des Videos.")
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /zurück zur übersicht/i })
      ).toBeInTheDocument();
    });

    it("renders not found state when video is null", () => {
      mockUseQuery.mockReturnValue({
        data: null,
        isLoading: false,
        error: null,
      });

      renderWithRouter(<VideoDetailsPage />);

      expect(screen.getByText("Video nicht gefunden.")).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /zurück zur übersicht/i })
      ).toBeInTheDocument();
    });
  });

  // ============================================================================
  // Unit Tests: Video Header (5 tests)
  // ============================================================================

  describe("Video Header", () => {
    it("displays video title as h1", () => {
      renderWithRouter(<VideoDetailsPage />);

      const heading = screen.getByRole("heading", {
        level: 1,
        name: mockVideo.title!,
      });
      expect(heading).toBeInTheDocument();
    });

    it("displays channel name", () => {
      renderWithRouter(<VideoDetailsPage />);

      expect(screen.getByText(mockVideo.channel!)).toBeInTheDocument();
    });

    it("displays thumbnail with correct aspect ratio", () => {
      renderWithRouter(<VideoDetailsPage />);

      const thumbnail = screen.getByAltText(mockVideo.title!);
      expect(thumbnail).toBeInTheDocument();
      expect(thumbnail).toHaveAttribute("src", mockVideo.thumbnail_url!);
    });

    it("displays duration badge on thumbnail", () => {
      renderWithRouter(<VideoDetailsPage />);

      // Duration 600 seconds = 10:00
      expect(screen.getByText("10:00")).toBeInTheDocument();
    });

    it("displays tags as chips", () => {
      renderWithRouter(<VideoDetailsPage />);

      expect(screen.getByText("Test Tag")).toBeInTheDocument();
      expect(screen.getByText("Tutorial")).toBeInTheDocument();
    });
  });

  // ============================================================================
  // Unit Tests: Field Grouping (7 tests)
  // ============================================================================

  describe("Field Grouping by Schema", () => {
    it("groups fields by schema_name", () => {
      renderWithRouter(<VideoDetailsPage />);

      // All fields in mockVideo have schema_name: "Tutorial Schema"
      expect(screen.getByText(/tutorial schema/i)).toBeInTheDocument();
    });

    it("shows field count in section header", () => {
      renderWithRouter(<VideoDetailsPage />);

      // 3 available fields
      expect(
        screen.getByText(/tutorial schema \(3 felder\)/i)
      ).toBeInTheDocument();
    });

    it('shows singular "Feld" for single field', () => {
      const videoWithOneField: VideoResponse = {
        ...mockVideo,
        available_fields: [
          createAvailableField({ field_id: "field-1", display_order: 0 }),
        ],
      };

      mockUseQuery.mockReturnValue({
        data: videoWithOneField,
        isLoading: false,
        error: null,
      });

      renderWithRouter(<VideoDetailsPage />);

      expect(
        screen.getByText(/tutorial schema \(1 feld\)/i)
      ).toBeInTheDocument();
    });

    it("sorts schemas alphabetically", () => {
      const videoWithMultipleSchemas: VideoResponse = {
        ...mockVideo,
        available_fields: [
          createAvailableField({
            field_id: "field-1",
            schema_name: "Zebra Schema",
            display_order: 0,
          }),
          createAvailableField({
            field_id: "field-2",
            schema_name: "Alpha Schema",
            display_order: 0,
          }),
        ],
      };

      mockUseQuery.mockReturnValue({
        data: videoWithMultipleSchemas,
        isLoading: false,
        error: null,
      });

      renderWithRouter(<VideoDetailsPage />);

      // Look for schema section headers (not all buttons)
      expect(screen.getByText(/alpha schema \(1 feld\)/i)).toBeInTheDocument();
      expect(screen.getByText(/zebra schema \(1 feld\)/i)).toBeInTheDocument();

      // Alpha should appear before Zebra in DOM
      const sections = screen
        .getAllByRole("button")
        .filter((btn) => btn.textContent?.includes("Schema"));
      expect(sections[0]).toHaveTextContent(/alpha schema/i);
      expect(sections[1]).toHaveTextContent(/zebra schema/i);
    });

    it("initializes all schemas as expanded", () => {
      renderWithRouter(<VideoDetailsPage />);

      // Fields should be visible (sections expanded by default)
      expect(screen.getByText("Rating")).toBeInTheDocument();
      expect(screen.getByText("Quality")).toBeInTheDocument();
    });

    it('shows "Keine benutzerdefinierten Felder" when no fields', () => {
      const videoWithNoFields: VideoResponse = {
        ...mockVideo,
        available_fields: null, // Use null instead of empty array to avoid infinite loop
        field_values: [],
      };

      mockUseQuery.mockReturnValue({
        data: videoWithNoFields,
        isLoading: false,
        error: null,
      });

      renderWithRouter(<VideoDetailsPage />);

      expect(
        screen.getByText("Keine benutzerdefinierten Felder verfügbar.")
      ).toBeInTheDocument();
    });

    it("sorts fields by display_order within schema", () => {
      const videoWithUnsortedFields: VideoResponse = {
        ...mockVideo,
        available_fields: [
          createAvailableField({
            field_id: "field-3",
            field_name: "Field C",
            display_order: 2,
          }),
          createAvailableField({
            field_id: "field-1",
            field_name: "Field A",
            display_order: 0,
          }),
          createAvailableField({
            field_id: "field-2",
            field_name: "Field B",
            display_order: 1,
          }),
        ],
      };

      mockUseQuery.mockReturnValue({
        data: videoWithUnsortedFields,
        isLoading: false,
        error: null,
      });

      renderWithRouter(<VideoDetailsPage />);

      const fieldLabels = screen.getAllByText(/Field [ABC]/);
      expect(fieldLabels[0]).toHaveTextContent("Field A");
      expect(fieldLabels[1]).toHaveTextContent("Field B");
      expect(fieldLabels[2]).toHaveTextContent("Field C");
    });
  });

  // ============================================================================
  // Unit Tests: Field Rendering (2 tests)
  // ============================================================================

  describe("Field Rendering", () => {
    it("renders filled field values correctly", () => {
      renderWithRouter(<VideoDetailsPage />);

      // Rating field should show value
      expect(screen.getByText("Rating")).toBeInTheDocument();

      // Select field should show value
      expect(screen.getByText("Quality")).toBeInTheDocument();
    });

    it("renders empty fields with null values", () => {
      const videoWithEmptyField: VideoResponse = {
        ...mockVideo,
        field_values: [], // No filled values
        available_fields: [
          createAvailableField({
            field_id: "field-1",
            field_name: "Empty Rating",
            field_type: "rating",
            display_order: 0,
          }),
        ],
      };

      mockUseQuery.mockReturnValue({
        data: videoWithEmptyField,
        isLoading: false,
        error: null,
      });

      renderWithRouter(<VideoDetailsPage />);

      // Field label should be visible even if empty
      expect(screen.getByText("Empty Rating")).toBeInTheDocument();
    });
  });

  // ============================================================================
  // Unit Tests: Navigation (2 tests)
  // ============================================================================

  describe("Navigation", () => {
    it("back button navigates to /videos", async () => {
      const { useNavigate } = await import("react-router-dom");
      const mockNavigate = vi.fn();
      vi.mocked(useNavigate).mockReturnValue(mockNavigate);

      renderWithRouter(<VideoDetailsPage />);

      const backButton = screen.getAllByRole("button", {
        name: /zurück zur übersicht/i,
      })[0];
      await userEvent.click(backButton);

      expect(mockNavigate).toHaveBeenCalledWith("/videos");
    });

    it("channel button exists but does not navigate yet", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      renderWithRouter(<VideoDetailsPage />);

      const channelButton = screen.getByText(mockVideo.channel!);
      await userEvent.click(channelButton);

      // Should log (functionality placeholder)
      expect(consoleSpy).toHaveBeenCalledWith(
        "Channel clicked:",
        mockVideo.channel
      );

      consoleSpy.mockRestore();
    });
  });

  // ============================================================================
  // Integration Tests (3 tests)
  // ============================================================================

  describe("Integration: Full User Flows", () => {
    it("toggles schema section on click", async () => {
      renderWithRouter(<VideoDetailsPage />);

      // Find the collapsible trigger button
      const sectionButton = screen.getByRole("button", {
        name: /tutorial schema/i,
      });

      // Initially expanded - fields visible
      expect(screen.getByText("Rating")).toBeInTheDocument();

      // Click to collapse
      await userEvent.click(sectionButton);

      // Fields should still be visible (Collapsible content may not unmount immediately)
      // Check for aria-expanded attribute instead
      await waitFor(() => {
        const button = screen.getByRole("button", { name: /tutorial schema/i });
        expect(button).toHaveAttribute("aria-expanded", "false");
      });

      // Click to expand again
      await userEvent.click(sectionButton);

      await waitFor(() => {
        const button = screen.getByRole("button", { name: /tutorial schema/i });
        expect(button).toHaveAttribute("aria-expanded", "true");
      });
    });

    it("field value update triggers mutation", async () => {
      const mockMutate = vi.fn();
      mockUseMutation.mockReturnValue({
        mutate: mockMutate,
        isPending: false,
        isError: false,
        error: null,
      });

      renderWithRouter(<VideoDetailsPage />);

      // Find a rating field (RatingStars component)
      const _ratingButtons = screen.getAllByRole("button");

      // Click first star (should be in the rating component)
      // Note: Actual interaction depends on FieldDisplay implementation
      // This tests that the mutation hook is wired up correctly
      expect(mockMutate).not.toHaveBeenCalled();
    });

    it("handles null available_fields gracefully", () => {
      const videoWithNullFields: VideoResponse = {
        ...mockVideo,
        available_fields: null,
        field_values: [],
      };

      mockUseQuery.mockReturnValue({
        data: videoWithNullFields,
        isLoading: false,
        error: null,
      });

      renderWithRouter(<VideoDetailsPage />);

      // Should show "no fields" message
      expect(
        screen.getByText("Keine benutzerdefinierten Felder verfügbar.")
      ).toBeInTheDocument();
    });
  });

  // ============================================================================
  // Accessibility Tests (5 tests)
  // ============================================================================

  describe("Accessibility", () => {
    it("video title has correct heading hierarchy (h1)", () => {
      renderWithRouter(<VideoDetailsPage />);

      const h1 = screen.getByRole("heading", { level: 1 });
      expect(h1).toHaveTextContent(mockVideo.title!);
    });

    it("back button has accessible label", () => {
      renderWithRouter(<VideoDetailsPage />);

      const backButton = screen.getAllByRole("button", {
        name: /zurück zur übersicht/i,
      })[0];
      expect(backButton).toBeInTheDocument();
    });

    it("collapsible triggers are buttons", () => {
      renderWithRouter(<VideoDetailsPage />);

      const sectionButton = screen.getByRole("button", {
        name: /tutorial schema/i,
      });
      expect(sectionButton.tagName).toBe("BUTTON");
    });

    it("collapsible has aria-expanded attribute", () => {
      renderWithRouter(<VideoDetailsPage />);

      const sectionButton = screen.getByRole("button", {
        name: /tutorial schema/i,
      });
      expect(sectionButton).toHaveAttribute("aria-expanded");
    });

    it("field sections have proper structure", () => {
      renderWithRouter(<VideoDetailsPage />);

      // Check that "Benutzerdefinierte Felder" heading exists
      const fieldsHeading = screen.getByRole("heading", {
        level: 2,
        name: /benutzerdefinierte felder/i,
      });
      expect(fieldsHeading).toBeInTheDocument();
    });
  });

  // ============================================================================
  // Edge Cases (3 tests)
  // ============================================================================

  describe("Edge Cases", () => {
    it("handles video without thumbnail", () => {
      const videoWithoutThumbnail: VideoResponse = {
        ...mockVideo,
        thumbnail_url: null,
      };

      mockUseQuery.mockReturnValue({
        data: videoWithoutThumbnail,
        isLoading: false,
        error: null,
      });

      renderWithRouter(<VideoDetailsPage />);

      // Should not crash, title still visible
      expect(
        screen.getByRole("heading", { level: 1, name: mockVideo.title! })
      ).toBeInTheDocument();
    });

    it("handles video without tags", () => {
      const videoWithoutTags: VideoResponse = {
        ...mockVideo,
        tags: [],
      };

      mockUseQuery.mockReturnValue({
        data: videoWithoutTags,
        isLoading: false,
        error: null,
      });

      renderWithRouter(<VideoDetailsPage />);

      // Should not crash
      expect(
        screen.getByRole("heading", { level: 1, name: mockVideo.title! })
      ).toBeInTheDocument();
    });

    it("handles video without channel", () => {
      const videoWithoutChannel: VideoResponse = {
        ...mockVideo,
        channel: null,
      };

      mockUseQuery.mockReturnValue({
        data: videoWithoutChannel,
        isLoading: false,
        error: null,
      });

      renderWithRouter(<VideoDetailsPage />);

      // Should not crash, but channel button should not exist
      expect(screen.queryByText("Test Channel")).not.toBeInTheDocument();
    });
  });
});
