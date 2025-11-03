import { useState, useMemo } from 'react'
import {
  useReactTable,
  createColumnHelper,
  flexRender,
  getCoreRowModel,
} from '@tanstack/react-table'
import axios from 'axios'
import { useVideos, useCreateVideo, useDeleteVideo, exportVideosCSV } from '@/hooks/useVideos'
import { CSVUpload } from './CSVUpload'
// import { useWebSocket } from '@/hooks/useWebSocket' // Temporarily commented for Task 1.7
import { ProgressBar } from './ProgressBar'
import { formatDuration } from '@/utils/formatDuration'
import type { VideoResponse } from '@/types/video'
import { CollapsibleSidebar } from '@/components/CollapsibleSidebar'
import { TagNavigation } from '@/components/TagNavigation'
import { TableSettingsDropdown } from './TableSettingsDropdown'
import { useTags } from '@/hooks/useTags'
import { useTagStore } from '@/stores/tagStore'
import { useShallow } from 'zustand/react/shallow'
import { FEATURE_FLAGS } from '@/config/featureFlags'

const columnHelper = createColumnHelper<VideoResponse>()

// YouTube URL validation regex
const YOUTUBE_URL_PATTERN = /^(https:\/\/(www\.|m\.)?youtube\.com\/watch\?v=[\w-]{11}|https:\/\/youtu\.be\/[\w-]{11}|https:\/\/(www\.)?youtube\.com\/embed\/[\w-]{11})$/

interface VideosPageProps {
  listId: string
}

// VideoThumbnail component with React state for error handling
const VideoThumbnail = ({ url, title }: { url: string | null; title: string }) => {
  const [hasError, setHasError] = useState(false)

  // Placeholder SVG component
  const Placeholder = () => (
    <div className="w-32 aspect-video bg-gray-100 rounded flex items-center justify-center">
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
      className="w-32 aspect-video object-cover rounded shadow-sm"
      onError={() => setHasError(true)}
    />
  )
}

export const VideosPage = ({ listId }: VideosPageProps) => {
  const [isAdding, setIsAdding] = useState(false)
  const [newVideoUrl, setNewVideoUrl] = useState('')
  const [urlError, setUrlError] = useState<string | null>(null)
  const [isUploadingCSV, setIsUploadingCSV] = useState(false)

  // Tag integration
  const { data: tags = [], isLoading: tagsLoading, error: tagsError } = useTags()
  // Use useShallow to prevent re-renders when selectedTagIds array has same values
  const selectedTagIds = useTagStore(useShallow((state) => state.selectedTagIds))
  const toggleTag = useTagStore((state) => state.toggleTag)
  const clearTags = useTagStore((state) => state.clearTags)

  // Compute selected tags (no useMemo - simple filter is fast enough per React docs)
  const selectedTags = tags.filter(tag => selectedTagIds.includes(tag.id))

  // Extract tag names for API filtering
  const selectedTagNames = selectedTags.map(tag => tag.name)

  // Fetch videos filtered by selected tag names (OR logic)
  const { data: videos = [], isLoading, error } = useVideos(
    listId,
    selectedTagNames.length > 0 ? selectedTagNames : undefined
  )
  const createVideo = useCreateVideo(listId)
  const deleteVideo = useDeleteVideo(listId)

  // Create tag placeholder handler
  const handleCreateTag = () => {
    console.log('Create tag clicked - will be implemented in later task')
  }

  // WebSocket hook for real-time progress updates
  // TEMPORARILY DISABLED: Causes flicker due to heartbeat re-renders
  // Will be re-enabled when background jobs are implemented (Task 8/9)
  // const { jobProgress, reconnecting, historyError } = useWebSocket()
  const jobProgress = new Map()
  const reconnecting = false
  const historyError = null

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

  const columns = useMemo(
    () => [
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
          const youtubeUrl = `https://www.youtube.com/watch?v=${row.youtube_id}`

          return (
            <div className="flex flex-col gap-1 min-w-[200px] max-w-[400px]">
              <a
                href={youtubeUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-gray-900 hover:text-blue-600 hover:underline line-clamp-2 leading-tight"
                title={title}
              >
                {title}
              </a>
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

      // Column 4: Actions
      columnHelper.accessor('id', {
        id: 'actions',
        header: 'Aktionen',
        cell: (info) => (
          <button
            onClick={() => {
              if (window.confirm('Video wirklich löschen?')) {
                deleteVideo.mutate(info.getValue())
              }
            }}
            className="px-3 py-1 text-sm text-red-600 hover:text-red-800 hover:bg-red-50 rounded transition-colors"
          >
            Löschen
          </button>
        ),
      }),
    ],
    [deleteVideo]
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
      await createVideo.mutateAsync({ url: newVideoUrl })
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
            <h1 className="text-3xl font-bold text-gray-900">Videos</h1>
            {selectedTags.length > 0 && (
              <p className="text-sm text-gray-600 mt-1">
                Gefiltert nach: {selectedTags.map(t => t.name).join(', ')}
                <button
                  onClick={clearTags}
                  className="ml-2 text-blue-600 hover:text-blue-800 text-xs"
                >
                  (Filter entfernen)
                </button>
              </p>
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
              {table.getRowModel().rows.map((row) => (
                <tr key={row.id} className="hover:bg-gray-50 transition-colors">
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-6 py-4">
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {videos.length > 0 && (
        <div className="mt-4 text-sm text-gray-600">
          {videos.length} Video{videos.length !== 1 ? 's' : ''} in dieser Liste
        </div>
      )}
        </div>
      </div>
    </div>
  )
}
