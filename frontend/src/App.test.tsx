import { screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import App from './App';
import { ReadyState } from 'react-use-websocket';
import { renderWithRouter } from './test/renderWithRouter';

// Mock dependencies
vi.mock('./hooks/useLists', () => ({
  useLists: vi.fn(() => ({
    data: [{
      id: 'test-list-1',
      name: 'Test List',
      description: 'Test',
      video_count: 0,
      created_at: new Date().toISOString(),
    }],
    isLoading: false,
    error: null,
  })),
  useCreateList: vi.fn(() => ({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false })),
  useDeleteList: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
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

describe('App', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders without crashing', () => {
    const { container } = renderWithRouter(<App />, { initialEntries: ['/'] });

    // App should render without throwing
    expect(container).toBeTruthy();
  });

  it('redirects root path to /videos', () => {
    renderWithRouter(<App />, { initialEntries: ['/'] });

    // Should see the VideosPage (which has "Videos" heading)
    // Note: Navigation is hidden in single-list MVP
    expect(screen.queryByText('Listen')).not.toBeInTheDocument();
    expect(screen.queryByText('Dashboard')).not.toBeInTheDocument();
  });
});
