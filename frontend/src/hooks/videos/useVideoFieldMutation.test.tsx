import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { expect, it, vi } from "vitest";
import { api } from "@/lib/api";
import { videoKeys } from "@/lib/videoKeys";
import { useVideoFieldMutation } from "./useVideoFieldMutation";

it("keeps page/detail shapes intact and refreshes field-dependent statistics", async () => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const listKey = videoKeys.page("list", { offset: 0, limit: 50 });
  const detailKey = videoKeys.detail("video");
  const page = {
    items: [{ id: "video", title: "Preserved" }],
    total: 1,
    offset: 0,
    limit: 50,
  };
  client.setQueryData(listKey, page);
  client.setQueryData(detailKey, {
    id: "video",
    available_fields: [{ field_id: "field" }],
  });
  client.setQueryData(["analytics", "list"], { coverage: 0 });
  let finish!: () => void;
  const request = new Promise<void>((resolve) => {
    finish = resolve;
  });
  const put = vi.spyOn(api, "put").mockImplementation(async () => {
    await request;
    return { data: { updated_count: 1 } } as never;
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  try {
    const { result } = renderHook(useVideoFieldMutation, { wrapper });
    act(() =>
      result.current.mutate({ videoId: "video", fieldId: "field", value: 4 })
    );
    await waitFor(() => expect(put).toHaveBeenCalled());
    expect(client.getQueryData(listKey)).toEqual(page);
    expect(client.getQueryData(detailKey)).toEqual({
      id: "video",
      available_fields: [{ field_id: "field" }],
    });
    finish();
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(client.getQueryState(listKey)?.isInvalidated).toBe(true);
    expect(client.getQueryState(detailKey)?.isInvalidated).toBe(true);
    expect(client.getQueryState(["analytics", "list"])?.isInvalidated).toBe(
      true
    );
  } finally {
    put.mockRestore();
    client.clear();
  }
});
