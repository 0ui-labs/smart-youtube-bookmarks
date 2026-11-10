import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { beforeEach, expect, it, vi } from "vitest";
import { api } from "@/lib/api";
import { useTagStore } from "@/stores/tagStore";
import { server } from "@/test/mocks/server";
import { renderWithRouter } from "@/test/renderWithRouter";
import type { VideoResponse } from "@/types/video";
import { VideosPage } from "../VideosPage";

const fixtures = vi.hoisted(() => ({
  tag: {
    id: "11111111-1111-4111-8111-111111111111",
    user_id: "11111111-1111-4111-8111-111111111112",
    name: "Selected",
    is_video_type: false,
    color: null,
    schema_id: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  },
}));
vi.mock("@/hooks/useTags", async () => ({
  ...(await vi.importActual("@/hooks/useTags")),
  useTags: () => ({ data: [fixtures.tag], isLoading: false }),
}));
vi.mock("@/hooks/useChannels", () => ({
  useChannels: () => ({ data: [], isLoading: false }),
}));
let videos: VideoResponse[];
let reachEnd: () => void;
const requests: { offset: number; filtered: boolean }[] = [];
beforeEach(() => {
  requests.length = 0;
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      private callback: IntersectionObserverCallback;
      constructor(callback: IntersectionObserverCallback) {
        this.callback = callback;
      }
      observe(element: Element) {
        if (element.getAttribute("data-testid") === "video-load-more") {
          reachEnd = () =>
            this.callback(
              [{ isIntersecting: true } as IntersectionObserverEntry],
              this as never
            );
        }
      }
      disconnect() {
        /* No browser resources in this observer stub. */
      }
    }
  );
  videos = Array.from({ length: 51 }, (_, index) => ({
    id: `11111111-1111-4111-8111-${String(index).padStart(12, "0")}`,
    list_id: "11111111-1111-4111-8111-111111111113",
    youtube_id: `v${String(index).padStart(10, "0")}`,
    title: `Video ${index}`,
    channel: "Synthetic channel",
    thumbnail_url: null,
    duration: 120,
    published_at: null,
    tags: [],
    processing_status: "completed",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    import_stage: "complete",
    import_progress: 100,
    field_values: [],
  }));
  const page = (request: Request, filtered: boolean) => {
    const url = new URL(request.url);
    const offset = Number(url.searchParams.get("offset") ?? 0);
    const limit = Number(url.searchParams.get("limit") ?? 50);
    requests.push({ offset, filtered });
    const selected = filtered ? videos.slice(0, 2) : videos;
    return HttpResponse.json({
      items: selected.slice(offset, offset + limit),
      total: selected.length,
      offset,
      limit,
    });
  };
  server.use(
    http.get("/api/lists/:listId/videos/page", ({ request }) =>
      page(request, false)
    ),
    http.post("/api/lists/:listId/videos/filter/page", ({ request }) =>
      page(request, true)
    ),
    http.delete("/api/videos/:videoId", ({ params }) => {
      videos = videos.filter((video) => video.id !== params.videoId);
      return new HttpResponse(null, { status: 204 });
    })
  );
});
const show = () =>
  renderWithRouter(
    <VideosPage listId="11111111-1111-4111-8111-111111111113" />
  );

it("renders 50 initial cards and reaches the final record", async () => {
  const view = show();
  await screen.findByText("Video 0");
  expect(view.container.querySelectorAll(".video-card")).toHaveLength(50);
  act(() => reachEnd());
  await screen.findByText("Video 50");
  expect(view.container.querySelectorAll(".video-card")).toHaveLength(51);
  expect(screen.getByText("Video 0")).toBeVisible();
  expect(
    screen.queryByRole("button", { name: "Nächste Seite" })
  ).not.toBeInTheDocument();
  expect(requests.map((request) => request.offset)).toEqual([0, 50]);
});

it("starts a new continuous collection when a tag filter changes", async () => {
  show();
  await screen.findByText("Video 0");
  act(() => reachEnd());
  await screen.findByText("Video 50");
  act(() => useTagStore.getState().setSelectedTagIds([fixtures.tag.id]));
  await waitFor(() =>
    expect(screen.queryByText("Video 50")).not.toBeInTheDocument()
  );
  await screen.findByText("Video 0");
  expect(
    requests
      .filter((request) => request.filtered)
      .every((request) => request.offset === 0)
  ).toBe(true);
  expect(screen.queryByText("Video 50")).not.toBeInTheDocument();
});

it("retains earlier cards and removes a deleted final record", async () => {
  show();
  await screen.findByText("Video 0");
  act(() => reachEnd());
  await screen.findByText("Video 50");
  await userEvent.click(
    screen.getAllByRole("button", { name: "Aktionen" }).at(-1)!
  );
  await userEvent.click(screen.getByRole("menuitem", { name: /Löschen/ }));
  const dialog = screen.getByRole("alertdialog");
  await userEvent.click(
    within(dialog).getByRole("button", { name: "Löschen" })
  );
  await waitFor(() =>
    expect(screen.queryByText("Video 50")).not.toBeInTheDocument()
  );
  expect(screen.getByText("Video 0")).toBeVisible();
  expect(
    screen.queryByRole("button", { name: "Vorherige Seite" })
  ).not.toBeInTheDocument();
});

it("keeps loaded cards after a next-batch failure and retries without switching pages", async () => {
  let fails = true;
  server.use(
    http.get("/api/lists/:listId/videos/page", ({ request }) => {
      const url = new URL(request.url);
      const offset = Number(url.searchParams.get("offset") ?? 0);
      if (offset > 0 && fails) return new HttpResponse(null, { status: 503 });
      return HttpResponse.json({
        items: videos.slice(offset, offset + 50),
        total: videos.length,
        offset,
        limit: 50,
      });
    })
  );
  show();
  await screen.findByText("Video 0");
  act(() => reachEnd());
  await screen.findByText("Weitere Videos konnten nicht geladen werden.");
  expect(screen.getByText("Video 0")).toBeVisible();
  fails = false;
  await userEvent.click(screen.getByRole("button", { name: "Erneut laden" }));
  await screen.findByText("Video 50");
  expect(screen.getByText("Video 0")).toBeVisible();
});

it("cancels a pending next batch on filter change and keeps late records out", async () => {
  let release: () => void = () => {};
  let pending = false;
  const get = vi.spyOn(api, "get");
  server.use(
    http.get("/api/lists/:listId/videos/page", async ({ request }) => {
      const offset = Number(
        new URL(request.url).searchParams.get("offset") ?? 0
      );
      if (offset) {
        pending = true;
        await new Promise<void>((resolve) => {
          release = resolve;
        });
      }
      return HttpResponse.json({
        items: videos.slice(offset, offset + 50),
        total: videos.length,
        offset,
        limit: 50,
      });
    })
  );
  show();
  await screen.findByText("Video 0");
  act(() => reachEnd());
  await waitFor(() => expect(pending).toBe(true));
  act(() => useTagStore.getState().setSelectedTagIds([fixtures.tag.id]));
  await waitFor(() =>
    expect(
      get.mock.calls.find(([url]) => String(url).includes("offset=50"))?.[1]
        ?.signal?.aborted
    ).toBe(true)
  );
  release();
  await screen.findByText("Video 0");
  expect(screen.queryByText("Video 50")).not.toBeInTheDocument();
  get.mockRestore();
});
