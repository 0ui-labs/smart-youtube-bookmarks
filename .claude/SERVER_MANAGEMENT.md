# Server Management Best Practices

**Problem:** Multiple server instances accumulate over time, causing port conflicts and "Vite infinite loading" issues

**When it happens:** Especially during git merge operations and long sessions

---

## ⚠️ The Problem

### Symptoms
- Frontend shows infinite loading when trying to fetch data
- User reports: "Das Vite Problem" or "Frontend lädt ewig"
- Happens repeatedly after merge operations
- Multiple background bash processes accumulate

### Root Cause
Multiple server instances get started during development but don't get properly cleaned up:
- Backend on port 8000 (multiple uvicorn processes)
- Frontend on port 5173/5174 (multiple Vite dev servers)
- ARQ worker processes
- Old test runners

These compete for the same ports, causing race conditions and connection failures.

---

## ✅ The Solution

### At Thread Start (MANDATORY)

**1. Check for running processes:**
```bash
lsof -ti:8000  # Backend
lsof -ti:5173  # Frontend
lsof -ti:5174  # Alternative frontend port
```

**2. Kill ALL old processes:**
```bash
# Backend
lsof -ti:8000 | xargs kill -9 2>/dev/null || true

# Frontend
lsof -ti:5173 | xargs kill -9 2>/dev/null || true
lsof -ti:5174 | xargs kill -9 2>/dev/null || true

# Verify clean
lsof -ti:8000 -ti:5173 -ti:5174
# Should output: nothing (empty)
```

**3. Start servers cleanly:**
```bash
# Backend (in background)
cd backend && uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Frontend (in background)
cd frontend && npm run dev

# Wait 3-5 seconds for startup
sleep 5
```

**4. Verify they're working:**
```bash
# Backend health
curl -s http://localhost:8000/api/lists | head -20

# Frontend serving
curl -s http://localhost:5173 | head -20
```

---

### During Development

**Before starting new servers:**
1. Check if servers are already running
2. If yes, use existing ones (don't start duplicates)
3. If crashed/killed, clean ports first, then restart

**When restarting servers:**
```bash
# Kill existing first
lsof -ti:8000 | xargs kill -9
lsof -ti:5173 | xargs kill -9

# Wait a moment
sleep 2

# Start fresh
cd backend && uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
cd frontend && npm run dev
```

---

### After Git Merge Operations

**CRITICAL:** Always check and restart servers after merge!

```bash
# 1. Check server status
BashOutput on existing server IDs

# 2. If killed or not responding:
lsof -ti:8000 -ti:5173 | xargs kill -9
sleep 2
cd backend && uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
cd frontend && npm run dev

# 3. Verify working
curl http://localhost:8000/api/lists
curl http://localhost:5173
```

---

## 🎯 Quick Reference

### Check Running Servers
```bash
# List all background bash processes
# (in Claude Code: check system-reminders for bash IDs)

# Check specific ports
lsof -i:8000  # Backend
lsof -i:5173  # Frontend
```

### Emergency Reset (Nuclear Option)
```bash
# Kill everything on development ports
lsof -ti:8000 -ti:5173 -ti:5174 -ti:6379 | xargs kill -9 2>/dev/null || true

# Wait
sleep 3

# Restart services
docker-compose up -d postgres redis  # Infrastructure
cd backend && uvicorn app.main:app --reload --host 0.0.0.0 --port 8000 &
cd frontend && npm run dev &

# Wait for startup
sleep 5

# Verify
curl http://localhost:8000/api/lists
curl http://localhost:5173
```

---

## 📋 Checklist for New Threads

Use this at the start of EVERY new thread:

```
□ Kill old processes: lsof -ti:8000 -ti:5173 | xargs kill -9
□ Verify clean: lsof -ti:8000 -ti:5173 (should be empty)
□ Check Docker: docker-compose ps (postgres, redis healthy)
□ Start backend: cd backend && uvicorn app.main:app --reload
□ Start frontend: cd frontend && npm run dev
□ Wait 5 seconds: sleep 5
□ Verify backend: curl http://localhost:8000/api/lists
□ Verify frontend: curl http://localhost:5173
□ Record bash IDs for later reference
```

---

## 🐛 Debugging Server Issues

### Frontend shows infinite loading

**Symptoms:**
- Browser shows loading spinner forever
- Network tab shows pending requests
- No data appears

**Debug:**
```bash
# 1. Check backend is responding
curl http://localhost:8000/api/lists

# 2. Check frontend is serving
curl http://localhost:5173

# 3. Check for port conflicts
lsof -i:8000
lsof -i:5173

# 4. Check backend logs
BashOutput [backend_bash_id]

# 5. Check frontend logs
BashOutput [frontend_bash_id]
```

**Fix:**
```bash
# Full restart
lsof -ti:8000 -ti:5173 | xargs kill -9
sleep 2
cd backend && uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
cd frontend && npm run dev
sleep 5
curl http://localhost:8000/api/lists
```

### Backend fails to start

**Error:** `Address already in use`

**Fix:**
```bash
lsof -ti:8000 | xargs kill -9
sleep 2
cd backend && uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### Frontend port conflicts

**Error:** `Port 5173 is in use, trying another one...`

**When OK:** If Vite finds alternative port (5174) automatically

**When NOT OK:** If multiple Vite instances compete

**Fix:**
```bash
lsof -ti:5173 -ti:5174 | xargs kill -9
sleep 2
cd frontend && npm run dev
# Should start on 5173
```

---

## 💡 Best Practices

1. **One server per port:** Never run multiple instances on same port
2. **Clean start:** Always kill old processes before starting new ones
3. **Verify before claiming:** Test endpoints before saying "servers running"
4. **Record bash IDs:** Keep track of which background process is which
5. **Check after merge:** Git operations can kill processes
6. **Use background processes:** Start servers with `run_in_background: true`
7. **Periodic cleanup:** During long sessions, periodically check for zombie processes

---

## 🔗 Related Documentation

- `.claude/thread-start-checks.sh` - Automated verification script
- `.claude/DEVELOPMENT_WORKFLOW.md` - Full workflow documentation
- `docker-compose.yml` - Infrastructure services (postgres, redis)

---

## 📊 Known Issues Log

### Issue #1: Server Accumulation During Merge (2025-10-29)
**Symptoms:** After merging `feature/websocket-progress-updates` to main, frontend showed infinite loading

**Root Cause:** Multiple server instances from previous merge attempts were still running

**Solution:** Killed all processes on ports 8000, 5173, 5174 and restarted cleanly

**Prevention:** Always check and clean ports after merge operations

**User Quote:** "Das scheint immer zu passieren wenn du versuchst zu mergen."

---

**Last Updated:** 2025-10-29
**Version:** 1.0
**Author:** Claude (based on debugging session)
