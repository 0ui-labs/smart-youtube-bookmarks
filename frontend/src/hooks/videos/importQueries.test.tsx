import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { PropsWithChildren } from "react";
import { useState } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { api } from "@/lib/api";
import { useVideoDuplicateLookup } from "./useVideoDuplicateLookup";
import { useVideoImportPolling } from "./useVideoImportPolling";

const wrapper = ({ children }: PropsWithChildren) => (
  <QueryClientProvider
    client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
  >
    {children}
  </QueryClientProvider>
);
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

it("checks duplicate IDs in bounded batches across the entire list", async () => {
  const ids = Array.from({ length: 205 }, (_, index) => `youtube-${index}`);
  const calls: string[][] = [];
  vi.spyOn(api, "post").mockImplementation(async (_url, body) => {
    const chunk = (body as { youtube_ids: string[] }).youtube_ids;
    calls.push(chunk);
    return {
      data: {
        existing_youtube_ids: chunk.includes("youtube-204")
          ? ["youtube-204"]
          : [],
      },
    };
  });
  const { result } = renderHook(
    () => useVideoDuplicateLookup("list-a", ids, true),
    { wrapper }
  );
  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(calls.map((chunk) => chunk.length)).toEqual([100, 100, 5]);
  expect(result.current.data).toEqual(["youtube-204"]);
});

it("watches off-page imports with at most 100 IDs per tick until all finish", async () => {
  vi.useFakeTimers();
  const calls: string[][] = [];
  vi.spyOn(api, "post").mockImplementation(async (_url, body) => {
    const chunk = (body as { video_ids: string[] }).video_ids;
    calls.push(chunk);
    return {
      data: chunk.map((id) => ({
        id,
        import_stage: "complete",
        import_progress: 100,
        processing_status: "completed",
      })),
    };
  });
  const { result } = renderHook(
    () => {
      const [ids, setIds] = useState(
        Array.from({ length: 205 }, (_, index) => `video-${index}`)
      );
      useVideoImportPolling("list-a", ids, (finished) =>
        setIds((current) => current.filter((id) => !finished.includes(id)))
      );
      return ids;
    },
    { wrapper }
  );
  await act(async () => {
    await vi.advanceTimersByTimeAsync(4000);
  });
  expect(result.current).toEqual([]);
  expect(calls.every((chunk) => chunk.length <= 100)).toBe(true);
  expect(new Set(calls.flat()).size).toBe(205);
  const finishedCalls = calls.length;
  await act(async () => {
    await vi.advanceTimersByTimeAsync(30_000);
  });
  expect(calls).toHaveLength(finishedCalls);
});
