import { useState, useMemo, useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  useReactTable,
  createColumnHelper,
  flexRender,
  getCoreRowModel,
} from '@tanstack/react-table'
import axios from 'axios'
import { useVideos, useCreateVideo, useDeleteVideo, exportVideosCSV, useAssignTags } from '@/hooks/useVideos'
import { CSVUpload } from './CSVUpload'
import { useWebSocket } from '@/hooks/useWebSocket'
import { ProgressBar } from './ProgressBar'
import { formatDuration } from '@/utils/formatDuration'
import type { VideoResponse } from '@/types/video'
import { CollapsibleSidebar } from '@/components/CollapsibleSidebar'
import { TagNavigation } from '@/components/TagNavigation'
import { TableSettingsDropdown } from './TableSettingsDropdown'
import { ConfirmDeleteModal } from './ConfirmDeleteModal'
import { CreateTagDialog } from './CreateTagDialog'
import { useTags } from '@/hooks/useTags'
import { useTagStore } from '@/stores/tagStore'
import { useTableSettingsStore } from '@/stores/tableSettingsStore'
import { useShallow } from 'zustand/react/shallow'
import { FEATURE_FLAGS } from '@/config/featureFlags'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu'

const columnHelper = createColumnHelper<VideoResponse>()

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
const VideoThumbnail = ({ url, title }: { url: string | null; title: string }) => {
  const [hasError, setHasError] = useState(false)
  const thumbnailSize = useTableSettingsStore((state) => state.thumbnailSize)

  // REF MCP Improvement #3: Full class strings for Tailwind PurgeCSS
  // Object mapping ensures all classes are detected at build time (no dynamic concatenation)
  // xlarge uses w-[500px] for YouTube's standard list view thumbnail size (500x280)
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

  // Placeholder SVG component with dynamic sizing
  const Placeholder = () => (
    <div className={placeholderSizeClasses[thumbnailSize]}>
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
  return (
    <img
      src={url}
      alt={title}
      loading="lazy"
      className={sizeClasses[thumbnailSize]}
      onError={() => setHasError(true)}
    />
  )
}

export const VideosPage = ({ listId }: VideosPageProps) => {
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
  const [isCreateTagDialogOpen, setIsCreateTagDialogOpen] = useState(false)

  // Tag integration
  const { data: tags = [], isLoading: tagsLoading, error: tagsError } = useTags()
  // Use useShallow to prevent re-renders when selectedTagIds array has same values
  const selectedTagIds = useTagStore(useShallow((state) => state.selectedTagIds))
  const toggleTag = useTagStore((state) => state.toggleTag)
  const clearTags = useTagStore((state) => state.clearTags)
  const setSelectedTagIds = useTagStore((state) => state.setSelectedTagIds)

  // Compute selected tags (no useMemo - simple filter is fast enough per React docs)
  const selectedTags = tags.filter(tag => selectedTagIds.includes(tag.id))

  // Extract tag names for API filtering
  const selectedTagNames = selectedTags.map(tag => tag.name)

  // Fetch videos filtered by selected tag names (OR logic)
  // No polling needed - single videos get metadata synchronously
  // Bulk uploads use WebSocket for live updates
  const { data: videos = [], isLoading, error, refetch } = useVideos(
    listId,
    selectedTagNames.length > 0 ? selectedTagNames : undefined
  )
  const createVideo = useCreateVideo(listId)
  const assignTags = useAssignTags()

  // WebSocket for bulk upload progress (optional - bulk uploads now work without it too)
  // Disabled for now to prevent unnecessary re-renders
  // const { jobProgress, reconnecting, historyError } = useWebSocket()
  const jobProgress = new Map()
  const reconnecting = false
  const historyError = null

  const deleteVideo = useDeleteVideo(listId)

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

  // Create tag handler - opens dialog
  const handleCreateTag = () => {
    setIsCreateTagDialogOpen(true)
  }

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

  const columns = useMemo(
    () => {
      const allColumns = [
        // Column 1: Thumbnail (with Aspect Ratio + Loading State)
        columnHelper.accessor('thumbnail_url', {
          id: 'thumbnail',
          header: 'Vorschau',
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
          header: 'Titel',
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
          header: 'Dauer',
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
    [visibleColumns]
  )

  const table = useReactTable({
    data: videos,
    columns,
    getCoreRowModel: getCoreRowModel(),
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

  // Quick add handler for Plus icon button
  const handleQuickAdd = () => {
    // TODO: Implement enhanced quick-add functionality (e.g., modal with minimal fields)
    // For now, use existing add video form
    setIsAdding(true)
  }

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
    <div className="flex h-screen">
      {/* Sidebar with TagNavigation */}
      <CollapsibleSidebar>
        {tagsLoading ? (
          <div className="p-4 text-sm text-gray-500">Tags werden geladen...</div>
        ) : tagsError ? (
          <div className="p-4 text-sm text-red-600">Fehler beim Laden der Tags</div>
        ) : (
          <TagNavigation
            tags={tags}
            selectedTagIds={selectedTagIds}
            onTagSelect={toggleTag}
            onTagCreate={handleCreateTag}
          />
        )}
      </CollapsibleSidebar>

      {/* Main content area */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-7xl mx-auto p-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            {selectedTags.length > 0 ? (
              <div>
                <h1 className="text-3xl font-bold text-gray-900">
                  {selectedTags.map(t => t.name).join(', ')}
                </h1>
                <button
                  onClick={clearTags}
                  className="mt-1 text-sm text-blue-600 hover:text-blue-800"
                >
                  Alle Videos anzeigen
                </button>
              </div>
            ) : (
              <h1 className="text-3xl font-bold text-gray-900">Alle Videos</h1>
            )}
          </div>
        {/* Action Buttons - Feature Flag Controlled (Task #24) */}
        <div className="flex gap-2">
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
          {/* Plus Icon Button - Quick Add Shortcut (Task #30) */}
          {FEATURE_FLAGS.SHOW_ADD_PLUS_ICON_BUTTON && (
            <Button
              variant="ghost"
              size="icon"
              onClick={handleQuickAdd}
              aria-label="Video hinzufügen"
            >
              <Plus className="h-4 w-4" />
            </Button>
          )}
          {/* Table Settings Dropdown */}
          <TableSettingsDropdown />
        </div>
      </div>

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

      {/* Progress Dashboard */}
      {jobProgress.size > 0 && (
        <div className="mb-8 p-6 bg-white border border-gray-200 rounded-lg shadow-sm">
          <h2 className="text-xl font-semibold mb-4 text-gray-800">
            Active Jobs ({jobProgress.size})
          </h2>
          <div className="space-y-4">
            {Array.from(jobProgress.values()).map((progress) => (
              <ProgressBar key={progress.job_id} progress={progress} />
            ))}
          </div>
        </div>
      )}

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
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <th
                      key={header.id}
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
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
            <tbody className="bg-white divide-y divide-gray-200">
              {table.getRowModel().rows.map((row) => {
                const video = row.original
                const youtubeUrl = `https://www.youtube.com/watch?v=${video.youtube_id}`

                const handleRowClick = () => {
                  window.open(youtubeUrl, '_blank', 'noopener,noreferrer')
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

      {videos.length > 0 && (
        <div className="mt-4 text-sm text-gray-600">
          {videos.length} Video{videos.length !== 1 ? 's' : ''} in dieser Liste
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

      {/* Create Tag Dialog */}
      <CreateTagDialog
        open={isCreateTagDialogOpen}
        onOpenChange={setIsCreateTagDialogOpen}
      />
        </div>
      </div>
    </div>
  )
}
