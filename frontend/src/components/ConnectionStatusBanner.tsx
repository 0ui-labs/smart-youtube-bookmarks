import { ReadyState } from "react-use-websocket";

export interface ConnectionStatusBannerProps {
  readyState: ReadyState;
  reconnecting: boolean;
}

/**
 * ConnectionStatusBanner - Visual indicator for WebSocket connection status
 *
 * Displays colored banner with connection state:
 * - Yellow: Connecting (initial connection)
 * - Orange: Reconnecting (connection lost, retrying)
 * - Green: Connected (live updates active)
 * - Red: Disconnected (no connection, stopped retrying)
 */
export function ConnectionStatusBanner({
  readyState,
  reconnecting,
}: ConnectionStatusBannerProps) {
  // Don't show banner if WebSocket not instantiated
  if (readyState === ReadyState.UNINSTANTIATED) {
    return null;
  }

  // Determine banner state
  const isConnecting = readyState === ReadyState.CONNECTING && !reconnecting;
  const isConnected = readyState === ReadyState.OPEN && !reconnecting;
  const isReconnecting = reconnecting;
  const isDisconnected = readyState === ReadyState.CLOSED && !reconnecting;

  if (isConnecting) {
    return (
      <div
        aria-live="polite"
        className="border-yellow-200 border-b bg-yellow-50"
        role="status"
      >
        <div className="mx-auto max-w-7xl px-4 py-2 sm:px-6 lg:px-8">
          <p className="text-sm text-yellow-800">
            <span aria-hidden="true">⏳</span> Connecting to progress feed...
          </p>
        </div>
      </div>
    );
  }

  if (isReconnecting) {
    return (
      <div
        aria-live="polite"
        className="border-orange-200 border-b bg-orange-50"
        role="status"
      >
        <div className="mx-auto max-w-7xl px-4 py-2 sm:px-6 lg:px-8">
          <p className="text-orange-800 text-sm">
            <span aria-hidden="true">🔄</span> Connection lost. Reconnecting...
          </p>
        </div>
      </div>
    );
  }

  if (isConnected) {
    return (
      <div
        aria-live="polite"
        className="border-green-200 border-b bg-green-50"
        role="status"
      >
        <div className="mx-auto max-w-7xl px-4 py-2 sm:px-6 lg:px-8">
          <p className="text-green-800 text-sm">
            <span aria-hidden="true">✓</span> Connected - Live updates enabled
          </p>
        </div>
      </div>
    );
  }

  if (isDisconnected) {
    return (
      <div
        aria-live="assertive"
        className="border-red-200 border-b bg-red-50"
        role="alert"
      >
        <div className="mx-auto max-w-7xl px-4 py-2 sm:px-6 lg:px-8">
          <p className="text-red-800 text-sm">
            <span aria-hidden="true">✗</span> Disconnected - Live updates paused
          </p>
        </div>
      </div>
    );
  }

  return null;
}
