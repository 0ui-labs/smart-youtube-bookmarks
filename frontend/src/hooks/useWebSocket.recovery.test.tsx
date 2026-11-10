import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { useWebSocket } from "./useWebSocket";

const socket = vi.hoisted(() => ({
  options: null as any,
  message: null as any,
  ready: 1,
}));
vi.mock("react-use-websocket", () => ({
  default: (_url: string, options: unknown) => {
    socket.options = options;
    return {
      lastJsonMessage: socket.message,
      readyState: socket.ready,
      sendJsonMessage: vi.fn(),
    };
  },
  ReadyState: { OPEN: 1 },
}));
beforeEach(() => {
  socket.message = null;
  localStorage.setItem("token", "test-token");
});

it("recovers after authenticated reconnect and never rewinds newer live progress", async () => {
  let resolveHistory: (value: unknown) => void = () => {};
  const fetchHistory = vi.fn(
    () =>
      new Promise((resolve) => {
        resolveHistory = resolve;
      })
  );
  vi.stubGlobal("fetch", fetchHistory);
  const { result, rerender } = renderHook(() => useWebSocket());
  act(() => socket.options.onOpen());
  expect(fetchHistory).not.toHaveBeenCalled();
  act(() => {
    socket.message = {
      job_id: "job-1",
      status: "processing",
      progress: 20,
      current_video: 2,
      total_videos: 10,
      message: "working",
    };
    rerender();
  });
  act(() => socket.options.onClose({ code: 1006 }));
  act(() => socket.options.onOpen());
  expect(fetchHistory).not.toHaveBeenCalled();
  act(() => {
    socket.message = { type: "auth_confirmed", authenticated: true };
    rerender();
  });
  await waitFor(() => expect(fetchHistory).toHaveBeenCalled());
  act(() => {
    socket.message = {
      job_id: "job-1",
      status: "completed",
      progress: 100,
      current_video: 10,
      total_videos: 10,
      message: "done",
    };
    rerender();
  });
  await act(async () =>
    resolveHistory({
      ok: true,
      json: async () => [
        {
          id: "event-1",
          created_at: "2026-11-09T00:00:00Z",
          progress_data: {
            job_id: "job-1",
            status: "processing",
            progress: 60,
            current_video: 6,
            total_videos: 10,
            message: "old",
          },
        },
      ],
    })
  );
  expect(result.current.jobProgress.get("job-1")?.status).toBe("completed");
});

it("keeps the event identity across history and repeated live delivery", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [
        {
          id: "event-2",
          job_id: "job-1",
          created_at: "2026-11-10T00:01:00Z",
          progress_data: {
            progress: 50,
            processed: 1,
            failed: 0,
            total: 2,
            status: "processing",
          },
        },
      ],
    })
  );
  const { result, rerender } = renderHook(() => useWebSocket());
  act(() => {
    socket.message = { job_id: "job-1", status: "processing", progress: 0 };
    rerender();
  });
  await act(async () => result.current.retryHistory());
  const recovered = result.current.jobProgress.get("job-1");
  expect(recovered?.event_id).toBe("event-2");
  act(() => {
    socket.message = {
      job_id: "job-1",
      event_id: "event-2",
      status: "processing",
      progress: 50,
      processed: 1,
      total: 2,
      message: "duplicate",
    };
    rerender();
  });
  expect(result.current.jobProgress.get("job-1")).toBe(recovered);
  act(() => {
    socket.message = {
      job_id: "job-1",
      event_id: "event-1",
      created_at: "2026-11-10T00:00:00Z",
      status: "processing",
      progress: 50,
      processed: 1,
      total: 2,
      message: "older",
    };
    rerender();
  });
  expect(result.current.jobProgress.get("job-1")).toBe(recovered);
});

it("recovers all monitored jobs and leaves partial failures retryable", async () => {
  const fetchHistory = vi
    .fn()
    .mockResolvedValueOnce({ ok: false, status: 503 })
    .mockResolvedValue({ ok: true, json: async () => [] });
  vi.stubGlobal("fetch", fetchHistory);
  const { result, rerender } = renderHook(() => useWebSocket());
  for (const job_id of ["job-a", "job-b"])
    act(() => {
      socket.message = { job_id, status: "processing", progress: 10 };
      rerender();
    });
  await act(async () => result.current.retryHistory());
  expect(fetchHistory).toHaveBeenCalledTimes(2);
  expect(result.current.historyError).toContain("job-a");
  await act(async () => result.current.retryHistory());
  expect(fetchHistory).toHaveBeenCalledTimes(4);
  expect(result.current.historyError).toBeNull();
});

it("ignores a history response belonging to a disconnected connection", async () => {
  let resolveHistory: (value: unknown) => void = () => {};
  vi.stubGlobal(
    "fetch",
    vi.fn(
      () =>
        new Promise((resolve) => {
          resolveHistory = resolve;
        })
    )
  );
  const { result, rerender } = renderHook(() => useWebSocket());
  act(() => {
    socket.message = { job_id: "job-a", status: "processing", progress: 10 };
    rerender();
  });
  let pending: Promise<void>;
  act(() => {
    pending = result.current.retryHistory();
  });
  act(() => socket.options.onClose({ code: 1006 }));
  await act(async () => {
    resolveHistory({
      ok: true,
      json: async () => [
        {
          job_id: "job-a",
          progress_data: { status: "completed", progress: 100 },
        },
      ],
    });
    await pending;
  });
  expect(result.current.jobProgress.get("job-a")?.progress).toBe(10);
});
