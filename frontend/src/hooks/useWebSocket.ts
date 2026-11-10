import { useEffect, useRef, useState } from "react";
import useWebSocketLib, { ReadyState } from "react-use-websocket";
import { useImportProgressStore } from "@/stores/importProgressStore";

/**
 * Progress update data structure received from WebSocket
 */
export interface ProgressUpdate {
  job_id: string;
  event_id?: string;
  created_at?: string;
  status:
    | "pending"
    | "processing"
    | "completed"
    | "failed"
    | "completed_with_errors";
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
  authStatus: "pending" | "authenticated" | "failed";
  historyError: string | null;
  retryHistory: () => Promise<void>;
}

// WebSocket configuration constants
const WS_URL =
  import.meta.env.VITE_WS_URL ||
  `${window.location.protocol === "https:" ? "wss:" : "ws:"}//${window.location.host}/api/ws/progress`;
const MAX_BACKOFF = 30_000; // 30 seconds
const INITIAL_BACKOFF = 3000; // 3 seconds (not used anymore - react-use-websocket handles it)
const CLEANUP_INTERVAL = 60_000; // 1 minute
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
  const [jobProgress, setJobProgress] = useState<Map<string, ProgressUpdate>>(
    new Map()
  );
  const [authStatus, setAuthStatus] = useState<
    "pending" | "authenticated" | "failed"
  >("pending");
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [reconnecting, setReconnecting] = useState(false);

  const monitoredJobsRef = useRef<Set<string>>(new Set());
  const lastConnectedTimeRef = useRef<Map<string, number>>(new Map());
  const isReconnectingRef = useRef(false);
  const connectionEpoch = useRef(0);

  // Get auth token from localStorage (optional in dev mode)
  const token = localStorage.getItem("token");
  // In dev mode, connect without token (backend will use default user)
  const wsUrl = token ? `${WS_URL}?token=${token}` : WS_URL;

  // ===== react-use-websocket Integration =====
  const { lastJsonMessage, readyState, sendJsonMessage } = useWebSocketLib(
    wsUrl, // null if no token (won't connect)
    {
      // Connection lifecycle
      onOpen: () => {
        console.log("WebSocket connected");
        setReconnecting(false);

        // Send auth message (backend expects this)
        if (token) {
          sendJsonMessage({
            type: "auth",
            token,
          });
        }
      },

      onClose: (event) => {
        console.log("WebSocket disconnected", event.code);
        setAuthStatus("pending");
        connectionEpoch.current += 1;

        // Don't set reconnecting on intentional close (code 1000)
        if (event.code !== 1000) {
          setReconnecting(true);
          isReconnectingRef.current = true;
        }
      },

      onError: (event) => {
        console.error("WebSocket error:", event);
      },

      // Reconnection configuration
      shouldReconnect: (closeEvent) => {
        // Don't reconnect on intentional closure
        return (
          closeEvent.code !== 1000 &&
          closeEvent.code !== 1008 &&
          closeEvent.code !== 4001
        );
      },
      reconnectAttempts: 10,
      reconnectInterval: (attemptNumber) => {
        // Exponential backoff: 3s, 6s, 12s, 24s, max 30s
        return Math.min(INITIAL_BACKOFF * 2 ** attemptNumber, MAX_BACKOFF);
      },
      retryOnError: true,
      onReconnectStop: (numAttempts) => {
        console.error(`Failed to reconnect after ${numAttempts} attempts`);
        setReconnecting(false);
        // TODO: Show user-friendly error banner
      },

      // Heartbeat configuration (keeps connection alive through load balancers)
      heartbeat: {
        message: JSON.stringify({ type: "ping" }),
        returnMessage: JSON.stringify({ type: "pong" }),
        timeout: 60_000, // 1 minute - detect dead connections
        interval: 25_000, // 25 seconds - keep connection alive
      },

      // Share connection across components
      share: true,

      // Filter heartbeat messages (don't trigger re-renders)
      filter: (message) => {
        try {
          const data = JSON.parse(message.data);
          // Filter out ping/pong messages
          return data.type !== "ping" && data.type !== "pong";
        } catch {
          return true; // Keep malformed messages for error logging
        }
      },
    },
    // Always connect (backend handles auth in dev mode)
    true
  );

  // ===== Handle Incoming Messages =====
  useEffect(() => {
    if (!lastJsonMessage) return;

    const data = lastJsonMessage as any;

    // Handle auth confirmation/failure
    if (data.type === "auth_confirmed" && data.authenticated) {
      setAuthStatus("authenticated");
      if (isReconnectingRef.current) {
        isReconnectingRef.current = false;
        void fetchJobHistory(Array.from(monitoredJobsRef.current));
      }
      return;
    }

    if (data.type === "auth_failed") {
      setAuthStatus("failed");
      console.error("WebSocket authentication failed:", data.error);
      return;
    }

    // Handle video-level import progress updates
    if (data.type === "import_progress") {
      const { video_id, progress, stage } = data;
      useImportProgressStore.getState().setProgress(video_id, progress, stage);
      return;
    }

    // Handle job-level progress updates
    if (
      !(
        data.job_id &&
        [
          "pending",
          "processing",
          "completed",
          "failed",
          "completed_with_errors",
        ].includes(data.status)
      )
    )
      return;
    const update: ProgressUpdate = normalizeProgress(data);

    // Add timestamp for cleanup logic
    update.timestamp = Date.now();

    // Track last connected time for this job
    lastConnectedTimeRef.current.set(update.job_id, update.timestamp);

    // Track this job for history API on reconnect
    monitoredJobsRef.current.add(update.job_id);

    // Remove from monitored set after TTL if terminal state
    if (
      ["completed", "failed", "completed_with_errors"].includes(update.status)
    ) {
      setTimeout(() => {
        monitoredJobsRef.current.delete(update.job_id);
      }, COMPLETED_JOB_TTL);
    }

    // Update job progress state
    setJobProgress((prev) => {
      const next = new Map(prev);
      const current = next.get(update.job_id);
      if (!current || canAdvance(current, update))
        next.set(update.job_id, update);
      return next;
    });
  }, [lastJsonMessage]);

  // ===== History API Integration =====
  const fetchJobHistory = async (jobIds: string[]) => {
    const epoch = connectionEpoch.current;
    let failed = false;
    setHistoryError(null);
    for (const jobId of jobIds) {
      try {
        // Replay persisted history: client receipt times are not server cursors.
        for (let offset = 0; ; offset += 100) {
          const response = await fetch(
            `/api/jobs/${jobId}/progress-history?offset=${offset}&limit=100`,
            {
              headers: token ? { Authorization: `Bearer ${token}` } : {},
            }
          );
          if (!response.ok) throw new Error(`History HTTP ${response.status}`);
          const events = await response.json();
          if (connectionEpoch.current !== epoch) return;
          setJobProgress((prev) => {
            const next = new Map(prev);
            for (const event of events) {
              const update = normalizeProgress({
                ...event,
                ...(event.progress_data ?? event),
                timestamp: event.created_at
                  ? Date.parse(event.created_at)
                  : (event.timestamp ?? Date.now()),
              });
              if (!update.job_id) continue;
              const current = next.get(update.job_id);
              if (!current || canAdvance(current, update))
                next.set(update.job_id, update);
            }
            return next;
          });
          if (events.length < 100) break;
        }
      } catch {
        if (connectionEpoch.current !== epoch) return;
        failed = true;
        setHistoryError(`Failed to load progress history for job ${jobId}`);
      }
    }
    if (!failed && connectionEpoch.current === epoch) setHistoryError(null);
  };

  // ===== Automatic Cleanup (5 min TTL) =====
  useEffect(() => {
    const cleanup = setInterval(() => {
      setJobProgress((prev) => {
        const now = Date.now();
        const filtered = new Map<string, ProgressUpdate>();

        for (const [id, progress] of prev) {
          const isActive =
            progress.status === "pending" || progress.status === "processing";
          const isRecent =
            progress.timestamp && now - progress.timestamp < COMPLETED_JOB_TTL;

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

    return () => {
      clearInterval(cleanup);
      connectionEpoch.current += 1;
    };
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
    historyError,
    retryHistory: () => fetchJobHistory(Array.from(monitoredJobsRef.current)),
  };
}

function canAdvance(current: ProgressUpdate, update: ProgressUpdate): boolean {
  if (current.event_id && current.event_id === update.event_id) return false;
  if (
    current.created_at &&
    update.created_at &&
    Date.parse(update.created_at) < Date.parse(current.created_at)
  )
    return false;
  const terminal = ["completed", "failed", "completed_with_errors"];
  if (terminal.includes(current.status) && !terminal.includes(update.status))
    return false;
  if (update.current_video < current.current_video) return false;
  if (
    update.current_video === current.current_video &&
    update.progress < current.progress
  )
    return false;
  return true;
}

function normalizeProgress(data: Record<string, any>): ProgressUpdate {
  return {
    ...data,
    event_id: data.event_id ?? data.id,
    status: ["started", "success", "error"].includes(data.status)
      ? "processing"
      : data.status,
    current_video:
      data.current_video ?? (data.processed ?? 0) + (data.failed ?? 0),
    total_videos: data.total_videos ?? data.total ?? 0,
    message: data.message ?? "",
  } as ProgressUpdate;
}
