import type { ProgressUpdate } from "../hooks/useWebSocket";
import { ProgressBar } from "./ProgressBar";

export interface JobProgressCardProps {
  job: ProgressUpdate;
}

/**
 * JobProgressCard - Displays individual job progress with ProgressBar
 *
 * Shows job ID, status, progress bar, and error messages.
 */
export function JobProgressCard({ job }: JobProgressCardProps) {
  return (
    <div
      className="rounded-lg bg-white shadow-md transition-shadow duration-200 hover:shadow-lg"
      data-testid={`job-card-${job.job_id}`}
    >
      {/* Card Header */}
      <div className="border-gray-200 border-b px-4 pt-4 pb-2">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-gray-900 text-sm">
            Job {job.job_id.slice(0, 8)}
          </h3>
          {job.video_id && (
            <span className="text-gray-500 text-xs">
              Video: {job.video_id.slice(0, 8)}
            </span>
          )}
        </div>
      </div>

      {/* Card Body - ProgressBar */}
      <div className="p-4">
        <ProgressBar progress={job} />
      </div>
    </div>
  );
}
