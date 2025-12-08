import { ConnectionStatusBanner } from "../components/ConnectionStatusBanner";
import { JobProgressCard } from "../components/JobProgressCard";
import { useWebSocket } from "../hooks/useWebSocket";

/**
 * Dashboard Page - Real-time job progress monitoring
 *
 * Displays all active video processing jobs with live progress updates
 * via WebSocket connection.
 */
export function Dashboard() {
  const { jobProgress, readyState, reconnecting } = useWebSocket();

  // Convert Map to Array for rendering
  const jobs = Array.from(jobProgress.values());

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          <h1 className="font-bold text-2xl text-gray-900">
            Job Progress Dashboard
          </h1>
        </div>
      </header>

      {/* Connection Status Banner */}
      <ConnectionStatusBanner
        readyState={readyState}
        reconnecting={reconnecting}
      />

      {/* Main Content */}
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {jobs.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-gray-500 text-lg">
              No active jobs. Upload a CSV to start processing videos.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {jobs.map((job) => (
              <JobProgressCard job={job} key={job.job_id} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
