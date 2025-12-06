import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, ArrowLeft, Info, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ChannelInfo } from "@/components/ChannelInfo";
import { CustomFieldsModal } from "@/components/CustomFieldsModal";
import { EnrichmentStatus } from "@/components/EnrichmentStatus";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { VideoPlayer } from "@/components/VideoPlayer";
import {
  useRetryEnrichment,
  useVideoEnrichment,
} from "@/hooks/useVideoEnrichment";
import { useSetVideoCategory } from "@/hooks/useVideos";
import { api } from "@/lib/api";
import { getLanguageLabel } from "@/lib/enrichmentUtils";
import type { TextTrack } from "@/types/player";
import { VideoResponseSchema } from "@/types/video";

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
  const { videoId } = useParams<{ videoId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [isFieldsModalOpen, setIsFieldsModalOpen] = useState(false);

  // Fetch video with available_fields (Task #74)
  const {
    data: video,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["videos", videoId],
    queryFn: async () => {
      const { data } = await api.get(`/videos/${videoId}`);
      return VideoResponseSchema.parse(data);
    },
    enabled: !!videoId,
  });

  // Enrichment data (captions, chapters)
  const { data: enrichment, isLoading: isEnrichmentLoading } =
    useVideoEnrichment(videoId, { enabled: !!videoId });

  const retryEnrichment = useRetryEnrichment();

  // Generate text tracks from enrichment data with proper cleanup
  const [textTracks, setTextTracks] = useState<TextTrack[]>([]);
  const blobUrlsRef = useRef<string[]>([]);

  useEffect(() => {
    // Cleanup previous blob URLs
    blobUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    blobUrlsRef.current = [];

    const tracks: TextTrack[] = [];

    if (enrichment?.captions_vtt) {
      // Create a blob URL from VTT content
      const blob = new Blob([enrichment.captions_vtt], { type: "text/vtt" });
      const src = URL.createObjectURL(blob);
      blobUrlsRef.current.push(src);

      tracks.push({
        src,
        label: getLanguageLabel(
          enrichment.captions_language,
          enrichment.captions_source
        ),
        language: enrichment.captions_language || "en",
        kind: "captions",
        type: "vtt",
        default: true,
      });
    }

    if (enrichment?.chapters_vtt) {
      const blob = new Blob([enrichment.chapters_vtt], { type: "text/vtt" });
      const src = URL.createObjectURL(blob);
      blobUrlsRef.current.push(src);

      tracks.push({
        src,
        label: "Chapters",
        language: "en",
        kind: "chapters",
        type: "vtt",
        default: true,
      });
    }

    setTextTracks(tracks);

    // Cleanup on unmount
    return () => {
      blobUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
      blobUrlsRef.current = [];
    };
  }, [
    enrichment?.captions_vtt,
    enrichment?.captions_language,
    enrichment?.captions_source,
    enrichment?.chapters_vtt,
  ]);

  // Mutation for updating field values (Task #72)
  // Simplified without optimistic updates to avoid discriminated union type issues
  const updateField = useMutation({
    mutationFn: async ({
      fieldId,
      value,
    }: {
      fieldId: string;
      value: string | number | boolean;
    }) => {
      const { data } = await api.put(`/videos/${videoId}/fields`, {
        field_values: [{ field_id: fieldId, value }], // FIX: Backend expects "field_values" not "updates"
      });
      return data;
    },
    onSuccess: () => {
      setUpdateError(null);
      // Invalidate to refetch latest data
      queryClient.invalidateQueries({ queryKey: ["videos", videoId] });
    },
    onError: (error: any) => {
      console.error("Failed to update field value:", error);
      const message =
        error.response?.data?.detail ||
        "Fehler beim Speichern. Bitte versuchen Sie es erneut.";
      setUpdateError(message);
    },
  });

  // Handle field value changes
  const handleFieldChange = (
    fieldId: string,
    value: string | number | boolean
  ) => {
    updateField.mutate({ fieldId, value });
  };

  // Category change mutation (Step 5.8)
  const setVideoCategory = useSetVideoCategory();

  // Handle category change
  const handleCategoryChange = (
    categoryId: string | null,
    restoreBackup?: boolean
  ) => {
    if (!videoId) return;

    // TODO: Pass restoreBackup to API when endpoint supports it
    setVideoCategory.mutate(
      { videoId, categoryId, restoreBackup },
      {
        onSuccess: () => {
          setUpdateError(null);
        },
        onError: (error: any) => {
          const message =
            error.response?.data?.detail ||
            error.message ||
            "Kategorie konnte nicht geändert werden";
          setUpdateError(message);
        },
      }
    );
  };

  // Handle channel link click
  const handleChannelClick = (channelName: string) => {
    // TODO: Navigate to channel filter or search
    console.log("Channel clicked:", channelName);
  };

  // Get current category (is_video_type=true) and labels (is_video_type=false)
  const currentCategory =
    video?.tags?.find((t: any) => t.is_video_type) ?? null;
  const labels = video?.tags?.filter((t: any) => !t.is_video_type) ?? [];

  // Loading state
  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p className="text-gray-600">Lädt Video...</p>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4">
        <p className="text-red-600">Fehler beim Laden des Videos.</p>
        <Button onClick={() => navigate("/videos")}>
          Zurück zur Übersicht
        </Button>
      </div>
    );
  }

  // Not found state
  if (!video) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4">
        <p className="text-gray-600">Video nicht gefunden.</p>
        <Button onClick={() => navigate("/videos")}>
          Zurück zur Übersicht
        </Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-[1840px] px-4 py-8">
      {/* Back button */}
      <Button
        className="mb-6"
        onClick={() => navigate("/videos")}
        variant="ghost"
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Zurück zur Übersicht
      </Button>

      {/* Error Alert */}
      {updateError && (
        <div className="mb-6 flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4">
          <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-600" />
          <div className="flex-1">
            <p className="text-red-800 text-sm">{updateError}</p>
          </div>
          <button
            className="text-red-600 hover:text-red-800"
            onClick={() => setUpdateError(null)}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Video header */}
      <div className="mb-8">
        {/* Video Player (replaces thumbnail) */}
        <div className="mb-4">
          <VideoPlayer
            initialPosition={video.watch_position}
            key={video.youtube_id}
            textTracks={textTracks}
            thumbnailsVtt={enrichment?.thumbnails_vtt_url}
            thumbnailUrl={video.thumbnail_url}
            videoId={video.id}
            youtubeId={video.youtube_id}
          />
        </div>

        {/* Title */}
        <h1 className="mb-4 font-bold text-3xl">
          {video.title || "Untitled Video"}
        </h1>

        {/* Channel Info with Category (YouTube-style) */}
        <ChannelInfo
          channelAvatarUrl={video.channel_thumbnail_url}
          channelName={video.channel}
          currentCategory={currentCategory}
          isCategoryMutating={setVideoCategory.isPending}
          onCategoryChange={handleCategoryChange}
          onChannelClick={() => handleChannelClick(video.channel!)}
        />

        {/* Labels (only is_video_type=false tags) - Step 5.9 */}
        {labels.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {labels.map((tag: any) => (
              <Badge key={tag.id} variant="secondary">
                {tag.name}
              </Badge>
            ))}
          </div>
        )}
      </div>

      {/* Enrichment Status */}
      <div className="mb-6 flex items-center gap-4">
        <EnrichmentStatus
          enrichment={enrichment}
          isLoading={isEnrichmentLoading}
          isRetrying={retryEnrichment.isPending}
          onRetry={() => retryEnrichment.mutate(video.id)}
        />

        {/* Custom Fields Button */}
        {(video.available_fields?.length ?? 0) > 0 && (
          <Button
            className="flex items-center gap-2"
            onClick={() => setIsFieldsModalOpen(true)}
            size="sm"
            variant="outline"
          >
            <Info className="h-4 w-4" />
            Mehr Informationen
          </Button>
        )}
      </div>

      {/* Custom Fields Modal */}
      <CustomFieldsModal
        availableFields={video.available_fields || []}
        fieldValues={video.field_values || []}
        listId={video.list_id}
        onFieldChange={handleFieldChange}
        onOpenChange={setIsFieldsModalOpen}
        open={isFieldsModalOpen}
        videoId={video.id}
      />
    </div>
  );
};
