import { useWebSocket } from '../hooks/useWebSocket';
import { ReadyState } from 'react-use-websocket';
import { JobProgressCard } from '../components/JobProgressCard';

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

  // Connection status
  const isConnected = readyState === ReadyState.OPEN;
  const isConnecting = readyState === ReadyState.CONNECTING;

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
      {isConnecting && (
        <div className="bg-yellow-50 border-b border-yellow-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2">
            <p className="text-sm text-yellow-800">
              ⏳ Connecting to progress feed...
            </p>
          </div>
        </div>
      )}

      {reconnecting && (
        <div className="bg-orange-50 border-b border-orange-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2">
            <p className="text-sm text-orange-800">
              🔄 Connection lost. Reconnecting...
            </p>
          </div>
        </div>
      )}

      {isConnected && !reconnecting && (
        <div className="bg-green-50 border-b border-green-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2">
            <p className="text-sm text-green-800">
              ✓ Connected - Live updates enabled
            </p>
          </div>
        </div>
      )}

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
