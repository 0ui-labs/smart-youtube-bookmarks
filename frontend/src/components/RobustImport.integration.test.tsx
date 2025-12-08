/**
 * Integration Tests for Robust Video Import Flow
 *
 * Tests the complete import flow including:
 * 1. Video creation with placeholder state (grayed out)
 * 2. WebSocket progress updates → Store → VideoCard UI
 * 3. Progress overlay visibility during import
 * 4. Error state display for failed imports
 * 5. ImportSummaryToast for batch import results
 *
 * Follows TDD pattern established in Phase 4-5 implementation
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { BrowserRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useImportProgressStore } from "@/stores/importProgressStore";
import type { VideoResponse } from "@/types/video";
import { ImportSummaryToast } from "./ImportSummaryToast";
import { ProgressOverlay } from "./ProgressOverlay";
import { VideoCard } from "./VideoCard";

// Create fresh QueryClient for each test
const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

// Helper to render with providers
const renderWithProviders = (ui: React.ReactElement) => {
  const queryClient = createTestQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>{ui}</BrowserRouter>
    </QueryClientProvider>
  );
};

// Mock navigate
const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// Mock tag store
vi.mock("@/stores/tagStore", () => ({
  useTagStore: () => ({
    tags: [],
    toggleTag: vi.fn(),
  }),
}));

// Mock field values hook
vi.mock("@/hooks/useVideoFieldValues", () => ({
  useUpdateVideoFieldValues: () => ({
    mutate: vi.fn(),
  }),
}));

describe("Robust Import Integration Flow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset import progress store
    useImportProgressStore.getState().clearAllProgress();
  });

  afterEach(() => {
    useImportProgressStore.getState().clearAllProgress();
  });

  describe("Phase 4: Import Progress Display", () => {
    const mockVideo: VideoResponse = {
      id: "video-import-123",
      youtube_id: "dQw4w9WgXcQ",
      title: "Test Import Video",
      channel: "Test Channel",
      duration: 180,
      thumbnail_url: "https://img.youtube.com/vi/dQw4w9WgXcQ/mqdefault.jpg",
      published_at: "2025-01-01T00:00:00Z",
      tags: [],
      list_id: "list-123",
      processing_status: "pending",
      created_at: "2025-01-01T00:00:00Z",
      updated_at: "2025-01-01T00:00:00Z",
      field_values: [],
      import_progress: 0,
      import_stage: "created",
    };

    it("shows progress overlay when video import starts", async () => {
      // Arrange: Set video as importing in store BEFORE rendering
      act(() => {
        useImportProgressStore
          .getState()
          .setProgress("video-import-123", 25, "metadata");
      });

      // Act: Render VideoCard
      const { container } = renderWithProviders(
        <VideoCard video={mockVideo} />
      );

      // Assert: Progress overlay is visible
      await waitFor(() => {
        expect(screen.getByRole("progressbar")).toBeInTheDocument();
      });
      expect(screen.getByText("25%")).toBeInTheDocument();
      expect(screen.getByText("Metadata")).toBeInTheDocument();

      // Assert: Thumbnail has grayscale effect
      const grayscaleElement = container.querySelector(".grayscale");
      expect(grayscaleElement).toBeInTheDocument();
    });

    it("updates progress overlay as import progresses", async () => {
      // Arrange: Start with metadata stage BEFORE rendering
      act(() => {
        useImportProgressStore
          .getState()
          .setProgress("video-import-123", 25, "metadata");
      });
      renderWithProviders(<VideoCard video={mockVideo} />);

      // Assert initial state
      await waitFor(() => {
        expect(screen.getByText("25%")).toBeInTheDocument();
      });
      expect(screen.getByText("Lade Metadaten...")).toBeInTheDocument();

      // Act: Progress to captions stage
      act(() => {
        useImportProgressStore
          .getState()
          .setProgress("video-import-123", 50, "captions");
      });

      // Assert: Progress updated
      await waitFor(() => {
        expect(screen.getByText("50%")).toBeInTheDocument();
        expect(screen.getByText("Lade Untertitel...")).toBeInTheDocument();
      });

      // Act: Progress to chapters stage
      act(() => {
        useImportProgressStore
          .getState()
          .setProgress("video-import-123", 75, "chapters");
      });

      // Assert: Progress updated
      await waitFor(() => {
        expect(screen.getByText("75%")).toBeInTheDocument();
        expect(screen.getByText("Lade Kapitel...")).toBeInTheDocument();
      });
    });

    it("removes progress overlay when import completes", async () => {
      // Arrange: Start with captions stage
      useImportProgressStore
        .getState()
        .setProgress("video-import-123", 50, "captions");
      const { container } = renderWithProviders(
        <VideoCard video={mockVideo} />
      );

      // Assert: Progress overlay visible
      expect(screen.getByRole("progressbar")).toBeInTheDocument();

      // Act: Complete import
      act(() => {
        useImportProgressStore
          .getState()
          .setProgress("video-import-123", 100, "complete");
      });

      // Assert: Progress overlay removed, grayscale removed
      await waitFor(() => {
        expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
      });

      const grayscaleElement = container.querySelector(".grayscale");
      expect(grayscaleElement).not.toBeInTheDocument();
    });

    it("disables card click during import", async () => {
      const user = userEvent.setup();

      // Arrange: Set video as importing
      useImportProgressStore
        .getState()
        .setProgress("video-import-123", 50, "captions");
      renderWithProviders(<VideoCard video={mockVideo} />);

      // Act: Try to click the card
      const card = screen.getByRole("button", { name: /Test Import Video/i });
      await user.click(card);

      // Assert: Navigation should not happen
      expect(mockNavigate).not.toHaveBeenCalled();
    });

    it("allows card click after import completes", async () => {
      const user = userEvent.setup();

      // Arrange: Video is complete (not in import progress store)
      const completedVideo: VideoResponse = {
        ...mockVideo,
        import_stage: "complete",
        import_progress: 100,
      };
      renderWithProviders(<VideoCard video={completedVideo} />);

      // Act: Click the card
      const card = screen.getByRole("button", { name: /Test Import Video/i });
      await user.click(card);

      // Assert: Navigation should happen
      expect(mockNavigate).toHaveBeenCalledWith("/videos/video-import-123");
    });
  });

  describe("Phase 5: Error State Display", () => {
    const errorVideo: VideoResponse = {
      id: "video-error-123",
      youtube_id: "error123",
      title: "Failed Import Video",
      channel: "Test Channel",
      duration: 0,
      thumbnail_url: "https://img.youtube.com/vi/error123/mqdefault.jpg",
      published_at: null,
      tags: [],
      list_id: "list-123",
      processing_status: "error",
      created_at: "2025-01-01T00:00:00Z",
      updated_at: "2025-01-01T00:00:00Z",
      field_values: [],
      import_progress: 0,
      import_stage: "error",
    };

    it("shows error indicator for failed imports", () => {
      const { container } = renderWithProviders(
        <VideoCard video={errorVideo} />
      );

      // Assert: Error indicator is visible
      const errorIndicator = container.querySelector('[data-error="true"]');
      expect(errorIndicator).toBeInTheDocument();

      // Assert: Error icon with aria-label
      expect(screen.getByLabelText(/fehler|error/i)).toBeInTheDocument();
    });

    it("allows clicking failed import video to see details", async () => {
      const user = userEvent.setup();
      renderWithProviders(<VideoCard video={errorVideo} />);

      // Act: Click the error video
      const card = screen.getByRole("button", { name: /Failed Import Video/i });
      await user.click(card);

      // Assert: Navigation should happen (error videos are clickable)
      expect(mockNavigate).toHaveBeenCalledWith("/videos/video-error-123");
    });

    it("does not show progress overlay for error state", () => {
      renderWithProviders(<VideoCard video={errorVideo} />);

      // Assert: No progress overlay
      expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
    });
  });

  describe("ProgressOverlay Component", () => {
    it("displays correct progress percentage", () => {
      render(<ProgressOverlay progress={65} stage="captions" />);

      expect(screen.getByText("65%")).toBeInTheDocument();
      expect(screen.getByRole("progressbar")).toHaveAttribute(
        "aria-valuenow",
        "65"
      );
    });

    it("displays correct stage labels", () => {
      const stages = [
        { stage: "created", label: "Vorbereiten..." },
        { stage: "metadata", label: "Lade Metadaten..." },
        { stage: "captions", label: "Lade Untertitel..." },
        { stage: "chapters", label: "Lade Kapitel..." },
        { stage: "complete", label: "Fertig" },
        { stage: "error", label: "Fehler" },
      ];

      stages.forEach(({ stage, label }) => {
        const { unmount } = render(
          <ProgressOverlay progress={50} stage={stage} />
        );
        expect(screen.getByText(label)).toBeInTheDocument();
        unmount();
      });
    });

    it("clamps progress between 0 and 100", () => {
      // Test over 100
      const { rerender } = render(
        <ProgressOverlay progress={150} stage="complete" />
      );
      expect(screen.getByRole("progressbar")).toHaveAttribute(
        "aria-valuenow",
        "100"
      );
      expect(screen.getByText("100%")).toBeInTheDocument();

      // Test under 0
      rerender(<ProgressOverlay progress={-10} stage="created" />);
      expect(screen.getByRole("progressbar")).toHaveAttribute(
        "aria-valuenow",
        "0"
      );
      expect(screen.getByText("0%")).toBeInTheDocument();
    });
  });

  describe("ImportSummaryToast Component", () => {
    it("shows success state for all successful imports", () => {
      const { container } = render(
        <ImportSummaryToast
          result={{
            total: 47,
            successful: 47,
            withoutCaptions: 0,
            failed: 0,
          }}
        />
      );

      // Assert: Success styling
      expect(container.querySelector(".text-green-500")).toBeInTheDocument();
      expect(screen.getByText(/47 Videos importiert/i)).toBeInTheDocument();
    });

    it("shows warning state for imports without captions", () => {
      const { container } = render(
        <ImportSummaryToast
          result={{
            total: 50,
            successful: 47,
            withoutCaptions: 3,
            failed: 0,
          }}
        />
      );

      // Assert: Warning styling (amber)
      expect(container.querySelector(".text-amber-500")).toBeInTheDocument();
      expect(screen.getByText(/47 Videos importiert/i)).toBeInTheDocument();
      expect(screen.getByText(/3 ohne Untertitel/i)).toBeInTheDocument();
    });

    it("shows error state for failed imports", () => {
      const { container } = render(
        <ImportSummaryToast
          result={{
            total: 50,
            successful: 45,
            withoutCaptions: 0,
            failed: 5,
          }}
        />
      );

      // Assert: Error styling (red)
      expect(container.querySelector(".text-red-500")).toBeInTheDocument();
      expect(screen.getByText(/45 Videos importiert/i)).toBeInTheDocument();
      expect(screen.getByText(/5 fehlgeschlagen/i)).toBeInTheDocument();
    });

    it("shows combined warning and error state", () => {
      const { container } = render(
        <ImportSummaryToast
          result={{
            total: 50,
            successful: 43,
            withoutCaptions: 2,
            failed: 5,
          }}
        />
      );

      // Assert: Error state takes priority (red)
      expect(container.querySelector(".text-red-500")).toBeInTheDocument();
      expect(screen.getByText(/43 Videos importiert/i)).toBeInTheDocument();
      expect(screen.getByText(/2 ohne Untertitel/i)).toBeInTheDocument();
      expect(screen.getByText(/5 fehlgeschlagen/i)).toBeInTheDocument();
    });

    it("handles singular video correctly", () => {
      render(
        <ImportSummaryToast
          result={{
            total: 1,
            successful: 1,
            withoutCaptions: 0,
            failed: 0,
          }}
        />
      );

      expect(screen.getByText(/1 Video importiert/i)).toBeInTheDocument();
    });

    it("has accessible role for screen readers", () => {
      render(
        <ImportSummaryToast
          result={{
            total: 10,
            successful: 10,
            withoutCaptions: 0,
            failed: 0,
          }}
        />
      );

      expect(screen.getByRole("status")).toBeInTheDocument();
    });
  });

  describe("Import Progress Store", () => {
    it("tracks progress for multiple videos independently", () => {
      const store = useImportProgressStore.getState();

      // Set progress for two videos
      store.setProgress("video-1", 25, "metadata");
      store.setProgress("video-2", 75, "chapters");

      // Assert: Both videos tracked independently
      expect(store.getProgress("video-1")).toEqual({
        progress: 25,
        stage: "metadata",
      });
      expect(store.getProgress("video-2")).toEqual({
        progress: 75,
        stage: "chapters",
      });
    });

    it("correctly identifies importing state", () => {
      const store = useImportProgressStore.getState();

      // Set up different states
      store.setProgress("video-importing", 50, "captions");
      store.setProgress("video-complete", 100, "complete");
      store.setProgress("video-error", 0, "error");

      // Assert: Only in-progress videos are importing
      expect(store.isImporting("video-importing")).toBe(true);
      expect(store.isImporting("video-complete")).toBe(false);
      expect(store.isImporting("video-error")).toBe(false);
      expect(store.isImporting("video-unknown")).toBe(false);
    });

    it("clears progress for individual video", () => {
      const store = useImportProgressStore.getState();

      store.setProgress("video-1", 50, "captions");
      store.setProgress("video-2", 75, "chapters");

      // Clear one video
      store.clearProgress("video-1");

      // Assert: Only video-1 cleared
      expect(store.getProgress("video-1")).toBeUndefined();
      expect(store.getProgress("video-2")).toEqual({
        progress: 75,
        stage: "chapters",
      });
    });

    it("clears all progress", () => {
      const store = useImportProgressStore.getState();

      store.setProgress("video-1", 50, "captions");
      store.setProgress("video-2", 75, "chapters");

      // Clear all
      store.clearAllProgress();

      // Assert: All cleared
      expect(store.getProgress("video-1")).toBeUndefined();
      expect(store.getProgress("video-2")).toBeUndefined();
    });
  });

  describe("Full Import Flow Simulation", () => {
    const mockVideo: VideoResponse = {
      id: "video-full-flow",
      youtube_id: "fullflow123",
      title: "Full Flow Test Video",
      channel: "Test Channel",
      duration: 0,
      thumbnail_url: "https://img.youtube.com/vi/fullflow123/mqdefault.jpg",
      published_at: null,
      tags: [],
      list_id: "list-123",
      processing_status: "pending",
      created_at: "2025-01-01T00:00:00Z",
      updated_at: "2025-01-01T00:00:00Z",
      field_values: [],
      import_progress: 0,
      import_stage: "created",
    };

    it("simulates complete WebSocket progress flow", async () => {
      // This test simulates the full flow by setting up progress before render
      // and testing each stage through re-renders (simulating component updates)

      // Step 1: Initial state - no progress
      const { container, unmount } = renderWithProviders(
        <VideoCard video={mockVideo} />
      );

      // Initially: No progress overlay (video just created)
      expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
      unmount();

      // Step 2: Metadata stage (simulates WebSocket message arrival)
      act(() => {
        useImportProgressStore
          .getState()
          .setProgress("video-full-flow", 25, "metadata");
      });

      const { container: container2, unmount: unmount2 } = renderWithProviders(
        <VideoCard video={mockVideo} />
      );

      // Assert: Progress overlay appears
      await waitFor(() => {
        expect(screen.getByRole("progressbar")).toBeInTheDocument();
      });
      expect(screen.getByText("25%")).toBeInTheDocument();
      expect(screen.getByText("Metadata")).toBeInTheDocument();
      expect(container2.querySelector(".grayscale")).toBeInTheDocument();
      unmount2();

      // Step 3: Captions stage
      act(() => {
        useImportProgressStore
          .getState()
          .setProgress("video-full-flow", 50, "captions");
      });

      const { container: container3, unmount: unmount3 } = renderWithProviders(
        <VideoCard video={mockVideo} />
      );

      await waitFor(() => {
        expect(screen.getByText("50%")).toBeInTheDocument();
      });
      expect(screen.getByText("Untertitel")).toBeInTheDocument();
      unmount3();

      // Step 4: Complete
      act(() => {
        useImportProgressStore
          .getState()
          .setProgress("video-full-flow", 100, "complete");
      });

      // Render completed video with updated data
      const completedVideo: VideoResponse = {
        ...mockVideo,
        import_stage: "complete",
        import_progress: 100,
        duration: 180,
        title: "Full Flow Test Video - Enriched",
      };

      const { container: container4 } = renderWithProviders(
        <VideoCard video={completedVideo} />
      );

      // Assert: Progress overlay removed
      expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
      expect(container4.querySelector(".grayscale")).not.toBeInTheDocument();

      // Assert: Duration now visible
      expect(screen.getByText("3:00")).toBeInTheDocument();
    });

    it("simulates error flow", async () => {
      // Step 1: Import starts
      act(() => {
        useImportProgressStore
          .getState()
          .setProgress("video-full-flow", 25, "metadata");
      });

      const { unmount } = renderWithProviders(<VideoCard video={mockVideo} />);

      // Assert: Progress visible
      await waitFor(() => {
        expect(screen.getByRole("progressbar")).toBeInTheDocument();
      });
      unmount();

      // Step 2: Error occurs - set error in store
      act(() => {
        useImportProgressStore
          .getState()
          .setProgress("video-full-flow", 25, "error");
      });

      // Render with error state in store
      renderWithProviders(<VideoCard video={mockVideo} />);

      // Assert: Progress overlay removed (error stage = not importing)
      expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();

      // Note: Error indicator would be shown when video.import_stage is 'error' (from backend)
      // The store just tracks active imports, actual error display is based on video data
    });
  });
});
