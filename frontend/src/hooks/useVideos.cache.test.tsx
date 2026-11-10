import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { PropsWithChildren } from "react";
import { expect, it, vi } from "vitest";
import { api } from "@/lib/api";
import { useCreateVideo, videoKeys } from "./useVideos";

it("preserves filtered and sorted caches until the server recomputes them", async () => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const keys = [
    videoKeys.list("list-1"),
    videoKeys.filtered("list-1", ["A"]),
    videoKeys.filtered("list-1", ["B"]),
    videoKeys.withOptions("list-1", { sortBy: "title", sortOrder: "desc" }),
  ];
  for (const key of keys) client.setQueryData(key, [{ id: "old-video" }]);
  const post = vi
    .spyOn(api, "post")
    .mockResolvedValueOnce({ data: { id: "new-video", title: "New" } });
  const wrapper = ({ children }: PropsWithChildren) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const { result, unmount } = renderHook(() => useCreateVideo("list-1"), {
    wrapper,
  });
  await act(async () => {
    await result.current.mutateAsync({ url: "https://youtu.be/aaaaaaaaaaa" });
  });
  for (const key of keys) {
    expect(client.getQueryData(key)).toEqual([{ id: "old-video" }]);
    expect(client.getQueryState(key)?.isInvalidated).toBe(true);
  }
  await waitFor(() => expect(result.current.data?.id).toBe("new-video"));
  unmount();
  client.clear();
  post.mockRestore();
});

it("updates field list caches without treating a detail object as an array", async () => {
  const client = new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  });
  const listKey = videoKeys.list("list-1");
  const detailKey = ["videos", "detail", "video-1"];
  const detail = { id: "video-1", field_values: [] };
  client.setQueryData(listKey, [detail]);
  client.setQueryData(detailKey, detail);
  const put = vi
    .spyOn(api, "put")
    .mockResolvedValueOnce({ data: { updated_count: 1, field_values: [] } });
  const wrapper = ({ children }: PropsWithChildren) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const { useUpdateVideoFieldValues } = await import("./useVideos");
  const { result, unmount } = renderHook(
    () => useUpdateVideoFieldValues("video-1"),
    { wrapper }
  );
  await act(async () => {
    await result.current.mutateAsync({
      field_values: [{ field_id: "field-1", value: 4 }],
    });
  });
  expect(client.getQueryData(detailKey)).toEqual(detail);
  expect(client.getQueryState(detailKey)?.isInvalidated).toBe(true);
  expect(client.getQueryState(listKey)?.isInvalidated).toBe(true);
  unmount();
  client.clear();
  put.mockRestore();
});
