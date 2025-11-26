import { RefreshCw, Check, AlertCircle, Clock, Loader2 } from 'lucide-react'
import type { EnrichmentResponse, EnrichmentStatus as Status } from '@/types/enrichment'

interface EnrichmentStatusProps {
  enrichment: EnrichmentResponse | null | undefined
  isLoading?: boolean
  onRetry?: () => void
  isRetrying?: boolean
}

const statusConfig: Record<
  Status,
  {
    label: string
    badgeClass: string
    icon: React.ReactNode
  }
> = {
  pending: {
    label: 'Pending',
    badgeClass: 'bg-gray-100 text-gray-800 border border-gray-300',
    icon: <Clock className="w-3 h-3" />,
  },
  processing: {
    label: 'Processing',
    badgeClass: 'bg-blue-50 text-blue-900 border border-blue-200',
    icon: <Loader2 className="w-3 h-3 animate-spin" />,
  },
  completed: {
    label: 'Completed',
    badgeClass: 'bg-green-50 text-green-900 border border-green-200',
    icon: <Check className="w-3 h-3" />,
  },
  partial: {
    label: 'Partial',
    badgeClass: 'bg-amber-50 text-amber-900 border border-amber-300',
    icon: <AlertCircle className="w-3 h-3" />,
  },
  failed: {
    label: 'Failed',
    badgeClass: 'bg-red-50 text-red-900 border border-red-200',
    icon: <AlertCircle className="w-3 h-3" />,
  },
}

/**
 * Displays enrichment processing status with optional retry button.
 *
 * Shows:
 * - Status badge (pending, processing, completed, partial, failed)
 * - Caption language and source when available
 * - Progress message during processing
 * - Error message when failed
 * - Retry button for failed/partial enrichments
 *
 * @example
 * ```tsx
 * const { data: enrichment } = useVideoEnrichment(videoId)
 * const retry = useRetryEnrichment()
 *
 * <EnrichmentStatus
 *   enrichment={enrichment}
 *   onRetry={() => retry.mutate(videoId)}
 *   isRetrying={retry.isPending}
 * />
 * ```
 */
export function EnrichmentStatus({
  enrichment,
  isLoading,
  onRetry,
  isRetrying,
}: EnrichmentStatusProps) {
  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Loader2 className="w-4 h-4 animate-spin" />
        <span>Loading enrichment...</span>
      </div>
    )
  }

  // No enrichment data
  if (!enrichment) {
    return (
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-500">No enrichment data</span>
        {onRetry && (
          <button
            onClick={onRetry}
            disabled={isRetrying}
            className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-blue-600 hover:text-blue-800 disabled:opacity-50"
          >
            {isRetrying ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <RefreshCw className="w-3 h-3" />
            )}
            Start Enrichment
          </button>
        )}
      </div>
    )
  }

  // Don't show anything when enrichment is completed successfully
  if (enrichment.status === 'completed') {
    return null
  }

  const config = statusConfig[enrichment.status]

  return (
    <div className="space-y-2">
      {/* Status Row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {/* Status Badge */}
          <span
            className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold rounded ${config.badgeClass}`}
          >
            {config.icon}
            {config.label}
          </span>
        </div>

        {/* Retry Button */}
        {onRetry && (enrichment.status === 'failed' || enrichment.status === 'partial') && (
          <button
            onClick={onRetry}
            disabled={isRetrying}
            className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-blue-600 hover:text-blue-800 disabled:opacity-50"
          >
            {isRetrying ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <RefreshCw className="w-3 h-3" />
            )}
            Retry
          </button>
        )}
      </div>

      {/* Progress Message */}
      {enrichment.status === 'processing' && enrichment.progress_message && (
        <p className="text-xs text-gray-600">{enrichment.progress_message}</p>
      )}

      {/* Error Message */}
      {enrichment.error_message && (
        <div
          role="alert"
          className="p-2 bg-red-50 border border-red-200 rounded text-xs text-red-900"
        >
          <span className="font-semibold">Error:</span> {enrichment.error_message}
        </div>
      )}
    </div>
  )
}

/**
 * Compact version for display in video cards or lists.
 */
export function EnrichmentStatusBadge({
  status,
}: {
  status: Status | undefined
}) {
  if (!status) return null

  const config = statusConfig[status]

  return (
    <span
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 text-xs font-medium rounded ${config.badgeClass}`}
      title={`Enrichment: ${config.label}`}
    >
      {config.icon}
    </span>
  )
}
