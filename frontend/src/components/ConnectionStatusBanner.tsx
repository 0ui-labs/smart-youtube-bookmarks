import { ReadyState } from 'react-use-websocket';

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
export function ConnectionStatusBanner({ readyState, reconnecting }: ConnectionStatusBannerProps) {
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
      <div className="bg-yellow-50 border-b border-yellow-200" role="status" aria-live="polite">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2">
          <p className="text-sm text-yellow-800">
            <span aria-hidden="true">⏳</span> Connecting to progress feed...
          </p>
        </div>
      </div>
    );
  }

  if (isReconnecting) {
    return (
      <div className="bg-orange-50 border-b border-orange-200" role="status" aria-live="polite">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2">
          <p className="text-sm text-orange-800">
            <span aria-hidden="true">🔄</span> Connection lost. Reconnecting...
          </p>
        </div>
      </div>
    );
  }

  if (isConnected) {
    return (
      <div className="bg-green-50 border-b border-green-200" role="status" aria-live="polite">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2">
          <p className="text-sm text-green-800">
            <span aria-hidden="true">✓</span> Connected - Live updates enabled
          </p>
        </div>
      </div>
    );
  }

  if (isDisconnected) {
    return (
      <div className="bg-red-50 border-b border-red-200" role="alert" aria-live="assertive">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2">
          <p className="text-sm text-red-800">
            <span aria-hidden="true">✗</span> Disconnected - Live updates paused
          </p>
        </div>
      </div>
    );
  }

  return null;
}
