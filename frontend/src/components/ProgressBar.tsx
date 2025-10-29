import { useId } from 'react';
import { ProgressUpdate } from '../hooks/useWebSocket';

export interface ProgressBarProps {
  progress: ProgressUpdate;
}

const statusColors = {
  pending: 'bg-gray-400',
  processing: 'bg-blue-500',
  completed: 'bg-green-500',
  failed: 'bg-red-500',
  completed_with_errors: 'bg-amber-500',
};

const statusBadgeClasses = {
  pending: 'bg-gray-100 text-gray-800 border border-gray-300',
  processing: 'bg-blue-50 text-blue-900 border border-blue-200',
  completed: 'bg-green-50 text-green-900 border border-green-200',
  failed: 'bg-red-50 text-red-900 border border-red-200',
  completed_with_errors: 'bg-amber-50 text-amber-900 border border-amber-300',
};

const statusLabels = {
  pending: 'Pending',
  processing: 'Processing',
  completed: 'Completed',
  failed: 'Failed',
  completed_with_errors: 'Completed with errors',
};

const statusIcons = {
  pending: '⏳',
  processing: '⚙️',
  completed: '✓',
  failed: '✗',
  completed_with_errors: '⚠️',
};

export function ProgressBar({ progress }: ProgressBarProps) {
  const progressId = useId();
  const messageId = useId();
  const colorClass = statusColors[progress.status];
  const badgeClass = statusBadgeClasses[progress.status];
  const statusLabel = statusLabels[progress.status];
  const statusIcon = statusIcons[progress.status];

  return (
    <div className="progress-bar-container bg-white rounded-lg shadow p-4 mb-4">
      {/* Header: Message and Percentage */}
      <div className="flex justify-between items-center mb-2">
        <span id={messageId} className="text-sm font-medium text-gray-700">
          {progress.message}
        </span>
        <span className="text-sm font-bold text-gray-900">
          {progress.progress}%
        </span>
      </div>

      {/* Progress Track and Fill */}
      <div
        className="progress-track w-full bg-gray-200 rounded-full h-3 mb-2"
        role="progressbar"
        aria-valuenow={progress.progress}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-labelledby={messageId}
        id={progressId}
      >
        <div
          className={`progress-fill ${colorClass} h-full rounded-full motion-safe:transition-all motion-safe:duration-300 motion-reduce:transition-none`}
          style={{ width: `${progress.progress}%` }}
        />
      </div>

      {/* Footer: Video Counter and Status Badge */}
      <div className="flex justify-between items-center">
        <span className="text-xs text-gray-600">
          {progress.current_video}/{progress.total_videos} videos
        </span>
        <span className={`px-2 py-1 text-xs font-semibold rounded ${badgeClass}`}>
          <span aria-hidden="true">{statusIcon}</span> {statusLabel}
        </span>
      </div>

      {/* Live Region for Screen Reader Announcements */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {progress.message} - {progress.progress}% complete. Processing video{' '}
        {progress.current_video} of {progress.total_videos}.
      </div>

      {/* Error Message (if present) */}
      {progress.error && (
        <div
          role="alert"
          aria-live="assertive"
          className="error-message mt-3 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-900"
        >
          <span className="font-semibold">Error:</span> {progress.error}
        </div>
      )}
    </div>
  );
}
