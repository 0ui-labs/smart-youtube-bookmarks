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
import { buildVideoSelection } from "@/hooks/videos/selection";
import { useVideoFieldMutation } from "@/hooks/videos/useVideoFieldMutation";
import { useVideoImportPolling } from "@/hooks/videos/useVideoImportPolling";
import { useVideoPageState } from "@/hooks/videos/useVideoPageState";
import { useFieldFilterStore } from "@/stores/fieldFilterStore";
import { useImportDropStore } from "@/stores/importDropStore";
import { useTableSettingsStore } from "@/stores/tableSettingsStore";
import { useTagStore } from "@/stores/tagStore";
import type { VideoResponse } from "@/types/video";
import { createCSVFromUrls, parseUrlsFromText } from "@/utils/urlParser";
import { ConfirmDeleteModal } from "./ConfirmDeleteModal";
import { CSVUpload } from "./CSVUpload";
import { TableSettingsDropdown } from "./TableSettingsDropdown";
import { VideoDetailsModal } from "./VideoDetailsModal";
import { VideoGrid } from "./VideoGrid";
import { ViewModeToggle } from "./ViewModeToggle";
import { VideoPagination } from "./videos/VideoPagination";
import { VideoTable } from "./videos/VideoTable";

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
              <button className="whitespace-nowrap rounded-full bg-secondary px-3 py-1.5 text-secondary-foreground text-sm transition-colors hover:bg-accent">
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
  const [pendingVideoIds, setPendingVideoIds] = useState<string[]>([]);
  const isPolling = pendingVideoIds.length > 0;
  const importPolling = useVideoImportPolling(
    listId,
    pendingVideoIds,
    (finished) => {
      if (finished.length)
        setPendingVideoIds((current) =>
          current.filter((id) => !finished.includes(id))
        );
    }
  );
  const POLLING_INTERVAL = 500; // 500ms for snappy updates

  // Mobile detection for responsive behavior
  // On mobile, always use "page" mode for video details (never modal)
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

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

  const updateField = useVideoFieldMutation();

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

  const selectionKey = JSON.stringify({
    listId,
    tags: selectedTagNames,
    channel: selectedChannelId,
    fields: activeFilters,
    sortBy,
    sortOrder,
  });
  const { page, setPage } = useVideoPageState(selectionKey);
  const pageSize = 50;

  // Fetch videos with both tag filters and field filters
  // Falls back to useVideos if no field filters are active
  const hasFieldFilters = activeFilters.length > 0;
  const hasTagFilters = selectedTagNames.length > 0;
  const hasChannelFilter = selectedChannelId !== null;

  // Use new filter hook if any filters are active, otherwise fallback to old hook
  const {
    data: filteredVideos = [],
    total: filteredTotal,
    isLoading: filterLoading,
    error: filterError,
  } = useVideosFilter({
    listId,
    offset: page * pageSize,
    limit: pageSize,
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
    total: allTotal,
    isLoading: allLoading,
    error: allError,
  } = useVideos(listId, {
    offset: page * pageSize,
    limit: pageSize,
    enabled: !(hasFieldFilters || hasTagFilters || hasChannelFilter),
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
  const serverTotal = hasAnyFilter ? filteredTotal : allTotal;
  const totalVideos = serverTotal ?? videos.length;
  useEffect(() => {
    if (serverTotal !== undefined && page > 0 && page * pageSize >= serverTotal)
      setPage(Math.max(0, Math.ceil(serverTotal / pageSize) - 1));
  }, [serverTotal, page, setPage]);
  const createVideo = useCreateVideo(listId);
  const assignTags = useAssignTags();
  const bulkUpload = useBulkUploadVideos(listId);

  // Get existing video IDs for duplicate detection in import preview
  const existingVideoIds = useMemo(
    () =>
      videos.map((v) => v.youtube_id).filter((id): id is string => id !== null),
    [videos]
  );

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
  const { jobProgress, reconnecting, historyError, retryHistory } =
    useWebSocket();

  const deleteVideo = useDeleteVideo(listId);

  // TASK 4: Handlers to update sort state in URL
  const handleSortChange = useCallback(
    (newSortBy: string, newSortOrder: "asc" | "desc") => {
      const params = new URLSearchParams(searchParams);
      params.set("sort_by", newSortBy);
      params.set("sort_order", newSortOrder);
      params.delete("page");
      setSearchParams(params, { replace: true });
    },
    [searchParams, setSearchParams]
  );

  const handleClearSort = () => {
    const params = new URLSearchParams(searchParams);
    params.delete("sort_by");
    params.delete("sort_order");
    params.delete("page");
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
        setSearchParams(
          (current) => {
            const next = new URLSearchParams(current);
            next.delete("tags");
            next.delete("page");
            return next;
          },
          { replace: true }
        );
      }
    } else {
      // Set tags param with comma-separated tag names
      const tagNames = selectedTags
        .map((tag) => tag.name)
        .sort()
        .join(",");
      const currentTagsParam = searchParams.get("tags");

      if (currentTagsParam !== tagNames) {
        setSearchParams(
          (current) => {
            const next = new URLSearchParams(current);
            next.set("tags", tagNames);
            next.delete("page");
            return next;
          },
          { replace: true }
        );
      }
    }
  }, [selectedTags, searchParams, setSearchParams]); // Run when selected tags change

  // Channel URL sync removed - URL is now the single source of truth
  // selectedChannelId is read directly from searchParams above

  const handleExportCSV = async () => {
    try {
      await exportVideosCSV(
        listId,
        buildVideoSelection({
          tags: selectedTagNames,
          channelId: selectedChannelId ?? undefined,
          fieldFilters: activeFilters,
          sortBy,
          sortOrder,
        })
      );
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

  const viewMode = useTableSettingsStore((state) => state.viewMode);
  const setViewMode = useTableSettingsStore((state) => state.setViewMode);
  const gridColumns = useTableSettingsStore((state) => state.gridColumns);

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
        setPendingVideoIds((current) =>
          current.filter((id) => id !== deleteModal.videoId)
        );
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
  // Opens modal if videoDetailsView is 'modal' (desktop only), otherwise navigates to page
  // Mobile always uses page mode for better UX (modals are awkward on small screens)
  const handleGridVideoClick = (video: VideoResponse) => {
    const videoDetailsView = useTableSettingsStore.getState().videoDetailsView;

    // Mobile override: always use page mode regardless of setting
    if (!isMobile && videoDetailsView === "modal") {
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
        <div className="text-muted-foreground">Lädt Videos...</div>
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
      aria-label="Video-Bereich mit Drag-and-Drop Unterstützung"
      className="relative mx-auto w-full max-w-[2180px] px-1.5 py-2 md:p-8"
      onDrop={handleNativeDrop}
      role="region"
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
              <h1 className="font-bold text-3xl text-foreground">
                {channels.find((c) => c.id === selectedChannelId)?.name ||
                  "Kanal"}
              </h1>
              <p className="mt-1 text-muted-foreground text-sm">
                {totalVideos} {totalVideos === 1 ? "Video" : "Videos"} in dieser
                Liste
              </p>
            </div>
          ) : selectedTags.length > 0 ? (
            <div>
              <h1 className="font-bold text-3xl text-foreground">
                {selectedTags.map((t) => t.name).join(", ")}
              </h1>
              <p className="mt-1 text-muted-foreground text-sm">
                {totalVideos} {totalVideos === 1 ? "Video" : "Videos"} in dieser
                Liste
              </p>
            </div>
          ) : (
            <div>
              <h1 className="font-bold text-3xl text-foreground">
                Alle Videos
              </h1>
              <p className="mt-1 text-muted-foreground text-sm">
                {totalVideos} {totalVideos === 1 ? "Video" : "Videos"} in dieser
                Liste
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
          {/* YouTube-style Add Button - Quick Add Shortcut (Task #30) - Desktop only */}
          {FEATURE_FLAGS.SHOW_ADD_PLUS_ICON_BUTTON && (
            <button
              aria-label="Video hinzufügen"
              className="hidden items-center gap-2 rounded-full bg-secondary px-4 py-2.5 font-medium text-secondary-foreground transition-colors hover:bg-accent md:flex"
              onClick={handleQuickAdd}
            >
              <Plus className="h-5 w-5" strokeWidth={2.5} />
              <span>Add</span>
            </button>
          )}
        </div>
      </div>

      {/* Mobile Floating Action Button */}
      {FEATURE_FLAGS.SHOW_ADD_PLUS_ICON_BUTTON && (
        <button
          aria-label="Video hinzufügen"
          className="fixed right-4 bottom-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-105 active:scale-95 md:hidden"
          onClick={handleQuickAdd}
        >
          <Plus className="h-6 w-6" strokeWidth={2.5} />
        </button>
      )}

      {/* Filter and View Controls Bar - Hidden on mobile */}
      <div className="mb-6 hidden items-center gap-4 md:flex">
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
                aria-hidden="true"
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
                aria-hidden="true"
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
              <button onClick={() => void retryHistory()} type="button">
                Erneut versuchen
              </button>
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
          className="mb-6 rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800"
          onSubmit={handleAddVideo}
        >
          <h2 className="mb-4 font-semibold text-gray-900 text-lg dark:text-gray-100">
            Neues Video hinzufügen
          </h2>
          <div className="space-y-4">
            <div>
              <label
                className="mb-1 block font-medium text-gray-700 text-sm dark:text-gray-300"
                htmlFor="video-url"
              >
                YouTube-URL *
              </label>
              <input
                autoFocus
                className={`w-full border px-3 py-2 ${
                  urlError
                    ? "border-red-500"
                    : "border-gray-300 dark:border-gray-600"
                } rounded-lg bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-100 dark:placeholder-gray-400`}
                id="video-url"
                onChange={(e) => setNewVideoUrl(e.target.value)}
                placeholder="https://www.youtube.com/watch?v=..."
                required
                type="text"
                value={newVideoUrl}
              />
              {urlError && (
                <p className="mt-1 text-red-600 text-sm dark:text-red-400">
                  {urlError}
                </p>
              )}
              <p className="mt-1 text-gray-500 text-sm dark:text-gray-400">
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
              className="rounded-lg bg-gray-300 px-4 py-2 text-gray-700 transition-colors hover:bg-gray-400 dark:bg-gray-600 dark:text-gray-200 dark:hover:bg-gray-500"
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
        <div className="rounded-lg border border-border bg-card py-12 text-center">
          <p className="text-lg text-muted-foreground">
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
        <VideoTable
          handleClearSort={handleClearSort}
          handleSortChange={handleSortChange}
          onDeleteVideo={handleGridDeleteClick}
          onVideoClick={handleGridVideoClick}
          sortBy={sortBy}
          sortOrder={sortOrder}
          videos={videos as VideoResponse[]}
        />
      )}

      {importPolling.error && (
        <div role="alert">
          {importPolling.error}
          <button onClick={importPolling.retry} type="button">
            Erneut prüfen
          </button>
        </div>
      )}
      <VideoPagination
        onPage={setPage}
        page={page}
        pageSize={pageSize}
        shown={videos.length}
        total={totalVideos}
      />

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
        listId={listId}
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
export { VideoThumbnail } from "./videos/VideoThumbnail";
