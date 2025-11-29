import { screen } from "@testing-library/react";
import { ReadyState } from "react-use-websocket";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import { renderWithRouter } from "./test/renderWithRouter";

// Mock dependencies
vi.mock("./hooks/useLists", () => ({
  useLists: vi.fn(() => ({
    data: [
      {
        id: "test-list-1",
        name: "Test List",
        description: "Test",
        video_count: 0,
        created_at: new Date().toISOString(),
      },
    ],
    isLoading: false,
    error: null,
  })),
  useCreateList: vi.fn(() => ({
    mutate: vi.fn(),
    mutateAsync: vi.fn(),
    isPending: false,
  })),
  useDeleteList: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
}));

vi.mock("./hooks/useWebSocket", () => ({
  useWebSocket: vi.fn(() => ({
    jobProgress: new Map(),
    isConnected: false,
    reconnecting: false,
    readyState: ReadyState.CONNECTING,
    sendJsonMessage: vi.fn(),
    authStatus: "pending",
    historyError: null,
  })),
}));

vi.mock("./hooks/useVideos", () => ({
  useVideos: vi.fn(() => ({
    data: [],
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

vi.mock("./hooks/useVideosFilter", () => ({
  useVideosFilter: vi.fn(() => ({
    data: [],
    isLoading: false,
    error: null,
  })),
}));

vi.mock("./hooks/useTags", () => ({
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

vi.mock("./stores/fieldFilterStore", () => ({
  useFieldFilterStore: vi.fn(() => ({
    activeFilters: [],
  })),
}));

vi.mock("./stores/tagStore", () => ({
  useTagStore: vi.fn(() => ({
    selectedTagIds: [],
    setSelectedTagIds: vi.fn(),
  })),
}));

vi.mock("./stores/tableSettingsStore", () => ({
  useTableSettingsStore: vi.fn(() => ({
    viewMode: "table",
    visibleColumns: [],
    setViewMode: vi.fn(),
    setVisibleColumns: vi.fn(),
  })),
}));

describe("App", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders without crashing", () => {
    renderWithRouter(<App />, { initialEntries: ["/"] });

    // Verify the main heading is rendered (redirects to /videos which shows "Alle Videos")
    expect(
      screen.getByRole("heading", { name: /Alle Videos/i })
    ).toBeInTheDocument();
  });

  it("redirects root path to /videos", () => {
    renderWithRouter(<App />, { initialEntries: ["/"] });

    // Should see the VideosPage (which has "Videos" heading)
    // Note: Navigation is hidden in single-list MVP
    expect(screen.queryByText("Listen")).not.toBeInTheDocument();
    expect(screen.queryByText("Dashboard")).not.toBeInTheDocument();
  });
});
