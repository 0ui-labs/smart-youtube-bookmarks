# WebSocket Progress Updates - Manual Testing Checklist

## Prerequisites

- Backend running: `cd backend && uvicorn app.main:app --reload`
- Frontend running: `cd frontend && npm run dev`
- Docker services: `docker-compose up -d postgres redis`
- Redis monitor (optional): `docker exec -it youtube-bookmarks-redis redis-cli MONITOR`

---

## Test Cases

### TC1: Happy Path - Small Batch (10 videos)

**Steps:**
1. Navigate to Videos page
2. Click "Upload CSV" button
3. Upload CSV with 10 videos
4. Observe progress dashboard

**Expected Results:**
- ✅ Progress bar appears immediately
- ✅ Progress updates smoothly (0% → 10% → 20% → ... → 100%)
- ✅ Video counter increments (1/10 → 2/10 → ... → 10/10)
- ✅ Status badge shows "Processing" (blue)
- ✅ Final status shows "Completed" (green)
- ✅ Progress bar disappears after 5 minutes

**Actual Results:** _[Fill during testing]_

---

### TC2: Reconnection - Tab Close During Processing

**Steps:**
1. Start CSV upload (20 videos)
2. Wait for progress to reach ~30%
3. Close browser tab
4. Wait 10 seconds
5. Reopen tab and navigate back to Videos page

**Expected Results:**
- ✅ Progress bar reappears with last known state (~50-60%)
- ✅ Live updates resume from current state
- ✅ No duplicate progress bars
- ✅ History API called (check Network tab)

**Actual Results:** _[Fill during testing]_

---

### TC3: Multiple Tabs - Same User

**Steps:**
1. Open Videos page in 2 browser tabs
2. Start CSV upload from Tab 1
3. Observe both tabs

**Expected Results:**
- ✅ Both tabs show same progress bar
- ✅ Both tabs update in sync
- ✅ Progress percentages match

**Actual Results:** _[Fill during testing]_

---

### TC4: Error Handling - Failed Video

**Steps:**
1. Upload CSV with invalid video ID
2. Observe progress when worker hits failed video

**Expected Results:**
- ✅ Progress bar shows error message
- ✅ Status remains "Processing" (continues with next video)
- ✅ Final status shows "Completed with errors" (yellow)
- ✅ Error details visible in progress message

**Actual Results:** _[Fill during testing]_

---

### TC5: Large Batch - Throttling

**Steps:**
1. Upload CSV with 200+ videos
2. Monitor Redis pub/sub activity
3. Observe progress update frequency

**Expected Results:**
- ✅ Progress updates throttled (not every single video)
- ✅ UI still feels responsive
- ✅ Final completion event received

**Actual Results:** _[Fill during testing]_

---

### TC6: WebSocket Debugging

**Steps:**
1. Open Browser DevTools → Network → WS tab
2. Start CSV upload
3. Observe WebSocket messages

**Expected Results:**
- ✅ Connection established to `ws://localhost:8000/api/ws/progress?token=...`
- ✅ Messages received with progress data
- ✅ No connection errors
- ✅ Messages are valid JSON

**Actual Results:** _[Fill during testing]_

---

### TC7: Redis Restart Scenario

**Steps:**
1. Start CSV upload
2. During processing: `docker-compose restart redis`
3. Observe frontend behavior

**Expected Results:**
- ✅ WebSocket disconnects
- ✅ "Reconnecting..." banner appears
- ✅ After Redis restarts, WebSocket reconnects
- ✅ History API provides last state

**Actual Results:** _[Fill during testing]_

---

### TC8: Database Query Performance

**Steps:**
1. Create multiple jobs with progress history
2. Query history API: `GET /api/jobs/{id}/progress-history`
3. Check query execution time in logs

**Expected Results:**
- ✅ Query uses index (check `EXPLAIN ANALYZE`)
- ✅ Response time < 100ms for typical job
- ✅ Pagination with `since` parameter works

**Actual Results:** _[Fill during testing]_

---

### TC9: Cleanup - Completed Jobs Disappear

**Steps:**
1. Start CSV upload, wait for completion
2. Wait 5+ minutes
3. Observe progress dashboard

**Expected Results:**
- ✅ Completed job disappears after 5 minutes
- ✅ No memory leak (check browser memory usage)

**Actual Results:** _[Fill during testing]_

---

### TC10: Multi-User Isolation

**Steps:**
1. Login as User A in Browser 1
2. Login as User B in Browser 2
3. User A starts CSV upload
4. Observe User B's Videos page

**Expected Results:**
- ✅ User B sees NO progress bar for User A's job
- ✅ User isolation maintained

**Actual Results:** _[Fill during testing]_

---

## Performance Metrics

| Metric | Target | Actual |
|--------|--------|--------|
| WebSocket connection time | < 500ms | _[Fill]_ |
| Progress update latency | < 200ms | _[Fill]_ |
| History API response time | < 100ms | _[Fill]_ |
| Browser memory usage (10 jobs) | < 50MB | _[Fill]_ |
| Redis pub/sub throughput | 100+ msg/sec | _[Fill]_ |

---

## Sign-Off

**Tested By:** _[Your Name]_
**Date:** _[Date]_
**Environment:** Development
**Result:** ✅ PASS / ❌ FAIL

**Notes:** _[Any observations, bugs found, etc.]_
