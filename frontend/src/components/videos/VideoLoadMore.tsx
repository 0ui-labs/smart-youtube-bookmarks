import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";

/** Append the next bounded batch without replacing the cards already on screen. */
export function VideoLoadMore({
  hasMore,
  loading,
  failed,
  onLoad,
}: {
  hasMore: boolean;
  loading: boolean;
  failed: boolean;
  onLoad: () => void;
}) {
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (
      !(end.current && hasMore) ||
      loading ||
      failed ||
      typeof IntersectionObserver === "undefined"
    )
      return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) onLoad();
      },
      { rootMargin: "200px" }
    );
    observer.observe(end.current);
    return () => observer.disconnect();
  }, [hasMore, loading, failed, onLoad]);
  return (
    <div className="min-h-px" data-testid="video-load-more" ref={end}>
      {loading && <output>Weitere Videos werden geladen…</output>}
      {failed ? (
        <div role="alert">
          Weitere Videos konnten nicht geladen werden.
          <Button onClick={onLoad} variant="outline">
            Erneut laden
          </Button>
        </div>
      ) : (
        hasMore &&
        !loading && (
          <button
            className="sr-only focus:not-sr-only"
            onClick={onLoad}
            type="button"
          >
            Weitere Videos laden
          </button>
        )
      )}
    </div>
  );
}
