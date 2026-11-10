/** Initial DOM card count in jsdom; no browser/paint performance claim. */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { expect, it } from "vitest";
import type { VideoResponse } from "@/types/video";
import { VideoGrid } from "../VideoGrid";

it.each([
  100, 1000, 10_000,
])("measures initial cards for %i synthetic records", (size) => {
  const before = process.env.SYB_BENCHMARK_PHASE === "before";
  const videos: VideoResponse[] = Array.from(
    { length: before ? size : 50 },
    (_, index) => ({
      id: `synthetic-${index}`,
      list_id: "synthetic-list",
      youtube_id: `v${index.toString().padStart(10, "0")}`,
      title: `Measurement video ${index}`,
      channel: "Synthetic channel",
      thumbnail_url: null,
      duration: 120,
      published_at: null,
      processing_status: "completed",
      error_message: null,
      created_at: "2026-11-10T00:00:00Z",
      updated_at: "2026-11-10T00:00:00Z",
      import_stage: "complete",
      import_progress: 100,
      tags: [
        {
          id: "tag-1",
          user_id: "synthetic-user",
          name: "Measurement tag",
          is_video_type: false,
          color: null,
          schema_id: null,
          created_at: "2026-11-10T00:00:00Z",
          updated_at: "2026-11-10T00:00:00Z",
        },
      ],
      field_values: [
        {
          id: `value-${index}`,
          video_id: `synthetic-${index}`,
          field_id: "rating-field",
          field_name: "Measurement rating",
          show_on_card: true,
          updated_at: "2026-11-10T00:00:00Z",
          value: 4,
          field: {
            id: "rating-field",
            list_id: "synthetic-list",
            name: "Measurement rating",
            field_type: "rating",
            config: { max_rating: 5 },
            created_at: "2026-11-10T00:00:00Z",
            updated_at: "2026-11-10T00:00:00Z",
          },
        },
      ],
    })
  );
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const start = performance.now();
  const view = render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <VideoGrid gridColumns={3} videos={videos} />
      </MemoryRouter>
    </QueryClientProvider>
  );
  const elapsed = Math.round((performance.now() - start) * 100) / 100;
  const count = view.container.querySelectorAll(".video-card").length;
  expect(count).toBe(before ? size : 50);
  const output = process.env.SYB_BENCHMARK_OUTPUT;
  if (output) {
    const report = existsSync(output)
      ? JSON.parse(readFileSync(output, "utf8"))
      : {
          phase: before ? "before" : "after",
          runtime: process.version,
          environment: "Vitest/jsdom; no browser paint",
          samples: [],
        };
    report.samples = [
      ...report.samples.filter(
        (sample: { size: number }) => sample.size !== size
      ),
      { size, initial_cards: count, render_ms: elapsed },
    ];
    writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`);
  }
  view.unmount();
  client.clear();
}, 120_000);
