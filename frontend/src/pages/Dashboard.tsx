import { useWebSocket } from '../hooks/useWebSocket';
import { ReadyState } from 'react-use-websocket';
import { JobProgressCard } from '../components/JobProgressCard';
import { ConnectionStatusBanner } from '../components/ConnectionStatusBanner';

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
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <h1 className="text-2xl font-bold text-gray-900">
            Job Progress Dashboard
          </h1>
        </div>
      </header>

      {/* Connection Status Banner */}
      <ConnectionStatusBanner readyState={readyState} reconnecting={reconnecting} />

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {jobs.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500 text-lg">
              No active jobs. Upload a CSV to start processing videos.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {jobs.map((job) => (
              <JobProgressCard key={job.job_id} job={job} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
