import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Dashboard } from './Dashboard';
import { ReadyState } from 'react-use-websocket';
import type { ProgressUpdate } from '../hooks/useWebSocket';

// Mock useWebSocket hook
const mockUseWebSocket = vi.fn();
vi.mock('../hooks/useWebSocket', () => ({
  useWebSocket: () => mockUseWebSocket(),
}));

describe('Dashboard Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows empty state when no jobs', () => {
    mockUseWebSocket.mockReturnValue({
      jobProgress: new Map(),
      isConnected: true,
      reconnecting: false,
      readyState: ReadyState.OPEN,
      sendJsonMessage: vi.fn(),
      authStatus: 'authenticated',
      historyError: null,
    });

    render(<Dashboard />);

    expect(screen.getByText(/No active jobs/i)).toBeInTheDocument();
  });

  it('displays multiple jobs with progress', async () => {
    const jobs = new Map<string, ProgressUpdate>([
      ['job-1', {
        job_id: 'job-1',
        status: 'processing',
        progress: 25,
        current_video: 5,
        total_videos: 20,
        message: 'Processing videos...',
        timestamp: Date.now(),
      }],
      ['job-2', {
        job_id: 'job-2',
        status: 'completed',
        progress: 100,
        current_video: 10,
        total_videos: 10,
        message: 'Processing complete',
        timestamp: Date.now(),
      }],
    ]);

    mockUseWebSocket.mockReturnValue({
      jobProgress: jobs,
      isConnected: true,
      reconnecting: false,
      readyState: ReadyState.OPEN,
      sendJsonMessage: vi.fn(),
      authStatus: 'authenticated',
      historyError: null,
    });

    render(<Dashboard />);

    // Should show both jobs
    expect(screen.getByText(/job-1/i)).toBeInTheDocument();
    expect(screen.getByText(/job-2/i)).toBeInTheDocument();

    // Should show progress for each job
    expect(screen.getByText('25%')).toBeInTheDocument();
    expect(screen.getByText('100%')).toBeInTheDocument();
  });

  it('updates UI when job progress changes', async () => {
    const initialJobs = new Map<string, ProgressUpdate>([
      ['job-1', {
        job_id: 'job-1',
        status: 'processing',
        progress: 25,
        current_video: 5,
        total_videos: 20,
        message: 'Processing videos...',
        timestamp: Date.now(),
      }],
    ]);

    // Initial render with 25% progress
    mockUseWebSocket.mockReturnValue({
      jobProgress: initialJobs,
      isConnected: true,
      reconnecting: false,
      readyState: ReadyState.OPEN,
      sendJsonMessage: vi.fn(),
      authStatus: 'authenticated',
      historyError: null,
    });

    const { rerender } = render(<Dashboard />);
    expect(screen.getByText('25%')).toBeInTheDocument();

    // Update to 50% progress
    const updatedJobs = new Map<string, ProgressUpdate>([
      ['job-1', {
        ...initialJobs.get('job-1')!,
        progress: 50,
        current_video: 10,
      }],
    ]);

    mockUseWebSocket.mockReturnValue({
      jobProgress: updatedJobs,
      isConnected: true,
      reconnecting: false,
      readyState: ReadyState.OPEN,
      sendJsonMessage: vi.fn(),
      authStatus: 'authenticated',
      historyError: null,
    });

    rerender(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByText('50%')).toBeInTheDocument();
    });
  });

  it('shows reconnecting banner when connection lost', () => {
    mockUseWebSocket.mockReturnValue({
      jobProgress: new Map(),
      isConnected: false,
      reconnecting: true,
      readyState: ReadyState.CLOSED,
      sendJsonMessage: vi.fn(),
      authStatus: 'pending',
      historyError: null,
    });

    render(<Dashboard />);

    expect(screen.getByText(/Reconnecting/i)).toBeInTheDocument();
  });

  it('shows error message when job fails', () => {
    const jobs = new Map<string, ProgressUpdate>([
      ['job-1', {
        job_id: 'job-1',
        status: 'failed',
        progress: 45,
        current_video: 9,
        total_videos: 20,
        message: 'Processing failed',
        error: 'Network timeout',
        timestamp: Date.now(),
      }],
    ]);

    mockUseWebSocket.mockReturnValue({
      jobProgress: jobs,
      isConnected: true,
      reconnecting: false,
      readyState: ReadyState.OPEN,
      sendJsonMessage: vi.fn(),
      authStatus: 'authenticated',
      historyError: null,
    });

    render(<Dashboard />);

    // Should show error message
    expect(screen.getByText('Network timeout')).toBeInTheDocument();
  });
});
