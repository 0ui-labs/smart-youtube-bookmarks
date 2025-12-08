# User Story 05: Session Persistence

## Story

**As a** user
**I want to** stay logged in across sessions
**So that** I don't have to log in every time I visit

## UX Flow

```
1. User logs in successfully
   ↓
2. User closes browser tab
   ↓
3. (Hours/days later)
   ↓
4. User opens app in new tab
   ↓
5. App checks for existing Clerk session
   ↓
6. Session valid → User is logged in automatically
   ↓
7. User sees their data immediately
```

## Acceptance Criteria

- [ ] Session persists after closing tab
- [ ] Session persists after closing browser
- [ ] Session works across multiple tabs
- [ ] Token refresh happens automatically
- [ ] No manual re-login for reasonable time (days)
- [ ] Loading state shown while checking session

## Edge Cases

| Scenario | Expected Behavior |
|----------|-------------------|
| Session expired | Redirect to sign-in, seamless re-auth if possible |
| Token refresh fails | Redirect to sign-in |
| Multiple tabs, one logs out | All tabs detect and redirect |
| Browser clears cookies | Session lost, must re-login |
| Incognito mode | Session only for that window |

## Technical Implementation

### Clerk Session Handling

```tsx
// App.tsx or ProtectedRoute
import { useAuth } from '@clerk/clerk-react'

function App() {
  const { isLoaded, isSignedIn } = useAuth()

  // Loading state while Clerk checks session
  if (!isLoaded) {
    return <LoadingSpinner />
  }

  if (!isSignedIn) {
    return <RedirectToSignIn />
  }

  return <AppContent />
}
```

### Loading State

```tsx
// Zeige Skeleton während Session-Check
function LoadingSpinner() {
  return (
    <div className="flex h-screen items-center justify-center">
      <Spinner size="lg" />
      <span className="ml-2">Loading...</span>
    </div>
  )
}
```

## Clerk Session Configuration

Clerk Dashboard Settings:
- **Session lifetime:** 7 days (configurable)
- **Inactivity timeout:** None (or customize)
- **Multi-session:** Disabled (single device) or Enabled (multiple)
