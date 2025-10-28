import { useState, useMemo } from 'react'
import {
  useReactTable,
  createColumnHelper,
  flexRender,
  getCoreRowModel,
} from '@tanstack/react-table'
import { useVideos, useCreateVideo, useDeleteVideo } from '@/hooks/useVideos'
import type { VideoResponse } from '@/types/video'

const columnHelper = createColumnHelper<VideoResponse>()

// YouTube URL validation regex
const YOUTUBE_URL_PATTERN = /^(https?:\/\/)?(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|m\.youtube\.com\/watch\?v=)[\w-]{11}/

const getStatusColor = (status: VideoResponse['processing_status']) => {
  switch (status) {
    case 'pending':
      return 'bg-yellow-100 text-yellow-800'
    case 'processing':
      return 'bg-blue-100 text-blue-800'
    case 'completed':
      return 'bg-green-100 text-green-800'
    case 'failed':
      return 'bg-red-100 text-red-800'
    default:
      return 'bg-gray-100 text-gray-800'
  }
}

const getStatusLabel = (status: VideoResponse['processing_status']) => {
  switch (status) {
    case 'pending':
      return 'Ausstehend'
    case 'processing':
      return 'Verarbeitung'
    case 'completed':
      return 'Abgeschlossen'
    case 'failed':
      return 'Fehler'
    default:
      return status
  }
}

interface VideosPageProps {
  listId: string
  onBack: () => void
}

export const VideosPage = ({ listId, onBack }: VideosPageProps) => {
  const [isAdding, setIsAdding] = useState(false)
  const [newVideoUrl, setNewVideoUrl] = useState('')
  const [urlError, setUrlError] = useState<string | null>(null)

  const { data: videos = [], isLoading, error } = useVideos(listId)
  const createVideo = useCreateVideo(listId)
  const deleteVideo = useDeleteVideo(listId)

  const columns = useMemo(
    () => [
      columnHelper.accessor('thumbnail_url', {
        header: 'Vorschau',
        cell: (info) => {
          const url = info.getValue()
          const title = info.row.original.title || 'Video'
          return url ? (
            <img
              src={url}
              alt={title}
              className="w-32 h-18 object-cover rounded"
              loading="lazy"
            />
          ) : (
            <div className="w-32 h-18 bg-gray-200 rounded flex items-center justify-center text-xs text-gray-500">
              Kein Bild
            </div>
          )
        },
      }),
      columnHelper.accessor('title', {
        header: 'Titel',
        cell: (info) => {
          const title = info.getValue()
          const youtubeId = info.row.original.youtube_id
          const youtubeUrl = `https://www.youtube.com/watch?v=${youtubeId}`

          return (
            <div className="flex flex-col gap-1">
              <a
                href={youtubeUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-blue-600 hover:text-blue-800 hover:underline"
              >
                {title || <span className="italic text-gray-400">Titel wird geladen...</span>}
              </a>
              {info.row.original.channel_name && (
                <span className="text-sm text-gray-500">
                  {info.row.original.channel_name}
                </span>
              )}
            </div>
          )
        },
      }),
      columnHelper.accessor('duration_seconds', {
        header: 'Dauer',
        cell: (info) => {
          const seconds = info.getValue()
          if (!seconds) {
            return <span className="text-sm text-gray-400">-</span>
          }
          const minutes = Math.floor(seconds / 60)
          const remainingSeconds = seconds % 60
          return (
            <span className="text-sm text-gray-600">
              {minutes}:{remainingSeconds.toString().padStart(2, '0')}
            </span>
          )
        },
      }),
      columnHelper.accessor('processing_status', {
        header: 'Status',
        cell: (info) => {
          const status = info.getValue()
          return (
            <span
              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(
                status
              )}`}
            >
              {getStatusLabel(status)}
            </span>
          )
        },
      }),
      columnHelper.accessor('created_at', {
        header: 'Hinzugefügt',
        cell: (info) => (
          <span className="text-sm text-gray-500">
            {new Date(info.getValue()).toLocaleDateString('de-DE')}
          </span>
        ),
      }),
      columnHelper.accessor('id', {
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
    <div className="max-w-7xl mx-auto p-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <button
            onClick={onBack}
            className="text-blue-600 hover:text-blue-800 mb-2 text-sm"
          >
            ← Zurück zu Listen
          </button>
          <h1 className="text-3xl font-bold text-gray-900">Videos</h1>
        </div>
        <button
          onClick={() => setIsAdding(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Video hinzufügen
        </button>
      </div>

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
  )
}
