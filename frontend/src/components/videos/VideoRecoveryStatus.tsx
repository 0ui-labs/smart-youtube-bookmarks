export function VideoRecoveryStatus({
  reconnecting,
  hasActiveJobs,
  historyError,
  retryHistory,
}: {
  reconnecting: boolean;
  hasActiveJobs: boolean;
  historyError: string | null;
  retryHistory: () => Promise<void>;
}) {
  return (
    <>
      {/* WebSocket Connection Status Banner - Only show when jobs are active */}
      {reconnecting && hasActiveJobs && (
        <div className="mb-6 rounded-lg border-yellow-400 border-l-4 bg-yellow-50 p-4">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <svg
                aria-hidden="true"
                className="h-5 w-5 animate-spin text-yellow-400"
                fill="none"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  fill="currentColor"
                />
              </svg>
            </div>
            <div className="ml-3">
              <p className="font-medium text-sm text-yellow-800">
                Verbindung zu Fortschritts-Updates wird wiederhergestellt...
              </p>
            </div>
          </div>
        </div>
      )}

      {/* History Error Display */}
      {historyError && (
        <div
          className="mb-6 rounded-lg border-red-400 border-l-4 bg-red-50 p-4"
          role="alert"
        >
          <div className="flex">
            <div className="flex-shrink-0">
              <svg
                aria-hidden="true"
                className="h-5 w-5 text-red-400"
                fill="currentColor"
                viewBox="0 0 20 20"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  clipRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                  fillRule="evenodd"
                />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="font-medium text-red-800 text-sm">
                Fehler beim Laden der Verlaufshistorie
              </h3>
              <p className="mt-1 text-red-700 text-sm">{historyError}</p>
              <button onClick={() => void retryHistory()} type="button">
                Erneut versuchen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Job-level progress removed - individual video progress is shown on thumbnails */}
    </>
  );
}
