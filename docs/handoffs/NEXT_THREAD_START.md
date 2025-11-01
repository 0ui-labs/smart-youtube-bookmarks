# 🚀 Thread #14 Start - Task 11: List Management UI

**Status:** Ready to start
**Previous Task:** Task 10 - React Query Setup ✅ (Complete)
**Current Task:** Task 11 - List Management UI (Frontend)
**Estimated Time:** 2-3 hours

---

## ⚡ Quick Start Commands

```bash
# 1. Navigate to project
cd "/Users/philippbriese/Documents/dev/projects/by IDE/Claude Code/Smart Youtube Bookmarks"

# 2. Run automated checks
./.claude/thread-start-checks.sh

# 3. Check git status
git status
git log --oneline -5

# 4. Read detailed handoff (optional)
cat docs/handoffs/2025-11-01-task-10-react-query-setup-complete.md
```

---

## 📋 Task 11 Overview

**Goal:** Build first real feature with React Query - List Management UI

**What to Build:**
1. `frontend/src/types/list.ts` - TypeScript interfaces
2. `frontend/src/hooks/useLists.ts` - React Query hooks (useQuery, useMutation)
3. `frontend/src/components/ListsPage.tsx` - List CRUD UI
4. `frontend/src/App.tsx` - Integrate ListsPage

**Reference:** Implementation plan lines 1609-1813

---

## ✅ What's Already Done

**Backend (Ready to Use):**
- ✅ List API endpoints working (Task 6)
  - `GET /api/lists` - Fetch all lists
  - `POST /api/lists` - Create list
  - `DELETE /api/lists/{id}` - Delete list
- ✅ Database models and migrations (Task 2-3)
- ✅ Docker services running (Task 5)

**Frontend (Just Completed in Task 10):**
- ✅ React Query v5 with singleton pattern
- ✅ Axios client with robust error handling
- ✅ QueryClientProvider wrapping app
- ✅ 6 unit tests passing
- ✅ Build and dev server working

---

## 🎯 Task 11 Requirements

**From Implementation Plan (lines 1609-1813):**

### 1. TypeScript Types (`types/list.ts`)

```typescript
export interface ListResponse {
  id: string
  name: string
  description: string | null
  schema_id: string | null
  video_count: number
  created_at: string
  updated_at: string
}

export interface ListCreate {
  name: string
  description?: string
  schema_id?: string
}
```

### 2. React Query Hooks (`hooks/useLists.ts`)

```typescript
// useQuery for fetching lists
export const useLists = () => {
  return useQuery({
    queryKey: ['lists'],
    queryFn: async () => {
      const { data } = await api.get<ListResponse[]>('/lists')
      return data
    },
  })
}

// useMutation for creating lists
export const useCreateList = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (listData: ListCreate) => {
      const { data } = await api.post<ListResponse>('/lists', listData)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lists'] })
    },
  })
}

// useMutation for deleting lists
export const useDeleteList = () => { ... }
```

### 3. ListsPage Component (`components/ListsPage.tsx`)

**Features:**
- Display list of bookmark lists
- "Neue Liste" button
- Form to create new list (name + optional description)
- Delete button per list
- Show video count per list
- Loading states
- Error handling

**UX Requirements:**
- Show loading spinner while fetching
- Optimistic updates for better UX
- Error messages for failed operations
- Empty state: "Noch keine Listen vorhanden"

### 4. App Integration (`App.tsx`)

```typescript
import { ListsPage } from './components/ListsPage'

function App() {
  return (
    <div className="min-h-screen bg-gray-50">
      <ListsPage />
    </div>
  )
}
```

---

## 🔧 Testing Strategy

**For Task 11:**
1. **Component Tests:** React Testing Library
   - Test list rendering
   - Test create list form
   - Test delete functionality
2. **Integration Test:** Manual browser testing
   - Create list → verify appears
   - Delete list → verify removed
   - Empty state → verify message
3. **Visual Test:** Chrome DevTools MCP
   - Screenshot of ListsPage
   - Verify Tailwind CSS styling

**No Backend Tests Needed:** API already tested in Task 6

---

## 🚨 Critical Information

### React Query is Ready to Use

**From Task 10 (just completed):**
```typescript
// Import the singleton QueryClient
import { getQueryClient } from './lib/queryClient'

// Import axios instance
import { api } from './lib/api'

// Use in hooks:
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
```

**Configuration (already set):**
- StaleTime: 60 seconds
- GcTime: 5 minutes
- RefetchOnWindowFocus: false
- Retry: 1

### Backend API Endpoints (from Task 6)

**Base URL:** `http://localhost:8000/api` (proxied via Vite to `/api`)

**Endpoints:**
```bash
GET    /api/lists           → Fetch all lists
POST   /api/lists           → Create list (body: {name, description?})
GET    /api/lists/{id}      → Fetch single list
DELETE /api/lists/{id}      → Delete list
```

**Example Response:**
```json
{
  "id": "123e4567-e89b-12d3-a456-426614174000",
  "name": "My First List",
  "description": "Test list",
  "schema_id": null,
  "video_count": 0,
  "created_at": "2025-11-01T20:00:00Z",
  "updated_at": "2025-11-01T20:00:00Z"
}
```

---

## 📚 Important Files to Reference

**Implementation Plan:**
- `docs/plans/2025-10-27-initial-implementation.md` (lines 1609-1813)

**Workflow:**
- `.claude/DEVELOPMENT_WORKFLOW.md` (6-phase workflow)

**Project Overview:**
- `CLAUDE.md` (tech stack, setup instructions)

**Previous Handoff (detailed):**
- `docs/handoffs/2025-11-01-task-10-react-query-setup-complete.md`

---

## 🎓 Key Learnings from Task 10 (Apply to Task 11)

1. **REF MCP Before Implementation** - Research current best practices first
2. **Option C Approach** - Fix ALL issues, not just Critical
3. **Evidence Before Claims** - Show test output, build output, screenshots
4. **Multi-Tool Reviews** - Use code-reviewer + Semgrep + CodeRabbit

---

## 📝 Workflow Checklist for Task 11

**Phase 1: Vorbereitung**
- [ ] Load `superpowers:using-superpowers`
- [ ] Read Task 11 from implementation plan (lines 1609-1813)
- [ ] REF MCP Research: React Query hooks best practices (via subagent)
- [ ] Review findings with user

**Phase 2: Implementation**
- [ ] Create `types/list.ts`
- [ ] Create `hooks/useLists.ts` with React Query hooks
- [ ] Create `components/ListsPage.tsx`
- [ ] Update `App.tsx`
- [ ] Test in browser (manual + Chrome DevTools MCP)

**Phase 3: Verification**
- [ ] `npm run build` - successful?
- [ ] `npm run dev` - app loads?
- [ ] Manual test: Create list → Delete list
- [ ] Screenshot with Chrome DevTools MCP

**Phase 4: Reviews**
- [ ] Code-reviewer subagent
- [ ] Semgrep security scan
- [ ] CodeRabbit CLI review

**Phase 5: Fix Issues**
- [ ] Fix ALL issues (Option C)
- [ ] Re-verify after fixes

**Phase 6: Handoff**
- [ ] Create handoff for Task 12
- [ ] Commit handoff document
- [ ] User-Bericht (Was/Wie/Warum)

---

## 🔗 Backend Services Status

**Required Services:**
```bash
# Check services are running:
docker-compose ps

# Expected:
# postgres: Up (port 5432)
# redis: Up (port 6379)

# Start if needed:
docker-compose up -d postgres redis
```

**Backend API:**
```bash
# Start backend:
cd backend
uvicorn app.main:app --reload

# Expected: Server at http://localhost:8000
# Check health: curl http://localhost:8000/api/health
```

---

## 💡 Tips for Task 11

**1. Use React Query DevTools (Optional but Helpful):**
```typescript
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'

<QueryClientProvider client={getQueryClient()}>
  <App />
  <ReactQueryDevtools initialIsOpen={false} />
</QueryClientProvider>
```

**2. Optimistic Updates:**
```typescript
onMutate: async (newList) => {
  // Cancel outgoing refetches
  await queryClient.cancelQueries({ queryKey: ['lists'] })

  // Snapshot previous value
  const previousLists = queryClient.getQueryData(['lists'])

  // Optimistically update
  queryClient.setQueryData(['lists'], (old) => [...old, newList])

  return { previousLists }
},
onError: (err, newList, context) => {
  // Rollback on error
  queryClient.setQueryData(['lists'], context.previousLists)
}
```

**3. Loading States:**
```typescript
const { data: lists, isLoading, error } = useLists()

if (isLoading) return <div>Lädt...</div>
if (error) return <div>Fehler: {error.message}</div>
```

---

## 🎯 Success Criteria for Task 11

**Must Have:**
- [ ] All 4 files created (types, hooks, component, App)
- [ ] `npm run build` successful
- [ ] Lists can be created via UI
- [ ] Lists can be deleted via UI
- [ ] Lists appear after creation (real-time update)
- [ ] Loading states work
- [ ] All code review tools pass (code-reviewer, Semgrep, CodeRabbit)
- [ ] ALL issues fixed (Option C)

**Nice to Have:**
- [ ] Optimistic updates
- [ ] React Query DevTools integrated
- [ ] Component tests with React Testing Library
- [ ] Error boundary for better error handling

---

## 📊 Git Status (Current)

```bash
# Latest commits:
3302d1c - docs: add Task 10 completion handoff for Thread #14
e1474e0 - fix: address code-reviewer issues - remove hardcoded Content-Type and add tests
a2471a2 - feat: improve React Query setup with singleton pattern and robust error handling

# Branch: main
# Ahead of origin: 25 commits
# Working directory: Clean
```

---

## 🚀 Ready to Start!

**Next Action:** Load `superpowers:using-superpowers` and begin Phase 1 (REF MCP Research for React Query hooks best practices)

**Estimated Duration:** 2-3 hours

**Remember:**
- REF MCP research BEFORE implementation (via subagent to save tokens)
- Fix ALL issues (Option C approach)
- Evidence before claims (show test output, screenshots)

---

**Document Created:** 2025-11-01 22:20 CET
**For Thread:** #14
**Current Task:** Task 11 - List Management UI

🎯 **Let's build the first real feature with React Query!**
