import React, { useState, useMemo, useEffect, useCallback } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import {
  useReactTable,
  createColumnHelper,
  flexRender,
  getCoreRowModel,
} from '@tanstack/react-table'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import { api } from '@/lib/api'
import { useVideos, useCreateVideo, useDeleteVideo, exportVideosCSV, useAssignTags, useBulkUploadVideos } from '@/hooks/useVideos'
import { useVideoDropZone, type ParsedDropData } from '@/hooks/useVideoDropZone'
import { DropZoneOverlay } from '@/components/DropZoneOverlay'
import { ImportPreviewModal } from '@/components/ImportPreviewModal'
import { createCSVFromUrls, parseUrlsFromText } from '@/utils/urlParser'
import { useImportDropStore } from '@/stores/importDropStore'
import { useVideosFilter } from '@/hooks/useVideosFilter'
import { useFieldFilterStore } from '@/stores/fieldFilterStore'
import { FilterBar } from '@/components/videos/FilterBar'
import { FilterSettingsModal } from '@/components/videos/FilterSettingsModal'
import { CSVUpload } from './CSVUpload'
import { formatDuration } from '@/utils/formatDuration'
import type { VideoResponse } from '@/types/video'
import { useChannels } from '@/hooks/useChannels'
import { TableSettingsDropdown } from './TableSettingsDropdown'
import { ConfirmDeleteModal } from './ConfirmDeleteModal'
import { VideoDetailsModal } from './VideoDetailsModal'
import { ViewModeToggle } from './ViewModeToggle'
import { VideoGrid } from './VideoGrid'
import { useTags } from '@/hooks/useTags'
import { useTagStore } from '@/stores/tagStore'
import { useTableSettingsStore } from '@/stores/tableSettingsStore'
import { useShallow } from 'zustand/react/shallow'
import { FEATURE_FLAGS } from '@/config/featureFlags'
import { useWebSocket } from '@/hooks/useWebSocket'
import { Plus } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu'
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '@/components/ui/carousel'

// Note: VideoResponse type has optional field_values, but TanStack Table needs explicit type
// Using Partial to handle cases where backend doesn't return all fields in list view
type VideoListItem = Omit<VideoResponse, 'field_values' | 'available_fields'> & {
  field_values?: VideoResponse['field_values']
  available_fields?: VideoResponse['available_fields']
}

const columnHelper = createColumnHelper<VideoListItem>()

// Tag Carousel Component with conditional arrow display
const TagCarousel = () => {
  const dummyTags = ['Python', 'JavaScript', 'React', 'Machine Learning', 'Web Development', 'Tutorial', 'Backend', 'Database', 'API', 'DevOps', 'Security', 'Testing']
  const [api, setApi] = React.useState<any>()
  const [canScrollPrev, setCanScrollPrev] = React.useState(false)
  const [canScrollNext, setCanScrollNext] = React.useState(false)

  React.useEffect(() => {
    if (!api) return

    const updateScrollState = () => {
      setCanScrollPrev(api.canScrollPrev())
      setCanScrollNext(api.canScrollNext())
    }

    updateScrollState()
    api.on('select', updateScrollState)
    api.on('reInit', updateScrollState)

    return () => {
      api.off('select', updateScrollState)
    }
  }, [api])

  return (
    <Carousel
      setApi={setApi}
      opts={{
        align: "start",
        slidesToScroll: 3,
      }}
      className="w-full max-w-[calc(100vw-400px)]"
    >
      <div className="flex items-center gap-2">
        {canScrollPrev && (
          <CarouselPrevious className="static translate-y-0 h-8 w-8 flex-shrink-0" />
        )}
        <CarouselContent className="-ml-2">
          {dummyTags.map((tag) => (
            <CarouselItem key={tag} className="pl-2 basis-auto">
              <button
                className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-full transition-colors whitespace-nowrap"
              >
                {tag}
              </button>
            </CarouselItem>
          ))}
        </CarouselContent>
        {canScrollNext && (
          <CarouselNext className="static translate-y-0 h-8 w-8 flex-shrink-0" />
        )}
      </div>
    </Carousel>
  )
}

// YouTube URL validation regex
const YOUTUBE_URL_PATTERN = /^(https:\/\/(www\.|m\.)?youtube\.com\/watch\?v=[\w-]{11}|https:\/\/youtu\.be\/[\w-]{11}|https:\/\/(www\.)?youtube\.com\/embed\/[\w-]{11})$/

interface VideosPageProps {
  listId: string
}

// VideoThumbnail component with React state for error handling
// REF MCP Improvement #1: Use existing component (extend, not recreate)
// REF MCP Improvement #3: Object mapping for Tailwind PurgeCSS compatibility
// REF MCP Improvement #5: w-48 for large (not w-64) for smoother progression
// REF MCP Improvement #6: Placeholder also scales dynamically
// Task #35 Fix: Add useFullWidth prop for Grid mode (container-adapted sizing)
const VideoThumbnail = ({ url, title, useFullWidth = false }: { url: string | null; title: string; useFullWidth?: boolean }) => {
  const [hasError, setHasError] = useState(false)
  const thumbnailSize = useTableSettingsStore((state) => state.thumbnailSize)

  // REF MCP Improvement #3: Full class strings for Tailwind PurgeCSS
  // Object mapping ensures all classes are detected at build time (no dynamic concatenation)
  // xlarge uses w-[500px] for YouTube's standard list view thumbnail size (500x280)
  // Task #35 Fix: List mode uses thumbnailSize, Grid mode uses w-full (container-adapted)
  const sizeClasses = {
    small: 'w-32 aspect-video object-cover rounded shadow-sm',
    medium: 'w-40 aspect-video object-cover rounded shadow-sm',
    large: 'w-48 aspect-video object-cover rounded shadow-sm',
    xlarge: 'w-[500px] aspect-video object-cover rounded shadow-sm',
  } as const

  const placeholderSizeClasses = {
    small: 'w-32 aspect-video bg-gray-100 rounded flex items-center justify-center',
    medium: 'w-40 aspect-video bg-gray-100 rounded flex items-center justify-center',
    large: 'w-48 aspect-video bg-gray-100 rounded flex items-center justify-center',
    xlarge: 'w-[500px] aspect-video bg-gray-100 rounded flex items-center justify-center',
  } as const

  // Task #35 Fix: Grid mode uses w-full for container-adapted sizing
  const fullWidthClasses = 'w-full aspect-video object-cover rounded shadow-sm'
  const fullWidthPlaceholderClasses = 'w-full aspect-video bg-gray-100 rounded flex items-center justify-center'

  // Placeholder SVG component with dynamic sizing
  const Placeholder = () => (
    <div className={useFullWidth ? fullWidthPlaceholderClasses : placeholderSizeClasses[thumbnailSize]}>
      <svg className="w-8 h-8 text-gray-400" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
      </svg>
    </div>
  )

  // No URL or error occurred - show placeholder
  if (!url || hasError) {
    return <Placeholder />
  }

  // Show image with error handling
  // Task #35 Fix: Use fullWidthClasses in Grid mode, sizeClasses in List mode
  return (
    <img
      src={url}
      alt={title}
      loading="lazy"
      className={useFullWidth ? fullWidthClasses : sizeClasses[thumbnailSize]}
      onError={() => setHasError(true)}
    />
  )
}

export const VideosPage = ({ listId }: VideosPageProps) => {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [isAdding, setIsAdding] = useState(false)
  const [newVideoUrl, setNewVideoUrl] = useState('')
  const [urlError, setUrlError] = useState<string | null>(null)
  const [isUploadingCSV, setIsUploadingCSV] = useState(false)
  const [deleteModal, setDeleteModal] = useState<{
    open: boolean
    videoId: string | null
    videoTitle: string | null
  }>({
    open: false,
    videoId: null,
    videoTitle: null,
  })

  // Channel filter state (YouTube Channels feature)
  // Initialize from URL immediately to prevent fetching all videos first
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(() => {
    return searchParams.get('channel')
  })

  // Video Details Modal state (follows pattern of ConfirmDeleteModal)
  const [videoDetailsModal, setVideoDetailsModal] = useState<{
    open: boolean
    video: VideoResponse | null
  }>({
    open: false,
    video: null,
  })

  // Drag & Drop Import state (Steps 19-23)
  const [importPreviewModal, setImportPreviewModal] = useState<{
    open: boolean
    urls: string[]
  }>({
    open: false,
    urls: [],
  })

  // Polling state for real-time updates after import
  // When true, refetch videos frequently until all are processed
  const [isPolling, setIsPolling] = useState(false)
  const [pendingVideoIds, setPendingVideoIds] = useState<string[]>([])
  const POLLING_INTERVAL = 500 // 500ms for snappy updates

  // Tag integration
  const { data: tags = [] } = useTags()
  // Channels query (YouTube Channels feature)
  const { data: channels = [] } = useChannels()
  // Use useShallow to prevent re-renders when selectedTagIds array has same values
  const selectedTagIds = useTagStore(useShallow((state) => state.selectedTagIds))
  const setSelectedTagIds = useTagStore((state) => state.setSelectedTagIds)

  // Compute selected tags with useMemo for referential stability
  // This prevents useEffect dependencies from changing on every render
  const selectedTags = useMemo(
    () => tags.filter(tag => selectedTagIds.includes(tag.id)),
    [tags, selectedTagIds]
  )

  // Query client for cache invalidation
  const queryClient = useQueryClient()

  // Mutation for updating field values in video detail modal
  const updateField = useMutation({
    mutationFn: async ({ videoId, fieldId, value }: { videoId: string; fieldId: string; value: string | number | boolean }) => {
      const { data } = await api.put(`/videos/${videoId}/fields`, {
        field_values: [{ field_id: fieldId, value }],  // FIX: Backend expects "field_values" not "updates"
      })
      return data
    },
    onMutate: async ({ videoId, fieldId, value }) => {
      // Cancel outgoing refetches to avoid race conditions
      await queryClient.cancelQueries({ queryKey: ['video-detail', videoId] })
      await queryClient.cancelQueries({ queryKey: ['videos', listId] })

      // Snapshot previous value for rollback
      const previousVideoDetail = queryClient.getQueryData(['video-detail', videoId])
      const previousVideosList = queryClient.getQueryData(['videos', listId])

      // Optimistically update video detail cache
      queryClient.setQueryData(['video-detail', videoId], (old: VideoResponse | undefined) => {
        if (!old) return old
        return {
          ...old,
          field_values: old.field_values?.map((fv) =>
            fv.field_id === fieldId ? { ...fv, value } : fv
          ) ?? [],
        }
      })

      // Optimistically update videos list cache
      queryClient.setQueryData(['videos', listId], (old: VideoResponse[] | undefined) => {
        if (!old) return old
        return old.map((video) =>
          video.id === videoId
            ? {
                ...video,
                field_values: video.field_values?.map((fv) =>
                  fv.field_id === fieldId ? { ...fv, value } : fv
                ) ?? [],
              }
            : video
        )
      })

      return { previousVideoDetail, previousVideosList }
    },
    onSuccess: (_data, variables) => {
      // Invalidate queries to refetch and sync with server state
      queryClient.invalidateQueries({ queryKey: ['video-detail', variables.videoId] })
      queryClient.invalidateQueries({ queryKey: ['videos', listId] })
    },
    onError: (error: any, variables, context) => {
      // Rollback optimistic updates on error
      if (context?.previousVideoDetail) {
        queryClient.setQueryData(['video-detail', variables.videoId], context.previousVideoDetail)
      }
      if (context?.previousVideosList) {
        queryClient.setQueryData(['videos', listId], context.previousVideosList)
      }

      // Log error and notify user
      console.error('Failed to update field value:', error)
      // TODO: Replace console.error with toast notification
      // toast.error('Failed to update field value')
      alert('Failed to update field value. Please try again.')
    },
  })

  // Handle field value changes from video detail modal
  const handleFieldChange = (fieldId: string, value: string | number | boolean) => {
    if (videoDetailsModal.video) {
      updateField.mutate({
        videoId: videoDetailsModal.video.id,
        fieldId,
        value,
      })
    }
  }

  // Extract tag names for API filtering (memoized to prevent unnecessary query key changes)
  const selectedTagNames = useMemo(
    () => selectedTags.map(tag => tag.name),
    [selectedTags]
  )

  // TASK 4: Parse sort parameters from URL query params
  const sortBy = searchParams.get('sort_by') || undefined
  const sortOrderParam = searchParams.get('sort_order')
  const sortOrder: 'asc' | 'desc' = sortOrderParam === 'desc' ? 'desc' : 'asc'

  // Get active field-based filters from store
  const activeFilters = useFieldFilterStore((state) => state.activeFilters)
  const removeFilter = useFieldFilterStore((state) => state.removeFilter)

  // Cleanup: Remove filters with invalid fieldIds (e.g., stale temp IDs from optimistic updates)
  useEffect(() => {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    activeFilters.forEach((filter) => {
      if (!uuidRegex.test(filter.fieldId)) {
        console.warn(`Removing filter with invalid fieldId: ${filter.fieldId}`)
        removeFilter(filter.id)
      }
    })
  }, []) // Run once on mount to clean up stale data

  // Fetch videos with both tag filters and field filters
  // Falls back to useVideos if no field filters are active
  const hasFieldFilters = activeFilters.length > 0
  const hasTagFilters = selectedTagNames.length > 0
  const hasChannelFilter = selectedChannelId !== null

  // Use new filter hook if any filters are active, otherwise fallback to old hook
  const { data: filteredVideos = [], isLoading: filterLoading, error: filterError } = useVideosFilter({
    listId,
    tags: hasTagFilters ? selectedTagNames : undefined,
    channelId: hasChannelFilter ? selectedChannelId : undefined,
    fieldFilters: hasFieldFilters ? activeFilters : undefined,
    sortBy,
    sortOrder,
    enabled: hasFieldFilters || hasTagFilters || hasChannelFilter,
    refetchInterval: isPolling ? POLLING_INTERVAL : undefined,
  })

  const { data: allVideos = [], isLoading: allLoading, error: allError } = useVideos(
    listId,
    {
      tags: undefined,
      sortBy,
      sortOrder,
      refetchInterval: isPolling ? POLLING_INTERVAL : undefined,
    }
  )

  // Use filtered results if filters are active, otherwise show all videos
  const hasAnyFilter = hasFieldFilters || hasTagFilters || hasChannelFilter
  const videos = hasAnyFilter ? filteredVideos : allVideos
  const isLoading = hasAnyFilter ? filterLoading : allLoading
  const error = hasAnyFilter ? filterError : allError
  const createVideo = useCreateVideo(listId)
  const assignTags = useAssignTags()
  const bulkUpload = useBulkUploadVideos(listId)

  // Get existing video IDs for duplicate detection in import preview
  const existingVideoIds = useMemo(
    () => videos.map((v) => v.youtube_id).filter((id): id is string => id !== null),
    [videos]
  )

  // Stop polling when all PENDING videos have been fully processed (import_stage = complete/error)
  // This provides real-time UI updates after import without manual refresh
  useEffect(() => {
    console.log('[Polling] isPolling:', isPolling, 'pendingVideoIds:', pendingVideoIds.length, 'videos.length:', videos.length)
    if (!isPolling || pendingVideoIds.length === 0) return

    // Find the pending videos in the current videos list
    const pendingVideos = videos.filter((video) => pendingVideoIds.includes(video.id))
    console.log('[Polling] Found pending videos:', pendingVideos.length, 'of', pendingVideoIds.length)

    // Check if all pending videos have finished import (complete or error)
    // Videos are "still processing" if import_stage is NOT 'complete' or 'error'
    // Note: Type assertion needed because import_stage may not be in all response types
    const stillProcessing = pendingVideos.filter((video) => {
      const stage = (video as VideoResponse).import_stage || 'created'
      return stage !== 'complete' && stage !== 'error'
    })
    console.log('[Polling] Still processing:', stillProcessing.length, stillProcessing.map(v => `${v.youtube_id}:${(v as VideoResponse).import_stage}`))

    // Only stop polling when we found all pending videos AND they're all done
    if (pendingVideos.length === pendingVideoIds.length && stillProcessing.length === 0) {
      console.log('[Polling] All pending videos processed, stopping polling')
      setIsPolling(false)
      setPendingVideoIds([])
    }
  }, [isPolling, pendingVideoIds, videos])

  // Drag & Drop handler: called when videos are detected
  const handleVideosDetected = useCallback((data: ParsedDropData) => {
    if (data.urls.length === 0) {
      return
    }

    // Open import preview modal with detected URLs
    setImportPreviewModal({
      open: true,
      urls: data.urls,
    })
  }, [])

  // Drag & Drop handler: called when import is confirmed
  const handleImportConfirm = useCallback(
    async (urls: string[], categoryId?: string) => {
      try {
        // Close modal first
        setImportPreviewModal({ open: false, urls: [] })

        if (urls.length === 0) {
          return
        }

        // Create CSV blob from URLs
        const csvBlob = createCSVFromUrls(urls)
        const csvFile = new File([csvBlob], 'import.csv', { type: 'text/csv' })

        // Upload via bulk upload API
        const result = await bulkUpload.mutateAsync(csvFile)

        // Start polling for real-time updates after successful import
        if (result.created_video_ids.length > 0) {
          console.log('[Import] Starting polling for', result.created_video_ids.length, 'videos:', result.created_video_ids)
          setPendingVideoIds(result.created_video_ids)
          setIsPolling(true)
        }

        // If category was selected, assign it to all imported videos
        if (categoryId && result.created_video_ids.length > 0) {
          await Promise.all(
            result.created_video_ids.map((videoId) =>
              assignTags.mutateAsync({ videoId, tagIds: [categoryId] })
            )
          )
        }
      } catch (error) {
        console.error('Failed to import videos:', error)
        // TODO: Add toast notification for error
      }
    },
    [bulkUpload, assignTags, listId]
  )

  // Mobile detection: Disable drag-drop on touch devices (Step 29)
  const isTouchDevice = useMemo(() => {
    if (typeof window === 'undefined') return false
    return 'ontouchstart' in window || navigator.maxTouchPoints > 0
  }, [])

  // Initialize useVideoDropZone hook
  const dropZoneDisabled = !FEATURE_FLAGS.DRAG_DROP_IMPORT || isTouchDevice
  const { isDragging, getRootProps, getInputProps } = useVideoDropZone({
    onVideosDetected: handleVideosDetected,
    disabled: dropZoneDisabled,
  })

  // Listen for pending imports from TagNavigation drops
  const pendingImport = useImportDropStore((state) => state.pendingImport)
  const clearPendingImport = useImportDropStore((state) => state.clearPendingImport)

  // Handle pending imports from TagNavigation drops
  useEffect(() => {
    if (pendingImport) {
      // If category was preselected (dropped on a tag), auto-import without modal
      if (pendingImport.preselectedCategoryId) {
        handleImportConfirm(pendingImport.urls, pendingImport.preselectedCategoryId)
        clearPendingImport()
      } else {
        // No category preselected - show modal for selection
        setImportPreviewModal({
          open: true,
          urls: pendingImport.urls,
        })
      }
    }
  }, [pendingImport, handleImportConfirm, clearPendingImport])

  // WebSocket for bulk upload progress and import progress tracking
  // Provides real-time updates for video enrichment stages (created → metadata → captions → chapters → complete)
  const { jobProgress, reconnecting, historyError } = useWebSocket()

  const deleteVideo = useDeleteVideo(listId)

  // TASK 4: Handlers to update sort state in URL
  const handleSortChange = (newSortBy: string, newSortOrder: 'asc' | 'desc') => {
    const params = new URLSearchParams(searchParams)
    params.set('sort_by', newSortBy)
    params.set('sort_order', newSortOrder)
    setSearchParams(params, { replace: true })
  }

  const handleClearSort = () => {
    const params = new URLSearchParams(searchParams)
    params.delete('sort_by')
    params.delete('sort_order')
    setSearchParams(params, { replace: true })
  }

  // URL Sync: Parse tag names from URL on mount and sync to store
  useEffect(() => {
    const urlTagNames = searchParams.get('tags')
    if (!urlTagNames || tags.length === 0) return

    // Parse comma-separated tag names from URL
    const tagNamesFromUrl = urlTagNames.split(',').map(name => name.trim()).filter(Boolean)

    // Find tag IDs that match the names from URL
    const tagIdsFromUrl = tags
      .filter(tag => tagNamesFromUrl.includes(tag.name))
      .map(tag => tag.id)

    // Only update if different from current selection
    const currentIds = [...selectedTagIds].sort().join(',')
    const urlIds = [...tagIdsFromUrl].sort().join(',')

    if (currentIds !== urlIds && tagIdsFromUrl.length > 0) {
      setSelectedTagIds(tagIdsFromUrl)
    }
  }, [searchParams, tags]) // Run when URL changes or tags are loaded

  // URL Sync: Update URL when selected tags change
  useEffect(() => {
    if (selectedTags.length === 0) {
      // Remove tags param if no tags selected
      if (searchParams.has('tags')) {
        searchParams.delete('tags')
        setSearchParams(searchParams, { replace: true })
      }
    } else {
      // Set tags param with comma-separated tag names
      const tagNames = selectedTags.map(tag => tag.name).sort().join(',')
      const currentTagsParam = searchParams.get('tags')

      if (currentTagsParam !== tagNames) {
        searchParams.set('tags', tagNames)
        setSearchParams(searchParams, { replace: true })
      }
    }
  }, [selectedTags]) // Run when selected tags change

  // URL Sync: Read channel from URL on mount and when URL changes (YouTube Channels feature)
  useEffect(() => {
    const urlChannelId = searchParams.get('channel')

    // If no channel in URL, clear the selection
    if (!urlChannelId) {
      if (selectedChannelId !== null) {
        setSelectedChannelId(null)
      }
      return
    }

    // Wait for channels to load before validating
    if (channels.length === 0) return

    // Verify channel exists and update state
    const channelExists = channels.some(c => c.id === urlChannelId)
    if (channelExists && selectedChannelId !== urlChannelId) {
      setSelectedChannelId(urlChannelId)
    }
  }, [searchParams, channels]) // Run when URL changes or channels are loaded

  // URL Sync: Update URL when selected channel changes
  useEffect(() => {
    // Wait for channels to load before syncing state → URL
    // This prevents removing channel param before we can validate it
    if (channels.length === 0) return

    if (selectedChannelId === null) {
      // Remove channel param if no channel selected
      if (searchParams.has('channel')) {
        const params = new URLSearchParams(searchParams)
        params.delete('channel')
        setSearchParams(params, { replace: true })
      }
    } else {
      // Set channel param
      const currentChannelParam = searchParams.get('channel')
      if (currentChannelParam !== selectedChannelId) {
        const params = new URLSearchParams(searchParams)
        params.set('channel', selectedChannelId)
        setSearchParams(params, { replace: true })
      }
    }
  }, [selectedChannelId, channels.length]) // Run when selected channel changes or channels load

  const handleExportCSV = async () => {
    try {
      await exportVideosCSV(listId)
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const errorMessage = error.response?.data?.detail || 'Fehler beim Exportieren der Videos. Bitte versuchen Sie es erneut.'
        alert(errorMessage)
      } else {
        alert('Fehler beim Exportieren der Videos. Bitte versuchen Sie es erneut.')
      }
    }
  }

  // Get column visibility settings from store
  const visibleColumns = useTableSettingsStore((state) => state.visibleColumns)

  // Get viewMode from store (REF MCP #1: independent from thumbnailSize)
  // REF Improvement #1 (Task #35): Use separate selectors for optimal re-render prevention
  const viewMode = useTableSettingsStore((state) => state.viewMode)
  const setViewMode = useTableSettingsStore((state) => state.setViewMode)

  // Get gridColumns from store (Task #35: Dynamic grid column count)
  const gridColumns = useTableSettingsStore((state) => state.gridColumns)

  const columns = useMemo(
    () => {
      const allColumns = [
        // Column 1: Thumbnail (with Aspect Ratio + Loading State)
        columnHelper.accessor('thumbnail_url', {
          id: 'thumbnail',
          header: 'Vorschau',
          enableSorting: false, // TASK 5: Disable sorting on thumbnail
          cell: (info) => {
            const thumbnailUrl = info.getValue()
            const row = info.row.original
            const title = row.title || `Video ${row.youtube_id}`

            return <VideoThumbnail url={thumbnailUrl} title={title} />
          },
        }),

        // Column 2: Title + Channel
        columnHelper.accessor('title', {
          id: 'title',
          header: ({ column }) => (
            <button
              onClick={column.getToggleSortingHandler()}
              className="flex items-center gap-2 hover:text-blue-600 transition-colors"
            >
              Titel
              {column.getIsSorted() && (
                <span aria-label={column.getIsSorted() === 'asc' ? 'Aufsteigend sortiert' : 'Absteigend sortiert'}>
                  {column.getIsSorted() === 'asc' ? '↑' : '↓'}
                </span>
              )}
            </button>
          ),
          enableSorting: true, // TASK 5: Enable sorting on title
          cell: (info) => {
            const row = info.row.original
            const title = info.getValue() || `Video ${row.youtube_id}`
            const channel = row.channel

            return (
              <div className="flex flex-col gap-1 min-w-[200px] max-w-[400px]">
                <span
                  className="font-medium text-gray-900 line-clamp-2 leading-tight"
                  title={title}
                >
                  {title}
                </span>
                {channel && (
                  <span className="text-sm text-gray-600 truncate">
                    {channel}
                  </span>
                )}
              </div>
            )
          },
        }),

        // Column 3: Duration
        columnHelper.accessor('duration', {
          id: 'duration',
          header: ({ column }) => (
            <button
              onClick={column.getToggleSortingHandler()}
              className="flex items-center gap-2 hover:text-blue-600 transition-colors"
            >
              Dauer
              {column.getIsSorted() && (
                <span aria-label={column.getIsSorted() === 'asc' ? 'Aufsteigend sortiert' : 'Absteigend sortiert'}>
                  {column.getIsSorted() === 'asc' ? '↑' : '↓'}
                </span>
              )}
            </button>
          ),
          enableSorting: true, // TASK 5: Enable sorting on duration
          cell: (info) => {
            const duration = info.getValue()
            return (
              <span className="text-sm text-gray-700 font-mono tabular-nums">
                {formatDuration(duration)}
              </span>
            )
          },
        }),

        // Column 4: Three-dot menu
        columnHelper.accessor('id', {
          id: 'menu',
          header: '', // No header text - just icon column
          cell: (info) => (
            <DropdownMenu modal={false}>
              <DropdownMenuTrigger
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.stopPropagation()
                  }
                }}
                tabIndex={-1}
                className="inline-flex items-center justify-center w-8 h-8 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
                aria-label="Aktionen"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                  <circle cx="12" cy="5" r="2" />
                  <circle cx="12" cy="12" r="2" />
                  <circle cx="12" cy="19" r="2" />
                </svg>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation()
                    const row = info.row.original
                    // REF MCP #3: Smart video title with fallback chain
                    const videoTitle = row.title || `Video ${row.youtube_id}` || 'Unbekanntes Video'
                    setDeleteModal({
                      open: true,
                      videoId: info.getValue() as string,
                      videoTitle: videoTitle,
                    })
                  }}
                  className="text-red-600 focus:text-red-700 cursor-pointer"
                >
                  <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M3 6h18" />
                    <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
                    <line x1="10" y1="11" x2="10" y2="17" />
                    <line x1="14" y1="11" x2="14" y2="17" />
                  </svg>
                  Löschen
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ),
        }),
      ]

      // Filter columns based on visibility settings
      return allColumns.filter((column) => {
        const columnId = column.id as 'thumbnail' | 'title' | 'duration' | 'menu'

        // Map 'menu' column id to 'actions' in store
        if (columnId === 'menu') {
          return visibleColumns.actions
        }

        return visibleColumns[columnId]
      })
    },
    [visibleColumns, sortBy, sortOrder] // TASK 5: Add sort params to dependencies
  )

  // TASK 5: Configure TanStack Table with manual sorting
  const table = useReactTable({
    data: videos as VideoListItem[],
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualSorting: true, // Backend handles sorting
    state: {
      sorting: sortBy
        ? [{ id: sortBy, desc: sortOrder === 'desc' }]
        : [],
    },
    onSortingChange: (updater) => {
      const newSorting = typeof updater === 'function'
        ? updater(sortBy ? [{ id: sortBy, desc: sortOrder === 'desc' }] : [])
        : updater

      if (newSorting.length > 0) {
        const sort = newSorting[0]
        if (sort) {
          handleSortChange(sort.id, sort.desc ? 'desc' : 'asc')
        }
      } else {
        handleClearSort()
      }
    },
  })

  const validateYoutubeUrl = (url: string): boolean => {
    if (!url.trim()) {
      setUrlError('Bitte geben Sie eine YouTube-URL ein')
      return false
    }
    if (!YOUTUBE_URL_PATTERN.test(url)) {
      setUrlError('Ungültige YouTube-URL. Bitte verwenden Sie das Format: https://www.youtube.com/watch?v=...')
      return false
    }
    setUrlError(null)
    return true
  }

  const handleAddVideo = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateYoutubeUrl(newVideoUrl)) {
      return
    }

    try {
      // Create video
      const newVideo = await createVideo.mutateAsync({ url: newVideoUrl })

      // If tags are currently selected (filtered view), auto-assign them to the new video
      if (selectedTagIds.length > 0) {
        await assignTags.mutateAsync({
          videoId: newVideo.id,
          tagIds: selectedTagIds
        })
      }

      setNewVideoUrl('')
      setIsAdding(false)
      setUrlError(null)
    } catch (error: any) {
      // Handle specific errors
      if (error.response?.status === 409) {
        setUrlError('Dieses Video ist bereits in der Liste vorhanden')
      } else if (error.response?.status === 422) {
        setUrlError('Die YouTube-URL konnte nicht verarbeitet werden')
      } else {
        setUrlError('Fehler beim Hinzufügen des Videos. Bitte versuchen Sie es erneut.')
      }
    }
  }

  // Handle delete confirmation from modal
  const handleDeleteConfirm = () => {
    if (!deleteModal.videoId) return

    deleteVideo.mutate(deleteModal.videoId, {
      onSuccess: () => {
        // Close modal after successful delete
        setDeleteModal({ open: false, videoId: null, videoTitle: null })
      },
      onError: (error) => {
        // Keep modal open on error, user can retry or cancel
        console.error('Failed to delete video:', error)
        // TODO: Add toast notification here
      },
    })
  }

  const handleDeleteCancel = () => {
    setDeleteModal({ open: false, videoId: null, videoTitle: null })
  }

  // Handle delete click from Grid View
  const handleGridDeleteClick = (video: VideoResponse) => {
    setDeleteModal({
      open: true,
      videoId: video.id,
      videoTitle: video.title || `Video ${video.youtube_id}` || 'Unbekanntes Video'
    })
  }

  // Handle video card click from Grid View
  // Opens modal if videoDetailsView is 'modal', otherwise navigates to page
  const handleGridVideoClick = (video: VideoResponse) => {
    const videoDetailsView = useTableSettingsStore.getState().videoDetailsView

    if (videoDetailsView === 'modal') {
      setVideoDetailsModal({
        open: true,
        video: video,
      })
    } else {
      // Page mode - navigate to video details page
      navigate(`/videos/${video.id}`)
    }
  }

  // Handle video details modal close
  const handleVideoDetailsModalClose = () => {
    setVideoDetailsModal({
      open: false,
      video: null,
    })
  }

  // Quick add handler for Plus icon button
  const handleQuickAdd = () => {
    // TODO: Implement enhanced quick-add functionality (e.g., modal with minimal fields)
    // For now, use existing add video form
    setIsAdding(true)
  }

  // Handle URL drops directly (react-dropzone only handles file drops)
  // MUST be defined before early returns to satisfy React hooks rules
  const handleNativeDrop = useCallback((e: React.DragEvent) => {
    // Check for files FIRST - macOS includes text/plain when dragging webloc files
    // which would cause us to only detect 1 URL instead of all files
    const hasFiles = e.dataTransfer.files && e.dataTransfer.files.length > 0
    const hasWeblocOrCsv = hasFiles && Array.from(e.dataTransfer.files).some(
      f => f.name.endsWith('.webloc') || f.name.endsWith('.csv')
    )

    if (hasWeblocOrCsv) {
      // Let react-dropzone handle file drops
      getRootProps().onDrop?.(e as React.DragEvent<HTMLElement>)
      return
    }

    // Check for text/URL data (browser URL drag - only if no supported files)
    const text = e.dataTransfer.getData('text/plain') || e.dataTransfer.getData('text/uri-list')
    if (text) {
      const urls = parseUrlsFromText(text)
      if (urls.length > 0) {
        e.preventDefault()
        e.stopPropagation()
        handleVideosDetected({ type: 'youtube-urls', urls })
        return
      }
    }

    // Let react-dropzone handle other file drops
    getRootProps().onDrop?.(e as React.DragEvent<HTMLElement>)
  }, [handleVideosDetected, getRootProps])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-600">Lädt Videos...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-red-600">
          Fehler beim Laden der Videos. Bitte versuchen Sie es später erneut.
        </div>
      </div>
    )
  }

  return (
    <div
      {...getRootProps()}
      onDrop={handleNativeDrop}
      className="w-full max-w-[2180px] mx-auto p-8 relative"
    >
      {/* Hidden file input for react-dropzone */}
      <input {...getInputProps()} />

      {/* Drop Zone Overlay - shown during drag (not on touch devices) */}
      {isDragging && FEATURE_FLAGS.DRAG_DROP_IMPORT && !isTouchDevice && (
        <DropZoneOverlay message="YouTube-URLs hier ablegen" />
      )}

        <div className="flex justify-between items-center mb-4">
          <div>
            {selectedChannelId ? (
              <div>
                <h1 className="text-3xl font-bold text-gray-900">
                  {channels.find(c => c.id === selectedChannelId)?.name || 'Kanal'}
                </h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  {videos.length} {videos.length === 1 ? 'Video' : 'Videos'} in dieser Liste
                </p>
              </div>
            ) : selectedTags.length > 0 ? (
              <div>
                <h1 className="text-3xl font-bold text-gray-900">
                  {selectedTags.map(t => t.name).join(', ')}
                </h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  {videos.length} {videos.length === 1 ? 'Video' : 'Videos'} in dieser Liste
                </p>
              </div>
            ) : (
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Alle Videos</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  {videos.length} {videos.length === 1 ? 'Video' : 'Videos'} in dieser Liste
                </p>
              </div>
            )}
          </div>
        {/* Action Buttons - Feature Flag Controlled (Task #24) */}
        <div className="flex gap-2 items-center">
          {FEATURE_FLAGS.SHOW_CSV_EXPORT_BUTTON && (
            <button
              onClick={handleExportCSV}
              disabled={videos.length === 0}
              className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:bg-gray-400 transition-colors"
              aria-label="Videos als CSV exportieren"
            >
              CSV Export
            </button>
          )}
          {FEATURE_FLAGS.SHOW_CSV_UPLOAD_BUTTON && (
            <button
              onClick={() => setIsUploadingCSV(true)}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
              aria-label="Videos per CSV hochladen"
            >
              CSV Upload
            </button>
          )}
          {FEATURE_FLAGS.SHOW_ADD_VIDEO_BUTTON && (
            <button
              onClick={() => setIsAdding(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              aria-label="Einzelnes Video hinzufügen"
            >
              Video hinzufügen
            </button>
          )}
          {/* YouTube-style Add Button - Quick Add Shortcut (Task #30) */}
          {FEATURE_FLAGS.SHOW_ADD_PLUS_ICON_BUTTON && (
            <button
              onClick={handleQuickAdd}
              className="flex items-center gap-2 px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-900 rounded-full transition-colors font-medium"
              aria-label="Video hinzufügen"
            >
              <Plus className="h-5 w-5" strokeWidth={2.5} />
              <span>Add</span>
            </button>
          )}
        </div>
      </div>

      {/* Filter and View Controls Bar */}
      <div className="flex items-center gap-4 mb-6">
        {/* Left side - Tag filters with carousel */}
        <div className="flex-1 min-w-0">
          <TagCarousel />
        </div>

        {/* Right side - View controls */}
        <div className="flex gap-1 items-center flex-shrink-0 ml-auto">
          {/* Filter Settings Modal - Field-based filters */}
          <FilterSettingsModal listId={listId} selectedTagIds={selectedTagIds} />
          {/* View Mode Toggle - Task #32 */}
          <ViewModeToggle viewMode={viewMode} onToggle={setViewMode} />
          {/* Table Settings Dropdown - Task #35 */}
          <TableSettingsDropdown />
        </div>
      </div>

      {/* Field-Based Filter Bar - Task #145 */}
      <FilterBar listId={listId} />

      {/* WebSocket Connection Status Banner - Only show when jobs are active */}
      {reconnecting && jobProgress.size > 0 && (
        <div className="mb-6 p-4 bg-yellow-50 border-l-4 border-yellow-400 rounded-lg">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-yellow-400 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-yellow-800">
                Verbindung zu Fortschritts-Updates wird wiederhergestellt...
              </p>
            </div>
          </div>
        </div>
      )}

      {/* History Error Display */}
      {historyError && (
        <div role="alert" className="mb-6 p-4 bg-red-50 border-l-4 border-red-400 rounded-lg">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">
                Fehler beim Laden der Verlaufshistorie
              </h3>
              <p className="mt-1 text-sm text-red-700">
                {historyError}
              </p>
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
          onSubmit={handleAddVideo}
          className="mb-6 p-6 border border-gray-200 rounded-lg bg-white shadow-sm"
        >
          <h2 className="text-lg font-semibold mb-4">Neues Video hinzufügen</h2>
          <div className="space-y-4">
            <div>
              <label
                htmlFor="video-url"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                YouTube-URL *
              </label>
              <input
                id="video-url"
                type="text"
                value={newVideoUrl}
                onChange={(e) => setNewVideoUrl(e.target.value)}
                placeholder="https://www.youtube.com/watch?v=..."
                className={`w-full px-3 py-2 border ${
                  urlError ? 'border-red-500' : 'border-gray-300'
                } rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500`}
                autoFocus
                required
              />
              {urlError && (
                <p className="mt-1 text-sm text-red-600">{urlError}</p>
              )}
              <p className="mt-1 text-sm text-gray-500">
                Unterstützte Formate: youtube.com/watch?v=..., youtu.be/..., youtube.com/embed/...
              </p>
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button
              type="submit"
              disabled={createVideo.isPending}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 transition-colors"
            >
              {createVideo.isPending ? 'Wird hinzugefügt...' : 'Hinzufügen'}
            </button>
            <button
              type="button"
              onClick={() => {
                setIsAdding(false)
                setNewVideoUrl('')
                setUrlError(null)
              }}
              className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors"
            >
              Abbrechen
            </button>
          </div>
        </form>
      )}

      {videos.length === 0 ? (
        <div className="text-center py-12 bg-white border border-gray-200 rounded-lg">
          <p className="text-gray-500 text-lg">
            Noch keine Videos in dieser Liste. Fügen Sie Ihr erstes Video hinzu!
          </p>
        </div>
      ) : viewMode === 'grid' ? (
        // Grid View - Task #32, Task #35 (gridColumns), Task #130 (navigation)
        <VideoGrid
          videos={videos as VideoResponse[]}
          gridColumns={gridColumns}
          onDeleteVideo={handleGridDeleteClick}
          onVideoClick={handleGridVideoClick}
        />
      ) : (
        // Table View (existing implementation)
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="hidden">
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <th
                      key={header.id}
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(header.column.columnDef.header, header.getContext())}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {table.getRowModel().rows.map((row) => {
                const video = row.original

                // Use same logic as Grid View: respect videoDetailsView setting
                const handleRowClick = () => {
                  const videoDetailsView = useTableSettingsStore.getState().videoDetailsView

                  if (videoDetailsView === 'modal') {
                    setVideoDetailsModal({
                      open: true,
                      video: video as VideoResponse,
                    })
                  } else {
                    // Page mode - navigate to video details page
                    navigate(`/videos/${video.id}`)
                  }
                }

                const handleKeyDown = (e: React.KeyboardEvent) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    handleRowClick()
                  }
                }

                return (
                  <tr
                    key={row.id}
                    onClick={handleRowClick}
                    onKeyDown={handleKeyDown}
                    role="button"
                    tabIndex={0}
                    className="cursor-pointer hover:bg-gray-50 transition-colors focus:outline-none focus:bg-gray-100"
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="px-6 py-4">
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext()
                        )}
                      </td>
                    ))}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Confirm Delete Modal */}
      <ConfirmDeleteModal
        open={deleteModal.open}
        videoTitle={deleteModal.videoTitle}
        onConfirm={handleDeleteConfirm}
        onCancel={handleDeleteCancel}
        isLoading={deleteVideo.isPending}
      />

      {/* Video Details Modal (follows pattern of ConfirmDeleteModal) */}
      {videoDetailsModal.video && (
        <VideoDetailsModal
          video={videoDetailsModal.video}
          open={videoDetailsModal.open}
          onOpenChange={(open) => {
            if (!open) {
              handleVideoDetailsModalClose()
            }
          }}
          listId={listId}
          onFieldChange={handleFieldChange}
        />
      )}

      {/* Import Preview Modal (Drag & Drop Import feature) */}
      <ImportPreviewModal
        open={importPreviewModal.open}
        onOpenChange={(open) => {
          if (!open) {
            setImportPreviewModal({ open: false, urls: [] })
            clearPendingImport() // Clear pending import from TagNavigation
          }
        }}
        urls={importPreviewModal.urls}
        existingVideoIds={existingVideoIds}
        preselectedCategoryId={pendingImport?.preselectedCategoryId}
        onImport={handleImportConfirm}
      />
    </div>
  )
}

// Export VideoThumbnail for reuse in VideoCard (Task #32)
export { VideoThumbnail }
