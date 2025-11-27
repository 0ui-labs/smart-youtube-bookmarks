/**
 * Integration tests for WebSocket import progress flow
 *
 * Tests the full flow:
 * 1. WebSocket receives import_progress message
 * 2. importProgressStore is updated
 * 3. VideoCard displays progress overlay
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { useImportProgressStore } from '@/stores/importProgressStore';
import { VideoCard } from '@/components/VideoCard';
import type { VideoResponse } from '@/types/video';

// Mock external dependencies
vi.mock('@/stores/tagStore', () => ({
  useTagStore: () => ({
    tags: [],
    toggleTag: vi.fn(),
  }),
}));

vi.mock('@/hooks/useVideoFieldValues', () => ({
  useUpdateVideoFieldValues: () => ({
    mutate: vi.fn(),
  }),
}));

const mockVideo: VideoResponse = {
  id: 'test-video-123',
  youtube_id: 'dQw4w9WgXcQ',
  title: 'Test Video',
  channel: 'Test Channel',
  duration: 240,
  thumbnail_url: 'https://img.youtube.com/vi/dQw4w9WgXcQ/mqdefault.jpg',
  published_at: '2025-01-01T00:00:00Z',
  tags: [],
  list_id: 'list-123',
  processing_status: 'pending',
  created_at: '2025-01-01T00:00:00Z',
  updated_at: '2025-01-01T00:00:00Z',
  field_values: [],
};

describe('WebSocket Import Progress Integration', () => {
  beforeEach(() => {
    // Reset the store before each test
    act(() => {
      useImportProgressStore.getState().clearAllProgress();
    });
  });

  it('VideoCard shows progress overlay when store has importing progress', () => {
    // Simulate receiving import_progress message by updating store directly
    act(() => {
      useImportProgressStore.getState().setProgress('test-video-123', 50, 'captions');
    });

    render(
      <MemoryRouter>
        <VideoCard video={mockVideo} />
      </MemoryRouter>
    );

    // Progress overlay should be visible
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
    expect(screen.getByText('50%')).toBeInTheDocument();
    expect(screen.getAllByText(/untertitel/i).length).toBeGreaterThanOrEqual(1);
  });

  it('VideoCard removes progress overlay when import completes', () => {
    // Start with importing state
    act(() => {
      useImportProgressStore.getState().setProgress('test-video-123', 50, 'captions');
    });

    const { rerender } = render(
      <MemoryRouter>
        <VideoCard video={mockVideo} />
      </MemoryRouter>
    );

    // Verify importing state
    expect(screen.getByRole('progressbar')).toBeInTheDocument();

    // Complete the import
    act(() => {
      useImportProgressStore.getState().setProgress('test-video-123', 100, 'complete');
    });

    rerender(
      <MemoryRouter>
        <VideoCard video={mockVideo} />
      </MemoryRouter>
    );

    // Progress overlay should be gone
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  });

  it('store correctly tracks multiple videos independently', () => {
    // Set up progress for multiple videos
    act(() => {
      useImportProgressStore.getState().setProgress('video-1', 25, 'metadata');
      useImportProgressStore.getState().setProgress('video-2', 75, 'chapters');
      useImportProgressStore.getState().setProgress('video-3', 100, 'complete');
    });

    const store = useImportProgressStore.getState();

    // Verify each video's state
    expect(store.isImporting('video-1')).toBe(true);
    expect(store.isImporting('video-2')).toBe(true);
    expect(store.isImporting('video-3')).toBe(false); // complete

    expect(store.getProgress('video-1')?.progress).toBe(25);
    expect(store.getProgress('video-2')?.progress).toBe(75);
    expect(store.getProgress('video-3')?.progress).toBe(100);
  });

  it('progress updates flow correctly from store to component', () => {
    render(
      <MemoryRouter>
        <VideoCard video={mockVideo} />
      </MemoryRouter>
    );

    // Initially no progress overlay
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();

    // Simulate WebSocket message by updating store
    act(() => {
      useImportProgressStore.getState().setProgress('test-video-123', 30, 'metadata');
    });

    // Now should show overlay with 30%
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
    expect(screen.getByText('30%')).toBeInTheDocument();

    // Update progress
    act(() => {
      useImportProgressStore.getState().setProgress('test-video-123', 60, 'captions');
    });

    // Should show updated progress
    expect(screen.getByText('60%')).toBeInTheDocument();
  });
});
