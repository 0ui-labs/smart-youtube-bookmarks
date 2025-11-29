import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "@/lib/api";
import type { Tag } from "@/types/tag";
import { tagsOptions, useCreateTag, useTags } from "./useTags";

// Mock API
vi.mock("@/lib/api", () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

const mockTags: Tag[] = [
  {
    id: "00000000-0000-0000-0000-000000000001",
    name: "Python",
    color: "#3B82F6",
    schema_id: null,
    is_video_type: true,
    user_id: "00000000-0000-0000-0000-000000000100",
    created_at: "2025-01-01T00:00:00Z",
    updated_at: "2025-01-01T00:00:00Z",
  },
  {
    id: "00000000-0000-0000-0000-000000000002",
    name: "Tutorial",
    color: null,
    schema_id: null,
    is_video_type: true,
    user_id: "00000000-0000-0000-0000-000000000100",
    created_at: "2025-01-01T00:00:00Z",
    updated_at: "2025-01-01T00:00:00Z",
  },
];

describe("tagsOptions", () => {
  it("returns query options with correct structure", () => {
    const options = tagsOptions();

    expect(options.queryKey).toEqual(["tags"]);
    expect(options.queryFn).toBeDefined();
    expect(typeof options.queryFn).toBe("function");
  });
});

describe("useTags", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
    vi.clearAllMocks();
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  it("fetches tags successfully", async () => {
    vi.mocked(api.get).mockResolvedValueOnce({ data: mockTags });

    const { result } = renderHook(() => useTags(), { wrapper });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.data).toBeUndefined();

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(mockTags);
    expect(result.current.data).toHaveLength(2);
    expect(result.current.data?.[0].name).toBe("Python");
    expect(api.get).toHaveBeenCalledWith("/tags");
    expect(api.get).toHaveBeenCalledTimes(1);
  });

  it("handles empty tag list", async () => {
    vi.mocked(api.get).mockResolvedValueOnce({ data: [] });

    const { result } = renderHook(() => useTags(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual([]);
    expect(result.current.data).toHaveLength(0);
  });

  it("handles fetch error", async () => {
    const error = new Error("Network error");
    vi.mocked(api.get).mockRejectedValueOnce(error);

    const { result } = renderHook(() => useTags(), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toBe(error);
    expect(result.current.data).toBeUndefined();
  });
});

describe("useCreateTag", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        mutations: { retry: false },
      },
    });
    vi.clearAllMocks();
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  it("creates tag successfully", async () => {
    const newTag: Tag = {
      id: "00000000-0000-0000-0000-000000000003",
      name: "JavaScript",
      color: "#F7DF1E",
      schema_id: null,
      is_video_type: true,
      user_id: "00000000-0000-0000-0000-000000000100",
      created_at: "2025-01-02T00:00:00Z",
      updated_at: "2025-01-02T00:00:00Z",
    };

    vi.mocked(api.post).mockResolvedValueOnce({ data: newTag });

    const { result } = renderHook(() => useCreateTag(), { wrapper });

    result.current.mutate({ name: "JavaScript", color: "#F7DF1E" });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(newTag);
    expect(api.post).toHaveBeenCalledWith("/tags", {
      name: "JavaScript",
      color: "#F7DF1E",
    });
    expect(api.post).toHaveBeenCalledTimes(1);
  });

  it("creates tag without color", async () => {
    const newTag: Tag = {
      id: "00000000-0000-0000-0000-000000000004",
      name: "TypeScript",
      color: null,
      schema_id: null,
      is_video_type: true,
      user_id: "00000000-0000-0000-0000-000000000100",
      created_at: "2025-01-02T00:00:00Z",
      updated_at: "2025-01-02T00:00:00Z",
    };

    vi.mocked(api.post).mockResolvedValueOnce({ data: newTag });

    const { result } = renderHook(() => useCreateTag(), { wrapper });

    result.current.mutate({ name: "TypeScript" });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(newTag);
    expect(api.post).toHaveBeenCalledWith("/tags", { name: "TypeScript" });
  });

  it("handles create error", async () => {
    const error = new Error("Tag already exists");
    vi.mocked(api.post).mockRejectedValueOnce(error);

    const { result } = renderHook(() => useCreateTag(), { wrapper });

    result.current.mutate({ name: "Python" });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toBe(error);
  });

  it("invalidates tags query after successful creation", async () => {
    const newTag: Tag = mockTags[0];
    vi.mocked(api.post).mockResolvedValueOnce({ data: newTag });
    vi.mocked(api.get).mockResolvedValueOnce({ data: mockTags });

    // Pre-populate cache
    queryClient.setQueryData(["tags"], []);

    const { result } = renderHook(() => useCreateTag(), { wrapper });

    result.current.mutate({ name: "Python", color: "#3B82F6" });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    // Query should be invalidated
    const queryState = queryClient.getQueryState(["tags"]);
    expect(queryState?.isInvalidated).toBe(true);
  });
});
