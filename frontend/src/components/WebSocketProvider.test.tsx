/**
 * Tests for WebSocketProvider component
 * TDD RED phase - Tests written BEFORE implementation
 */

import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useWebSocket } from "@/hooks/useWebSocket";
import { WebSocketProvider } from "./WebSocketProvider";

// Mock the useWebSocket hook
const mockUseWebSocket = vi.fn();
vi.mock("@/hooks/useWebSocket", async (original) => ({
  ...(await original<typeof import("@/hooks/useWebSocket")>()),
  useProgressConnection: () => mockUseWebSocket(),
}));

describe("WebSocketProvider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseWebSocket.mockReturnValue({
      isConnected: true,
      readyState: 1,
      reconnecting: false,
      jobProgress: new Map(),
      sendJsonMessage: vi.fn(),
      authStatus: "authenticated",
      historyError: null,
    });
  });

  it("renders children", () => {
    render(
      <WebSocketProvider>
        <div data-testid="child">Child content</div>
      </WebSocketProvider>
    );

    expect(screen.getByTestId("child")).toBeInTheDocument();
    expect(screen.getByText("Child content")).toBeInTheDocument();
  });

  it("establishes WebSocket connection on mount", () => {
    render(
      <WebSocketProvider>
        <div>Content</div>
      </WebSocketProvider>
    );

    // useWebSocket should have been called to establish connection
    expect(mockUseWebSocket).toHaveBeenCalled();
  });

  it("shares one connection with multiple consumers", () => {
    function Consumer() {
      const { isConnected } = useWebSocket();
      return <span>{isConnected ? "Verbunden" : "Getrennt"}</span>;
    }
    render(
      <WebSocketProvider>
        <Consumer />
        <Consumer />
      </WebSocketProvider>
    );
    expect(screen.getAllByText("Verbunden")).toHaveLength(2);
    expect(mockUseWebSocket).toHaveBeenCalledTimes(1);
  });
});
