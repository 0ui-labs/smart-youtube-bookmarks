import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { ProgressBar } from './ProgressBar';
import { ProgressUpdate } from '../hooks/useWebSocket';

describe('ProgressBar', () => {
  it('renders progress percentage', () => {
    const progress: ProgressUpdate = {
      job_id: 'job-123',
      status: 'processing',
      progress: 50,
      current_video: 5,
      total_videos: 10,
      message: 'Processing video 5/10',
    };

    render(<ProgressBar progress={progress} />);

    expect(screen.getByText('50%')).toBeInTheDocument();
    expect(screen.getByText('Processing video 5/10')).toBeInTheDocument();
    expect(screen.getByText('5/10 videos')).toBeInTheDocument();
  });

  it('displays error message when status is failed', () => {
    const progress: ProgressUpdate = {
      job_id: 'job-123',
      status: 'failed',
      progress: 30,
      current_video: 3,
      total_videos: 10,
      message: 'Processing failed',
      error: 'API rate limit exceeded',
    };

    render(<ProgressBar progress={progress} />);

    expect(screen.getByText(/API rate limit exceeded/)).toBeInTheDocument();
  });

  it('shows green color for completed status', () => {
    const progress: ProgressUpdate = {
      job_id: 'job-123',
      status: 'completed',
      progress: 100,
      current_video: 10,
      total_videos: 10,
      message: 'Completed',
    };

    const { container } = render(<ProgressBar progress={progress} />);
    const progressBar = container.querySelector('.bg-green-500');

    expect(progressBar).toBeInTheDocument();
  });

  // Accessibility tests (from REF research recommendations)
  describe('Accessibility', () => {
    it('has proper ARIA attributes for progressbar role', () => {
      const progress: ProgressUpdate = {
        job_id: 'job-123',
        status: 'processing',
        progress: 50,
        current_video: 5,
        total_videos: 10,
        message: 'Processing video 5/10',
      };

      render(<ProgressBar progress={progress} />);

      const progressBar = screen.getByRole('progressbar');
      expect(progressBar).toHaveAttribute('aria-valuenow', '50');
      expect(progressBar).toHaveAttribute('aria-valuemin', '0');
      expect(progressBar).toHaveAttribute('aria-valuemax', '100');
      expect(progressBar).toHaveAttribute('aria-labelledby');
    });

    it('announces errors assertively for screen readers', () => {
      const progress: ProgressUpdate = {
        job_id: 'job-123',
        status: 'failed',
        progress: 30,
        current_video: 3,
        total_videos: 10,
        message: 'Processing failed',
        error: 'API rate limit exceeded',
      };

      render(<ProgressBar progress={progress} />);

      const errorAlert = screen.getByRole('alert');
      expect(errorAlert).toBeInTheDocument();
      expect(errorAlert).toHaveAttribute('aria-live', 'assertive');
      expect(errorAlert).toHaveTextContent('API rate limit exceeded');
    });

    it('includes live region for progress updates', () => {
      const progress: ProgressUpdate = {
        job_id: 'job-123',
        status: 'processing',
        progress: 75,
        current_video: 7,
        total_videos: 10,
        message: 'Processing video 7/10',
      };

      render(<ProgressBar progress={progress} />);

      const liveRegion = screen.getByRole('status');
      expect(liveRegion).toHaveAttribute('aria-live', 'polite');
      expect(liveRegion).toHaveAttribute('aria-atomic', 'true');
    });

    it('displays status badge with icon and label', () => {
      const progress: ProgressUpdate = {
        job_id: 'job-123',
        status: 'completed',
        progress: 100,
        current_video: 10,
        total_videos: 10,
        message: 'Completed',
      };

      const { container } = render(<ProgressBar progress={progress} />);

      // Check for status badge (more specific selector)
      const statusBadge = container.querySelector('.px-2.py-1.text-xs');
      expect(statusBadge).toBeInTheDocument();
      expect(statusBadge).toHaveTextContent('✓');
      expect(statusBadge).toHaveTextContent('Completed');
    });

    it('applies reduced motion classes for accessibility', () => {
      const progress: ProgressUpdate = {
        job_id: 'job-123',
        status: 'processing',
        progress: 50,
        current_video: 5,
        total_videos: 10,
        message: 'Processing video 5/10',
      };

      const { container } = render(<ProgressBar progress={progress} />);
      const progressFill = container.querySelector('.progress-fill');

      expect(progressFill).toHaveClass('motion-safe:transition-all');
      expect(progressFill).toHaveClass('motion-reduce:transition-none');
    });
  });

  describe('Status Colors', () => {
    it('applies correct colors for each status', () => {
      const statuses: Array<ProgressUpdate['status']> = [
        'pending',
        'processing',
        'completed',
        'failed',
        'completed_with_errors',
      ];

      const expectedColors = {
        pending: 'bg-gray-400',
        processing: 'bg-blue-500',
        completed: 'bg-green-500',
        failed: 'bg-red-500',
        completed_with_errors: 'bg-amber-500',
      };

      statuses.forEach((status) => {
        const progress: ProgressUpdate = {
          job_id: 'job-123',
          status,
          progress: 50,
          current_video: 5,
          total_videos: 10,
          message: `Status: ${status}`,
        };

        const { container, unmount } = render(<ProgressBar progress={progress} />);
        const progressFill = container.querySelector('.progress-fill');

        expect(progressFill).toHaveClass(expectedColors[status]);

        // Clean up DOM between iterations to prevent false positives
        unmount();
      });
    });
  });

  describe('Input Validation', () => {
    it('clamps progress to 0-100 range for negative values', () => {
      const progress: ProgressUpdate = {
        job_id: 'job-123',
        status: 'processing',
        progress: -10,
        current_video: 0,
        total_videos: 10,
        message: 'Processing',
      };

      const { container } = render(<ProgressBar progress={progress} />);
      const progressBar = screen.getByRole('progressbar');

      expect(progressBar).toHaveAttribute('aria-valuenow', '0');

      const progressFill = container.querySelector('.progress-fill');
      expect(progressFill).toHaveStyle({ width: '0%' });
    });

    it('clamps progress to 0-100 range for values above 100', () => {
      const progress: ProgressUpdate = {
        job_id: 'job-123',
        status: 'processing',
        progress: 150,
        current_video: 10,
        total_videos: 10,
        message: 'Processing',
      };

      const { container } = render(<ProgressBar progress={progress} />);
      const progressBar = screen.getByRole('progressbar');

      expect(progressBar).toHaveAttribute('aria-valuenow', '100');

      const progressFill = container.querySelector('.progress-fill');
      expect(progressFill).toHaveStyle({ width: '100%' });
    });

    it('handles NaN progress values gracefully', () => {
      const progress: ProgressUpdate = {
        job_id: 'job-123',
        status: 'processing',
        progress: NaN,
        current_video: 5,
        total_videos: 10,
        message: 'Processing',
      };

      const { container } = render(<ProgressBar progress={progress} />);
      const progressBar = screen.getByRole('progressbar');

      expect(progressBar).toHaveAttribute('aria-valuenow', '0');

      const progressFill = container.querySelector('.progress-fill');
      expect(progressFill).toHaveStyle({ width: '0%' });
    });
  });
});
