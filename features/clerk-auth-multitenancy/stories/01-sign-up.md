# User Story 01: New User Registration

## Story

**As a** new visitor
**I want to** create an account
**So that** I can save and organize my YouTube bookmarks

## UX Flow

```
1. User navigates to app URL (e.g., localhost:5173)
   ↓
2. App detects no session → Redirects to Clerk Sign-Up
   ↓
3. User sees Clerk Sign-Up UI with options:
   - Email + Password
   - Continue with Google
   - Continue with GitHub
   ↓
4. User chooses registration method
   ↓
5a. Email: Enter email → Verify email → Set password
5b. Google: OAuth flow → Return to app
5c. GitHub: OAuth flow → Return to app
   ↓
6. Clerk creates user, issues JWT
   ↓
7. App redirects to /videos (main page)
   ↓
8. Backend receives first API call with JWT
   ↓
9. Backend creates User record in DB with clerk_id
   ↓
10. User sees empty bookmark list (fresh start)
```

## Acceptance Criteria

- [ ] Sign-up page accessible at `/sign-up`
- [ ] Email/password registration works
- [ ] Google OAuth registration works
- [ ] GitHub OAuth registration works
- [ ] After sign-up, user lands on main app page
- [ ] New user sees empty state (no lists, no videos)
- [ ] User record created in database with `clerk_id`
- [ ] Subsequent API calls work with user's token

## Edge Cases

| Scenario | Expected Behavior |
|----------|-------------------|
| Email already exists in Clerk | Clerk shows error "Account already exists" |
| Email exists in DB but not Clerk | On first login, link to existing DB user |
| OAuth provider denies access | Show error, allow retry |
| Email verification expires | Allow resend verification |
| Weak password | Clerk enforces password policy |

## Technical Notes

- Clerk handles all registration logic
- Backend only creates User on first authenticated API call
- No custom sign-up UI needed (use Clerk's)
