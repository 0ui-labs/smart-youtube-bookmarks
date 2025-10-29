import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useWebSocket } from './useWebSocket';

// Mock WebSocket class for testing
class MockWebSocket {
  static instances: MockWebSocket[] = [];

  onopen: (() => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: ((event: Event) => void) | null = null;

  readyState: number = 0; // CONNECTING
  url: string;
  sentMessages: string[] = [];

  constructor(url: string) {
    this.url = url;
    MockWebSocket.instances.push(this);

    // Simulate async connection
    setTimeout(() => {
      this.readyState = 1; // OPEN
      this.onopen?.();
    }, 0);
  }

  send(data: string) {
    this.sentMessages.push(data);
  }

  close() {
    this.readyState = 3; // CLOSED
    this.onclose?.();
  }

  // Helper to simulate receiving a message
  simulateMessage(data: any) {
    const event = new MessageEvent('message', {
      data: JSON.stringify(data)
    });
    this.onmessage?.(event);
  }
}

// Replace global WebSocket with mock
global.WebSocket = MockWebSocket as any;

describe('useWebSocket', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    MockWebSocket.instances = [];
    localStorage.clear();
    localStorage.setItem('token', 'test-token-123');
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    localStorage.clear();
    MockWebSocket.instances = [];
  });

  describe('Option B Security: Post-Connection Authentication', () => {
    it('connects WITH token in URL (Query Parameter Auth)', async () => {
      renderHook(() => useWebSocket());

      await act(async () => {
        await vi.advanceTimersByTimeAsync(0); // Flush immediate timers only
      });

      // UPDATED: Backend requires token as query parameter
      // (changed from post-connection auth to query param auth)
      const wsInstance = MockWebSocket.instances[0]!;
      expect(wsInstance.url).toContain('token=');
      expect(wsInstance.url).toContain('test-token-123');
    });

    it('sends auth message AFTER connection opens', async () => {
      renderHook(() => useWebSocket());

      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });

      const wsInstance = MockWebSocket.instances[0]!;

      // Should send auth message with token
      expect(wsInstance.sentMessages.length).toBeGreaterThan(0);
      const authMessage = JSON.parse(wsInstance.sentMessages[0]!);
      expect(authMessage.type).toBe('auth');
      expect(authMessage.token).toBe('test-token-123');
    });

    it('updates authStatus to authenticated on auth confirmation', async () => {
      const { result } = renderHook(() => useWebSocket());

      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });

      // Initially should be pending
      expect(result.current.authStatus).toBe('pending');

      // Simulate auth confirmation from server
      const wsInstance = MockWebSocket.instances[0]!;
      await act(async () => {
        wsInstance.simulateMessage({
          type: 'auth_confirmed',
          authenticated: true
        });
      });

      expect(result.current.authStatus).toBe('authenticated');
    });

    it('updates authStatus to failed on auth rejection', async () => {
      const { result } = renderHook(() => useWebSocket());

      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });

      // Simulate auth rejection from server
      const wsInstance = MockWebSocket.instances[0]!;
      await act(async () => {
        wsInstance.simulateMessage({
          type: 'auth_failed',
          authenticated: false,
          error: 'Invalid token'
        });
      });

      expect(result.current.authStatus).toBe('failed');
    });
  });

  describe('Connection Management', () => {
    it('establishes connection on mount', async () => {
      const { result } = renderHook(() => useWebSocket());

      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });

      expect(result.current.isConnected).toBe(true);
      expect(MockWebSocket.instances.length).toBe(1);
    });

    it('handles disconnect and sets reconnecting flag', async () => {
      const { result } = renderHook(() => useWebSocket());

      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });

      expect(result.current.isConnected).toBe(true);

      // Simulate disconnect
      const wsInstance = MockWebSocket.instances[0]!;
      await act(async () => {
        wsInstance.close();
      });

      expect(result.current.isConnected).toBe(false);
      expect(result.current.reconnecting).toBe(true);
    });

    it('reconnects with exponential backoff (3s, 6s, 12s, max 30s)', async () => {
      renderHook(() => useWebSocket());

      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });

      const wsInstance = MockWebSocket.instances[0]!;

      // First disconnect -> should retry in 3s
      await act(async () => {
        wsInstance.close();
      });

      expect(MockWebSocket.instances.length).toBe(1); // Not reconnected yet

      await act(async () => {
        await vi.advanceTimersByTimeAsync(2999); // Just before 3s
      });
      expect(MockWebSocket.instances.length).toBe(1); // Still not reconnected

      await act(async () => {
        await vi.advanceTimersByTimeAsync(1); // Hit 3s
      });
      expect(MockWebSocket.instances.length).toBe(2); // Reconnected!

      // Second disconnect -> should retry in 6s (3s * 2^1)
      const wsInstance2 = MockWebSocket.instances[1]!;
      await act(async () => {
        wsInstance2.close();
      });

      await act(async () => {
        await vi.advanceTimersByTimeAsync(5999);
      });
      expect(MockWebSocket.instances.length).toBe(2); // Not yet

      await act(async () => {
        await vi.advanceTimersByTimeAsync(1);
      });
      expect(MockWebSocket.instances.length).toBe(3); // Reconnected after 6s
    });
  });

  describe('Option B: History API Integration', () => {
    it('calls history API on reconnect for monitored jobs', async () => {
      // Mock fetch for history API
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ([
          {
            job_id: 'job-123',
            status: 'processing',
            progress: 75,
            current_video: 8,
            total_videos: 10,
            message: 'Processing video 8/10',
            timestamp: Date.now() - 1000
          }
        ])
      });
      global.fetch = mockFetch;

      renderHook(() => useWebSocket());

      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });

      // Receive initial progress update to track this job
      const wsInstance = MockWebSocket.instances[0]!;
      await act(async () => {
        wsInstance.simulateMessage({
          type: 'auth_confirmed',
          authenticated: true
        });
      });

      await act(async () => {
        wsInstance.simulateMessage({
          job_id: 'job-123',
          status: 'processing',
          progress: 50,
          current_video: 5,
          total_videos: 10,
          message: 'Processing video 5/10'
        });
      });

      // Disconnect
      await act(async () => {
        wsInstance.close();
      });

      // Reconnect
      await act(async () => {
        await vi.advanceTimersByTimeAsync(3000);
      });

      // Issue #1: Now history is fetched after auth confirmation (not in onopen)
      const wsInstance2 = MockWebSocket.instances[1]!;
      await act(async () => {
        wsInstance2.simulateMessage({
          type: 'auth_confirmed',
          authenticated: true
        });
      });

      // Wait for async fetch call to complete with proper timeout
      await act(async () => {
        // Use runOnlyPendingTimersAsync instead of new Promise
        await vi.runOnlyPendingTimersAsync();
      });

      // Should have called history API for job-123
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/jobs/job-123/progress-history'),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer test-token-123'
          })
        })
      );

    });

    it('does NOT call history API on initial connect', async () => {
      const mockFetch = vi.fn();
      global.fetch = mockFetch;

      renderHook(() => useWebSocket());

      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });

      // Should NOT call history API on initial connection
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe('Progress Updates', () => {
    it('receives and stores progress updates in Map', async () => {
      const { result } = renderHook(() => useWebSocket());

      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });

      expect(MockWebSocket.instances.length).toBeGreaterThan(0);
      const wsInstance = MockWebSocket.instances[0]!;

      // Send progress update
      await act(async () => {
        wsInstance.simulateMessage({
          job_id: 'job-123',
          status: 'processing',
          progress: 50,
          current_video: 5,
          total_videos: 10,
          message: 'Processing video 5/10'
        });
      });

      expect(result.current.jobProgress.size).toBe(1);
      const progress = result.current.jobProgress.get('job-123');
      expect(progress).toBeDefined();
      expect(progress?.progress).toBe(50);
      expect(progress?.status).toBe('processing');
      expect(progress?.current_video).toBe(5);
      expect(progress?.total_videos).toBe(10);
    });

    it('adds timestamp to progress updates for cleanup logic', async () => {
      const { result } = renderHook(() => useWebSocket());

      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });

      const wsInstance = MockWebSocket.instances[0]!;
      const beforeTime = Date.now();

      await act(async () => {
        wsInstance.simulateMessage({
          job_id: 'job-123',
          status: 'processing',
          progress: 50,
          current_video: 5,
          total_videos: 10,
          message: 'Processing'
        });
      });

      const progress = result.current.jobProgress.get('job-123');
      expect(progress?.timestamp).toBeDefined();
      expect(progress?.timestamp).toBeGreaterThanOrEqual(beforeTime);
    });

    it('updates existing job progress', async () => {
      const { result } = renderHook(() => useWebSocket());

      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });

      const wsInstance = MockWebSocket.instances[0]!;

      // First update
      await act(async () => {
        wsInstance.simulateMessage({
          job_id: 'job-123',
          status: 'processing',
          progress: 50,
          current_video: 5,
          total_videos: 10,
          message: 'Processing video 5/10'
        });
      });

      // Second update (same job)
      await act(async () => {
        wsInstance.simulateMessage({
          job_id: 'job-123',
          status: 'processing',
          progress: 80,
          current_video: 8,
          total_videos: 10,
          message: 'Processing video 8/10'
        });
      });

      expect(result.current.jobProgress.size).toBe(1); // Still one job
      const progress = result.current.jobProgress.get('job-123');
      expect(progress?.progress).toBe(80); // Updated
      expect(progress?.current_video).toBe(8);
    });
  });

  describe('Job Cleanup (5 min TTL)', () => {
    it('removes completed jobs after 5 minutes', async () => {
      const { result } = renderHook(() => useWebSocket());

      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });

      const wsInstance = MockWebSocket.instances[0]!;

      // Add completed job
      await act(async () => {
        wsInstance.simulateMessage({
          job_id: 'job-completed',
          status: 'completed',
          progress: 100,
          current_video: 10,
          total_videos: 10,
          message: 'All videos processed'
        });
      });

      expect(result.current.jobProgress.has('job-completed')).toBe(true);

      // Advance time by 5 minutes + cleanup interval (60s)
      await act(async () => {
        await vi.advanceTimersByTimeAsync(5 * 60 * 1000 + 60 * 1000);
      });

      // Job should be cleaned up
      expect(result.current.jobProgress.has('job-completed')).toBe(false);
    });

    it('keeps active jobs (pending/processing) indefinitely', async () => {
      const { result } = renderHook(() => useWebSocket());

      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });

      const wsInstance = MockWebSocket.instances[0]!;

      // Add processing job
      await act(async () => {
        wsInstance.simulateMessage({
          job_id: 'job-active',
          status: 'processing',
          progress: 50,
          current_video: 5,
          total_videos: 10,
          message: 'Processing'
        });
      });

      // Advance time by 10 minutes (way past TTL)
      await act(async () => {
        await vi.advanceTimersByTimeAsync(10 * 60 * 1000);
      });

      // Active job should still be there
      expect(result.current.jobProgress.has('job-active')).toBe(true);
    });

    it('keeps recent completed jobs (within 5 min TTL)', async () => {
      const { result } = renderHook(() => useWebSocket());

      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });

      const wsInstance = MockWebSocket.instances[0]!;

      // Add completed job
      await act(async () => {
        wsInstance.simulateMessage({
          job_id: 'job-recent',
          status: 'completed',
          progress: 100,
          current_video: 10,
          total_videos: 10,
          message: 'Done'
        });
      });

      // Advance time by 4 minutes (less than TTL)
      await act(async () => {
        await vi.advanceTimersByTimeAsync(4 * 60 * 1000);
      });

      // Recent completed job should still be there
      expect(result.current.jobProgress.has('job-recent')).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('handles malformed JSON messages gracefully', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const { result } = renderHook(() => useWebSocket());

      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });

      const wsInstance = MockWebSocket.instances[0]!;

      // Send invalid JSON
      await act(async () => {
        const event = new MessageEvent('message', {
          data: 'not valid json {'
        });
        wsInstance.onmessage?.(event);
      });

      // Should log error but not crash
      expect(consoleErrorSpy).toHaveBeenCalled();
      expect(result.current.jobProgress.size).toBe(0);

      consoleErrorSpy.mockRestore();
    });

    it('handles missing token gracefully and sets auth status to failed', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      localStorage.clear(); // Clear before removing token

      const { result } = renderHook(() => useWebSocket());

      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });

      // Should not create WebSocket without token
      expect(MockWebSocket.instances.length).toBe(0);
      expect(consoleErrorSpy).toHaveBeenCalled();

      const errorCall = consoleErrorSpy.mock.calls.find(call =>
        String(call[0]).includes('No auth token')
      );
      expect(errorCall).toBeDefined();

      // Issue #4: Should set auth status to 'failed'
      expect(result.current.authStatus).toBe('failed');

      consoleErrorSpy.mockRestore();
    });

    it('sets historyError when history API fails', async () => {
      // Mock fetch for history API to fail
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        statusText: 'Not Found'
      });
      global.fetch = mockFetch;

      const { result } = renderHook(() => useWebSocket());

      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });

      // Receive initial progress update to track this job
      const wsInstance = MockWebSocket.instances[0]!;
      await act(async () => {
        wsInstance.simulateMessage({
          type: 'auth_confirmed',
          authenticated: true
        });
      });

      await act(async () => {
        wsInstance.simulateMessage({
          job_id: 'job-123',
          status: 'processing',
          progress: 50,
          current_video: 5,
          total_videos: 10,
          message: 'Processing video 5/10'
        });
      });

      // Disconnect
      await act(async () => {
        wsInstance.close();
      });

      // Reconnect
      await act(async () => {
        await vi.advanceTimersByTimeAsync(3000);
      });

      // Trigger auth confirmation to initiate history fetch
      const wsInstance2 = MockWebSocket.instances[1]!;
      await act(async () => {
        wsInstance2.simulateMessage({
          type: 'auth_confirmed',
          authenticated: true
        });
      });

      // Wait for async fetch call to complete
      await act(async () => {
        await vi.runOnlyPendingTimersAsync();
      });

      // Issue #5: Should have set historyError state
      expect(result.current.historyError).toContain('Failed to load progress history');
    });
  });

  describe('Cleanup on Unmount', () => {
    it('closes WebSocket and prevents reconnection on unmount', async () => {
      const { unmount } = renderHook(() => useWebSocket());

      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });

      // Ensure we have at least one instance
      expect(MockWebSocket.instances.length).toBeGreaterThan(0);

      const wsInstance = MockWebSocket.instances[MockWebSocket.instances.length - 1]!;
      expect(wsInstance.readyState).toBe(1); // OPEN

      // Unmount
      unmount();

      expect(wsInstance.readyState).toBe(3); // CLOSED

      // Advance time - should NOT reconnect
      const instanceCountBeforeAdvance = MockWebSocket.instances.length;
      await act(async () => {
        await vi.advanceTimersByTimeAsync(10000);
      });

      expect(MockWebSocket.instances.length).toBe(instanceCountBeforeAdvance); // No new connections
    });
  });
});
