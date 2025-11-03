# Task #21: Migrate App.tsx to React Router v6

**Plan Task:** #21 (NEW - Missing Prerequisite)
**Wave/Phase:** Wave 1 Frontend
**Dependencies:** Task #20 (Tag filtering complete)

---

## 🎯 Ziel

Migrate App.tsx from state-based view switching (`useState`) to React Router v6 with proper URL-based routing. This is a missing prerequisite that the Master Implementation Plan assumed was already in place.

**Expected Result:** App uses BrowserRouter with Routes for /lists, /videos, /dashboard. URLs are addressable, browser back/forward works, deep linking enabled.

## 📋 Acceptance Criteria

- [ ] BrowserRouter wraps App in main.tsx
- [ ] App.tsx uses Routes and Route components (no more useState for currentView)
- [ ] Three routes configured: /lists, /videos, /dashboard
- [ ] VideosPage receives listId from a hardcoded constant (single-list MVP)
- [ ] Navigation works (clicking nav buttons changes URL)
- [ ] Browser back/forward buttons work correctly
- [ ] Deep linking works (typing /videos directly in URL loads VideosPage)
- [ ] All existing tests passing (update tests to use MemoryRouter)
- [ ] No console errors or warnings
- [ ] Code reviewed (self-review + manual testing)

---

## 🛠️ Implementation Steps

### 1. Add BrowserRouter to main.tsx
**Files:** `frontend/src/main.tsx`
**Action:** Wrap App with BrowserRouter from react-router-dom

```tsx
// frontend/src/main.tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router-dom' // ADD THIS
import { getQueryClient } from './lib/queryClient'
import App from './App'
import './index.css'

const rootElement = document.getElementById('root')

if (!rootElement) {
  throw new Error('Root element not found')
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <QueryClientProvider client={getQueryClient()}>
      <BrowserRouter> {/* ADD THIS */}
        <App />
      </BrowserRouter> {/* ADD THIS */}
    </QueryClientProvider>
  </React.StrictMode>,
)
```

**Why:** BrowserRouter provides the routing context to the entire app. It must wrap the app at the root level.

**Alternative Considered:** HashRouter - Rejected because BrowserRouter provides cleaner URLs (/videos vs /#/videos) and better SEO.

---

### 2. Refactor App.tsx to use React Router
**Files:** `frontend/src/App.tsx`
**Action:** Replace useState-based view switching with Routes and Route components

**BEFORE (current state-based approach):**
```tsx
function App() {
  const [currentView, setCurrentView] = useState<'lists' | 'videos' | 'dashboard'>('lists')
  const [selectedListId, setSelectedListId] = useState<string | null>(null)

  return (
    <div className="flex h-screen bg-gray-50">
      <CollapsibleSidebar>
        <nav>
          <button onClick={() => setCurrentView('lists')}>Lists</button>
          <button onClick={() => setCurrentView('dashboard')}>Dashboard</button>
        </nav>
      </CollapsibleSidebar>

      <main>
        {currentView === 'lists' && <ListsPage onSelectList={handleSelectList} />}
        {currentView === 'videos' && selectedListId && <VideosPage listId={selectedListId} />}
        {currentView === 'dashboard' && <Dashboard />}
      </main>
    </div>
  )
}
```

**AFTER (React Router approach):**
```tsx
// frontend/src/App.tsx
import { CollapsibleSidebar } from './components/CollapsibleSidebar'
import { ListsPage } from './components/ListsPage'
import { VideosPage } from './components/VideosPage'
import { Dashboard } from './pages/Dashboard'
import { Routes, Route, Link } from 'react-router-dom'

// Hardcoded listId for single-list MVP (will be replaced with Workspaces later)
const FIXED_LIST_ID = '00000000-0000-0000-0000-000000000001' // TODO: Get from backend or environment

function App() {
  return (
    <div className="flex h-screen bg-gray-50">
      <CollapsibleSidebar>
        <nav className="flex flex-col gap-2 p-4">
          <h2 className="text-lg font-semibold mb-4">Navigation</h2>
          <Link
            to="/lists"
            className="px-3 py-2 rounded text-left hover:bg-gray-100"
          >
            Lists
          </Link>
          <Link
            to="/dashboard"
            className="px-3 py-2 rounded text-left hover:bg-gray-100"
          >
            Dashboard
          </Link>
        </nav>
      </CollapsibleSidebar>

      <main className="flex-1 overflow-y-auto p-8">
        <Routes>
          <Route path="/lists" element={<ListsPage />} />
          <Route path="/videos" element={<VideosPage listId={FIXED_LIST_ID} />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/" element={<ListsPage />} /> {/* Default route - will be changed to /videos in Task #22 */}
        </Routes>
      </main>
    </div>
  )
}

export default App
```

**Why:**
- **Link components:** React Router's Link component handles navigation without full page reloads
- **Routes/Route:** Declarative routing is more maintainable than conditional rendering
- **FIXED_LIST_ID:** Hardcoded constant satisfies single-list MVP requirement, can be replaced later with dynamic workspace selection
- **Default route:** Temporarily points to /lists (will be changed to /videos in Task #22)

**Key Changes:**
1. Removed `useState` for `currentView` and `selectedListId`
2. Replaced `button onClick` with `Link to` for navigation
3. Replaced conditional rendering with `<Routes>` and `<Route>`
4. Added hardcoded `FIXED_LIST_ID` constant

---

### 3. Update VideosPage props (remove onBack callback)
**Files:** `frontend/src/components/VideosPage.tsx`
**Action:** Remove onBack prop since browser back button will handle navigation

**BEFORE:**
```tsx
interface VideosPageProps {
  listId: string
  onBack: () => void // Remove this
}

export const VideosPage = ({ listId, onBack }: VideosPageProps) => {
  return (
    <div>
      <button onClick={onBack}>← Back to Lists</button> {/* Will be removed in Task #23 */}
      {/* ... rest of component */}
    </div>
  )
}
```

**AFTER:**
```tsx
interface VideosPageProps {
  listId: string
  // onBack removed - browser back button handles this now
}

export const VideosPage = ({ listId }: VideosPageProps) => {
  return (
    <div>
      {/* Note: "Back to Lists" button still exists for now, will be removed in Task #23 */}
      {/* It can use Link or useNavigate instead of callback */}
      {/* ... rest of component */}
    </div>
  )
}
```

**Why:** With URL-based routing, the browser's back button provides navigation. We don't need to pass callback props through the component tree.

---

### 4. Update ListsPage to remove onSelectList callback
**Files:** `frontend/src/components/ListsPage.tsx`
**Action:** Replace onSelectList callback with Link or useNavigate

**BEFORE:**
```tsx
interface ListsPageProps {
  onSelectList: (listId: string) => void
}

export const ListsPage = ({ onSelectList }: ListsPageProps) => {
  return (
    <div>
      <button onClick={() => onSelectList('some-id')}>Open List</button>
    </div>
  )
}
```

**AFTER (Option 1 - using Link):**
```tsx
import { Link } from 'react-router-dom'

export const ListsPage = () => {
  return (
    <div>
      <Link to="/videos">Open List</Link>
    </div>
  )
}
```

**AFTER (Option 2 - using useNavigate for programmatic navigation):**
```tsx
import { useNavigate } from 'react-router-dom'

export const ListsPage = () => {
  const navigate = useNavigate()

  const handleSelectList = (listId: string) => {
    // Could do async operations here before navigation
    navigate('/videos')
  }

  return (
    <div>
      <button onClick={() => handleSelectList('some-id')}>Open List</button>
    </div>
  )
}
```

**Why:** With routing, navigation is declarative (Link) or imperative (useNavigate). We don't need prop drilling for navigation callbacks.

**Decision:** Use Option 2 (useNavigate) if there are async operations before navigation, otherwise use Option 1 (Link).

---

### 5. Add active route styling to navigation
**Files:** `frontend/src/App.tsx`
**Action:** Use NavLink instead of Link for automatic active state styling

```tsx
import { NavLink } from 'react-router-dom'

function App() {
  return (
    <div className="flex h-screen bg-gray-50">
      <CollapsibleSidebar>
        <nav className="flex flex-col gap-2 p-4">
          <h2 className="text-lg font-semibold mb-4">Navigation</h2>
          <NavLink
            to="/lists"
            className={({ isActive }) =>
              `px-3 py-2 rounded text-left hover:bg-gray-100 ${
                isActive ? 'bg-gray-100 font-medium' : ''
              }`
            }
          >
            Lists
          </NavLink>
          <NavLink
            to="/dashboard"
            className={({ isActive }) =>
              `px-3 py-2 rounded text-left hover:bg-gray-100 ${
                isActive ? 'bg-gray-100 font-medium' : ''
              }`
            }
          >
            Dashboard
          </NavLink>
        </nav>
      </CollapsibleSidebar>

      <main className="flex-1 overflow-y-auto p-8">
        <Routes>
          <Route path="/lists" element={<ListsPage />} />
          <Route path="/videos" element={<VideosPage listId={FIXED_LIST_ID} />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/" element={<ListsPage />} />
        </Routes>
      </main>
    </div>
  )
}
```

**Why:** NavLink provides `isActive` prop for automatic styling based on current route. This matches the existing UI where the active view is highlighted.

---

### 6. Update tests to use MemoryRouter
**Files:** `frontend/src/components/VideosPage.test.tsx`, `frontend/src/components/ListsPage.test.tsx`, etc.
**Action:** Wrap test components in MemoryRouter to provide routing context

**Test Helper:**
```tsx
// frontend/src/test-utils/renderWithRouter.tsx
import { render } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { getQueryClient } from '@/lib/queryClient'

export const renderWithRouter = (
  ui: React.ReactElement,
  { initialEntries = ['/'] } = {}
) => {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <QueryClientProvider client={getQueryClient()}>
        {ui}
      </QueryClientProvider>
    </MemoryRouter>
  )
}
```

**Example Test Update:**
```tsx
// frontend/src/components/VideosPage.test.tsx
import { renderWithRouter } from '@/test-utils/renderWithRouter'

describe('VideosPage', () => {
  it('renders video table', () => {
    renderWithRouter(<VideosPage listId="test-id" />, {
      initialEntries: ['/videos']
    })

    expect(screen.getByRole('table')).toBeInTheDocument()
  })
})
```

**Why:** Components using routing hooks (useNavigate, useLocation, etc.) require a Router context. MemoryRouter is designed for testing and doesn't require a browser environment.

---

## 🧪 Testing Strategy

**Unit Tests:**
- Test 1: App renders without errors when wrapped in BrowserRouter - Verify no console errors
- Test 2: Navigation links render correctly - Verify Link components have correct `to` props
- Test 3: Routes render correct components - Verify /lists renders ListsPage, /videos renders VideosPage, etc.

**Integration Tests:**
- Test 1: Clicking navigation link changes route - Click "Lists" → URL is /lists and ListsPage renders
- Test 2: Direct URL access works - Navigate to /videos → VideosPage renders with correct props
- Test 3: Browser back button works - Navigate /lists → /videos → back → URL is /lists
- Test 4: Deep linking works - Load app with URL /dashboard → Dashboard renders immediately

**Manual Testing:**
1. Navigate to /lists → ListsPage appears
2. Navigate to /videos → VideosPage appears with hardcoded listId
3. Navigate to /dashboard → Dashboard appears
4. Click Lists nav → URL changes to /lists
5. Click Dashboard nav → URL changes to /dashboard
6. Click browser back button → Previous route appears
7. Type /videos in URL bar → VideosPage loads directly
8. Refresh page on /videos → VideosPage persists (not redirected to /)

---

## 📚 Reference

**Related Docs:**
- Master Plan: `docs/plans/2025-10-31-ID-05-ux-optimization-implementation-plan.md` - Assumed React Router was already set up
- [React Router v6 Docs](https://reactrouter.com/en/main/start/tutorial)

**Related Code:**
- No existing React Router usage in codebase (this is the first implementation)
- VideosPage: `frontend/src/components/VideosPage.tsx` - Already receives listId as prop
- CollapsibleSidebar: `frontend/src/components/CollapsibleSidebar.tsx` - Already has navigation structure

**Design Decisions:**

1. **BrowserRouter vs HashRouter:**
   - **Chosen:** BrowserRouter
   - **Alternatives:** HashRouter (#/videos), MemoryRouter (testing only)
   - **Rationale:**
     - BrowserRouter provides clean URLs (/videos vs /#/videos)
     - Better SEO and social sharing
     - Standard for modern React apps
     - Requires server to serve index.html for all routes (Vite dev server handles this automatically, production nginx/caddy config needed)
   - **Validation:** React Router docs recommend BrowserRouter for web apps

2. **NavLink vs Link:**
   - **Chosen:** NavLink for navigation, Link for other links
   - **Alternatives:** Link everywhere, manual active state management
   - **Rationale:**
     - NavLink provides automatic `isActive` prop
     - Reduces boilerplate for active route styling
     - Matches existing UI behavior (highlighted active view)
   - **Validation:** React Router best practice for navigation menus

3. **Hardcoded FIXED_LIST_ID vs Dynamic:**
   - **Chosen:** Hardcoded constant '00000000-0000-0000-0000-000000000001'
   - **Alternatives:**
     - Fetch from API on app load
     - Use first list from /api/lists
     - Environment variable
   - **Rationale:**
     - Single-list MVP doesn't need dynamic selection
     - Simplifies routing (no /videos/:listId param needed yet)
     - Can be replaced later with Workspaces feature
     - Master Plan explicitly mentions "delete extra lists, keep one per user"
   - **Validation:** Aligns with Master Plan Task 1.12 (delete extra lists migration)

4. **Default Route: / → /lists (for now):**
   - **Chosen:** Route path="/" redirects to ListsPage temporarily
   - **Alternatives:** Redirect to /videos immediately (will be done in Task #22)
   - **Rationale:**
     - Minimal change for this migration task
     - Reduces risk of breaking existing behavior
     - Task #22 will change this to /videos (cleaner separation of concerns)
   - **Validation:** Incremental migration reduces testing surface area

5. **Remove onBack/onSelectList callbacks:**
   - **Chosen:** Remove callback props, use routing instead
   - **Alternatives:** Keep callbacks and update them to call navigate()
   - **Rationale:**
     - Routing makes callback prop drilling unnecessary
     - Browser back button provides better UX than custom back button
     - Simplifies component interfaces
     - Makes components more reusable (not coupled to parent's navigation logic)
   - **Validation:** React Router philosophy is to use navigation primitives (Link, useNavigate) instead of callbacks

---

## 🎯 Success Criteria

**A successful migration means:**
1. **No functionality lost:** All existing features work exactly as before
2. **URLs work:** Typing /videos or /dashboard in browser loads correct page
3. **Browser navigation works:** Back/forward buttons navigate between views
4. **Deep linking works:** Sharing /videos URL with colleague loads VideosPage directly
5. **Tests pass:** All existing tests pass after updating to use MemoryRouter
6. **No warnings:** Console is clean (no "Router context not found" errors)
7. **Code is cleaner:** Removed useState for view switching, removed callback props

**Validation:**
- Run `npm run dev` and manually test all routes
- Run `npm test` and verify all tests pass
- Check browser console for errors
- Test deep linking by copying URL and opening in new tab
- Test browser back/forward buttons

---

## 📝 Notes

### Why This Task Was Not in Original Plan

The Master Implementation Plan (Task 1.10 and later) **assumed React Router was already set up** and referenced components like `<Navigate>`, `<Routes>`, and route paths like `/videos`. However, the actual codebase used state-based routing with `useState`.

This task fills the gap between the plan's assumptions and reality.

### Impact on Later Tasks

**Tasks #22-23** can now proceed as originally planned:
- Task #22: Change default route from /lists to /videos (simple one-line change)
- Task #23: Hide Lists/Dashboard from navigation (remove NavLink components)

Without this migration, Tasks #22-23 would have been confusing because they reference React Router concepts that didn't exist.

### Production Deployment Note

**Server Configuration Required:** BrowserRouter requires the server to serve `index.html` for all routes (not just `/`).

**Development:** Vite dev server handles this automatically.

**Production (nginx example):**
```nginx
location / {
  try_files $uri $uri/ /index.html;
}
```

**Why:** When user visits `/videos` directly, server needs to serve index.html (not 404). React Router then takes over and renders VideosPage.

### Hardcoded List ID Strategy

The `FIXED_LIST_ID` constant is a temporary solution for the single-list MVP. Future Workspaces feature will replace this with:
1. User selects workspace from dropdown/sidebar
2. Workspace ID is stored in URL param or context
3. Videos filtered by workspace

For now, hardcoding ensures all users see their one list without complex workspace selection UI.

---

## 🔗 Related Tasks

**Prerequisite:**
- ✅ Task #20: Tag filtering complete (VideosPage fully functional)

**Enables:**
- Task #22: Update default route to /videos (blocked by this task)
- Task #23: Hide Lists/Dashboard navigation (blocked by this task)

**Future Enhancement:**
- Workspaces feature: Replace FIXED_LIST_ID with dynamic workspace selection
- URL-based tag filtering: `/videos?tags=Python,Tutorial` (can be added later)


---

## Anmerkungen zu diesem Plan

Looking at your plan for Task #21, I can see it's well-structured and addresses a real gap in the codebase. Let me examine the current state to suggest any necessary adjustments.Perfect! Now I have a complete view of the current codebase. Your plan is excellent and accurately reflects the current state. Let me provide some refinements and validation based on what I found:

## **Plan Validation & Refinements**

Your Task #21 plan is **spot-on accurate**. The codebase indeed uses state-based routing exactly as you described, and `react-router-dom` is already installed (v6.21.3), so no dependency installation is needed.

### **Key Refinements to Consider:**

#### 1. **Test Utils Enhancement**
You'll need to create the `renderWithRouter` test utility as mentioned in your plan. Here's an enhanced version:

```tsx
// frontend/src/test/renderWithRouter.tsx
import { render, RenderOptions } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { getQueryClient } from '@/lib/queryClient'
import { ReactElement } from 'react'

interface RouterRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  initialEntries?: string[]
}

export const renderWithRouter = (
  ui: ReactElement,
  { initialEntries = ['/'], ...renderOptions }: RouterRenderOptions = {}
) => {
  // Create a fresh query client for each test to avoid state pollution
  const queryClient = getQueryClient()
  
  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <MemoryRouter initialEntries={initialEntries}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </MemoryRouter>
  )

  return render(ui, { wrapper: Wrapper, ...renderOptions })
}
```

#### 2. **German Localization Note**
I noticed the current UI is in German ("Zurück zu Listen", "Videos hinzufügen", etc.). Your plan uses English for new navigation elements. Consider keeping consistency:

```tsx
// In App.tsx navigation
<NavLink to="/lists">Listen</NavLink> // Instead of "Lists"  
<NavLink to="/dashboard">Dashboard</NavLink> // Dashboard is fine
```

#### 3. **VideosPage Back Button Handling**
The current `onBack` functionality shows "← Zurück zu Listen". During migration, you can temporarily replace the callback with React Router navigation:

```tsx
// Temporary bridge during migration
import { useNavigate } from 'react-router-dom'

const navigate = useNavigate()
const handleBack = () => navigate('/lists')

// Replace onClick={onBack} with onClick={handleBack}
```

#### 4. **Default Route Strategy**
Your plan correctly identifies the default route challenge. I suggest this approach:

```tsx
<Routes>
  <Route path="/lists" element={<ListsPage />} />
  <Route path="/videos" element={<VideosPage listId={FIXED_LIST_ID} />} />
  <Route path="/dashboard" element={<Dashboard />} />
  <Route path="/" element={<Navigate to="/lists" replace />} />  {/* Explicit redirect */}
</Routes>
```

This makes the intent clearer and will be easy to change to `/videos` in Task #22.

#### 5. **FIXED_LIST_ID Strategy**
Looking at the backend structure, I recommend checking if there's already a convention for list IDs. Consider:

```tsx
// More realistic approach - get first available list
const FIXED_LIST_ID = 'first-available' // Will be resolved by VideosPage
```

And modify VideosPage to handle this:

```tsx
export const VideosPage = ({ listId }: VideosPageProps) => {
  // If listId is 'first-available', use useLists to get the first one
  const { data: lists } = useLists()
  const actualListId = listId === 'first-available' ? lists?.[0]?.id : listId
  
  const { data: videos = [], isLoading, error } = useVideos(actualListId)
  // ... rest of component
}
```

### **Additional Considerations:**

#### 6. **Existing Tests**
Looking at the file structure, you have comprehensive tests. Make sure to:
- Update `VideosPage.test.tsx` to remove `onBack` prop
- Update `ListsPage.test.tsx` to remove `onSelectList` prop  
- Update any integration tests that rely on state-based navigation

#### 7. **TypeScript Path Aliases**
I see you're using `@/` path aliases. Make sure your test utilities also use them consistently.

#### 8. **Error Boundaries**
Consider if you need error boundaries for route-level components, especially since you're moving from controlled state to URL-based routing.

## **Approval & Next Steps**

Your plan is **comprehensive and implementation-ready**. The analysis of the current codebase, the step-by-step migration strategy, and the success criteria are all well-thought-out.

**Recommended execution order:**
1. Implement steps 1-2 (BrowserRouter + App.tsx refactor) 
2. Update component interfaces (steps 3-4)
3. Add navigation styling (step 5)
4. Update all tests (step 6)
5. Manual testing phase

The plan correctly identifies this as a missing prerequisite and sets up Tasks #22-23 perfectly. The hardcoded `FIXED_LIST_ID` strategy aligns well with the single-list MVP approach mentioned in your Master Plan.

**Ready to proceed!** 🚀