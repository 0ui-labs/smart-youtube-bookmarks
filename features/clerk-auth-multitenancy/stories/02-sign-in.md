# User Story 02: Returning User Login

## Story

**As a** returning user
**I want to** log into my account
**So that** I can access my saved bookmarks

## UX Flow

```
1. User navigates to app URL
   ↓
2. App detects no session → Redirects to Clerk Sign-In
   ↓
3. User sees Clerk Sign-In UI with options:
   - Email + Password
   - Continue with Google
   - Continue with GitHub
   - Magic Link (passwordless)
   ↓
4. User authenticates
   ↓
5. Clerk validates credentials, issues JWT
   ↓
6. App redirects to /videos
   ↓
7. Backend verifies JWT, finds existing User by clerk_id
   ↓
8. User sees their bookmark lists and videos
```

## Acceptance Criteria

- [ ] Sign-in page accessible at `/sign-in`
- [ ] Email/password login works
- [ ] Google OAuth login works
- [ ] GitHub OAuth login works
- [ ] Magic link login works
- [ ] After login, user lands on main app page
- [ ] User sees their existing data
- [ ] Session persists across browser refresh
- [ ] Session persists across browser tabs

## Edge Cases

| Scenario | Expected Behavior |
|----------|-------------------|
| Wrong password | Clerk shows error, allow retry |
| Account doesn't exist | Clerk shows "Sign up" option |
| OAuth account not linked | Create new user or show linking option |
| Magic link expired | Allow resend |
| Account locked (too many attempts) | Clerk handles lockout |

## Technical Notes

- Clerk handles session management
- JWT stored in httpOnly cookie by Clerk
- Token refresh handled automatically by Clerk SDK
