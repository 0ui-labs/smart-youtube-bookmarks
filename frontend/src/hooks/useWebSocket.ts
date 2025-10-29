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

  const wsRef = useRef<WebSocket | null>(null);
  const retryCountRef = useRef(0);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
  const isReconnectingRef = useRef(false); // Track if this is a reconnection
  const monitoredJobsRef = useRef<Set<string>>(new Set()); // Track jobs for history API

  useEffect(() => {
    const connect = () => {
      // Get auth token from localStorage
      const token = localStorage.getItem('token');
      if (!token) {
        console.error('No auth token found for WebSocket connection');
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

        // OPTION B: History API Integration
        // Fetch missed updates for monitored jobs after reconnect
        if (isReconnectingRef.current && monitoredJobsRef.current.size > 0) {
          await fetchJobHistory(Array.from(monitoredJobsRef.current), token);
        }

        // Reset reconnection flags after successful reconnect
        if (isReconnectingRef.current) {
          setReconnecting(false);
          retryCountRef.current = 0;
          isReconnectingRef.current = false;
        }
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          // Handle auth confirmation/failure messages
          if (data.type === 'auth_confirmed' && data.authenticated) {
            setAuthStatus('authenticated');
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

          // Track this job for history API on reconnect
          monitoredJobsRef.current.add(update.job_id);

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
          // Use functional setState to get latest jobProgress
          let sinceTimestamp = 0;
          setJobProgress(prev => {
            const lastUpdate = prev.get(jobId);
            sinceTimestamp = lastUpdate?.timestamp || 0;
            return prev; // No change, just reading
          });

          const response = await fetch(
            `/api/jobs/${jobId}/progress-history?since=${sinceTimestamp}`,
            {
              headers: {
                Authorization: `Bearer ${token}`
              }
            }
          );

          if (!response.ok) {
            console.error(`Failed to fetch history for job ${jobId}:`, response.statusText);
            continue;
          }

          const events: ProgressUpdate[] = await response.json();

          // Merge events into state
          events.forEach(event => {
            event.timestamp = event.timestamp || Date.now();
            setJobProgress(prev => {
              const next = new Map(prev);
              next.set(event.job_id, event);
              return next;
            });
          });
        } catch (error) {
          console.error(`Error fetching history for job ${jobId}:`, error);
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

  return { jobProgress, isConnected, reconnecting, authStatus };
}
