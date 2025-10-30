import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import App from './App';
import { ReadyState } from 'react-use-websocket';

// Mock dependencies
vi.mock('./hooks/useLists', () => ({
  useLists: vi.fn(() => ({
    data: [],
    isLoading: false,
    error: null,
  })),
  useCreateList: vi.fn(() => vi.fn()),
  useDeleteList: vi.fn(() => vi.fn()),
}));

vi.mock('./hooks/useWebSocket', () => ({
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

describe('App Navigation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows navigation menu with Lists and Dashboard links', () => {
    render(<App />);

    expect(screen.getByText('Lists')).toBeInTheDocument();
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
  });

  it('navigates to Dashboard when clicked', () => {
    render(<App />);

    const dashboardLink = screen.getByText('Dashboard');
    fireEvent.click(dashboardLink);

    expect(screen.getByText('Job Progress Dashboard')).toBeInTheDocument();
  });
});
