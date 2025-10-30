import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { Dashboard } from './Dashboard';
import { ReadyState } from 'react-use-websocket';

// Mock dependencies
vi.mock('../hooks/useWebSocket', () => ({
  useWebSocket: vi.fn(() => ({
    jobProgress: new Map(),
    isConnected: false,
    reconnecting: false,
    readyState: ReadyState.CONNECTING,
    sendJsonMessage: vi.fn(),
    authStatus: 'pending',
    historyError: null,
  })),
}));

describe('Dashboard', () => {
  it('renders dashboard title', () => {
    render(<Dashboard />);
    expect(screen.getByText('Job Progress Dashboard')).toBeInTheDocument();
  });

  it('shows connection status', () => {
    render(<Dashboard />);
    expect(screen.getByText(/Connecting/i)).toBeInTheDocument();
  });

  it('shows empty state when no jobs', () => {
    render(<Dashboard />);
    expect(screen.getByText(/No active jobs/i)).toBeInTheDocument();
  });
});
