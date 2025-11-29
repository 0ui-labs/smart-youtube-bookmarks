/**
 * WebSocketProvider Component
 *
 * Global provider that establishes and maintains the WebSocket connection.
 * Should be placed near the root of the application to ensure:
 * - WebSocket connection is established on app mount
 * - Import progress updates are received and stored in importProgressStore
 * - Connection is shared across all components
 *
 * The actual message handling is done in useWebSocket hook, which updates
 * the importProgressStore directly. This provider just ensures the hook
 * is called and the connection is active.
 */
import type { ReactNode } from "react";
import { useWebSocket } from "@/hooks/useWebSocket";

interface WebSocketProviderProps {
  children: ReactNode;
}

export function WebSocketProvider({ children }: WebSocketProviderProps) {
  // Establish WebSocket connection - this ensures messages are received
  // and routed to the appropriate stores (jobProgress, importProgressStore)
  useWebSocket();

  // Simply render children - the hook handles all the connection logic
  // and store updates. No context needed since stores are global.
  return <>{children}</>;
}
