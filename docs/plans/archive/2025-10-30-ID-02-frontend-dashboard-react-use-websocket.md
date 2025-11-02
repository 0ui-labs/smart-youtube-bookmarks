# Frontend Dashboard with react-use-websocket Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a production-ready real-time job progress dashboard using react-use-websocket library with hybrid approach that preserves our custom History API integration, job tracking, and automatic cleanup features.

**Architecture:** Refactor existing custom WebSocket hook to use battle-tested `react-use-websocket` library for connection management (fixes React 18 Strict Mode issues, adds heartbeat, message queue, retry limits) while preserving our domain-specific features (History API sync on reconnect, job tracking, 5-minute TTL cleanup). Create Dashboard page with JobProgressCard components and ConnectionStatusBanner for real-time job monitoring.

**Tech Stack:**
- React 18.2 + TypeScript 5.3 (strict mode)
- react-use-websocket 4.13.0 (connection management)
- @tanstack/react-query 5.17 (server state)
- Tailwind CSS 3.4 (styling)
- Vitest 1.2 (testing)
- FastAPI WebSocket backend (existing: `/api/ws/progress`)

---

## Context: Why This Refactoring?

### Problems with Existing Custom Hook
1. **React 18 Strict Mode Double-Mounting** - Creates 2 WebSocket connections, memory leak
2. **No Message Queue** - Messages sent before `onopen` are lost
3. **No Heartbeat** - Idle connections closed by load balancers/proxies (60s timeout)
4. **No Retry Limit** - Infinite reconnect loop on permanent errors
5. **Race Condition** - History API fetch can overlap with new WebSocket messages

### What We're Keeping
- ✅ History API integration on reconnect (`/api/jobs/{job_id}/progress-history`)
- ✅ Job tracking with `monitoredJobsRef`
- ✅ Automatic cleanup (5 min TTL for completed jobs)
- ✅ Timestamp-based deduplication (`since` parameter)
- ✅ Batch state updates (reduce re-renders)

---

## Task 1: Refactor useWebSocket Hook to Hybrid Approach

**Goal:** Replace custom WebSocket connection management with `react-use-websocket` while preserving all domain-specific features.

**Files:**
- Modify: `frontend/src/hooks/useWebSocket.ts` (complete rewrite, 265 lines → ~180 lines)
- Modify: `frontend/src/hooks/useWebSocket.test.ts` (update mocks for react-use-websocket)

### Step 1: Write failing test for react-use-websocket integration

**File:** `frontend/src/hooks/useWebSocket.test.ts`

Add this test at the top of the describe block (after line 64):

```typescript
describe('Hybrid Approach: react-use-websocket Integration', () => {
  it('uses react-use-websocket for connection management', async () => {
    // This test will fail until we refactor to use react-use-websocket
    const { result } = renderHook(() => useWebSocket());

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    // Should have readyState from react-use-websocket
    expect(result.current.readyState).toBeDefined();
    expect([0, 1, 2, 3]).toContain(result.current.readyState); // Valid WebSocket states
  });

  it('provides sendJsonMessage function from react-use-websocket', async () => {
    const { result } = renderHook(() => useWebSocket());

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    // Should have sendJsonMessage function
    expect(result.current.sendJsonMessage).toBeDefined();
    expect(typeof result.current.sendJsonMessage).toBe('function');
  });
});
```

### Step 2: Run test to verify it fails

```bash
cd frontend
npm test -- useWebSocket.test.ts
```

**Expected Output:**
```
FAIL  src/hooks/useWebSocket.test.ts
  ✗ uses react-use-websocket for connection management
    TypeError: result.current.readyState is not defined
  ✗ provides sendJsonMessage function from react-use-websocket
    TypeError: result.current.sendJsonMessage is not defined
```

### Step 3: Backup existing implementation

```bash
cd frontend/src/hooks
cp useWebSocket.ts useWebSocket.ts.backup
```

### Step 4: Implement hybrid approach (minimal version to pass tests)

**File:** `frontend/src/hooks/useWebSocket.ts`

Replace entire file with:

```typescript
import { useState, useEffect, useRef } from 'react';
import useWebSocket, { ReadyState } from 'react-use-websocket';

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
  } = useWebSocket(
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

    // Handle progress updates
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
          console.error(errorMsg, response.statusText);
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
        console.error(errorMsg, error);
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
```

### Step 5: Run test to verify it passes

```bash
cd frontend
npm test -- useWebSocket.test.ts
```

**Expected Output:**
```
PASS  src/hooks/useWebSocket.test.ts
  ✓ uses react-use-websocket for connection management
  ✓ provides sendJsonMessage function from react-use-websocket
```

**Note:** Other tests may fail at this point - that's expected. We'll fix them in the next task.

### Step 6: Commit

```bash
git add frontend/src/hooks/useWebSocket.ts frontend/src/hooks/useWebSocket.test.ts
git commit -m "refactor: migrate useWebSocket to react-use-websocket hybrid approach

- Uses react-use-websocket for connection management
- Fixes React 18 Strict Mode double-mounting issues
- Adds heartbeat/keep-alive (ping every 25s)
- Adds message queue for pre-connection messages
- Adds retry limit (10 attempts, then stop)
- Preserves History API integration
- Preserves job tracking and 5-min TTL cleanup
- Exposes readyState and sendJsonMessage to consumers

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 2: Fix All Existing WebSocket Tests

**Goal:** Update all existing tests to work with react-use-websocket mock instead of custom WebSocket mock.

**Files:**
- Modify: `frontend/src/hooks/useWebSocket.test.ts` (update all 19 tests)

### Step 1: Install and configure react-use-websocket test mock

Add mock setup at top of test file (after imports, before MockWebSocket class):

```typescript
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useWebSocket } from './useWebSocket';

// Mock react-use-websocket
vi.mock('react-use-websocket', () => {
  let mockLastJsonMessage: any = null;
  let mockReadyState = 0; // CONNECTING
  let mockSendJsonMessage: any = vi.fn();
  let mockOnOpenCallback: (() => void) | null = null;

  return {
    default: (url: string | null, options: any) => {
      // Store callbacks
      if (options?.onOpen) {
        mockOnOpenCallback = options.onOpen;
      }

      // Simulate connection on next tick
      setTimeout(() => {
        if (url && mockReadyState === 0) {
          mockReadyState = 1; // OPEN
          mockOnOpenCallback?.();
        }
      }, 0);

      return {
        lastJsonMessage: mockLastJsonMessage,
        readyState: mockReadyState,
        sendJsonMessage: mockSendJsonMessage,
      };
    },
    ReadyState: {
      CONNECTING: 0,
      OPEN: 1,
      CLOSING: 2,
      CLOSED: 3,
      UNINSTANTIATED: -1,
    },
    __setMockLastJsonMessage: (message: any) => {
      mockLastJsonMessage = message;
    },
    __setMockReadyState: (state: number) => {
      mockReadyState = state;
    },
    __getMockSendJsonMessage: () => mockSendJsonMessage,
    __triggerOnOpen: () => {
      mockOnOpenCallback?.();
    },
  };
});
```

### Step 2: Remove old MockWebSocket class

Delete the `MockWebSocket` class (lines 6-45) and the line `global.WebSocket = MockWebSocket as any;` (line 48).

### Step 3: Update beforeEach/afterEach hooks

```typescript
beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  localStorage.clear();
  localStorage.setItem('token', 'test-token-123');

  // Reset react-use-websocket mock state
  const mockModule = await import('react-use-websocket');
  (mockModule as any).__setMockLastJsonMessage(null);
  (mockModule as any).__setMockReadyState(0);
});

afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
  localStorage.clear();
});
```

### Step 4: Update individual tests to use new mock

Example for "connects WITH token in URL" test:

```typescript
it('connects WITH token in URL (Query Parameter Auth)', async () => {
  const { result } = renderHook(() => useWebSocket());

  await act(async () => {
    await vi.advanceTimersByTimeAsync(0);
  });

  // Should be in OPEN state
  expect(result.current.readyState).toBe(1); // ReadyState.OPEN
  expect(result.current.isConnected).toBe(true);
});
```

### Step 5: Run tests to verify they pass

```bash
cd frontend
npm test -- useWebSocket.test.ts
```

**Expected Output:**
```
PASS  src/hooks/useWebSocket.test.ts
  ✓ Hybrid Approach: react-use-websocket Integration (2)
  ✓ Option B Security: Post-Connection Authentication (3)
  ✓ Reconnection with Exponential Backoff (4)
  ✓ Progress Update Handling (5)
  ✓ History API Integration (3)
  ✓ Automatic Cleanup (2)

Tests: 19 passed, 19 total
```

**Note:** You'll need to update each test individually. Focus on:
- Removing references to `MockWebSocket.instances`
- Using `result.current.readyState` instead of `wsInstance.readyState`
- Using `result.current.sendJsonMessage` instead of `wsInstance.send()`
- Using mock module's `__setMockLastJsonMessage()` to simulate incoming messages

### Step 6: Commit

```bash
git add frontend/src/hooks/useWebSocket.test.ts
git commit -m "test: update WebSocket tests for react-use-websocket mock

- Replace custom MockWebSocket with react-use-websocket mock
- Update all 19 tests to use new mock API
- All tests passing

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 3: Create Dashboard Page Component

**Goal:** Create main Dashboard page that displays all active jobs with real-time progress.

**Files:**
- Create: `frontend/src/pages/Dashboard.tsx`
- Create: `frontend/src/pages/Dashboard.test.tsx`

### Step 1: Write failing test

**File:** `frontend/src/pages/Dashboard.test.tsx`

```typescript
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { Dashboard } from './Dashboard';
import { ReadyState } from 'react-use-websocket';

// Mock dependencies
vi.mock('../hooks/useWebSocket', () => ({
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

describe('Dashboard', () => {
  it('renders dashboard title', () => {
    render(<Dashboard />);
    expect(screen.getByText('Job Progress Dashboard')).toBeInTheDocument();
  });

  it('shows connection status', () => {
    render(<Dashboard />);
    expect(screen.getByText(/Connecting/i)).toBeInTheDocument();
  });

  it('shows empty state when no jobs', () => {
    render(<Dashboard />);
    expect(screen.getByText(/No active jobs/i)).toBeInTheDocument();
  });
});
```

### Step 2: Run test to verify it fails

```bash
cd frontend
npm test -- Dashboard.test.tsx
```

**Expected Output:**
```
FAIL  src/pages/Dashboard.test.tsx
  ✗ renders dashboard title
    Unable to find element with text: Job Progress Dashboard
```

### Step 3: Create Dashboard directory and component

```bash
cd frontend/src
mkdir -p pages
```

**File:** `frontend/src/pages/Dashboard.tsx`

```typescript
import { useWebSocket } from '../hooks/useWebSocket';
import { ReadyState } from 'react-use-websocket';

/**
 * Dashboard Page - Real-time job progress monitoring
 *
 * Displays all active video processing jobs with live progress updates
 * via WebSocket connection.
 */
export function Dashboard() {
  const { jobProgress, readyState, reconnecting } = useWebSocket();

  // Convert Map to Array for rendering
  const jobs = Array.from(jobProgress.values());

  // Connection status
  const isConnected = readyState === ReadyState.OPEN;
  const isConnecting = readyState === ReadyState.CONNECTING;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <h1 className="text-2xl font-bold text-gray-900">
            Job Progress Dashboard
          </h1>
        </div>
      </header>

      {/* Connection Status Banner */}
      {isConnecting && (
        <div className="bg-yellow-50 border-b border-yellow-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2">
            <p className="text-sm text-yellow-800">
              ⏳ Connecting to progress feed...
            </p>
          </div>
        </div>
      )}

      {reconnecting && (
        <div className="bg-orange-50 border-b border-orange-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2">
            <p className="text-sm text-orange-800">
              🔄 Connection lost. Reconnecting...
            </p>
          </div>
        </div>
      )}

      {isConnected && !reconnecting && (
        <div className="bg-green-50 border-b border-green-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2">
            <p className="text-sm text-green-800">
              ✓ Connected - Live updates enabled
            </p>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {jobs.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500 text-lg">
              No active jobs. Upload a CSV to start processing videos.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {jobs.map((job) => (
              <div key={job.job_id} className="bg-white rounded-lg shadow p-4">
                <p className="text-sm font-medium text-gray-900">
                  Job {job.job_id.slice(0, 8)}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {job.message}
                </p>
                <p className="text-xs text-gray-500 mt-2">
                  Progress: {job.progress}% ({job.current_video}/{job.total_videos} videos)
                </p>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
```

### Step 4: Run test to verify it passes

```bash
cd frontend
npm test -- Dashboard.test.tsx
```

**Expected Output:**
```
PASS  src/pages/Dashboard.test.tsx
  ✓ renders dashboard title
  ✓ shows connection status
  ✓ shows empty state when no jobs
```

### Step 5: Commit

```bash
git add frontend/src/pages/Dashboard.tsx frontend/src/pages/Dashboard.test.tsx
git commit -m "feat: create Dashboard page with connection status

- Displays all active jobs from WebSocket
- Shows connection status banner (connecting/reconnecting/connected)
- Empty state for no jobs
- Grid layout for job cards (responsive)
- Basic job info (ID, message, progress)

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 4: Create JobProgressCard Component

**Goal:** Extract job card logic into reusable component with ProgressBar integration.

**Files:**
- Create: `frontend/src/components/JobProgressCard.tsx`
- Create: `frontend/src/components/JobProgressCard.test.tsx`
- Modify: `frontend/src/pages/Dashboard.tsx` (use JobProgressCard)

### Step 1: Write failing test

**File:** `frontend/src/components/JobProgressCard.test.tsx`

```typescript
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

    expect(screen.getByText(/test-job-123/i)).toBeInTheDocument();
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
```

### Step 2: Run test to verify it fails

```bash
cd frontend
npm test -- JobProgressCard.test.tsx
```

**Expected Output:**
```
FAIL  src/components/JobProgressCard.test.tsx
  ✗ renders job information
    Unable to find element
```

### Step 3: Implement JobProgressCard component

**File:** `frontend/src/components/JobProgressCard.tsx`

```typescript
import { ProgressBar } from './ProgressBar';
import type { ProgressUpdate } from '../hooks/useWebSocket';

export interface JobProgressCardProps {
  job: ProgressUpdate;
}

/**
 * JobProgressCard - Displays individual job progress with ProgressBar
 *
 * Shows job ID, status, progress bar, and error messages.
 */
export function JobProgressCard({ job }: JobProgressCardProps) {
  return (
    <div className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow duration-200">
      {/* Card Header */}
      <div className="px-4 pt-4 pb-2 border-b border-gray-200">
        <div className="flex justify-between items-center">
          <h3 className="text-sm font-semibold text-gray-900">
            Job {job.job_id.slice(0, 8)}
          </h3>
          {job.video_id && (
            <span className="text-xs text-gray-500">
              Video: {job.video_id.slice(0, 8)}
            </span>
          )}
        </div>
      </div>

      {/* Card Body - ProgressBar */}
      <div className="p-4">
        <ProgressBar progress={job} />
      </div>
    </div>
  );
}
```

### Step 4: Update Dashboard to use JobProgressCard

**File:** `frontend/src/pages/Dashboard.tsx`

Replace the job mapping section (around line 65):

```typescript
// OLD:
{jobs.map((job) => (
  <div key={job.job_id} className="bg-white rounded-lg shadow p-4">
    <p className="text-sm font-medium text-gray-900">
      Job {job.job_id.slice(0, 8)}
    </p>
    {/* ... */}
  </div>
))}

// NEW:
import { JobProgressCard } from '../components/JobProgressCard';

{jobs.map((job) => (
  <JobProgressCard key={job.job_id} job={job} />
))}
```

### Step 5: Run tests to verify they pass

```bash
cd frontend
npm test -- JobProgressCard.test.tsx Dashboard.test.tsx
```

**Expected Output:**
```
PASS  src/components/JobProgressCard.test.tsx
  ✓ renders job information
  ✓ displays ProgressBar component
  ✓ shows error message when present

PASS  src/pages/Dashboard.test.tsx
  ✓ renders dashboard title
  ✓ shows connection status
  ✓ shows empty state when no jobs
```

### Step 6: Commit

```bash
git add frontend/src/components/JobProgressCard.tsx frontend/src/components/JobProgressCard.test.tsx frontend/src/pages/Dashboard.tsx
git commit -m "feat: create JobProgressCard component

- Reusable card component for individual jobs
- Integrates existing ProgressBar component
- Displays job ID, video ID, and status
- Responsive card with hover effects
- Update Dashboard to use JobProgressCard

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 5: Add Dashboard Navigation to App

**Goal:** Add Dashboard to routing and navigation menu.

**Files:**
- Modify: `frontend/src/App.tsx` (add Dashboard route)

### Step 1: Write failing test for navigation

**File:** `frontend/src/App.test.tsx` (create if doesn't exist)

```typescript
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import App from './App';

describe('App Navigation', () => {
  it('shows navigation menu with Lists, Videos, Dashboard links', () => {
    render(<App />);

    expect(screen.getByText('Lists')).toBeInTheDocument();
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
  });

  it('navigates to Dashboard when clicked', () => {
    render(<App />);

    const dashboardLink = screen.getByText('Dashboard');
    fireEvent.click(dashboardLink);

    expect(screen.getByText('Job Progress Dashboard')).toBeInTheDocument();
  });
});
```

### Step 2: Run test to verify it fails

```bash
cd frontend
npm test -- App.test.tsx
```

**Expected Output:**
```
FAIL  src/App.test.tsx
  ✗ shows navigation menu with Lists, Videos, Dashboard links
    Unable to find element with text: Dashboard
```

### Step 3: Update App.tsx with navigation and Dashboard route

**File:** `frontend/src/App.tsx`

```typescript
import { useState } from 'react';
import { ListsPage } from './components/ListsPage';
import { VideosPage } from './components/VideosPage';
import { Dashboard } from './pages/Dashboard';

function App() {
  const [currentView, setCurrentView] = useState<'lists' | 'videos' | 'dashboard'>('lists');
  const [selectedListId, setSelectedListId] = useState<string | null>(null);

  const handleSelectList = (listId: string) => {
    setSelectedListId(listId);
    setCurrentView('videos');
  };

  const handleBackToLists = () => {
    setCurrentView('lists');
    setSelectedListId(null);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation Bar */}
      <nav className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-8 h-16 items-center">
            <button
              onClick={() => setCurrentView('lists')}
              className={`px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                currentView === 'lists'
                  ? 'bg-blue-100 text-blue-700'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              Lists
            </button>
            <button
              onClick={() => setCurrentView('dashboard')}
              className={`px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                currentView === 'dashboard'
                  ? 'bg-blue-100 text-blue-700'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              Dashboard
            </button>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      {currentView === 'lists' && <ListsPage onSelectList={handleSelectList} />}
      {currentView === 'videos' && selectedListId && (
        <VideosPage listId={selectedListId} onBack={handleBackToLists} />
      )}
      {currentView === 'dashboard' && <Dashboard />}
    </div>
  );
}

export default App;
```

### Step 4: Run test to verify it passes

```bash
cd frontend
npm test -- App.test.tsx
```

**Expected Output:**
```
PASS  src/App.test.tsx
  ✓ shows navigation menu with Lists, Videos, Dashboard links
  ✓ navigates to Dashboard when clicked
```

### Step 5: Manual verification (optional but recommended)

```bash
cd frontend
npm run dev
```

Open browser to http://localhost:5173 and:
1. Click "Dashboard" in navigation
2. Verify Dashboard page renders
3. Verify connection status shows "Connecting..." or "Connected"
4. Upload a CSV from Lists page
5. Navigate back to Dashboard
6. Verify job cards appear with real-time progress

### Step 6: Commit

```bash
git add frontend/src/App.tsx frontend/src/App.test.tsx
git commit -m "feat: add Dashboard navigation to App

- Add navigation bar with Lists and Dashboard links
- Add Dashboard route to App component
- Active state highlighting for current view
- Tests for navigation functionality

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 6: Create ConnectionStatusBanner Component (Optional Enhancement)

**Goal:** Extract connection status logic into reusable component with retry count.

**Files:**
- Create: `frontend/src/components/ConnectionStatusBanner.tsx`
- Create: `frontend/src/components/ConnectionStatusBanner.test.tsx`
- Modify: `frontend/src/pages/Dashboard.tsx` (use ConnectionStatusBanner)

### Step 1: Write failing test

**File:** `frontend/src/components/ConnectionStatusBanner.test.tsx`

```typescript
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { ConnectionStatusBanner } from './ConnectionStatusBanner';
import { ReadyState } from 'react-use-websocket';

describe('ConnectionStatusBanner', () => {
  it('shows connecting state', () => {
    render(<ConnectionStatusBanner readyState={ReadyState.CONNECTING} reconnecting={false} />);
    expect(screen.getByText(/Connecting/i)).toBeInTheDocument();
  });

  it('shows connected state', () => {
    render(<ConnectionStatusBanner readyState={ReadyState.OPEN} reconnecting={false} />);
    expect(screen.getByText(/Connected/i)).toBeInTheDocument();
  });

  it('shows reconnecting state', () => {
    render(<ConnectionStatusBanner readyState={ReadyState.CLOSED} reconnecting={true} />);
    expect(screen.getByText(/Reconnecting/i)).toBeInTheDocument();
  });

  it('shows disconnected state', () => {
    render(<ConnectionStatusBanner readyState={ReadyState.CLOSED} reconnecting={false} />);
    expect(screen.getByText(/Disconnected/i)).toBeInTheDocument();
  });

  it('hides when uninstantiated', () => {
    const { container } = render(
      <ConnectionStatusBanner readyState={ReadyState.UNINSTANTIATED} reconnecting={false} />
    );
    expect(container.firstChild).toBeNull();
  });
});
```

### Step 2: Run test to verify it fails

```bash
cd frontend
npm test -- ConnectionStatusBanner.test.tsx
```

**Expected Output:**
```
FAIL  src/components/ConnectionStatusBanner.test.tsx
  ✗ shows connecting state
    Unable to find element
```

### Step 3: Implement ConnectionStatusBanner component

**File:** `frontend/src/components/ConnectionStatusBanner.tsx`

```typescript
import { ReadyState } from 'react-use-websocket';

export interface ConnectionStatusBannerProps {
  readyState: ReadyState;
  reconnecting: boolean;
}

/**
 * ConnectionStatusBanner - Visual indicator for WebSocket connection status
 *
 * Displays colored banner with connection state:
 * - Yellow: Connecting (initial connection)
 * - Orange: Reconnecting (connection lost, retrying)
 * - Green: Connected (live updates active)
 * - Red: Disconnected (no connection, stopped retrying)
 */
export function ConnectionStatusBanner({ readyState, reconnecting }: ConnectionStatusBannerProps) {
  // Don't show banner if WebSocket not instantiated
  if (readyState === ReadyState.UNINSTANTIATED) {
    return null;
  }

  // Determine banner state
  const isConnecting = readyState === ReadyState.CONNECTING && !reconnecting;
  const isConnected = readyState === ReadyState.OPEN && !reconnecting;
  const isReconnecting = reconnecting;
  const isDisconnected = readyState === ReadyState.CLOSED && !reconnecting;

  if (isConnecting) {
    return (
      <div className="bg-yellow-50 border-b border-yellow-200" role="status" aria-live="polite">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2">
          <p className="text-sm text-yellow-800">
            <span aria-hidden="true">⏳</span> Connecting to progress feed...
          </p>
        </div>
      </div>
    );
  }

  if (isReconnecting) {
    return (
      <div className="bg-orange-50 border-b border-orange-200" role="status" aria-live="polite">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2">
          <p className="text-sm text-orange-800">
            <span aria-hidden="true">🔄</span> Connection lost. Reconnecting...
          </p>
        </div>
      </div>
    );
  }

  if (isConnected) {
    return (
      <div className="bg-green-50 border-b border-green-200" role="status" aria-live="polite">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2">
          <p className="text-sm text-green-800">
            <span aria-hidden="true">✓</span> Connected - Live updates enabled
          </p>
        </div>
      </div>
    );
  }

  if (isDisconnected) {
    return (
      <div className="bg-red-50 border-b border-red-200" role="alert" aria-live="assertive">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2">
          <p className="text-sm text-red-800">
            <span aria-hidden="true">✗</span> Disconnected - Live updates paused
          </p>
        </div>
      </div>
    );
  }

  return null;
}
```

### Step 4: Update Dashboard to use ConnectionStatusBanner

**File:** `frontend/src/pages/Dashboard.tsx`

Replace the connection status banners (lines 31-64) with:

```typescript
import { ConnectionStatusBanner } from '../components/ConnectionStatusBanner';

// In JSX:
<ConnectionStatusBanner readyState={readyState} reconnecting={reconnecting} />
```

### Step 5: Run tests to verify they pass

```bash
cd frontend
npm test -- ConnectionStatusBanner.test.tsx Dashboard.test.tsx
```

**Expected Output:**
```
PASS  src/components/ConnectionStatusBanner.test.tsx
  ✓ shows connecting state
  ✓ shows connected state
  ✓ shows reconnecting state
  ✓ shows disconnected state
  ✓ hides when uninstantiated

PASS  src/pages/Dashboard.test.tsx
  (all tests still passing)
```

### Step 6: Commit

```bash
git add frontend/src/components/ConnectionStatusBanner.tsx frontend/src/components/ConnectionStatusBanner.test.tsx frontend/src/pages/Dashboard.tsx
git commit -m "feat: create ConnectionStatusBanner component

- Reusable banner for WebSocket connection status
- Four states: connecting, connected, reconnecting, disconnected
- Accessibility: role=status/alert, aria-live
- Update Dashboard to use new component

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 7: Add Comprehensive Integration Tests

**Goal:** Test complete Dashboard flow with mocked WebSocket and job updates.

**Files:**
- Create: `frontend/src/pages/Dashboard.integration.test.tsx`

### Step 1: Write integration test

**File:** `frontend/src/pages/Dashboard.integration.test.tsx`

```typescript
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

    const { rerender } = render(<Dashboard />);

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

    rerender(<Dashboard />);
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
```

### Step 2: Run test to verify it passes

```bash
cd frontend
npm test -- Dashboard.integration.test.tsx
```

**Expected Output:**
```
PASS  src/pages/Dashboard.integration.test.tsx
  ✓ shows empty state when no jobs
  ✓ displays multiple jobs with progress
  ✓ updates UI when job progress changes
  ✓ shows reconnecting banner when connection lost
  ✓ shows error message when job fails

Tests: 5 passed, 5 total
```

### Step 3: Commit

```bash
git add frontend/src/pages/Dashboard.integration.test.tsx
git commit -m "test: add comprehensive Dashboard integration tests

- Test empty state, multiple jobs, progress updates
- Test connection status changes (reconnecting)
- Test error handling (failed jobs)
- Mock useWebSocket hook for controlled testing

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 8: Run Full Test Suite and Build Verification

**Goal:** Verify all tests pass and app builds successfully.

### Step 1: Run all frontend tests

```bash
cd frontend
npm test
```

**Expected Output:**
```
Test Files  8 passed (8)
     Tests  42 passed (42)
  Duration  3.45s
```

**If any tests fail:** Fix them before proceeding. Common issues:
- Import path errors
- Missing mock updates
- Component prop mismatches

### Step 2: Check for TypeScript errors

```bash
cd frontend
npx tsc --noEmit
```

**Expected Output:**
```
(no output = success)
```

**If errors:** Fix all TypeScript errors. Common issues:
- Missing type imports (`ReadyState`, `ProgressUpdate`)
- Incorrect prop types
- Missing return types

### Step 3: Build production bundle

```bash
cd frontend
npm run build
```

**Expected Output:**
```
vite v5.0.11 building for production...
✓ 543 modules transformed.
dist/index.html                   0.45 kB
dist/assets/index-AbC123.js     142.38 kB │ gzip: 45.21 kB
✓ built in 4.32s
```

### Step 4: Verify build output

```bash
ls -lh frontend/dist/assets/
```

**Expected:** See `index-[hash].js` and `index-[hash].css` files.

### Step 5: Manual smoke test (optional but recommended)

```bash
cd frontend
npm run preview
```

Open browser to http://localhost:4173 and:
1. ✓ Navigate to Dashboard
2. ✓ See "No active jobs" message
3. ✓ Connection status shows "Connected" (green banner)
4. ✓ Upload CSV from Lists page
5. ✓ Navigate to Dashboard
6. ✓ See job cards with real-time progress
7. ✓ Watch progress bars update in real-time
8. ✓ Verify completed jobs disappear after 5 minutes

### Step 6: Commit (if any fixes were needed)

```bash
git add .
git commit -m "fix: resolve test failures and build errors

- Fixed TypeScript errors in [files]
- Updated tests for [components]
- Build successful, all tests passing

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 9: Update Documentation

**Goal:** Document the new Dashboard feature and react-use-websocket migration.

**Files:**
- Create: `docs/features/dashboard-real-time-progress.md`
- Modify: `README.md` (add Dashboard section)

### Step 1: Create feature documentation

**File:** `docs/features/dashboard-real-time-progress.md`

```markdown
# Real-Time Progress Dashboard

## Overview

The Dashboard provides real-time monitoring of video processing jobs via WebSocket connection. Users can see live progress updates for all active jobs without page refreshes.

## Features

- **Real-Time Updates:** WebSocket connection with live progress updates
- **Connection Status:** Visual indicators (connecting/connected/reconnecting/disconnected)
- **Job Cards:** Individual cards for each processing job with:
  - Job ID and video ID
  - Progress percentage
  - Video counter (X/Y processed)
  - Status badges (pending/processing/completed/failed)
  - Error messages (when applicable)
- **Auto-Cleanup:** Completed jobs automatically removed after 5 minutes
- **History Sync:** Missed updates fetched on reconnection
- **Responsive Design:** Grid layout adapts to screen size (1/2/3 columns)

## Architecture

### WebSocket Hook (Hybrid Approach)

Uses `react-use-websocket` library for connection management with custom domain logic:

**Connection Management (react-use-websocket):**
- React 18 Strict Mode safe (no double-mounting issues)
- Exponential backoff reconnection (up to 10 attempts)
- Heartbeat/keep-alive (ping every 25s, timeout after 60s)
- Message queue (buffers pre-connection messages)
- Shared connection (single WebSocket for entire app)

**Custom Domain Logic (preserved):**
- History API integration (`/api/jobs/{id}/progress-history`)
- Job tracking with monitored jobs set
- Timestamp-based deduplication
- 5-minute TTL automatic cleanup
- Batch state updates (reduce re-renders)

### Components

```
src/
├── pages/
│   └── Dashboard.tsx              # Main Dashboard page
├── components/
│   ├── JobProgressCard.tsx        # Individual job card
│   ├── ProgressBar.tsx            # Progress visualization (existing)
│   └── ConnectionStatusBanner.tsx # Connection status indicator
└── hooks/
    └── useWebSocket.ts            # WebSocket connection hook
```

## Usage

### User Flow

1. **Navigate to Dashboard:** Click "Dashboard" in navigation menu
2. **View Jobs:** All active jobs displayed in grid layout
3. **Monitor Progress:** Watch progress bars update in real-time
4. **Connection Status:** Banner shows current connection state
5. **Error Handling:** Failed jobs show error messages in red

### For Developers

#### Using the WebSocket Hook

```typescript
import { useWebSocket } from '../hooks/useWebSocket';
import { ReadyState } from 'react-use-websocket';

function MyComponent() {
  const {
    jobProgress,      // Map<string, ProgressUpdate>
    isConnected,      // boolean
    reconnecting,     // boolean
    readyState,       // ReadyState enum
    sendJsonMessage,  // (message: any) => void
  } = useWebSocket();

  const jobs = Array.from(jobProgress.values());

  return (
    <div>
      {jobs.map(job => (
        <div key={job.job_id}>
          {job.message} - {job.progress}%
        </div>
      ))}
    </div>
  );
}
```

#### WebSocket Message Format

```typescript
// Incoming progress update
{
  job_id: "uuid",
  status: "processing" | "completed" | "failed" | "completed_with_errors",
  progress: 45,          // 0-100
  current_video: 9,
  total_videos: 20,
  message: "Processing videos...",
  video_id?: "abc123",   // optional
  error?: "Error message" // optional, for failed jobs
}
```

## Configuration

### Environment Variables

```env
# WebSocket URL (defaults to ws://localhost:8000/api/ws/progress)
VITE_WS_URL=ws://localhost:8000/api/ws/progress

# Backend expects JWT token in query parameter
# Token retrieved from localStorage.getItem('token')
```

### Connection Parameters

```typescript
// Reconnection
reconnectAttempts: 10
reconnectInterval: 3s → 6s → 12s → 24s → 30s (max)

// Heartbeat
interval: 25 seconds (keep connection alive)
timeout: 60 seconds (detect dead connections)

// Cleanup
COMPLETED_JOB_TTL: 5 minutes (remove completed jobs)
CLEANUP_INTERVAL: 1 minute (check for expired jobs)
```

## Testing

### Unit Tests

```bash
# Hook tests
npm test -- useWebSocket.test.ts

# Component tests
npm test -- Dashboard.test.tsx
npm test -- JobProgressCard.test.tsx
npm test -- ConnectionStatusBanner.test.tsx

# Integration tests
npm test -- Dashboard.integration.test.tsx
```

### Manual Testing

1. **Start backend:** `cd backend && uvicorn app.main:app --reload`
2. **Start frontend:** `cd frontend && npm run dev`
3. **Upload CSV:** Go to Lists page → Upload CSV with video IDs
4. **Navigate to Dashboard:** Click "Dashboard" in nav
5. **Verify:**
   - Jobs appear with progress bars
   - Progress updates in real-time
   - Connection status banner shows "Connected"
   - Completed jobs disappear after 5 minutes

### Test Scenarios

- ✅ Multiple concurrent jobs
- ✅ Job completion (success)
- ✅ Job failure (with error message)
- ✅ Connection loss during processing (reconnect)
- ✅ Page refresh (history sync)
- ✅ Multi-tab (separate connections per tab)
- ✅ Backend restart (reconnect after backend comes back)

## Troubleshooting

### Connection Issues

**Symptom:** Dashboard shows "Reconnecting..." indefinitely

**Causes:**
1. Backend not running → Start backend
2. Wrong WebSocket URL → Check `VITE_WS_URL`
3. Invalid token → Check localStorage.getItem('token')
4. CORS issues → Backend should allow WebSocket connections

**Debug:**
```javascript
// Check token
console.log(localStorage.getItem('token'));

// Check WebSocket URL
console.log(import.meta.env.VITE_WS_URL);

// Check browser console for errors
```

### Jobs Not Appearing

**Symptom:** Dashboard shows "No active jobs" but CSV was uploaded

**Causes:**
1. Jobs not tracked yet → Wait for first progress event
2. WebSocket not connected → Check connection status
3. Wrong user token → Each user sees only their jobs

**Debug:**
```javascript
// In browser console
const { jobProgress } = useWebSocket();
console.log(Array.from(jobProgress.entries()));
```

### Performance Issues

**Symptom:** Dashboard laggy with many jobs

**Solutions:**
1. Use `useDeferredValue` for progress percentage (React 18)
2. Implement virtualization with `@tanstack/react-virtual` (>100 jobs)
3. Reduce update frequency in backend (throttle to 5% steps)

## Future Enhancements

- [ ] Job filtering (active/completed/failed)
- [ ] Job search by video ID
- [ ] Detailed job view (modal with full error stack trace)
- [ ] Job statistics (average time, success rate)
- [ ] Export job history to CSV
- [ ] Notifications (browser notifications on job completion)
- [ ] Dark mode support

## References

- [react-use-websocket Documentation](https://github.com/robtaussig/react-use-websocket)
- [WebSocket API MDN](https://developer.mozilla.org/en-US/docs/Web/API/WebSockets_API)
- [TanStack Query Integration](https://tanstack.com/query/latest)
```

### Step 2: Update main README

**File:** `README.md`

Add this section after "Features" section:

```markdown
## Dashboard

Real-time job progress monitoring dashboard with WebSocket connection.

**Features:**
- Live progress updates (no page refresh required)
- Connection status indicator
- Job cards with progress bars
- Error messages for failed jobs
- Auto-cleanup (completed jobs removed after 5 min)
- History sync on reconnection

**Technology:**
- `react-use-websocket` for connection management
- FastAPI WebSocket endpoint (`/api/ws/progress`)
- Redis Pub/Sub for real-time events
- PostgreSQL for progress history persistence

**See:** `docs/features/dashboard-real-time-progress.md` for detailed documentation.
```

### Step 3: Commit

```bash
git add docs/features/dashboard-real-time-progress.md README.md
git commit -m "docs: add Dashboard feature documentation

- Complete feature overview and architecture
- Usage guide for users and developers
- Configuration and testing instructions
- Troubleshooting guide
- Update README with Dashboard section

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Summary

### What We Built

✅ **Refactored WebSocket Hook** - Hybrid approach with react-use-websocket (180 lines, down from 265)
✅ **Dashboard Page** - Real-time job progress monitoring
✅ **JobProgressCard** - Reusable job card component
✅ **ConnectionStatusBanner** - Connection status indicator
✅ **Navigation** - Dashboard link in App menu
✅ **Tests** - 42 tests total (19 hook + 18 component + 5 integration)
✅ **Documentation** - Complete feature docs

### Files Created/Modified

**Created (7 files):**
- `frontend/src/pages/Dashboard.tsx`
- `frontend/src/pages/Dashboard.test.tsx`
- `frontend/src/pages/Dashboard.integration.test.tsx`
- `frontend/src/components/JobProgressCard.tsx`
- `frontend/src/components/JobProgressCard.test.tsx`
- `frontend/src/components/ConnectionStatusBanner.tsx`
- `frontend/src/components/ConnectionStatusBanner.test.tsx`
- `docs/features/dashboard-real-time-progress.md`

**Modified (4 files):**
- `frontend/src/hooks/useWebSocket.ts` (complete rewrite)
- `frontend/src/hooks/useWebSocket.test.ts` (updated for new mock)
- `frontend/src/App.tsx` (added Dashboard route)
- `README.md` (added Dashboard section)

### Git Commits

Total: 9 commits (atomic, descriptive messages)

1. Refactor useWebSocket to react-use-websocket hybrid
2. Update WebSocket tests for new mock
3. Create Dashboard page with connection status
4. Create JobProgressCard component
5. Add Dashboard navigation to App
6. Create ConnectionStatusBanner component
7. Add Dashboard integration tests
8. Fix test failures and build errors (if any)
9. Add Dashboard feature documentation

### Verification Checklist

Before proceeding to reviews (Phase 4):

- [ ] All tests passing (`npm test`)
- [ ] No TypeScript errors (`npx tsc --noEmit`)
- [ ] Production build succeeds (`npm run build`)
- [ ] Manual smoke test passed (upload CSV → see jobs on Dashboard)
- [ ] Connection status indicators working (connect/reconnect/disconnect)
- [ ] Jobs update in real-time (progress bars move)
- [ ] Completed jobs disappear after 5 minutes
- [ ] Error messages displayed for failed jobs
- [ ] All commits have proper messages

---

## Next Steps: Multi-Tool Reviews (Phase 4)

After completing all tasks in this plan:

1. **Code-Reviewer Subagent** - Review against plan requirements
2. **CodeRabbit CLI** - AI code review (run in background)
3. **Semgrep** - Security & code quality scan (React/TypeScript rules)

Then proceed to Phase 5 (Fix ALL issues - Option C) and Phase 6 (User Report + PAUSE).

---

**Plan Created:** 2025-10-30
**Estimated Time:** 3-4 hours (9 tasks × 20-30 min each)
**Tech Stack:** React 18 + TypeScript + react-use-websocket + Tailwind CSS + Vitest
**Target:** Production-ready real-time Dashboard with battle-tested WebSocket management
