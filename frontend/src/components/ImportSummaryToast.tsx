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
  const isSuccess = !hasWarnings && !hasErrors;

  // Choose status color
  const statusColor = hasErrors
    ? 'text-red-500'
    : hasWarnings
    ? 'text-amber-500'
    : 'text-green-500';

  // Build summary message parts
  const parts: string[] = [];

  // Main import count (singular/plural)
  const videoWord = successful === 1 ? 'Video' : 'Videos';
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
      role="status"
      className="flex items-start gap-3 p-4 rounded-lg bg-white shadow-lg border"
    >
      {/* Status Icon */}
      <div className={`flex-shrink-0 ${statusColor}`}>
        {isSuccess ? (
          // Checkmark icon
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        ) : hasErrors ? (
          // Error icon
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        ) : (
          // Warning icon
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        )}
      </div>

      {/* Message */}
      <div className="flex-1">
        <p className="text-sm font-medium text-gray-900">
          Import abgeschlossen
        </p>
        <p className="text-sm text-gray-600">
          {parts.join(', ')}
        </p>
      </div>
    </div>
  );
}
