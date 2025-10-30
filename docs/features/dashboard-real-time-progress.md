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
