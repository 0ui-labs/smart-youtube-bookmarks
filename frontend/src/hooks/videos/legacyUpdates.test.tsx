import {
  QueryClient,
  QueryClientProvider,
  useQuery,
} from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { useBulkApplySchema, useUpdateTag } from "@/hooks/useTags";
import { api } from "@/lib/api";
import { videoKeys } from "@/lib/videoKeys";
import { useSetVideoCategory } from "./mutations";
import { useVideoFieldMutation } from "./useVideoFieldMutation";

function setup() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { client, wrapper };
}

it("refreshes first field values in modal and sorted/filtered pages without losing page shape", async () => {
  const { client, wrapper } = setup();
  let rating: number | null = null;
  const pageKey = videoKeys.page("list", {
    offset: 0,
    limit: 50,
    sortBy: "field:rating",
  });
  const filteredKey = videoKeys.page("list", {
    offset: 0,
    limit: 50,
    fieldFilters: [{ rating: 4 }],
  });
  const inactiveKey = videoKeys.page("list", { offset: 50, limit: 50 });
  const originalPage = { items: [], total: 100, offset: 50, limit: 50 };
  client.setQueryData(inactiveKey, originalPage);
  const put = vi.spyOn(api, "put").mockImplementation(async () => {
    rating = 4;
    return { data: { updated_count: 1 } } as never;
  });
  const fields = () =>
    rating === null ? [] : [{ field_id: "rating", value: rating }];
  const { result, unmount } = renderHook(
    () => ({
      detail: useQuery({
        queryKey: videoKeys.detail("video"),
        queryFn: async () => ({ id: "video", field_values: fields() }),
      }),
      page: useQuery({
        queryKey: pageKey,
        queryFn: async () => ({
          items: [{ id: "video", field_values: fields() }],
          total: 1,
          offset: 0,
          limit: 50,
        }),
      }),
      filtered: useQuery({
        queryKey: filteredKey,
        queryFn: async () => ({
          items: rating === 4 ? [{ id: "video" }] : [],
          total: rating === 4 ? 1 : 0,
          offset: 0,
          limit: 50,
        }),
      }),
      update: useVideoFieldMutation(),
    }),
    { wrapper }
  );
  try {
    await waitFor(() => expect(result.current.detail.isSuccess).toBe(true));
    await waitFor(() => expect(result.current.filtered.isSuccess).toBe(true));
    await act(() =>
      result.current.update.mutateAsync({
        videoId: "video",
        fieldId: "rating",
        value: 4,
      })
    );
    await waitFor(() =>
      expect(result.current.detail.data?.field_values).toEqual([
        { field_id: "rating", value: 4 },
      ])
    );
    await waitFor(() =>
      expect(result.current.page.data?.items[0]?.field_values).toEqual([
        { field_id: "rating", value: 4 },
      ])
    );
    await waitFor(() => expect(result.current.filtered.data?.total).toBe(1));
    expect(result.current.page.data).toMatchObject({
      total: 1,
      offset: 0,
      limit: 50,
    });
    expect(client.getQueryData(inactiveKey)).toEqual(originalPage);
    expect(client.getQueryState(inactiveKey)?.isInvalidated).toBe(true);
  } finally {
    unmount();
    client.clear();
    put.mockRestore();
  }
});

it("preserves confirmed detail and page data when a field save fails", async () => {
  const { client, wrapper } = setup();
  const pageKey = videoKeys.page("list", { offset: 0, limit: 50 });
  const detail = {
    id: "video",
    field_values: [{ field_id: "rating", value: 2 }],
  };
  const page = { items: [detail], total: 1, offset: 0, limit: 50 };
  client.setQueryData(pageKey, page);
  client.setQueryData(videoKeys.detail("video"), detail);
  const put = vi
    .spyOn(api, "put")
    .mockRejectedValueOnce(new Error("Save rejected"));
  const alert = vi.spyOn(window, "alert").mockImplementation(() => {});
  const { result, unmount } = renderHook(useVideoFieldMutation, { wrapper });
  try {
    await act(async () => {
      await expect(
        result.current.mutateAsync({
          videoId: "video",
          fieldId: "rating",
          value: 5,
        })
      ).rejects.toThrow("Save rejected");
    });
    expect(client.getQueryData(pageKey)).toEqual(page);
    expect(client.getQueryData(videoKeys.detail("video"))).toEqual(detail);
  } finally {
    unmount();
    client.clear();
    put.mockRestore();
    alert.mockRestore();
  }
});

describe.each(["single", "bulk"] as const)("%s tag schema changes", (mode) => {
  it("refreshes the active modal and collection fields with current query keys", async () => {
    const { client, wrapper } = setup();
    const tagId = "550e8400-e29b-41d4-a716-446655440000";
    const oldSchema = "550e8400-e29b-41d4-a716-446655440010";
    const newSchema = "550e8400-e29b-41d4-a716-446655440011";
    let schema = oldSchema;
    const tag = {
      id: tagId,
      name: "Tutorial",
      color: "#3B82F6",
      is_video_type: true,
      user_id: "550e8400-e29b-41d4-a716-446655440001",
      created_at: "2025-11-18T10:00:00Z",
      updated_at: "2025-11-18T10:00:00Z",
    };
    client.setQueryData(
      ["tags"],
      [{ id: "tag", name: "Tutorial", schema_id: schema }]
    );
    const put = vi.spyOn(api, "put").mockImplementation(async () => {
      schema = newSchema;
      return { data: { ...tag, schema_id: schema } } as never;
    });
    const { result, unmount } = renderHook(
      () => ({
        detail: useQuery({
          queryKey: videoKeys.detail("video"),
          queryFn: async () => ({ available_fields: [schema] }),
        }),
        page: useQuery({
          queryKey: videoKeys.page("list", { offset: 0, limit: 50 }),
          queryFn: async () => ({
            items: [{ available_fields: [schema] }],
            total: 1,
          }),
        }),
        single: useUpdateTag(),
        bulk: useBulkApplySchema(),
      }),
      { wrapper }
    );
    try {
      await waitFor(() =>
        expect(result.current.detail.data?.available_fields).toEqual([
          oldSchema,
        ])
      );
      await act(async () => {
        if (mode === "single")
          await result.current.single.mutateAsync({
            tagId: "tag",
            data: { schema_id: newSchema },
          });
        else
          await result.current.bulk.mutateAsync({
            tagIds: ["tag"],
            schemaId: newSchema,
          });
      });
      await waitFor(() =>
        expect(result.current.detail.data?.available_fields).toEqual([
          newSchema,
        ])
      );
      await waitFor(() =>
        expect(result.current.page.data?.items[0]?.available_fields).toEqual([
          newSchema,
        ])
      );
      expect(client.getQueryData(["video-detail", "video"])).toBeUndefined();
    } finally {
      unmount();
      client.clear();
      put.mockRestore();
    }
  });
});

it.each([
  true,
  false,
])("sends the category restore choice through the API query contract (%s)", async (restoreBackup) => {
  const { client, wrapper } = setup();
  const put = vi.spyOn(api, "put").mockResolvedValueOnce({
    data: {
      backup_created: false,
      backup_available: true,
      restored_count: restoreBackup ? 1 : 0,
    },
  });
  const { result, unmount } = renderHook(useSetVideoCategory, { wrapper });
  try {
    await act(() =>
      result.current.mutateAsync({
        videoId: "video",
        categoryId: "category",
        restoreBackup,
      })
    );
    expect(put).toHaveBeenCalledWith(
      "/videos/video/category",
      { category_id: "category" },
      { params: { restore_backup: restoreBackup } }
    );
  } finally {
    unmount();
    client.clear();
    put.mockRestore();
  }
});
