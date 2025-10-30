import { ProgressBar } from './ProgressBar';
import type { ProgressUpdate } from '../hooks/useWebSocket';

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
      className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow duration-200"
      data-testid={`job-card-${job.job_id}`}
    >
      {/* Card Header */}
      <div className="px-4 pt-4 pb-2 border-b border-gray-200">
        <div className="flex justify-between items-center">
          <h3 className="text-sm font-semibold text-gray-900">
            Job {job.job_id.slice(0, 8)}
          </h3>
          {job.video_id && (
            <span className="text-xs text-gray-500">
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
