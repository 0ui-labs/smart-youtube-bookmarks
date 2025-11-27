import { useState, useEffect, useRef } from 'react';
import useWebSocketLib, { ReadyState } from 'react-use-websocket';
import { useImportProgressStore } from '@/stores/importProgressStore';

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
  timestamp?: number;
}

/**
 * Return type for useWebSocket hook
 */
export interface UseWebSocketReturn {
  jobProgress: Map<string, ProgressUpdate>;
  isConnected: boolean;
  reconnecting: boolean;
  readyState: ReadyState; // NEW: Expose react-use-websocket readyState
  sendJsonMessage: (message: any) => void; // NEW: Expose sendJsonMessage
  authStatus: 'pending' | 'authenticated' | 'failed';
  historyError: string | null;
}

// WebSocket configuration constants
const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:8000/api/ws/progress';
const MAX_BACKOFF = 30000; // 30 seconds
const INITIAL_BACKOFF = 3000; // 3 seconds (not used anymore - react-use-websocket handles it)
const CLEANUP_INTERVAL = 60000; // 1 minute
const COMPLETED_JOB_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Custom hook for WebSocket connection to track job progress updates
 *
 * HYBRID APPROACH:
 * - Uses react-use-websocket for connection management (fixes Strict Mode, adds heartbeat, message queue)
 * - Preserves custom History API integration, job tracking, and cleanup logic
 *
 * Features:
 * - ✅ React 18 Strict Mode safe (no double-mounting issues)
 * - ✅ Automatic reconnection with exponential backoff (up to 10 attempts)
 * - ✅ Heartbeat/keep-alive (ping every 25s, timeout after 60s)
 * - ✅ Message queue (pre-connection messages buffered)
 * - ✅ History API integration on reconnect
 * - ✅ Job cleanup after 5-minute TTL
 * - ✅ Shared connection across components
 *
 * @returns WebSocket state and job progress map
 */
export function useWebSocket(): UseWebSocketReturn {
  const [jobProgress, setJobProgress] = useState<Map<string, ProgressUpdate>>(new Map());
  const [authStatus, setAuthStatus] = useState<'pending' | 'authenticated' | 'failed'>('pending');
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [reconnecting, setReconnecting] = useState(false);

  const monitoredJobsRef = useRef<Set<string>>(new Set());
  const lastConnectedTimeRef = useRef<Map<string, number>>(new Map());
  const isReconnectingRef = useRef(false);

  // Get auth token from localStorage
  const token = localStorage.getItem('token');
  const wsUrl = token ? `${WS_URL}?token=${token}` : null;

  // ===== react-use-websocket Integration =====
  const {
    lastJsonMessage,
    readyState,
    sendJsonMessage,
  } = useWebSocketLib(
    wsUrl, // null if no token (won't connect)
    {
      // Connection lifecycle
      onOpen: () => {
        console.log('WebSocket connected');
        setReconnecting(false);
        isReconnectingRef.current = false;

        // Send auth message (backend expects this)
        if (token) {
          sendJsonMessage({
            type: 'auth',
            token: token
          });
        }

        // Fetch history if this is a reconnection
        if (isReconnectingRef.current && monitoredJobsRef.current.size > 0) {
          fetchJobHistory(Array.from(monitoredJobsRef.current), token!);
        }
      },

      onClose: (event) => {
        console.log('WebSocket disconnected', event.code);
        setAuthStatus('pending');

        // Don't set reconnecting on intentional close (code 1000)
        if (event.code !== 1000) {
          setReconnecting(true);
          isReconnectingRef.current = true;
        }
      },

      onError: (event) => {
        console.error('WebSocket error:', event);
      },

      // Reconnection configuration
      shouldReconnect: (closeEvent) => {
        // Don't reconnect on intentional closure
        return closeEvent.code !== 1000;
      },
      reconnectAttempts: 10,
      reconnectInterval: (attemptNumber) => {
        // Exponential backoff: 3s, 6s, 12s, 24s, max 30s
        return Math.min(INITIAL_BACKOFF * Math.pow(2, attemptNumber), MAX_BACKOFF);
      },
      retryOnError: true,
      onReconnectStop: (numAttempts) => {
        console.error(`Failed to reconnect after ${numAttempts} attempts`);
        setReconnecting(false);
        // TODO: Show user-friendly error banner
      },

      // Heartbeat configuration (keeps connection alive through load balancers)
      heartbeat: {
        message: JSON.stringify({ type: 'ping' }),
        returnMessage: JSON.stringify({ type: 'pong' }),
        timeout: 60000, // 1 minute - detect dead connections
        interval: 25000, // 25 seconds - keep connection alive
      },

      // Share connection across components
      share: true,

      // Filter heartbeat messages (don't trigger re-renders)
      filter: (message) => {
        try {
          const data = JSON.parse(message.data);
          // Filter out ping/pong messages
          return data.type !== 'ping' && data.type !== 'pong';
        } catch {
          return true; // Keep malformed messages for error logging
        }
      },
    },
    // Only connect if token exists
    !!token
  );

  // ===== Handle Incoming Messages =====
  useEffect(() => {
    if (!lastJsonMessage) return;

    const data = lastJsonMessage as any;

    // Handle auth confirmation/failure
    if (data.type === 'auth_confirmed' && data.authenticated) {
      setAuthStatus('authenticated');
      return;
    }

    if (data.type === 'auth_failed') {
      setAuthStatus('failed');
      console.error('WebSocket authentication failed:', data.error);
      return;
    }

    // Handle video-level import progress updates
    if (data.type === 'import_progress') {
      const { video_id, progress, stage } = data;
      useImportProgressStore.getState().setProgress(video_id, progress, stage);
      return;
    }

    // Handle job-level progress updates
    const update: ProgressUpdate = data;

    // Add timestamp for cleanup logic
    update.timestamp = Date.now();

    // Track last connected time for this job
    lastConnectedTimeRef.current.set(update.job_id, update.timestamp);

    // Track this job for history API on reconnect
    monitoredJobsRef.current.add(update.job_id);

    // Remove from monitored set after TTL if terminal state
    if (['completed', 'failed', 'completed_with_errors'].includes(update.status)) {
      setTimeout(() => {
        monitoredJobsRef.current.delete(update.job_id);
      }, COMPLETED_JOB_TTL);
    }

    // Update job progress state
    setJobProgress(prev => {
      const next = new Map(prev);
      next.set(update.job_id, update);
      return next;
    });
  }, [lastJsonMessage]);

  // ===== History API Integration =====
  const fetchJobHistory = async (jobIds: string[], token: string) => {
    for (const jobId of jobIds) {
      try {
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
          console.error('Failed to load progress history:', { jobId, status: response.statusText });
          setHistoryError(errorMsg);
          continue;
        }

        const events: ProgressUpdate[] = await response.json();

        // Batch state updates (reduce re-renders)
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
        console.error('Failed to load progress history:', {
          jobId,
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined
        });
        setHistoryError(errorMsg);
      }
    }
  };

  // ===== Automatic Cleanup (5 min TTL) =====
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

  // ===== Derived State =====
  const isConnected = readyState === ReadyState.OPEN;

  return {
    jobProgress,
    isConnected,
    reconnecting,
    readyState,
    sendJsonMessage,
    authStatus,
    historyError
  };
}
