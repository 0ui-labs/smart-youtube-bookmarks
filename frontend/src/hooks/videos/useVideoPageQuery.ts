import {
  hashKey,
  useInfiniteQuery,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useEffect, useMemo } from "react";
import type { VideoPage } from "./page";

/** Both modes share the selection/ownership contract, with distinct cache shapes. */
export function useVideoPageQuery({
  queryKey,
  queryPage,
  enabled,
  continuous = false,
  refetchInterval,
  refetchIntervalInBackground,
  staleTime,
}: {
  queryKey: readonly unknown[];
  queryPage: (offset: number, signal: AbortSignal) => Promise<VideoPage>;
  enabled: boolean;
  continuous?: boolean;
  refetchInterval?: number;
  refetchIntervalInBackground?: boolean;
  staleTime: number;
}) {
  const single = useQuery({
    queryKey,
    queryFn: ({ signal }) => queryPage(-1, signal),
    enabled: enabled && !continuous,
    staleTime,
    refetchOnWindowFocus: false,
    refetchOnMount: true,
    refetchOnReconnect: false,
    refetchInterval: (query) =>
      refetchInterval ??
      (query.state.data?.items.some(
        (video) =>
          video.import_stage &&
          !["complete", "error"].includes(video.import_stage)
      )
        ? 2000
        : false),
    refetchIntervalInBackground,
  });
  const collection = useInfiniteQuery({
    queryKey: [...queryKey, "continuous"],
    initialPageParam: 0,
    queryFn: ({ pageParam, signal }) => queryPage(pageParam, signal),
    getNextPageParam: (last) => {
      const next = last.offset + last.items.length;
      return last.items.length && next < last.total ? next : undefined;
    },
    enabled: enabled && continuous,
    staleTime,
    refetchOnWindowFocus: false,
    refetchOnMount: true,
    refetchOnReconnect: false,
    refetchInterval: (query) =>
      refetchInterval ??
      (query.state.data?.pages.some((page) =>
        page.items.some(
          (video) =>
            video.import_stage &&
            !["complete", "error"].includes(video.import_stage)
        )
      )
        ? 2000
        : false),
    refetchIntervalInBackground,
  });
  const client = useQueryClient();
  const activeHash = hashKey(
    continuous ? [...queryKey, "continuous"] : queryKey
  );
  useEffect(() => {
    // Disabling a mounted observer alone does not abort its in-flight request.
    // Only cancel abandoned selections, preserving any other active consumer.
    const cancelAbandoned = () =>
      client.cancelQueries({
        predicate: (query) =>
          query.queryHash === activeHash && !query.isActive(),
      });
    if (!enabled) void cancelAbandoned();
    return () => {
      void cancelAbandoned();
    };
  }, [client, activeHash, enabled]);
  const pages = collection.data?.pages;
  const last = pages?.at(-1);
  // Preserve card identities across renders and deduplicate shifting boundaries.
  const items = useMemo(
    () =>
      pages
        ? [
            ...new Map(
              pages
                .flatMap((page) => page.items)
                .map((video) => [video.id, video])
            ).values(),
          ]
        : undefined,
    [pages]
  );
  if (!continuous)
    return {
      ...single,
      hasNextPage: false,
      isFetchingNextPage: false,
      isFetchNextPageError: false,
      fetchNextPage: collection.fetchNextPage,
    };
  return {
    ...collection,
    // A failed next batch must not replace already loaded content with an error page.
    error: pages?.length ? null : collection.error,
    data: last && items ? { ...last, offset: 0, items } : undefined,
  };
}
