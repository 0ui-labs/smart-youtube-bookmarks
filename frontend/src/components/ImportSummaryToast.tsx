/**
 * ImportSummaryToast Component
 *
 * Displays a summary of import results in a toast notification.
 * Shows total imported, videos without captions, and failed imports.
 *
 * Examples:
 * - "47 Videos importiert"
 * - "47 Videos importiert, 3 ohne Untertitel"
 * - "45 Videos importiert, 2 ohne Untertitel, 3 fehlgeschlagen"
 */

export interface ImportResult {
  total: number;
  successful: number;
  withoutCaptions: number;
  failed: number;
}

interface ImportSummaryToastProps {
  result: ImportResult;
}

export function ImportSummaryToast({ result }: ImportSummaryToastProps) {
  const { successful, withoutCaptions, failed } = result;

  // Determine overall status
  const hasWarnings = withoutCaptions > 0;
  const hasErrors = failed > 0;
  const isSuccess = !(hasWarnings || hasErrors);

  // Choose status color
  const statusColor = hasErrors
    ? "text-red-500"
    : hasWarnings
      ? "text-amber-500"
      : "text-green-500";

  // Build summary message parts
  const parts: string[] = [];

  // Main import count (singular/plural)
  const videoWord = successful === 1 ? "Video" : "Videos";
  parts.push(`${successful} ${videoWord} importiert`);

  // Add warnings
  if (withoutCaptions > 0) {
    parts.push(`${withoutCaptions} ohne Untertitel`);
  }

  // Add errors
  if (failed > 0) {
    parts.push(`${failed} fehlgeschlagen`);
  }

  return (
    <div
      className="flex items-start gap-3 rounded-lg border bg-white p-4 shadow-lg"
      role="status"
    >
      {/* Status Icon */}
      <div className={`flex-shrink-0 ${statusColor}`}>
        {isSuccess ? (
          // Checkmark icon
          <svg
            className="h-6 w-6"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            viewBox="0 0 24 24"
          >
            <path
              d="M5 13l4 4L19 7"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        ) : hasErrors ? (
          // Error icon
          <svg
            className="h-6 w-6"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            viewBox="0 0 24 24"
          >
            <path
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        ) : (
          // Warning icon
          <svg
            className="h-6 w-6"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            viewBox="0 0 24 24"
          >
            <path
              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </div>

      {/* Message */}
      <div className="flex-1">
        <p className="font-medium text-gray-900 text-sm">
          Import abgeschlossen
        </p>
        <p className="text-gray-600 text-sm">{parts.join(", ")}</p>
      </div>
    </div>
  );
}
