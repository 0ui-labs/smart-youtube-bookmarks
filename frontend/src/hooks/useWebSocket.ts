import { useState, useEffect, useRef } from 'react';

/**
 * Progress update data structure received from WebSocket
 */
export interface ProgressUpdate {
  job_id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'completed_with_errors';
  progress: number;
  current_video: number;
  total_videos: number;
  message: string;
  video_id?: string;
  error?: string;
  timestamp?: number; // Added on frontend for cleanup logic
}

/**
 * Return type for useWebSocket hook
 */
export interface UseWebSocketReturn {
  jobProgress: Map<string, ProgressUpdate>;
  isConnected: boolean;
  reconnecting: boolean;
  authStatus: 'pending' | 'authenticated' | 'failed'; // Option B: Auth status tracking
  historyError: string | null; // Issue #5: Expose history API errors to UI
}

// WebSocket configuration constants
const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:8000/api/ws/progress';
const MAX_BACKOFF = 30000; // 30 seconds
const INITIAL_BACKOFF = 3000; // 3 seconds
const CLEANUP_INTERVAL = 60000; // 1 minute
const COMPLETED_JOB_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Custom hook for WebSocket connection to track job progress updates
 *
 * Features:
 * - Post-connection authentication (Option B security fix)
 * - Automatic reconnection with exponential backoff
 * - History API integration on reconnect
 * - Job cleanup after TTL
 *
 * @returns WebSocket state and job progress map
 */
export function useWebSocket(): UseWebSocketReturn {
  const [jobProgress, setJobProgress] = useState<Map<string, ProgressUpdate>>(new Map());
  const [isConnected, setIsConnected] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
  const [authStatus, setAuthStatus] = useState<'pending' | 'authenticated' | 'failed'>('pending');
  const [historyError, setHistoryError] = useState<string | null>(null); // Issue #5: Track history API errors

  const wsRef = useRef<WebSocket | null>(null);
  const retryCountRef = useRef(0);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
  const isReconnectingRef = useRef(false); // Track if this is a reconnection
  const monitoredJobsRef = useRef<Set<string>>(new Set()); // Track jobs for history API
  const lastConnectedTimeRef = useRef<Map<string, number>>(new Map()); // Issue #2: Track last connected time per job

  useEffect(() => {
    const connect = () => {
      // Get auth token from localStorage
      const token = localStorage.getItem('token');
      if (!token) {
        console.error('No auth token found for WebSocket connection');
        setAuthStatus('failed'); // Issue #4: Set auth status to failed when token missing
        return;
      }

      // OPTION B SECURITY FIX: Connect WITHOUT token in URL
      // This prevents token exposure in server logs
      const ws = new WebSocket(WS_URL);

      ws.onopen = async () => {
        console.log('WebSocket connected');
        setIsConnected(true);

        // OPTION B: Send auth message AFTER connection
        // TODO: Backend needs to handle auth messages (currently expects token in query param)
        ws.send(JSON.stringify({
          type: 'auth',
          token: token
        }));

        // Issue #6: ALWAYS reset retry count on successful connection
        retryCountRef.current = 0;

        // Reset reconnecting flag if this was a reconnection
        if (isReconnectingRef.current) {
          setReconnecting(false);
          isReconnectingRef.current = false;
        }
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          // Handle auth confirmation/failure messages
          if (data.type === 'auth_confirmed' && data.authenticated) {
            setAuthStatus('authenticated');

            // Issue #1: NOW fetch history after auth confirmed (not in onopen)
            if (isReconnectingRef.current && monitoredJobsRef.current.size > 0) {
              fetchJobHistory(Array.from(monitoredJobsRef.current), token);
            }
            return;
          }

          if (data.type === 'auth_failed') {
            setAuthStatus('failed');
            console.error('WebSocket authentication failed:', data.error);
            return;
          }

          // Handle progress updates
          const update: ProgressUpdate = data;

          // Add timestamp for cleanup logic
          update.timestamp = Date.now();

          // Issue #2: Track last connected time for this job
          lastConnectedTimeRef.current.set(update.job_id, update.timestamp);

          // Track this job for history API on reconnect
          monitoredJobsRef.current.add(update.job_id);

          // Issue #3: Remove from monitored set after TTL if terminal state
          if (['completed', 'failed', 'completed_with_errors'].includes(update.status)) {
            setTimeout(() => {
              monitoredJobsRef.current.delete(update.job_id);
            }, COMPLETED_JOB_TTL);
          }

          setJobProgress(prev => {
            const next = new Map(prev);
            next.set(update.job_id, update);
            return next;
          });
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };

      ws.onclose = () => {
        console.log('WebSocket disconnected');
        setIsConnected(false);
        setAuthStatus('pending'); // Reset auth status on disconnect

        // Don't reconnect if this was intentional close (component unmount)
        if (wsRef.current === ws) {
          setReconnecting(true);
          isReconnectingRef.current = true;

          // Exponential backoff: 3s, 6s, 12s, 24s, max 30s
          const backoff = Math.min(
            INITIAL_BACKOFF * Math.pow(2, retryCountRef.current),
            MAX_BACKOFF
          );
          retryCountRef.current++;

          console.log(`Reconnecting in ${backoff}ms (attempt ${retryCountRef.current})`);
          reconnectTimeoutRef.current = setTimeout(connect, backoff);
        }
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
      };

      wsRef.current = ws;
    };

    /**
     * Fetch job progress history after reconnection
     * Option B: Ensures no updates are missed during disconnect
     */
    const fetchJobHistory = async (jobIds: string[], token: string) => {
      for (const jobId of jobIds) {
        try {
          // Issue #2: Use ref for last connected timestamp (avoid stale reads)
          const sinceTimestamp = lastConnectedTimeRef.current.get(jobId) || 0;

          const response = await fetch(
            `/api/jobs/${jobId}/progress-history?since=${sinceTimestamp}`,
            {
              headers: {
                Authorization: `Bearer ${token}`
              }
            }
          );

          if (!response.ok) {
            const errorMsg = `Failed to load progress history for job ${jobId}`;
            console.error(errorMsg, response.statusText);
            setHistoryError(errorMsg); // Issue #5: Set error state
            continue;
          }

          const events: ProgressUpdate[] = await response.json();

          // Issue #8: Batch state updates (reduce re-renders)
          if (events.length > 0) {
            setJobProgress(prev => {
              const next = new Map(prev);
              for (const event of events) {
                const update: ProgressUpdate = { ...event };
                update.timestamp = event.timestamp || Date.now();
                next.set(update.job_id, update);
              }
              return next;
            });
          }
        } catch (error) {
          const errorMsg = `Failed to load progress history for job ${jobId}`;
          console.error(errorMsg, error);
          setHistoryError(errorMsg); // Issue #5: Set error state
        }
      }
    };

    connect();

    return () => {
      // Cleanup on unmount
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        const ws = wsRef.current;
        wsRef.current = null; // Prevent reconnection
        ws.close();
      }
    };
  }, []);

  // Cleanup completed/failed jobs after TTL
  useEffect(() => {
    const cleanup = setInterval(() => {
      setJobProgress(prev => {
        const now = Date.now();
        const filtered = new Map<string, ProgressUpdate>();

        for (const [id, progress] of prev) {
          const isActive = progress.status === 'pending' || progress.status === 'processing';
          const isRecent = progress.timestamp && (now - progress.timestamp) < COMPLETED_JOB_TTL;

          if (isActive || isRecent) {
            filtered.set(id, progress);
          } else {
            // Remove from monitored jobs when cleaned up
            monitoredJobsRef.current.delete(id);
          }
        }

        return filtered;
      });
    }, CLEANUP_INTERVAL);

    return () => clearInterval(cleanup);
  }, []);

  return { jobProgress, isConnected, reconnecting, authStatus, historyError };
}
