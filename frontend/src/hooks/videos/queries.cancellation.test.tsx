import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import type { ReactNode } from "react";
import { expect, it, vi } from "vitest";
import { api } from "@/lib/api";
import { server } from "@/test/mocks/server";
import { useVideos } from "./queries";

it("aborts the previous page request when selection changes", async () => {
  let started = false;
  let release!: () => void;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  const get = vi.spyOn(api, "get");
  const abort = vi.spyOn(XMLHttpRequest.prototype, "abort");
  server.use(
    http.get("/api/lists/:listId/videos/page", async ({ request }) => {
      const offset = Number(new URL(request.url).searchParams.get("offset"));
      if (offset === 0) {
        started = true;
        await pending;
      }
      return HttpResponse.json({
        items: [],
        total: offset === 0 ? 999 : 100,
        offset,
        limit: 50,
      });
    })
  );
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const { result, rerender, unmount } = renderHook(
    ({ offset }) => useVideos("selection", { offset }),
    { initialProps: { offset: 0 }, wrapper }
  );
  try {
    await waitFor(() => expect(started).toBe(true));
    const oldSignal = get.mock.calls[0]?.[1]?.signal;
    rerender({ offset: 50 });
    await waitFor(() => expect(result.current.total).toBe(100));
    expect(oldSignal?.aborted).toBe(true);
    expect(abort).toHaveBeenCalled();
    release();
    expect(result.current.total).toBe(100);
  } finally {
    release();
    unmount();
    client.clear();
    get.mockRestore();
    abort.mockRestore();
  }
});
