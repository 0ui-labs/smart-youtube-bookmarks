import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithRouter } from "@/test/renderWithRouter";
import { VideosPage } from "./VideosPage";

// Mock hooks
vi.mock("@/hooks/useVideos", () => ({
  useVideos: vi.fn(() => ({
    data: [
      {
        id: "video-1",
        youtube_id: "dQw4w9WgXcQ",
        title: "Test Video",
        channel: "Test Channel",
        duration: 210,
        thumbnail_url: "https://i.ytimg.com/vi/dQw4w9WgXcQ/default.jpg",
        processing_status: "completed",
        created_at: "2024-01-01T00:00:00Z",
      },
    ],
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
  useTagStore: vi.fn((selector) =>
    selector({
      selectedTagIds: [],
      toggleTag: vi.fn(),
      clearTags: vi.fn(),
    })
  ),
}));

describe("VideosPage - Row Click & Menu Interaction", () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  const renderVideosPage = () =>
    renderWithRouter(
      <QueryClientProvider client={queryClient}>
        <VideosPage listId="list-1" />
      </QueryClientProvider>
    );

  beforeEach(() => {
    vi.clearAllMocks();
    global.window.open = vi.fn();
    global.window.confirm = vi.fn(() => true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("Row Click Behavior", () => {
    it("should open video in new tab when clicking row", async () => {
      renderVideosPage();

      await waitFor(() => {
        expect(screen.getByText("Test Video")).toBeInTheDocument();
      });

      const row = screen.getByRole("button", { name: /test video/i });
      fireEvent.click(row);

      expect(window.open).toHaveBeenCalledWith(
        "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        "_blank",
        "noopener,noreferrer"
      );
    });

    it("should open video when pressing Enter on row", async () => {
      renderVideosPage();

      await waitFor(() => {
        expect(screen.getByText("Test Video")).toBeInTheDocument();
      });

      const row = screen.getByRole("button", { name: /test video/i });
      row.focus();
      fireEvent.keyDown(row, { key: "Enter" });

      expect(window.open).toHaveBeenCalledWith(
        "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        "_blank",
        "noopener,noreferrer"
      );
    });

    it("should open video when pressing Space on row", async () => {
      renderVideosPage();

      await waitFor(() => {
        expect(screen.getByText("Test Video")).toBeInTheDocument();
      });

      const row = screen.getByRole("button", { name: /test video/i });
      row.focus();
      fireEvent.keyDown(row, { key: " " });

      expect(window.open).toHaveBeenCalledWith(
        "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        "_blank",
        "noopener,noreferrer"
      );
    });
  });

  describe("Menu Click Isolation", () => {
    it("should NOT open video when clicking menu trigger", async () => {
      const user = userEvent.setup();
      renderVideosPage();

      await waitFor(() => {
        expect(screen.getByText("Test Video")).toBeInTheDocument();
      });

      const menuButton = screen.getByLabelText("Aktionen");
      await user.click(menuButton);

      expect(window.open).not.toHaveBeenCalled();

      // Menu should be open
      await waitFor(() => {
        expect(screen.getByText("Löschen")).toBeInTheDocument();
      });
    });

    it("should NOT open video when clicking delete menu item", async () => {
      const user = userEvent.setup();
      const { useDeleteVideo } = await import("@/hooks/useVideos");
      const mockMutate = vi.fn();
      vi.mocked(useDeleteVideo).mockReturnValue({
        mutate: mockMutate,
        isPending: false,
      } as any);

      renderVideosPage();

      await waitFor(() => {
        expect(screen.getByText("Test Video")).toBeInTheDocument();
      });

      // Open menu
      const menuButton = screen.getByLabelText("Aktionen");
      await user.click(menuButton);

      // Click delete
      await waitFor(() => {
        expect(screen.getByText("Löschen")).toBeInTheDocument();
      });
      const deleteItem = screen.getByText("Löschen");
      await user.click(deleteItem);

      // Confirm dialog shown (using AlertDialog now, not window.confirm)
      await waitFor(() => {
        expect(screen.getByText("Video löschen?")).toBeInTheDocument();
      });

      // Click confirm button in the dialog
      const confirmButton = screen.getByRole("button", { name: /Löschen/i });
      await user.click(confirmButton);

      // Delete mutation called
      await waitFor(() => {
        expect(mockMutate).toHaveBeenCalledWith("video-1");
      });

      // Video NOT opened
      expect(window.open).not.toHaveBeenCalled();
    });

    it("should close menu when pressing Escape", async () => {
      const user = userEvent.setup();
      renderVideosPage();

      await waitFor(() => {
        expect(screen.getByText("Test Video")).toBeInTheDocument();
      });

      // Open menu
      const menuButton = screen.getByLabelText("Aktionen");
      await user.click(menuButton);

      await waitFor(() => {
        expect(screen.getByText("Löschen")).toBeInTheDocument();
      });

      // Press Escape
      await user.keyboard("{Escape}");

      // Menu should close
      await waitFor(() => {
        expect(screen.queryByText("Löschen")).not.toBeInTheDocument();
      });

      // Video should NOT open
      expect(window.open).not.toHaveBeenCalled();
    });
  });

  describe("Title Column", () => {
    it("should render title as text, not link", async () => {
      renderVideosPage();

      await waitFor(() => {
        expect(screen.getByText("Test Video")).toBeInTheDocument();
      });

      const title = screen.getByText("Test Video");

      // Should be span, not <a>
      expect(title.tagName).toBe("SPAN");

      // Should not have href
      expect(title).not.toHaveAttribute("href");
    });
  });

  describe("Keyboard Navigation", () => {
    it("should allow tabbing through rows without stopping at menu buttons", async () => {
      renderVideosPage();

      await waitFor(() => {
        expect(screen.getByText("Test Video")).toBeInTheDocument();
      });

      const row = screen.getByRole("button", { name: /test video/i });
      const menuButton = screen.getByLabelText("Aktionen");

      // Menu button should have tabIndex -1
      expect(menuButton).toHaveAttribute("tabIndex", "-1");

      // Row should have tabIndex 0
      expect(row).toHaveAttribute("tabIndex", "0");
    });
  });
});
