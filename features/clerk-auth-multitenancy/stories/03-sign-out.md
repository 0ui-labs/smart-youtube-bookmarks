# User Story 03: User Logout

## Story

**As a** logged-in user
**I want to** log out of my account
**So that** I can secure my session or switch accounts

## UX Flow

```
1. User clicks profile/avatar in header
   ↓
2. Dropdown shows user info and "Sign Out" button
   ↓
3. User clicks "Sign Out"
   ↓
4. Clerk clears session (cookie, local storage)
   ↓
5. App redirects to Sign-In page
   ↓
6. Any open WebSocket connections close
   ↓
7. React Query cache is cleared
```

## Acceptance Criteria

- [ ] Sign-out button visible when logged in
- [ ] Clicking sign-out clears all session data
- [ ] User is redirected to sign-in page
- [ ] Cannot access protected routes after logout
- [ ] API calls return 401 after logout
- [ ] WebSocket disconnects gracefully
- [ ] Logging back in shows user's data again

## Edge Cases

| Scenario | Expected Behavior |
|----------|-------------------|
| Logout during API call | API call fails with 401, no crash |
| Logout in one tab | Other tabs detect logout, redirect |
| Network offline during logout | Local session cleared anyway |
| Background job running | Job completes or fails gracefully |

## Technical Notes

```tsx
// Using Clerk's SignOutButton
import { SignOutButton } from '@clerk/clerk-react'

<SignOutButton>
  <button>Sign Out</button>
</SignOutButton>

// Or programmatic logout
const { signOut } = useClerk()
await signOut()
```

- Clear React Query cache on logout: `queryClient.clear()`
- WebSocket should detect auth loss and close
