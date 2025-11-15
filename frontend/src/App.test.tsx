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

vi.mock('./hooks/useVideos', () => ({
  useVideos: vi.fn(() => ({
    data: [],
    isLoading: false,
    error: null,
  })),
  useCreateVideo: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
  useDeleteVideo: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
  exportVideosCSV: vi.fn(),
  useAssignTags: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
}));

vi.mock('./hooks/useVideosFilter', () => ({
  useVideosFilter: vi.fn(() => ({
    data: [],
    isLoading: false,
    error: null,
  })),
}));

vi.mock('./hooks/useTags', () => ({
  useTags: vi.fn(() => ({
    data: [],
    isLoading: false,
    error: null,
  })),
  useCreateTag: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
  useDeleteTag: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
}));

vi.mock('./stores/fieldFilterStore', () => ({
  useFieldFilterStore: vi.fn(() => ({
    activeFilters: [],
  })),
}));

vi.mock('./stores/tagStore', () => ({
  useTagStore: vi.fn(() => ({
    selectedTagIds: [],
    setSelectedTagIds: vi.fn(),
  })),
}));

vi.mock('./stores/tableSettingsStore', () => ({
  useTableSettingsStore: vi.fn(() => ({
    viewMode: 'table',
    visibleColumns: [],
    setViewMode: vi.fn(),
    setVisibleColumns: vi.fn(),
  })),
}));

describe('App', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders without crashing', () => {
    renderWithRouter(<App />, { initialEntries: ['/'] });

    // Verify the main heading is rendered (redirects to /videos which shows "Alle Videos")
    expect(screen.getByRole('heading', { name: /Alle Videos/i })).toBeInTheDocument();
  });

  it('redirects root path to /videos', () => {
    renderWithRouter(<App />, { initialEntries: ['/'] });

    // Should see the VideosPage (which has "Videos" heading)
    // Note: Navigation is hidden in single-list MVP
    expect(screen.queryByText('Listen')).not.toBeInTheDocument();
    expect(screen.queryByText('Dashboard')).not.toBeInTheDocument();
  });
});
