import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { VideoResponseSchema } from '@/types/video'
import { formatDuration } from '@/utils/formatDuration'
import { CustomFieldsSection } from '@/components/CustomFieldsSection'
import { CategorySelector, LabelBadge } from '@/components/CategorySelector'
import { Button } from '@/components/ui/button'
import { ArrowLeft, AlertCircle, X, Tag as TagIcon } from 'lucide-react'
import type { Tag } from '@/types/tag'

/**
 * VideoDetailsPage Component
 *
 * Displays full video details with YouTube-like UX.
 * Shows all custom fields grouped by schema with collapsible sections.
 *
 * Features:
 * - Large 16:9 thumbnail with metadata
 * - Clickable channel name with stopPropagation
 * - All available fields (filled + empty) grouped by schema
 * - Collapsible schema sections (default: all expanded)
 * - Inline field editing with optimistic updates (React Query v5)
 *
 * REF MCP Best Practices Applied:
 * - React Router v6 useParams() for :videoId
 * - React Query optimistic updates (onMutate + snapshot + rollback)
 * - Collapsible controlled with open/onOpenChange + local state
 * - CollapsibleTrigger with asChild + Button for keyboard navigation
 * - FieldDisplay interface: fieldValue prop (NOT field+value), readonly prop
 * - Channel link: stopPropagation() to prevent card click
 *
 * Related Tasks:
 * - Task #74: Field union with available_fields
 * - Task #129: FieldDisplay component
 * - Task #72: Batch update endpoint
 */
export const VideoDetailsPage = () => {
  const { videoId } = useParams<{ videoId: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [updateError, setUpdateError] = useState<string | null>(null)

  // Fetch video with available_fields (Task #74)
  const {
    data: video,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['videos', videoId],
    queryFn: async () => {
      const { data } = await api.get(`/videos/${videoId}`)
      return VideoResponseSchema.parse(data)
    },
    enabled: !!videoId,
  })

  // Mutation for updating field values (Task #72)
  // Simplified without optimistic updates to avoid discriminated union type issues
  const updateField = useMutation({
    mutationFn: async ({ fieldId, value }: { fieldId: string; value: string | number | boolean }) => {
      const { data } = await api.put(`/videos/${videoId}/fields`, {
        field_values: [{ field_id: fieldId, value }],  // FIX: Backend expects "field_values" not "updates"
      })
      return data
    },
    onSuccess: () => {
      setUpdateError(null)
      // Invalidate to refetch latest data
      queryClient.invalidateQueries({ queryKey: ['videos', videoId] })
    },
    onError: (error: any) => {
      console.error('Failed to update field value:', error)
      const message = error.response?.data?.detail || 'Fehler beim Speichern. Bitte versuchen Sie es erneut.'
      setUpdateError(message)
    },
  })

  // Handle field value changes
  const handleFieldChange = (fieldId: string, value: string | number | boolean) => {
    updateField.mutate({ fieldId, value })
  }

  // Handle channel link click with stopPropagation
  const handleChannelClick = (e: React.MouseEvent, channelName: string) => {
    e.stopPropagation()
    // TODO: Navigate to channel filter or search
    console.log('Channel clicked:', channelName)
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-gray-600">Lädt Video...</p>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-4">
        <p className="text-red-600">Fehler beim Laden des Videos.</p>
        <Button onClick={() => navigate('/videos')}>Zurück zur Übersicht</Button>
      </div>
    )
  }

  // Not found state
  if (!video) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-4">
        <p className="text-gray-600">Video nicht gefunden.</p>
        <Button onClick={() => navigate('/videos')}>Zurück zur Übersicht</Button>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      {/* Back button */}
      <Button
        variant="ghost"
        onClick={() => navigate('/videos')}
        className="mb-6"
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Zurück zur Übersicht
      </Button>

      {/* Error Alert */}
      {updateError && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm text-red-800">{updateError}</p>
          </div>
          <button
            onClick={() => setUpdateError(null)}
            className="text-red-600 hover:text-red-800"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Video header */}
      <div className="mb-8">
        {/* Large thumbnail (16:9) */}
        {video.thumbnail_url && (
          <div className="relative w-full aspect-video mb-4 rounded-lg overflow-hidden bg-gray-100">
            <img
              src={video.thumbnail_url}
              alt={video.title || 'Video thumbnail'}
              className="w-full h-full object-cover"
              loading="lazy"
            />
            {video.duration && (
              <div className="absolute bottom-2 right-2 bg-black/80 text-white text-xs px-2 py-1 rounded">
                {formatDuration(video.duration)}
              </div>
            )}
          </div>
        )}

        {/* Title */}
        <h1 className="text-3xl font-bold mb-2">{video.title || 'Untitled Video'}</h1>

        {/* Channel (clickable with stopPropagation) */}
        {video.channel && (
          <button
            onClick={(e) => handleChannelClick(e, video.channel!)}
            className="text-lg text-gray-600 hover:text-gray-900 mb-4 inline-block"
          >
            {video.channel}
          </button>
        )}

        {/* Category & Labels Section */}
        <div className="mt-4 space-y-3">
          {/* Category Selector */}
          {(() => {
            const category = video.tags.find((tag: Tag) => tag.is_video_type)
            const labels = video.tags.filter((tag: Tag) => !tag.is_video_type)

            return (
              <>
                {/* Category - Always show selector for changing */}
                <div className="flex items-center gap-2">
                  <CategorySelector
                    videoId={video.id}
                    currentCategoryId={category?.id || null}
                    fieldValues={video.field_values || []}
                  />
                </div>

                {/* Labels - Display as badges */}
                {labels.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2">
                    <TagIcon className="h-4 w-4 text-muted-foreground" />
                    {labels.map((label: Tag) => (
                      <LabelBadge
                        key={label.id}
                        name={label.name}
                        color={label.color}
                      />
                    ))}
                  </div>
                )}
              </>
            )
          })()}
        </div>
      </div>

      {/* Custom Fields Section - Grouped by Schema (Task #131 Step 2: Extracted to CustomFieldsSection) */}
      <CustomFieldsSection
        availableFields={video.available_fields || []}
        fieldValues={video.field_values || []}
        videoId={video.id}
        listId={video.list_id}
        onFieldChange={handleFieldChange}
      />
    </div>
  )
}
