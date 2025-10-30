import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { JobProgressCard } from './JobProgressCard';
import type { ProgressUpdate } from '../hooks/useWebSocket';

describe('JobProgressCard', () => {
  const mockJob: ProgressUpdate = {
    job_id: 'test-job-123',
    status: 'processing',
    progress: 45,
    current_video: 9,
    total_videos: 20,
    message: 'Processing videos...',
    timestamp: Date.now(),
  };

  it('renders job information', () => {
    render(<JobProgressCard job={mockJob} />);

    // Job ID is rendered (first 8 chars: "test-job")
    expect(screen.getByText(/test-job/i)).toBeInTheDocument();
    expect(screen.getByText('Processing videos...')).toBeInTheDocument();
  });

  it('displays ProgressBar component', () => {
    render(<JobProgressCard job={mockJob} />);

    // ProgressBar shows percentage
    expect(screen.getByText('45%')).toBeInTheDocument();
    // ProgressBar shows video counter
    expect(screen.getByText('9/20 videos')).toBeInTheDocument();
  });

  it('shows error message when present', () => {
    const jobWithError: ProgressUpdate = {
      ...mockJob,
      status: 'failed',
      error: 'Network timeout',
    };

    render(<JobProgressCard job={jobWithError} />);

    expect(screen.getByText('Network timeout')).toBeInTheDocument();
  });
});
