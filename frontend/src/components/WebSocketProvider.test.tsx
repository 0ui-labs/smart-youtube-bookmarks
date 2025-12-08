/**
 * Tests for WebSocketProvider component
 * TDD RED phase - Tests written BEFORE implementation
 */

import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { WebSocketProvider } from "./WebSocketProvider";

// Mock the useWebSocket hook
const mockUseWebSocket = vi.fn();
vi.mock("@/hooks/useWebSocket", () => ({
  useWebSocket: () => mockUseWebSocket(),
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

  it("provides connection context to children", () => {
    // This test verifies the provider doesn't crash and children render
    render(
      <WebSocketProvider>
        <div>Content</div>
      </WebSocketProvider>
    );

    expect(screen.getByText("Content")).toBeInTheDocument();
  });
});
