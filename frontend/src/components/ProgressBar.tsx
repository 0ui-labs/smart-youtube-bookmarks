import { useId } from "react";
import type { ProgressUpdate } from "../hooks/useWebSocket";

export interface ProgressBarProps {
  progress: ProgressUpdate;
}

const statusColors = {
  pending: "bg-gray-400",
  processing: "bg-blue-500",
  completed: "bg-green-500",
  failed: "bg-red-500",
  completed_with_errors: "bg-amber-500",
};

const statusBadgeClasses = {
  pending: "bg-gray-100 text-gray-800 border border-gray-300",
  processing: "bg-blue-50 text-blue-900 border border-blue-200",
  completed: "bg-green-50 text-green-900 border border-green-200",
  failed: "bg-red-50 text-red-900 border border-red-200",
  completed_with_errors: "bg-amber-50 text-amber-900 border border-amber-300",
};

const statusLabels = {
  pending: "Pending",
  processing: "Processing",
  completed: "Completed",
  failed: "Failed",
  completed_with_errors: "Completed with errors",
};

const statusIcons = {
  pending: "⏳",
  processing: "⚙️",
  completed: "✓",
  failed: "✗",
  completed_with_errors: "⚠️",
};

export function ProgressBar({ progress }: ProgressBarProps) {
  const progressId = useId();
  const messageId = useId();

  // Validate and clamp progress value to [0, 100] range
  // Handles NaN, negative values, and values above 100
  const clampedProgress = Math.max(0, Math.min(100, progress.progress || 0));

  const colorClass = statusColors[progress.status];
  const badgeClass = statusBadgeClasses[progress.status];
  const statusLabel = statusLabels[progress.status];
  const statusIcon = statusIcons[progress.status];

  return (
    <div className="progress-bar-container mb-4 rounded-lg bg-white p-4 shadow">
      {/* Header: Message and Percentage */}
      <div className="mb-2 flex items-center justify-between">
        <span className="font-medium text-gray-700 text-sm" id={messageId}>
          {progress.message}
        </span>
        <span className="font-bold text-gray-900 text-sm">
          {clampedProgress}%
        </span>
      </div>

      {/* Progress Track and Fill */}
      <div
        aria-labelledby={messageId}
        aria-valuemax={100}
        aria-valuemin={0}
        aria-valuenow={clampedProgress}
        className="progress-track mb-2 h-3 w-full rounded-full bg-gray-200"
        id={progressId}
        role="progressbar"
      >
        <div
          className={`progress-fill ${colorClass} h-full rounded-full motion-safe:transition-all motion-safe:duration-300 motion-reduce:transition-none`}
          style={{ width: `${clampedProgress}%` }}
        />
      </div>

      {/* Footer: Video Counter and Status Badge */}
      <div className="flex items-center justify-between">
        <span className="text-gray-600 text-xs">
          {progress.current_video}/{progress.total_videos} videos
        </span>
        <span
          className={`rounded px-2 py-1 font-semibold text-xs ${badgeClass}`}
        >
          <span aria-hidden="true">{statusIcon}</span> {statusLabel}
        </span>
      </div>

      {/* Live Region for Screen Reader Announcements */}
      <div
        aria-atomic="true"
        aria-live="polite"
        className="sr-only"
        role="status"
      >
        {progress.message} - {clampedProgress}% complete. Processing video{" "}
        {progress.current_video} of {progress.total_videos}.
      </div>

      {/* Error Message (if present) */}
      {progress.error && (
        <div
          aria-live="assertive"
          className="error-message mt-3 rounded border border-red-200 bg-red-50 p-2 text-red-900 text-sm"
          role="alert"
        >
          <span className="font-semibold">Error:</span> {progress.error}
        </div>
      )}
    </div>
  );
}
