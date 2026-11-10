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
