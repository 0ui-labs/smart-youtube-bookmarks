/**
 * Integration Tests for VideosPage Grid View (Task #32)
 *
 * Tests verify the complete Grid View implementation including:
 * - Default table view rendering
 * - Grid view rendering when enabled
 * - View mode toggle functionality
 * - Thumbnail size independence in grid view
 * - ViewMode persistence across page reloads
 *
 * Follows TDD pattern:
 * - RED: Tests written first (would fail without implementation)
 * - GREEN: Implementation exists from Task #5
 * - REFACTOR: Tests verify implementation correctness
 */

import { screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useTableSettingsStore } from "@/stores/tableSettingsStore";
import { renderWithRouter } from "@/test/renderWithRouter";
import type { VideoResponse } from "@/types/video";
import { VideosPage } from "./VideosPage";

// Helper function to create mock videos
const createMockVideo = (id: string): VideoResponse => ({
  id,
  list_id: "test-list-123",
  youtube_id: `yt-${id}`,
  title: `Test Video ${id}`,
  channel: `Test Channel ${id}`,
  duration: 210,
  thumbnail_url: `https://i.ytimg.com/vi/yt-${id}/default.jpg`,
  processing_status: "completed",
  error_message: null,
  created_at: "2024-01-01T00:00:00Z",
  updated_at: "2024-01-01T00:00:00Z",
  published_at: "2024-01-01T00:00:00Z",
});

// Mock data for tests
const mockVideos: VideoResponse[] = [
  createMockVideo("1"),
  createMockVideo("2"),
];

// Mock hooks
vi.mock("@/hooks/useVideos", () => ({
  useVideos: vi.fn(() => ({
    data: mockVideos,
    isLoading: false,
    error: null,
  })),
  useCreateVideo: vi.fn(() => ({
    mutate: vi.fn(),
    mutateAsync: vi.fn(),
    isPending: false,
  })),
  useDeleteVideo: vi.fn(() => ({
    mutate: vi.fn(),
    mutateAsync: vi.fn(),
    isPending: false,
  })),
  useBulkUploadVideos: vi.fn(() => ({
    mutate: vi.fn(),
    mutateAsync: vi.fn(),
    isPending: false,
  })),
  exportVideosCSV: vi.fn(),
  useAssignTags: vi.fn(() => ({
    mutate: vi.fn(),
    mutateAsync: vi.fn(),
    isPending: false,
  })),
  useUpdateVideoFieldValues: vi.fn(() => ({
    mutate: vi.fn(),
    mutateAsync: vi.fn(),
    isPending: false,
  })),
  parseValidationError: vi.fn((_err) => "Validation error"),
  videoKeys: {
    all: ["videos"],
    lists: () => ["videos", "list"],
    list: (listId: string) => ["videos", "list", listId],
    filtered: (listId: string, tagNames: string[]) => [
      "videos",
      "list",
      listId,
      { tags: tagNames.sort() },
    ],
    withOptions: (listId: string, options: any) => [
      "videos",
      "list",
      listId,
      options,
    ],
    fieldValues: () => ["videos", "field-values"],
    videoFieldValues: (videoId: string) => ["videos", "field-values", videoId],
  },
}));

vi.mock("@/hooks/useTags", () => ({
  useTags: vi.fn(() => ({
    data: [],
    isLoading: false,
    error: null,
  })),
  useCreateTag: vi.fn(() => ({
    mutate: vi.fn(),
    mutateAsync: vi.fn(),
    isPending: false,
  })),
  useBulkApplySchema: vi.fn(() => ({
    mutate: vi.fn(),
    mutateAsync: vi.fn(),
    isPending: false,
  })),
  tagsOptions: vi.fn(() => ({
    queryKey: ["tags"],
    queryFn: vi.fn(),
  })),
}));

vi.mock("@/stores/tagStore", () => ({
  useTagStore: vi.fn((selector) => {
    const state = {
      selectedTagIds: [],
      toggleTag: vi.fn(),
      clearTags: vi.fn(),
      setSelectedTagIds: vi.fn(),
    };
    return selector ? selector(state) : state;
  }),
}));

vi.mock("@/hooks/useWebSocket", () => ({
  useWebSocket: vi.fn(() => ({
    jobProgress: new Map(),
    reconnecting: false,
    historyError: null,
  })),
}));

describe("VideosPage - Grid View Integration (Task #32)", () => {
  const mockListId = "test-list-123";

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Reset store state to defaults before each test
    useTableSettingsStore.setState({
      viewMode: "list",
      thumbnailSize: "small",
      visibleColumns: {
        thumbnail: true,
        title: true,
        duration: true,
        actions: true,
      },
    });

    // Clear localStorage to prevent test pollution
    localStorage.clear();
  });

  describe("Test 1: Shows table view by default (viewMode: list)", () => {
    it("renders table structure and does NOT render grid", async () => {
      // Arrange: Store is already in 'list' mode from beforeEach
      const { container } = renderWithRouter(
        <VideosPage listId={mockListId} />
      );

      // Act: Component renders

      // Assert: Table renders
      await waitFor(() => {
        const table = screen.queryByRole("table");
        expect(table).toBeInTheDocument();
      });

      // Assert: Grid does NOT render
      const grid = screen.queryByRole("list", { name: "Video Grid" });
      expect(grid).not.toBeInTheDocument();

      // Additional verification: Check table structure exists
      const tableHeaders = screen.queryAllByRole("columnheader");
      expect(tableHeaders.length).toBeGreaterThan(0);
    });
  });

  describe("Test 2: Shows grid view when viewMode is grid", () => {
    it("renders grid and does NOT render table when viewMode is grid", async () => {
      // Arrange: Set viewMode to 'grid' before rendering
      useTableSettingsStore.setState({ viewMode: "grid" });

      const { container } = renderWithRouter(
        <VideosPage listId={mockListId} />
      );

      // Act: Component renders

      // Assert: Grid renders
      await waitFor(() => {
        const grid = screen.queryByRole("list", { name: "Video Grid" });
        expect(grid).toBeInTheDocument();
      });

      // Assert: Table does NOT render
      const table = screen.queryByRole("table");
      expect(table).not.toBeInTheDocument();

      // Additional verification: Check grid has correct CSS class
      const gridElement = container.querySelector(".video-grid");
      expect(gridElement).toBeInTheDocument();
      expect(gridElement).toHaveClass("grid");
    });
  });

  describe("Test 3: Switches from table to grid when clicking toggle button", () => {
    it("switches view mode when clicking ViewModeToggle button", async () => {
      // Arrange: Start in list mode
      const user = userEvent.setup();
      renderWithRouter(<VideosPage listId={mockListId} />);

      // Verify starting state: table visible
      await waitFor(() => {
        expect(screen.queryByRole("table")).toBeInTheDocument();
      });

      // Act: Click toggle button
      const toggleButton = screen.getByRole("button", {
        name: /Grid-Ansicht anzeigen/i,
      });
      expect(toggleButton).toBeInTheDocument();
      await user.click(toggleButton);

      // Assert: Grid appears, table disappears
      await waitFor(() => {
        const grid = screen.queryByRole("list", { name: "Video Grid" });
        expect(grid).toBeInTheDocument();
      });

      const table = screen.queryByRole("table");
      expect(table).not.toBeInTheDocument();

      // Verify store state changed
      const currentViewMode = useTableSettingsStore.getState().viewMode;
      expect(currentViewMode).toBe("grid");
    });
  });

  describe("Test 4: Works with small thumbnails in grid view (REF MCP #1)", () => {
    it("renders grid with small thumbnails and verifies independence", async () => {
      // Arrange: Set viewMode='grid' and thumbnailSize='small'
      useTableSettingsStore.setState({
        viewMode: "grid",
        thumbnailSize: "small",
      });

      const { container } = renderWithRouter(
        <VideosPage listId={mockListId} />
      );

      // Act: Component renders

      // Assert: Grid renders
      await waitFor(() => {
        const grid = screen.queryByRole("list", { name: "Video Grid" });
        expect(grid).toBeInTheDocument();
      });

      // Assert: Small thumbnails are used (w-32 class)
      // VideoCard uses VideoThumbnail which applies sizeClasses based on thumbnailSize
      const thumbnails = container.querySelectorAll("img");
      expect(thumbnails.length).toBeGreaterThan(0);

      // Verify thumbnails have small size class (w-32)
      thumbnails.forEach((img) => {
        expect(img).toHaveClass("w-32");
      });

      // Verify independence: thumbnailSize setting works in grid view
      const currentState = useTableSettingsStore.getState();
      expect(currentState.viewMode).toBe("grid");
      expect(currentState.thumbnailSize).toBe("small");
    });
  });

  describe("Test 5: Persists viewMode across page reloads", () => {
    it("maintains grid view after simulated page reload", async () => {
      // Arrange: Set viewMode to 'grid' and render
      useTableSettingsStore.setState({ viewMode: "grid" });

      const { unmount } = renderWithRouter(<VideosPage listId={mockListId} />);

      // Verify grid is active
      await waitFor(() => {
        expect(
          screen.queryByRole("list", { name: "Video Grid" })
        ).toBeInTheDocument();
      });

      // Act: Simulate page reload by unmounting and re-mounting
      unmount();

      // Zustand persist middleware saves to localStorage
      // Re-render should restore state from localStorage
      renderWithRouter(<VideosPage listId={mockListId} />);

      // Assert: Grid view persists after "reload"
      await waitFor(() => {
        const grid = screen.queryByRole("list", { name: "Video Grid" });
        expect(grid).toBeInTheDocument();
      });

      const table = screen.queryByRole("table");
      expect(table).not.toBeInTheDocument();

      // Verify store state persisted
      const currentViewMode = useTableSettingsStore.getState().viewMode;
      expect(currentViewMode).toBe("grid");

      // Verify localStorage has the persisted value
      const storedSettings = localStorage.getItem("video-table-settings");
      expect(storedSettings).toBeTruthy();
      const parsed = JSON.parse(storedSettings!);
      expect(parsed.state.viewMode).toBe("grid");
    });

    it("restores default list view on fresh mount (no localStorage)", async () => {
      // Arrange: Clear localStorage to simulate first visit
      localStorage.clear();

      // Reset store to defaults
      useTableSettingsStore.setState({ viewMode: "list" });

      // Act: Render component
      renderWithRouter(<VideosPage listId={mockListId} />);

      // Assert: Table view is active (default)
      await waitFor(() => {
        expect(screen.queryByRole("table")).toBeInTheDocument();
      });

      const grid = screen.queryByRole("list", { name: "Video Grid" });
      expect(grid).not.toBeInTheDocument();

      // Verify default state
      const currentViewMode = useTableSettingsStore.getState().viewMode;
      expect(currentViewMode).toBe("list");
    });
  });

  describe("Edge Cases: Grid view with empty state", () => {
    it("shows empty state message in grid view when no videos", async () => {
      // Arrange: Mock empty videos array
      const { useVideos } = await import("@/hooks/useVideos");
      vi.mocked(useVideos).mockReturnValue({
        data: [],
        isLoading: false,
        error: null,
      } as any);

      // Set viewMode to grid
      useTableSettingsStore.setState({ viewMode: "grid" });

      // Act: Render component
      renderWithRouter(<VideosPage listId={mockListId} />);

      // Assert: Empty state message appears
      await waitFor(() => {
        expect(
          screen.getByText(/Noch keine Videos in dieser Liste/i)
        ).toBeInTheDocument();
      });

      // Grid should NOT render when empty
      const grid = screen.queryByRole("list", { name: "Video Grid" });
      expect(grid).not.toBeInTheDocument();
    });
  });

  describe("REF MCP Verification: Independence of viewMode and thumbnailSize", () => {
    beforeEach(async () => {
      // Restore default mock with videos before each test in this suite
      const { useVideos } = await import("@/hooks/useVideos");
      vi.mocked(useVideos).mockReturnValue({
        data: mockVideos,
        isLoading: false,
        error: null,
      } as any);
    });

    it("allows grid view with large thumbnails", async () => {
      // Arrange: Set grid view with large thumbnails
      useTableSettingsStore.setState({
        viewMode: "grid",
        thumbnailSize: "large",
      });

      const { container } = renderWithRouter(
        <VideosPage listId={mockListId} />
      );

      // Act: Component renders

      // Assert: Grid renders with large thumbnails
      await waitFor(() => {
        const grid = screen.queryByRole("list", { name: "Video Grid" });
        expect(grid).toBeInTheDocument();
      });

      // Verify large thumbnails (w-48 class)
      const thumbnails = container.querySelectorAll("img");
      expect(thumbnails.length).toBeGreaterThan(0);
      thumbnails.forEach((img) => {
        expect(img).toHaveClass("w-48");
      });
    });

    it("allows list view with xlarge thumbnails", async () => {
      // Arrange: Set list view with xlarge thumbnails
      useTableSettingsStore.setState({
        viewMode: "list",
        thumbnailSize: "xlarge",
      });

      const { container } = renderWithRouter(
        <VideosPage listId={mockListId} />
      );

      // Act: Component renders

      // Assert: Table renders with xlarge thumbnails
      await waitFor(() => {
        expect(screen.queryByRole("table")).toBeInTheDocument();
      });

      // Verify xlarge thumbnails (w-[500px] class)
      const thumbnails = container.querySelectorAll("img");
      expect(thumbnails.length).toBeGreaterThan(0);
      thumbnails.forEach((img) => {
        expect(img).toHaveClass("w-[500px]");
      });
    });
  });

  describe("GridColumnControl integration with VideoGrid (Task #35)", () => {
    // REF IMPROVEMENT #4: Use real store with cleanup (not mocks)
    beforeEach(async () => {
      // Reset localStorage to ensure clean state
      localStorage.clear();

      // Reset Zustand store to default state
      useTableSettingsStore.setState({
        viewMode: "list",
        gridColumns: 3,
        thumbnailSize: "medium",
        visibleColumns: {
          thumbnail: true,
          title: true,
          duration: true,
          actions: true,
        },
      });

      // Restore default mock with videos
      const { useVideos } = await import("@/hooks/useVideos");
      vi.mocked(useVideos).mockReturnValue({
        data: mockVideos,
        isLoading: false,
        error: null,
      } as any);
    });

    it("updates VideoGrid classes when column count changes", async () => {
      const user = userEvent.setup();
      renderWithRouter(<VideosPage listId={mockListId} />);

      // Switch to grid view
      const gridButton = screen.getByRole("button", {
        name: /Grid-Ansicht anzeigen/i,
      });
      await user.click(gridButton);

      // Verify default 3 columns
      let grid = document.querySelector(".video-grid");
      expect(grid).toHaveClass("lg:grid-cols-3");

      // Open TableSettingsDropdown
      const settingsButton = screen.getByRole("button", {
        name: /einstellungen/i,
      });
      await user.click(settingsButton);

      // Change to 5 columns
      const button5 = screen.getByRole("menuitemradio", { name: /5 spalten/i });
      await user.click(button5);

      // Verify grid classes updated (REF IMPROVEMENT #2: md:grid-cols-2 for 5 cols)
      grid = document.querySelector(".video-grid");
      expect(grid).toHaveClass("lg:grid-cols-5");
      expect(grid).toHaveClass("md:grid-cols-2"); // Tablet: 2 cols (not 3)
      expect(grid).not.toHaveClass("lg:grid-cols-3");
    });

    it("preserves gridColumns when switching between list and grid views", async () => {
      const user = userEvent.setup();
      renderWithRouter(<VideosPage listId={mockListId} />);

      // Switch to grid view
      const gridButton = screen.getByRole("button", {
        name: /Grid-Ansicht anzeigen/i,
      });
      await user.click(gridButton);

      // Open settings and change to 4 columns
      const settingsButton = screen.getByRole("button", {
        name: /einstellungen/i,
      });
      await user.click(settingsButton);

      const button4 = screen.getByRole("menuitemradio", { name: /4 spalten/i });
      await user.click(button4);

      // Close dropdown
      await user.keyboard("{Escape}");

      // Switch to list view (button shows "Listen-Ansicht anzeigen" when in grid)
      const listButton = screen.getByRole("button", {
        name: /Listen-Ansicht anzeigen/i,
      });
      await user.click(listButton);

      // Switch back to grid view (need to find the button again with new label)
      const gridButtonAgain = screen.getByRole("button", {
        name: /Grid-Ansicht anzeigen/i,
      });
      await user.click(gridButtonAgain);

      // Should still be 4 columns (setting preserved via localStorage)
      const grid = document.querySelector(".video-grid");
      expect(grid).toHaveClass("lg:grid-cols-4");

      // Verify in store
      const state = useTableSettingsStore.getState();
      expect(state.gridColumns).toBe(4);
    });

    it("persists gridColumns setting across page reloads", async () => {
      const user = userEvent.setup();

      // Set up initial state
      const { unmount } = renderWithRouter(<VideosPage listId={mockListId} />);

      // Switch to grid and set 5 columns
      const gridButton = screen.getByRole("button", {
        name: /Grid-Ansicht anzeigen/i,
      });
      await user.click(gridButton);

      const settingsButton = screen.getByRole("button", {
        name: /einstellungen/i,
      });
      await user.click(settingsButton);

      const button5 = screen.getByRole("menuitemradio", { name: /5 spalten/i });
      await user.click(button5);

      // Unmount component (simulates page navigation)
      unmount();

      // Re-render component (simulates page reload)
      renderWithRouter(<VideosPage listId={mockListId} />);

      // Verify setting persisted (localStorage + Zustand persist middleware)
      const state = useTableSettingsStore.getState();
      expect(state.gridColumns).toBe(5);
      expect(state.viewMode).toBe("grid"); // viewMode also persisted

      // Grid view should already be active (persisted via localStorage)
      // No need to click toggle - just verify the grid classes
      const grid = document.querySelector(".video-grid");
      expect(grid).toHaveClass("lg:grid-cols-5");
    });
  });

  describe("Grid view delete flow", () => {
    it("deletes video from grid view via three-dot menu", async () => {
      const user = userEvent.setup();
      const testVideos = [createMockVideo("1"), createMockVideo("2")];

      // Mock useVideos to return test videos
      const { useVideos } = await import("@/hooks/useVideos");
      vi.mocked(useVideos).mockReturnValue({
        data: testVideos,
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      } as any);

      // Mock delete mutation
      const mockMutate = vi.fn();
      const { useDeleteVideo } = await import("@/hooks/useVideos");
      vi.mocked(useDeleteVideo).mockReturnValue({
        mutate: mockMutate,
        isPending: false,
      } as any);

      renderWithRouter(<VideosPage listId="test-list" />);

      // Switch to grid view
      const gridButton = screen.getByRole("button", {
        name: /Grid-Ansicht anzeigen/i,
      });
      await user.click(gridButton);

      // Wait for grid to render
      await waitFor(() => {
        expect(
          screen.getByRole("list", { name: "Video Grid" })
        ).toBeInTheDocument();
      });

      // Open three-dot menu on first video
      const menuButtons = screen.getAllByLabelText("Aktionen");
      await user.click(menuButtons[0]);

      // Click delete
      const deleteButton = screen.getByText("Löschen");
      await user.click(deleteButton);

      // Verify modal opened
      expect(
        screen.getByText(/Möchten Sie das Video.*wirklich löschen/i)
      ).toBeInTheDocument();

      // Confirm delete
      const confirmButton = screen.getByRole("button", { name: /^löschen$/i });
      await user.click(confirmButton);

      // Verify delete was called
      expect(mockMutate).toHaveBeenCalledWith("1", expect.anything());
    });
  });
});
