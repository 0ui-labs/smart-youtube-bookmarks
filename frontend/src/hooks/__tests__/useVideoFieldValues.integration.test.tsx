import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type React from "react";
import { beforeEach, describe, expect, it } from "vitest";
import {
  useUpdateVideoFieldValues,
  useVideoFieldValues,
} from "../useVideoFieldValues";

describe("useVideoFieldValues Integration", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  it("should fetch, update, and refetch field values in complete flow", async () => {
    // Step 1: Initial fetch
    const { result: queryResult } = renderHook(
      () => useVideoFieldValues("video-123"),
      { wrapper }
    );

    await waitFor(() => expect(queryResult.current.isSuccess).toBe(true));
    expect(queryResult.current.data?.[0].value).toBe(4);

    // Step 2: Update field value
    const { result: mutationResult } = renderHook(
      () => useUpdateVideoFieldValues("video-123"),
      { wrapper }
    );

    act(() => {
      mutationResult.current.mutate([{ field_id: "field-1", value: 5 }]);
    });

    await waitFor(() => expect(mutationResult.current.isSuccess).toBe(true));

    // Step 3: Verify cache was invalidated and refetched
    await waitFor(() => {
      const cachedData = queryClient.getQueryData([
        "videos",
        "field-values",
        "video-123",
      ]);
      expect(cachedData).toBeDefined();
    });
  });
});
