/**
 * Tests for useSubscriptions hooks.
 *
 * Tests the custom hooks for subscription management.
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it } from "vitest";
import { resetMockSubscriptions } from "@/test/mocks/handlers/subscriptions";
import {
  subscriptionsOptions,
  useDeleteSubscription,
  useSubscriptions,
  useSyncSubscription,
  useToggleSubscription,
  useUpdateSubscription,
} from "./useSubscriptions";

// Create wrapper with QueryClient
function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
      mutations: {
        retry: false,
      },
    },
  });

  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe("useSubscriptions", () => {
  beforeEach(() => {
    resetMockSubscriptions();
  });

  describe("subscriptionsOptions", () => {
    it("creates query options with correct queryKey", () => {
      const options = subscriptionsOptions();

      expect(options.queryKey).toEqual([
        "subscriptions",
        { listId: undefined, isActive: undefined },
      ]);
    });

    it("includes listId in queryKey when provided", () => {
      const options = subscriptionsOptions("test-list-id");

      expect(options.queryKey).toEqual([
        "subscriptions",
        { listId: "test-list-id", isActive: undefined },
      ]);
    });

    it("includes isActive in queryKey when provided", () => {
      const options = subscriptionsOptions(undefined, true);

      expect(options.queryKey).toEqual([
        "subscriptions",
        { listId: undefined, isActive: true },
      ]);
    });
  });

  describe("useSubscriptions hook", () => {
    it("returns empty array initially", async () => {
      const { result } = renderHook(() => useSubscriptions(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.data).toEqual([]);
      expect(result.current.error).toBeNull();
    });
  });

  describe("useDeleteSubscription", () => {
    it("returns mutation function", () => {
      const { result } = renderHook(() => useDeleteSubscription(), {
        wrapper: createWrapper(),
      });

      expect(result.current.mutate).toBeDefined();
      expect(result.current.mutateAsync).toBeDefined();
    });
  });

  describe("useUpdateSubscription", () => {
    it("returns mutation function", () => {
      const { result } = renderHook(() => useUpdateSubscription(), {
        wrapper: createWrapper(),
      });

      expect(result.current.mutate).toBeDefined();
      expect(result.current.mutateAsync).toBeDefined();
    });
  });

  describe("useSyncSubscription", () => {
    it("returns mutation function", () => {
      const { result } = renderHook(() => useSyncSubscription(), {
        wrapper: createWrapper(),
      });

      expect(result.current.mutate).toBeDefined();
      expect(result.current.mutateAsync).toBeDefined();
    });
  });

  describe("useToggleSubscription", () => {
    it("returns mutation function", () => {
      const { result } = renderHook(() => useToggleSubscription(), {
        wrapper: createWrapper(),
      });

      expect(result.current.mutate).toBeDefined();
      expect(result.current.mutateAsync).toBeDefined();
    });
  });
});
