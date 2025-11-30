import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import axios from "axios";
import { Plus } from "lucide-react";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useShallow } from "zustand/react/shallow";
import { DropZoneOverlay } from "@/components/DropZoneOverlay";
import { ImportPreviewModal } from "@/components/ImportPreviewModal";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { FilterBar } from "@/components/videos/FilterBar";
import { FilterSettingsModal } from "@/components/videos/FilterSettingsModal";
import { FEATURE_FLAGS } from "@/config/featureFlags";
import { useChannels } from "@/hooks/useChannels";
import { useTags } from "@/hooks/useTags";
import {
  type ParsedDropData,
  useVideoDropZone,
} from "@/hooks/useVideoDropZone";
import {
  exportVideosCSV,
  useAssignTags,
  useBulkUploadVideos,
  useCreateVideo,
  useDeleteVideo,
  useVideos,
} from "@/hooks/useVideos";
import { useVideosFilter } from "@/hooks/useVideosFilter";
import { useWebSocket } from "@/hooks/useWebSocket";
import { api } from "@/lib/api";
import { useFieldFilterStore } from "@/stores/fieldFilterStore";
import { useImportDropStore } from "@/stores/importDropStore";
import { useTableSettingsStore } from "@/stores/tableSettingsStore";
import { useTagStore } from "@/stores/tagStore";
import type { VideoResponse } from "@/types/video";
import { formatDuration } from "@/utils/formatDuration";
import {
  calculateThumbnailWidth,
  getBestQualityForVideo,
  getQualityForWidth,
  getThumbnailUrlsForQuality,
  setCachedQuality,
  type ThumbnailQuality,
} from "@/utils/thumbnailUrl";
import { createCSVFromUrls, parseUrlsFromText } from "@/utils/urlParser";
import { ConfirmDeleteModal } from "./ConfirmDeleteModal";
import { CSVUpload } from "./CSVUpload";
import { TableSettingsDropdown } from "./TableSettingsDropdown";
import { VideoDetailsModal } from "./VideoDetailsModal";
import { VideoGrid } from "./VideoGrid";
import { ViewModeToggle } from "./ViewModeToggle";

// Note: VideoResponse type has optional field_values, but TanStack Table needs explicit type
// Using Partial to handle cases where backend doesn't return all fields in list view
type VideoListItem = Omit<
  VideoResponse,
  "field_values" | "available_fields"
> & {
  field_values?: VideoResponse["field_values"];
  available_fields?: VideoResponse["available_fields"];
};

const columnHelper = createColumnHelper<VideoListItem>();

// Tag Carousel Component with conditional arrow display
const TagCarousel = () => {
  const dummyTags = [
    "Python",
    "JavaScript",
    "React",
    "Machine Learning",
    "Web Development",
    "Tutorial",
    "Backend",
    "Database",
    "API",
    "DevOps",
    "Security",
    "Testing",
  ];
  const [api, setApi] = React.useState<any>();
  const [canScrollPrev, setCanScrollPrev] = React.useState(false);
  const [canScrollNext, setCanScrollNext] = React.useState(false);

  React.useEffect(() => {
    if (!api) return;

    const updateScrollState = () => {
      setCanScrollPrev(api.canScrollPrev());
      setCanScrollNext(api.canScrollNext());
    };

    updateScrollState();
    api.on("select", updateScrollState);
    api.on("reInit", updateScrollState);

    return () => {
      api.off("select", updateScrollState);
    };
  }, [api]);

  return (
    <Carousel
      className="w-full max-w-[calc(100vw-400px)]"
      opts={{
        align: "start",
        slidesToScroll: 3,
      }}
      setApi={setApi}
    >
      <div className="flex items-center gap-2">
        {canScrollPrev && (
          <CarouselPrevious className="static h-8 w-8 flex-shrink-0 translate-y-0" />
        )}
        <CarouselContent className="-ml-2">
          {dummyTags.map((tag) => (
            <CarouselItem className="basis-auto pl-2" key={tag}>
              <button className="whitespace-nowrap rounded-full bg-gray-100 px-3 py-1.5 text-gray-700 text-sm transition-colors hover:bg-gray-200">
                {tag}
              </button>
            </CarouselItem>
          ))}
        </CarouselContent>
        {canScrollNext && (
          <CarouselNext className="static h-8 w-8 flex-shrink-0 translate-y-0" />
        )}
      </div>
    </Carousel>
  );
};

// YouTube URL validation regex
const YOUTUBE_URL_PATTERN =
  /^(https:\/\/(www\.|m\.)?youtube\.com\/watch\?v=[\w-]{11}|https:\/\/youtu\.be\/[\w-]{11}|https:\/\/(www\.)?youtube\.com\/embed\/[\w-]{11})$/;

interface VideosPageProps {
  listId: string;
}

// VideoThumbnail component with React state for error handling and quality fallback
// REF MCP Improvement #1: Use existing component (extend, not recreate)
// REF MCP Improvement #3: Object mapping for Tailwind PurgeCSS compatibility
// REF MCP Improvement #5: w-48 for large (not w-64) for smoother progression
// REF MCP Improvement #6: Placeholder also scales dynamically
// Task #35 Fix: Add useFullWidth prop for Grid mode (container-adapted sizing)
// Thumbnail 404 Fix: Fallback chain for sd/maxres that don't exist on all videos
const VideoThumbnail = ({
  youtubeId,
  fallbackUrl,
  title,
  useFullWidth = false,
}: {
  youtubeId: string;
  fallbackUrl?: string | null;
  title: string;
  useFullWidth?: boolean;
}) => {
  const thumbnailSize = useTableSettingsStore((state) => state.thumbnailSize);
  const viewMode = useTableSettingsStore((state) => state.viewMode);
  const gridColumns = useTableSettingsStore((state) => state.gridColumns);

  // Calculate target width and initial quality (considering cache)
  const targetWidth = calculateThumbnailWidth(
    useFullWidth ? "grid" : viewMode,
    thumbnailSize,
    gridColumns as 2 | 3 | 4 | 5
  );
  // Use cached quality if available, otherwise use optimal quality for view size
  const initialQuality = getBestQualityForVideo(youtubeId, targetWidth);

  const [currentQuality, setCurrentQuality] =
    useState<ThumbnailQuality>(initialQuality);
  const [useFallbackUrl, setUseFallbackUrl] = useState(false);

  // Reset when dependencies change (e.g., switching views)
  useEffect(() => {
    setCurrentQuality(getBestQualityForVideo(youtubeId, targetWidth));
    setUseFallbackUrl(false);
  }, [youtubeId, targetWidth]);

  // Get next fallback quality (maxres → sd → hq)
  const getNextQuality = (
    quality: ThumbnailQuality
  ): ThumbnailQuality | null => {
    switch (quality) {
      case "maxres":
        return "sd";
      case "sd":
        return "hq";
      default:
        return null; // hq, mq, default are guaranteed
    }
  };

  // Handle image load - check if it's a placeholder and fallback if needed
  const handleLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const { naturalWidth } = e.currentTarget;
    const expectedWidth = {
      maxres: 1280,
      sd: 640,
      hq: 480,
      mq: 320,
      default: 120,
    }[currentQuality];

    // If image is too small, it's YouTube's gray placeholder - fallback to next quality
    if (naturalWidth < expectedWidth * 0.5) {
      const nextQuality = getNextQuality(currentQuality);
      if (nextQuality) {
        setCurrentQuality(nextQuality);
      } else {
        // All qualities failed, use fallbackUrl
        setCachedQuality(youtubeId, "hq");
        setUseFallbackUrl(true);
      }
      return;
    }

    // Image loaded successfully - cache this quality if we had to fall back
    const optimalQuality = getQualityForWidth(targetWidth);
    if (currentQuality !== optimalQuality) {
      setCachedQuality(youtubeId, currentQuality);
    }
  };

  // REF MCP Improvement #3: Full class strings for Tailwind PurgeCSS
  // Object mapping ensures all classes are detected at build time (no dynamic concatenation)
  // xlarge uses w-[500px] for YouTube's standard list view thumbnail size (500x280)
  // Task #35 Fix: List mode uses thumbnailSize, Grid mode uses w-full (container-adapted)
  const sizeClasses = {
    small: "w-32 aspect-video object-cover rounded shadow-sm",
    medium: "w-40 aspect-video object-cover rounded shadow-sm",
    large: "w-48 aspect-video object-cover rounded shadow-sm",
    xlarge: "w-[500px] aspect-video object-cover rounded shadow-sm",
  } as const;

  const placeholderSizeClasses = {
    small:
      "w-32 aspect-video bg-gray-100 rounded flex items-center justify-center",
    medium:
      "w-40 aspect-video bg-gray-100 rounded flex items-center justify-center",
    large:
      "w-48 aspect-video bg-gray-100 rounded flex items-center justify-center",
    xlarge:
      "w-[500px] aspect-video bg-gray-100 rounded flex items-center justify-center",
  } as const;

  // Task #35 Fix: Grid mode uses w-full for container-adapted sizing
  const fullWidthClasses = "w-full aspect-video object-cover rounded shadow-sm";
  const fullWidthPlaceholderClasses =
    "w-full aspect-video bg-gray-100 rounded flex items-center justify-center";

  // Generate URLs for current quality
  const urls = getThumbnailUrlsForQuality(youtubeId, currentQuality);

  // Placeholder class based on size
  const placeholderClass = useFullWidth
    ? fullWidthPlaceholderClasses
    : placeholderSizeClasses[thumbnailSize];

  // Fallback to fallbackUrl or placeholder if primary fails
  if (useFallbackUrl) {
    if (fallbackUrl) {
      return (
        <img
          alt={title}
          className={
            useFullWidth ? fullWidthClasses : sizeClasses[thumbnailSize]
          }
          loading="lazy"
          src={fallbackUrl}
        />
      );
    }
    // Inline placeholder to avoid nested component definition
    return (
      <div className={placeholderClass}>
        <svg
          aria-hidden="true"
          className="h-8 w-8 text-gray-400"
          fill="currentColor"
          viewBox="0 0 24 24"
        >
          <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
        </svg>
      </div>
    );
  }

  // Primary: render current quality, handleLoad detects placeholders and triggers fallback
  return (
    <img
      alt={title}
      className={useFullWidth ? fullWidthClasses : sizeClasses[thumbnailSize]}
      loading="lazy"
      onError={() => setUseFallbackUrl(true)}
      onLoad={handleLoad}
      src={urls.webp}
    />
  );
};

export const VideosPage = ({ listId }: VideosPageProps) => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [isAdding, setIsAdding] = useState(false);
  const [newVideoUrl, setNewVideoUrl] = useState("");
  const [urlError, setUrlError] = useState<string | null>(null);
  const [isUploadingCSV, setIsUploadingCSV] = useState(false);
  const [deleteModal, setDeleteModal] = useState<{
    open: boolean;
    videoId: string | null;
    videoTitle: string | null;
  }>({
    open: false,
    videoId: null,
    videoTitle: null,
  });

  // Channel filter - URL is the single source of truth (no local state needed)
  const selectedChannelId = searchParams.get("channel");

  // Video Details Modal state (follows pattern of ConfirmDeleteModal)
  const [videoDetailsModal, setVideoDetailsModal] = useState<{
    open: boolean;
    video: VideoResponse | null;
  }>({
    open: false,
    video: null,
  });

  // Drag & Drop Import state (Steps 19-23)
  const [importPreviewModal, setImportPreviewModal] = useState<{
    open: boolean;
    urls: string[];
  }>({
    open: false,
    urls: [],
  });

  // Polling state for real-time updates after import
  // When true, refetch videos frequently until all are processed
  const [isPolling, setIsPolling] = useState(false);
  const [pendingVideoIds, setPendingVideoIds] = useState<string[]>([]);
  const POLLING_INTERVAL = 500; // 500ms for snappy updates

  // Tag integration
  const { data: tags = [] } = useTags();
  // Channels query (YouTube Channels feature)
  const { data: channels = [] } = useChannels();
  // Use useShallow to prevent re-renders when selectedTagIds array has same values
  const selectedTagIds = useTagStore(
    useShallow((state) => state.selectedTagIds)
  );
  const setSelectedTagIds = useTagStore((state) => state.setSelectedTagIds);

  // Compute selected tags with useMemo for referential stability
  // This prevents useEffect dependencies from changing on every render
  const selectedTags = useMemo(
    () => tags.filter((tag) => selectedTagIds.includes(tag.id)),
    [tags, selectedTagIds]
  );

  // Query client for cache invalidation
  const queryClient = useQueryClient();

  // Mutation for updating field values in video detail modal
  const updateField = useMutation({
    mutationFn: async ({
      videoId,
      fieldId,
      value,
    }: {
      videoId: string;
      fieldId: string;
      value: string | number | boolean;
    }) => {
      const { data } = await api.put(`/videos/${videoId}/fields`, {
        field_values: [{ field_id: fieldId, value }], // FIX: Backend expects "field_values" not "updates"
      });
      return data;
    },
    onMutate: async ({ videoId, fieldId, value }) => {
      // Cancel outgoing refetches to avoid race conditions
      await queryClient.cancelQueries({ queryKey: ["video-detail", videoId] });
      await queryClient.cancelQueries({ queryKey: ["videos", listId] });

      // Snapshot previous value for rollback
      const previousVideoDetail = queryClient.getQueryData([
        "video-detail",
        videoId,
      ]);
      const previousVideosList = queryClient.getQueryData(["videos", listId]);

      // Optimistically update video detail cache
      queryClient.setQueryData(
        ["video-detail", videoId],
        (old: VideoResponse | undefined) => {
          if (!old) return old;
          return {
            ...old,
            field_values:
              old.field_values?.map((fv) =>
                fv.field_id === fieldId ? { ...fv, value } : fv
              ) ?? [],
          };
        }
      );

      // Optimistically update videos list cache
      queryClient.setQueryData(
        ["videos", listId],
        (old: VideoResponse[] | undefined) => {
          if (!old) return old;
          return old.map((video) =>
            video.id === videoId
              ? {
                  ...video,
                  field_values:
                    video.field_values?.map((fv) =>
                      fv.field_id === fieldId ? { ...fv, value } : fv
                    ) ?? [],
                }
              : video
          );
        }
      );

      return { previousVideoDetail, previousVideosList };
    },
    onSuccess: (_data, variables) => {
      // Invalidate queries to refetch and sync with server state
      queryClient.invalidateQueries({
        queryKey: ["video-detail", variables.videoId],
      });
      queryClient.invalidateQueries({ queryKey: ["videos", listId] });
    },
    onError: (error: any, variables, context) => {
      // Rollback optimistic updates on error
      if (context?.previousVideoDetail) {
        queryClient.setQueryData(
          ["video-detail", variables.videoId],
          context.previousVideoDetail
        );
      }
      if (context?.previousVideosList) {
        queryClient.setQueryData(
          ["videos", listId],
          context.previousVideosList
        );
      }

      // Log error and notify user
      console.error("Failed to update field value:", error);
      // TODO: Replace console.error with toast notification
      // toast.error('Failed to update field value')
      alert("Failed to update field value. Please try again.");
    },
  });

  // Handle field value changes from video detail modal
  const handleFieldChange = (
    fieldId: string,
    value: string | number | boolean
  ) => {
    if (videoDetailsModal.video) {
      updateField.mutate({
        videoId: videoDetailsModal.video.id,
        fieldId,
        value,
      });
    }
  };

  // Extract tag names for API filtering (memoized to prevent unnecessary query key changes)
  const selectedTagNames = useMemo(
    () => selectedTags.map((tag) => tag.name),
    [selectedTags]
  );

  // TASK 4: Parse sort parameters from URL query params
  const sortBy = searchParams.get("sort_by") || undefined;
  const sortOrderParam = searchParams.get("sort_order");
  const sortOrder: "asc" | "desc" = sortOrderParam === "desc" ? "desc" : "asc";

  // Get active field-based filters from store
  const activeFilters = useFieldFilterStore((state) => state.activeFilters);
  const removeFilter = useFieldFilterStore((state) => state.removeFilter);

  // Cleanup: Remove filters with invalid fieldIds (e.g., stale temp IDs from optimistic updates)
  useEffect(() => {
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    activeFilters.forEach((filter) => {
      if (!uuidRegex.test(filter.fieldId)) {
        console.warn(`Removing filter with invalid fieldId: ${filter.fieldId}`);
        removeFilter(filter.id);
      }
    });
  }, [activeFilters.forEach, removeFilter]); // Run once on mount to clean up stale data

  // Fetch videos with both tag filters and field filters
  // Falls back to useVideos if no field filters are active
  const hasFieldFilters = activeFilters.length > 0;
  const hasTagFilters = selectedTagNames.length > 0;
  const hasChannelFilter = selectedChannelId !== null;

  // Use new filter hook if any filters are active, otherwise fallback to old hook
  const {
    data: filteredVideos = [],
    isLoading: filterLoading,
    error: filterError,
  } = useVideosFilter({
    listId,
    tags: hasTagFilters ? selectedTagNames : undefined,
    channelId: hasChannelFilter ? selectedChannelId : undefined,
    fieldFilters: hasFieldFilters ? activeFilters : undefined,
    sortBy,
    sortOrder,
    enabled: hasFieldFilters || hasTagFilters || hasChannelFilter,
    refetchInterval: isPolling ? POLLING_INTERVAL : undefined,
  });

  const {
    data: allVideos = [],
    isLoading: allLoading,
    error: allError,
  } = useVideos(listId, {
    tags: undefined,
    sortBy,
    sortOrder,
    refetchInterval: isPolling ? POLLING_INTERVAL : undefined,
  });

  // Use filtered results if filters are active, otherwise show all videos
  const hasAnyFilter = hasFieldFilters || hasTagFilters || hasChannelFilter;
  const videos = hasAnyFilter ? filteredVideos : allVideos;
  const isLoading = hasAnyFilter ? filterLoading : allLoading;
  const error = hasAnyFilter ? filterError : allError;
  const createVideo = useCreateVideo(listId);
  const assignTags = useAssignTags();
  const bulkUpload = useBulkUploadVideos(listId);

  // Get existing video IDs for duplicate detection in import preview
  const existingVideoIds = useMemo(
    () =>
      videos.map((v) => v.youtube_id).filter((id): id is string => id !== null),
    [videos]
  );

  // Stop polling when all PENDING videos have been fully processed (import_stage = complete/error)
  // This provides real-time UI updates after import without manual refresh
  useEffect(() => {
    console.log(
      "[Polling] isPolling:",
      isPolling,
      "pendingVideoIds:",
      pendingVideoIds.length,
      "videos.length:",
      videos.length
    );
    if (!isPolling || pendingVideoIds.length === 0) return;

    // Find the pending videos in the current videos list
    const pendingVideos = videos.filter((video) =>
      pendingVideoIds.includes(video.id)
    );
    console.log(
      "[Polling] Found pending videos:",
      pendingVideos.length,
      "of",
      pendingVideoIds.length
    );

    // Check if all pending videos have finished import (complete or error)
    // Videos are "still processing" if import_stage is NOT 'complete' or 'error'
    // Note: Type assertion needed because import_stage may not be in all response types
    const stillProcessing = pendingVideos.filter((video) => {
      const stage = (video as VideoResponse).import_stage || "created";
      return stage !== "complete" && stage !== "error";
    });
    console.log(
      "[Polling] Still processing:",
      stillProcessing.length,
      stillProcessing.map(
        (v) => `${v.youtube_id}:${(v as VideoResponse).import_stage}`
      )
    );

    // Only stop polling when we found all pending videos AND they're all done
    if (
      pendingVideos.length === pendingVideoIds.length &&
      stillProcessing.length === 0
    ) {
      console.log("[Polling] All pending videos processed, stopping polling");
      setIsPolling(false);
      setPendingVideoIds([]);
    }
  }, [isPolling, pendingVideoIds, videos]);

  // Drag & Drop handler: called when videos are detected
  const handleVideosDetected = useCallback((data: ParsedDropData) => {
    if (data.urls.length === 0) {
      return;
    }

    // Open import preview modal with detected URLs
    setImportPreviewModal({
      open: true,
      urls: data.urls,
    });
  }, []);

  // Drag & Drop handler: called when import is confirmed
  const handleImportConfirm = useCallback(
    async (urls: string[], categoryId?: string) => {
      try {
        // Close modal first
        setImportPreviewModal({ open: false, urls: [] });

        if (urls.length === 0) {
          return;
        }

        // Create CSV blob from URLs
        const csvBlob = createCSVFromUrls(urls);
        const csvFile = new File([csvBlob], "import.csv", { type: "text/csv" });

        // Upload via bulk upload API
        const result = await bulkUpload.mutateAsync(csvFile);

        // Start polling for real-time updates after successful import
        if (result.created_video_ids.length > 0) {
          console.log(
            "[Import] Starting polling for",
            result.created_video_ids.length,
            "videos:",
            result.created_video_ids
          );
          setPendingVideoIds(result.created_video_ids);
          setIsPolling(true);
        }

        // If category was selected, assign it to all imported videos
        if (categoryId && result.created_video_ids.length > 0) {
          await Promise.all(
            result.created_video_ids.map((videoId) =>
              assignTags.mutateAsync({ videoId, tagIds: [categoryId] })
            )
          );
        }
      } catch (error) {
        console.error("Failed to import videos:", error);
        // TODO: Add toast notification for error
      }
    },
    [bulkUpload, assignTags]
  );

  // Mobile detection: Disable drag-drop on touch devices (Step 29)
  const isTouchDevice = useMemo(() => {
    if (typeof window === "undefined") return false;
    return "ontouchstart" in window || navigator.maxTouchPoints > 0;
  }, []);

  // Initialize useVideoDropZone hook
  const dropZoneDisabled = !FEATURE_FLAGS.DRAG_DROP_IMPORT || isTouchDevice;
  const { isDragging, getRootProps, getInputProps } = useVideoDropZone({
    onVideosDetected: handleVideosDetected,
    disabled: dropZoneDisabled,
  });

  // Listen for pending imports from TagNavigation drops
  const pendingImport = useImportDropStore((state) => state.pendingImport);
  const clearPendingImport = useImportDropStore(
    (state) => state.clearPendingImport
  );

  // Handle pending imports from TagNavigation drops
  useEffect(() => {
    if (pendingImport) {
      // If category was preselected (dropped on a tag), auto-import without modal
      if (pendingImport.preselectedCategoryId) {
        handleImportConfirm(
          pendingImport.urls,
          pendingImport.preselectedCategoryId
        );
        clearPendingImport();
      } else {
        // No category preselected - show modal for selection
        setImportPreviewModal({
          open: true,
          urls: pendingImport.urls,
        });
      }
    }
  }, [pendingImport, handleImportConfirm, clearPendingImport]);

  // WebSocket for bulk upload progress and import progress tracking
  // Provides real-time updates for video enrichment stages (created → metadata → captions → chapters → complete)
  const { jobProgress, reconnecting, historyError } = useWebSocket();

  const deleteVideo = useDeleteVideo(listId);

  // TASK 4: Handlers to update sort state in URL
  const handleSortChange = (
    newSortBy: string,
    newSortOrder: "asc" | "desc"
  ) => {
    const params = new URLSearchParams(searchParams);
    params.set("sort_by", newSortBy);
    params.set("sort_order", newSortOrder);
    setSearchParams(params, { replace: true });
  };

  const handleClearSort = () => {
    const params = new URLSearchParams(searchParams);
    params.delete("sort_by");
    params.delete("sort_order");
    setSearchParams(params, { replace: true });
  };

  // URL Sync: Parse tag names from URL on mount and sync to store
  // Note: We use a ref to get current selectedTagIds without adding it to dependencies
  // This prevents the circular dependency: URL → state → URL → state...
  const selectedTagIdsRef = React.useRef(selectedTagIds);
  selectedTagIdsRef.current = selectedTagIds;

  useEffect(() => {
    const urlTagNames = searchParams.get("tags");
    if (!urlTagNames || tags.length === 0) return;

    // Parse comma-separated tag names from URL
    const tagNamesFromUrl = urlTagNames
      .split(",")
      .map((name) => name.trim())
      .filter(Boolean);

    // Find tag IDs that match the names from URL
    const tagIdsFromUrl = tags
      .filter((tag) => tagNamesFromUrl.includes(tag.name))
      .map((tag) => tag.id);

    // Only update if different from current selection (use ref to avoid dependency)
    const currentIds = [...selectedTagIdsRef.current].sort().join(",");
    const urlIds = [...tagIdsFromUrl].sort().join(",");

    if (currentIds !== urlIds && tagIdsFromUrl.length > 0) {
      setSelectedTagIds(tagIdsFromUrl);
    }
  }, [searchParams, tags, setSelectedTagIds]); // Removed selectedTagIds - use ref instead

  // URL Sync: Update URL when selected tags change
  useEffect(() => {
    if (selectedTags.length === 0) {
      // Remove tags param if no tags selected
      if (searchParams.has("tags")) {
        searchParams.delete("tags");
        setSearchParams(searchParams, { replace: true });
      }
    } else {
      // Set tags param with comma-separated tag names
      const tagNames = selectedTags
        .map((tag) => tag.name)
        .sort()
        .join(",");
      const currentTagsParam = searchParams.get("tags");

      if (currentTagsParam !== tagNames) {
        searchParams.set("tags", tagNames);
        setSearchParams(searchParams, { replace: true });
      }
    }
  }, [selectedTags, searchParams, setSearchParams]); // Run when selected tags change

  // Channel URL sync removed - URL is now the single source of truth
  // selectedChannelId is read directly from searchParams above

  const handleExportCSV = async () => {
    try {
      await exportVideosCSV(listId);
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const errorMessage =
          error.response?.data?.detail ||
          "Fehler beim Exportieren der Videos. Bitte versuchen Sie es erneut.";
        alert(errorMessage);
      } else {
        alert(
          "Fehler beim Exportieren der Videos. Bitte versuchen Sie es erneut."
        );
      }
    }
  };

  // Get column visibility settings from store
  const visibleColumns = useTableSettingsStore((state) => state.visibleColumns);

  // Get viewMode from store (REF MCP #1: independent from thumbnailSize)
  // REF Improvement #1 (Task #35): Use separate selectors for optimal re-render prevention
  const viewMode = useTableSettingsStore((state) => state.viewMode);
  const setViewMode = useTableSettingsStore((state) => state.setViewMode);

  // Get gridColumns from store (Task #35: Dynamic grid column count)
  const gridColumns = useTableSettingsStore((state) => state.gridColumns);

  const columns = useMemo(
    () => {
      const allColumns = [
        // Column 1: Thumbnail (with Aspect Ratio + Loading State)
        columnHelper.accessor("thumbnail_url", {
          id: "thumbnail",
          header: "Vorschau",
          enableSorting: false, // TASK 5: Disable sorting on thumbnail
          cell: (info) => {
            const thumbnailUrl = info.getValue();
            const row = info.row.original;
            const title = row.title || `Video ${row.youtube_id}`;

            return (
              <VideoThumbnail
                fallbackUrl={thumbnailUrl}
                title={title}
                youtubeId={row.youtube_id}
              />
            );
          },
        }),

        // Column 2: Title + Channel
        columnHelper.accessor("title", {
          id: "title",
          header: ({ column }) => (
            <button
              className="flex items-center gap-2 transition-colors hover:text-blue-600"
              onClick={column.getToggleSortingHandler()}
            >
              Titel
              {column.getIsSorted() && (
                <span
                  aria-label={
                    column.getIsSorted() === "asc"
                      ? "Aufsteigend sortiert"
                      : "Absteigend sortiert"
                  }
                >
                  {column.getIsSorted() === "asc" ? "↑" : "↓"}
                </span>
              )}
            </button>
          ),
          enableSorting: true, // TASK 5: Enable sorting on title
          cell: (info) => {
            const row = info.row.original;
            const title = info.getValue() || `Video ${row.youtube_id}`;
            const channel = row.channel;

            return (
              <div className="flex min-w-[200px] max-w-[400px] flex-col gap-1">
                <span
                  className="line-clamp-2 font-medium text-gray-900 leading-tight"
                  title={title}
                >
                  {title}
                </span>
                {channel && (
                  <span className="truncate text-gray-600 text-sm">
                    {channel}
                  </span>
                )}
              </div>
            );
          },
        }),

        // Column 3: Duration
        columnHelper.accessor("duration", {
          id: "duration",
          header: ({ column }) => (
            <button
              className="flex items-center gap-2 transition-colors hover:text-blue-600"
              onClick={column.getToggleSortingHandler()}
            >
              Dauer
              {column.getIsSorted() && (
                <span
                  aria-label={
                    column.getIsSorted() === "asc"
                      ? "Aufsteigend sortiert"
                      : "Absteigend sortiert"
                  }
                >
                  {column.getIsSorted() === "asc" ? "↑" : "↓"}
                </span>
              )}
            </button>
          ),
          enableSorting: true, // TASK 5: Enable sorting on duration
          cell: (info) => {
            const duration = info.getValue();
            return (
              <span className="font-mono text-gray-700 text-sm tabular-nums">
                {formatDuration(duration)}
              </span>
            );
          },
        }),

        // Column 4: Three-dot menu
        columnHelper.accessor("id", {
          id: "menu",
          header: "", // No header text - just icon column
          cell: (info) => (
            <DropdownMenu modal={false}>
              <DropdownMenuTrigger
                aria-label="Aktionen"
                className="inline-flex h-8 w-8 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.stopPropagation();
                  }
                }}
                tabIndex={-1}
              >
                <svg
                  className="h-4 w-4"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <circle cx="12" cy="5" r="2" />
                  <circle cx="12" cy="12" r="2" />
                  <circle cx="12" cy="19" r="2" />
                </svg>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  className="cursor-pointer text-red-600 focus:text-red-700"
                  onClick={(e) => {
                    e.stopPropagation();
                    const row = info.row.original;
                    // REF MCP #3: Smart video title with fallback chain
                    const videoTitle =
                      row.title ||
                      `Video ${row.youtube_id}` ||
                      "Unbekanntes Video";
                    setDeleteModal({
                      open: true,
                      videoId: info.getValue() as string,
                      videoTitle,
                    });
                  }}
                >
                  <svg
                    className="mr-2 h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    viewBox="0 0 24 24"
                  >
                    <path d="M3 6h18" />
                    <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
                    <line x1="10" x2="10" y1="11" y2="17" />
                    <line x1="14" x2="14" y1="11" y2="17" />
                  </svg>
                  Löschen
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ),
        }),
      ];

      // Filter columns based on visibility settings
      return allColumns.filter((column) => {
        const columnId = column.id as
          | "thumbnail"
          | "title"
          | "duration"
          | "menu";

        // Map 'menu' column id to 'actions' in store
        if (columnId === "menu") {
          return visibleColumns.actions;
        }

        return visibleColumns[columnId];
      });
    },
    [visibleColumns] // TASK 5: Add sort params to dependencies
  );

  // TASK 5: Configure TanStack Table with manual sorting
  const table = useReactTable({
    data: videos as VideoListItem[],
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualSorting: true, // Backend handles sorting
    state: {
      sorting: sortBy ? [{ id: sortBy, desc: sortOrder === "desc" }] : [],
    },
    onSortingChange: (updater) => {
      const newSorting =
        typeof updater === "function"
          ? updater(sortBy ? [{ id: sortBy, desc: sortOrder === "desc" }] : [])
          : updater;

      if (newSorting.length > 0) {
        const sort = newSorting[0];
        if (sort) {
          handleSortChange(sort.id, sort.desc ? "desc" : "asc");
        }
      } else {
        handleClearSort();
      }
    },
  });

  const validateYoutubeUrl = (url: string): boolean => {
    if (!url.trim()) {
      setUrlError("Bitte geben Sie eine YouTube-URL ein");
      return false;
    }
    if (!YOUTUBE_URL_PATTERN.test(url)) {
      setUrlError(
        "Ungültige YouTube-URL. Bitte verwenden Sie das Format: https://www.youtube.com/watch?v=..."
      );
      return false;
    }
    setUrlError(null);
    return true;
  };

  const handleAddVideo = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateYoutubeUrl(newVideoUrl)) {
      return;
    }

    try {
      // Create video
      const newVideo = await createVideo.mutateAsync({ url: newVideoUrl });

      // If tags are currently selected (filtered view), auto-assign them to the new video
      if (selectedTagIds.length > 0) {
        await assignTags.mutateAsync({
          videoId: newVideo.id,
          tagIds: selectedTagIds,
        });
      }

      setNewVideoUrl("");
      setIsAdding(false);
      setUrlError(null);
    } catch (error: any) {
      // Handle specific errors
      if (error.response?.status === 409) {
        setUrlError("Dieses Video ist bereits in der Liste vorhanden");
      } else if (error.response?.status === 422) {
        setUrlError("Die YouTube-URL konnte nicht verarbeitet werden");
      } else {
        setUrlError(
          "Fehler beim Hinzufügen des Videos. Bitte versuchen Sie es erneut."
        );
      }
    }
  };

  // Handle delete confirmation from modal
  const handleDeleteConfirm = () => {
    if (!deleteModal.videoId) return;

    deleteVideo.mutate(deleteModal.videoId, {
      onSuccess: () => {
        // Close modal after successful delete
        setDeleteModal({ open: false, videoId: null, videoTitle: null });
      },
      onError: (error) => {
        // Keep modal open on error, user can retry or cancel
        console.error("Failed to delete video:", error);
        // TODO: Add toast notification here
      },
    });
  };

  const handleDeleteCancel = () => {
    setDeleteModal({ open: false, videoId: null, videoTitle: null });
  };

  // Handle delete click from Grid View
  const handleGridDeleteClick = (video: VideoResponse) => {
    setDeleteModal({
      open: true,
      videoId: video.id,
      videoTitle:
        video.title || `Video ${video.youtube_id}` || "Unbekanntes Video",
    });
  };

  // Handle video card click from Grid View
  // Opens modal if videoDetailsView is 'modal', otherwise navigates to page
  const handleGridVideoClick = (video: VideoResponse) => {
    const videoDetailsView = useTableSettingsStore.getState().videoDetailsView;

    if (videoDetailsView === "modal") {
      setVideoDetailsModal({
        open: true,
        video,
      });
    } else {
      // Page mode - navigate to video details page
      navigate(`/videos/${video.id}`);
    }
  };

  // Handle video details modal close
  const handleVideoDetailsModalClose = () => {
    setVideoDetailsModal({
      open: false,
      video: null,
    });
  };

  // Quick add handler for Plus icon button
  const handleQuickAdd = () => {
    // TODO: Implement enhanced quick-add functionality (e.g., modal with minimal fields)
    // For now, use existing add video form
    setIsAdding(true);
  };

  // Handle URL drops directly (react-dropzone only handles file drops)
  // MUST be defined before early returns to satisfy React hooks rules
  const handleNativeDrop = useCallback(
    (e: React.DragEvent) => {
      // Check for files FIRST - macOS includes text/plain when dragging webloc files
      // which would cause us to only detect 1 URL instead of all files
      const hasFiles = e.dataTransfer.files && e.dataTransfer.files.length > 0;
      const hasWeblocOrCsv =
        hasFiles &&
        Array.from(e.dataTransfer.files).some(
          (f) => f.name.endsWith(".webloc") || f.name.endsWith(".csv")
        );

      if (hasWeblocOrCsv) {
        // Let react-dropzone handle file drops
        getRootProps().onDrop?.(e as React.DragEvent<HTMLElement>);
        return;
      }

      // Check for text/URL data (browser URL drag - only if no supported files)
      const text =
        e.dataTransfer.getData("text/plain") ||
        e.dataTransfer.getData("text/uri-list");
      if (text) {
        const urls = parseUrlsFromText(text);
        if (urls.length > 0) {
          e.preventDefault();
          e.stopPropagation();
          handleVideosDetected({ type: "youtube-urls", urls });
          return;
        }
      }

      // Let react-dropzone handle other file drops
      getRootProps().onDrop?.(e as React.DragEvent<HTMLElement>);
    },
    [handleVideosDetected, getRootProps]
  );

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-gray-600">Lädt Videos...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-red-600">
          Fehler beim Laden der Videos. Bitte versuchen Sie es später erneut.
        </div>
      </div>
    );
  }

  return (
    <div
      {...getRootProps()}
      className="relative mx-auto w-full max-w-[2180px] p-8"
      onDrop={handleNativeDrop}
    >
      {/* Hidden file input for react-dropzone */}
      <input {...getInputProps()} />

      {/* Drop Zone Overlay - shown during drag (not on touch devices) */}
      {isDragging && FEATURE_FLAGS.DRAG_DROP_IMPORT && !isTouchDevice && (
        <DropZoneOverlay message="YouTube-URLs hier ablegen" />
      )}

      <div className="mb-4 flex items-center justify-between">
        <div>
          {selectedChannelId ? (
            <div>
              <h1 className="font-bold text-3xl text-gray-900">
                {channels.find((c) => c.id === selectedChannelId)?.name ||
                  "Kanal"}
              </h1>
              <p className="mt-1 text-muted-foreground text-sm">
                {videos.length} {videos.length === 1 ? "Video" : "Videos"} in
                dieser Liste
              </p>
            </div>
          ) : selectedTags.length > 0 ? (
            <div>
              <h1 className="font-bold text-3xl text-gray-900">
                {selectedTags.map((t) => t.name).join(", ")}
              </h1>
              <p className="mt-1 text-muted-foreground text-sm">
                {videos.length} {videos.length === 1 ? "Video" : "Videos"} in
                dieser Liste
              </p>
            </div>
          ) : (
            <div>
              <h1 className="font-bold text-3xl text-gray-900">Alle Videos</h1>
              <p className="mt-1 text-muted-foreground text-sm">
                {videos.length} {videos.length === 1 ? "Video" : "Videos"} in
                dieser Liste
              </p>
            </div>
          )}
        </div>
        {/* Action Buttons - Feature Flag Controlled (Task #24) */}
        <div className="flex items-center gap-2">
          {FEATURE_FLAGS.SHOW_CSV_EXPORT_BUTTON && (
            <button
              aria-label="Videos als CSV exportieren"
              className="rounded-lg bg-gray-600 px-4 py-2 text-white transition-colors hover:bg-gray-700 disabled:bg-gray-400"
              disabled={videos.length === 0}
              onClick={handleExportCSV}
            >
              CSV Export
            </button>
          )}
          {FEATURE_FLAGS.SHOW_CSV_UPLOAD_BUTTON && (
            <button
              aria-label="Videos per CSV hochladen"
              className="rounded-lg bg-purple-600 px-4 py-2 text-white transition-colors hover:bg-purple-700"
              onClick={() => setIsUploadingCSV(true)}
            >
              CSV Upload
            </button>
          )}
          {FEATURE_FLAGS.SHOW_ADD_VIDEO_BUTTON && (
            <button
              aria-label="Einzelnes Video hinzufügen"
              className="rounded-lg bg-blue-600 px-4 py-2 text-white transition-colors hover:bg-blue-700"
              onClick={() => setIsAdding(true)}
            >
              Video hinzufügen
            </button>
          )}
          {/* YouTube-style Add Button - Quick Add Shortcut (Task #30) */}
          {FEATURE_FLAGS.SHOW_ADD_PLUS_ICON_BUTTON && (
            <button
              aria-label="Video hinzufügen"
              className="flex items-center gap-2 rounded-full bg-gray-100 px-4 py-2.5 font-medium text-gray-900 transition-colors hover:bg-gray-200"
              onClick={handleQuickAdd}
            >
              <Plus className="h-5 w-5" strokeWidth={2.5} />
              <span>Add</span>
            </button>
          )}
        </div>
      </div>

      {/* Filter and View Controls Bar */}
      <div className="mb-6 flex items-center gap-4">
        {/* Left side - Tag filters with carousel */}
        <div className="min-w-0 flex-1">
          <TagCarousel />
        </div>

        {/* Right side - View controls */}
        <div className="ml-auto flex flex-shrink-0 items-center gap-1">
          {/* Filter Settings Modal - Field-based filters */}
          <FilterSettingsModal
            listId={listId}
            selectedTagIds={selectedTagIds}
          />
          {/* View Mode Toggle - Task #32 */}
          <ViewModeToggle onToggle={setViewMode} viewMode={viewMode} />
          {/* Table Settings Dropdown - Task #35 */}
          <TableSettingsDropdown />
        </div>
      </div>

      {/* Field-Based Filter Bar - Task #145 */}
      <FilterBar listId={listId} />

      {/* WebSocket Connection Status Banner - Only show when jobs are active */}
      {reconnecting && jobProgress.size > 0 && (
        <div className="mb-6 rounded-lg border-yellow-400 border-l-4 bg-yellow-50 p-4">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <svg
                className="h-5 w-5 animate-spin text-yellow-400"
                fill="none"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  fill="currentColor"
                />
              </svg>
            </div>
            <div className="ml-3">
              <p className="font-medium text-sm text-yellow-800">
                Verbindung zu Fortschritts-Updates wird wiederhergestellt...
              </p>
            </div>
          </div>
        </div>
      )}

      {/* History Error Display */}
      {historyError && (
        <div
          className="mb-6 rounded-lg border-red-400 border-l-4 bg-red-50 p-4"
          role="alert"
        >
          <div className="flex">
            <div className="flex-shrink-0">
              <svg
                className="h-5 w-5 text-red-400"
                fill="currentColor"
                viewBox="0 0 20 20"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  clipRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                  fillRule="evenodd"
                />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="font-medium text-red-800 text-sm">
                Fehler beim Laden der Verlaufshistorie
              </h3>
              <p className="mt-1 text-red-700 text-sm">{historyError}</p>
            </div>
          </div>
        </div>
      )}

      {/* Job-level progress removed - individual video progress is shown on thumbnails */}

      {isUploadingCSV && (
        <CSVUpload
          listId={listId}
          onCancel={() => setIsUploadingCSV(false)}
          onSuccess={() => setIsUploadingCSV(false)}
        />
      )}

      {isAdding && (
        <form
          className="mb-6 rounded-lg border border-gray-200 bg-white p-6 shadow-sm"
          onSubmit={handleAddVideo}
        >
          <h2 className="mb-4 font-semibold text-lg">Neues Video hinzufügen</h2>
          <div className="space-y-4">
            <div>
              <label
                className="mb-1 block font-medium text-gray-700 text-sm"
                htmlFor="video-url"
              >
                YouTube-URL *
              </label>
              <input
                autoFocus
                className={`w-full border px-3 py-2 ${
                  urlError ? "border-red-500" : "border-gray-300"
                } rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-500`}
                id="video-url"
                onChange={(e) => setNewVideoUrl(e.target.value)}
                placeholder="https://www.youtube.com/watch?v=..."
                required
                type="text"
                value={newVideoUrl}
              />
              {urlError && (
                <p className="mt-1 text-red-600 text-sm">{urlError}</p>
              )}
              <p className="mt-1 text-gray-500 text-sm">
                Unterstützte Formate: youtube.com/watch?v=..., youtu.be/...,
                youtube.com/embed/...
              </p>
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <button
              className="rounded-lg bg-green-600 px-4 py-2 text-white transition-colors hover:bg-green-700 disabled:bg-gray-400"
              disabled={createVideo.isPending}
              type="submit"
            >
              {createVideo.isPending ? "Wird hinzugefügt..." : "Hinzufügen"}
            </button>
            <button
              className="rounded-lg bg-gray-300 px-4 py-2 text-gray-700 transition-colors hover:bg-gray-400"
              onClick={() => {
                setIsAdding(false);
                setNewVideoUrl("");
                setUrlError(null);
              }}
              type="button"
            >
              Abbrechen
            </button>
          </div>
        </form>
      )}

      {videos.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-white py-12 text-center">
          <p className="text-gray-500 text-lg">
            Noch keine Videos in dieser Liste. Fügen Sie Ihr erstes Video hinzu!
          </p>
        </div>
      ) : viewMode === "grid" ? (
        // Grid View - Task #32, Task #35 (gridColumns), Task #130 (navigation)
        <VideoGrid
          gridColumns={gridColumns}
          onDeleteVideo={handleGridDeleteClick}
          onVideoClick={handleGridVideoClick}
          videos={videos as VideoResponse[]}
        />
      ) : (
        // Table View (existing implementation)
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="hidden">
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <th
                      className="px-6 py-3 text-left font-medium text-gray-500 text-xs uppercase tracking-wider"
                      key={header.id}
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {table.getRowModel().rows.map((row) => {
                const video = row.original;

                // Use same logic as Grid View: respect videoDetailsView setting
                const handleRowClick = () => {
                  const videoDetailsView =
                    useTableSettingsStore.getState().videoDetailsView;

                  if (videoDetailsView === "modal") {
                    setVideoDetailsModal({
                      open: true,
                      video: video as VideoResponse,
                    });
                  } else {
                    // Page mode - navigate to video details page
                    navigate(`/videos/${video.id}`);
                  }
                };

                const handleKeyDown = (e: React.KeyboardEvent) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    handleRowClick();
                  }
                };

                return (
                  <tr
                    className="cursor-pointer transition-colors hover:bg-gray-50 focus:bg-gray-100 focus:outline-none"
                    key={row.id}
                    onClick={handleRowClick}
                    onKeyDown={handleKeyDown}
                    role="button"
                    tabIndex={0}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td className="px-6 py-4" key={cell.id}>
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext()
                        )}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Confirm Delete Modal */}
      <ConfirmDeleteModal
        isLoading={deleteVideo.isPending}
        onCancel={handleDeleteCancel}
        onConfirm={handleDeleteConfirm}
        open={deleteModal.open}
        videoTitle={deleteModal.videoTitle}
      />

      {/* Video Details Modal (follows pattern of ConfirmDeleteModal) */}
      {videoDetailsModal.video && (
        <VideoDetailsModal
          listId={listId}
          onFieldChange={handleFieldChange}
          onOpenChange={(open) => {
            if (!open) {
              handleVideoDetailsModalClose();
            }
          }}
          open={videoDetailsModal.open}
          video={videoDetailsModal.video}
        />
      )}

      {/* Import Preview Modal (Drag & Drop Import feature) */}
      <ImportPreviewModal
        existingVideoIds={existingVideoIds}
        onImport={handleImportConfirm}
        onOpenChange={(open) => {
          if (!open) {
            setImportPreviewModal({ open: false, urls: [] });
            clearPendingImport(); // Clear pending import from TagNavigation
          }
        }}
        open={importPreviewModal.open}
        preselectedCategoryId={pendingImport?.preselectedCategoryId}
        urls={importPreviewModal.urls}
      />
    </div>
  );
};

// Export VideoThumbnail for reuse in VideoCard (Task #32)
export { VideoThumbnail };
