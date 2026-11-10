import { useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { invalidateVideoViews } from "./cache";

interface ImportStatus {
  id: string;
  import_stage: string;
  import_progress: number;
  processing_status: string;
}

/** Rotate through at most 100 watched IDs per tick, independent of the visible page. */
export function useVideoImportPolling(
  listId: string,
  ids: string[],
  onFinished: (ids: string[]) => void
) {
  const client = useQueryClient();
  const latest = useRef({ ids, onFinished });
  latest.current = { ids, onFinished };
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const enabled = ids.length > 0;
  useEffect(() => {
    if (!enabled) {
      setError(null);
      return;
    }
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    let cursor = 0;
    let failures = 0;
    const controller = new AbortController();
    const poll = async () => {
      const current = latest.current.ids;
      if (!current.length || cancelled) return;
      cursor %= current.length;
      const batch = current.slice(cursor, cursor + 100);
      cursor += batch.length;
      let halted = false;
      try {
        const { data } = await api.post<ImportStatus[]>(
          `/lists/${listId}/videos/import-status`,
          { video_ids: batch },
          { signal: controller.signal }
        );
        if (cancelled) return;
        const finished = data
          .filter(
            (status) =>
              ["complete", "error"].includes(status.import_stage) ||
              status.processing_status === "failed"
          )
          .map((status) => status.id);
        latest.current.onFinished(finished);
        if (finished.length) void invalidateVideoViews(client, listId);
        setError(null);
        failures = 0;
      } catch (failure) {
        if (cancelled || controller.signal.aborted) return;
        setError("Importfortschritt konnte nicht aktualisiert werden.");
        failures += 1;
        halted =
          axios.isAxiosError(failure) && failure.response?.status === 404;
      }
      if (!(cancelled || halted))
        timer = setTimeout(
          () => void poll(),
          Math.min(30_000, 1000 * 2 ** failures)
        );
    };
    timer = setTimeout(() => void poll(), 500);
    return () => {
      cancelled = true;
      controller.abort();
      clearTimeout(timer);
    };
  }, [listId, enabled, retry, client]);
  return { error, retry: () => setRetry((value) => value + 1) };
}
