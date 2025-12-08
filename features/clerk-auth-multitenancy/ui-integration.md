# UI/UX Integration: Clerk Authentication

## Current UI Structure

```
App.tsx
├── <Routes>
│   ├── <MainLayout>           ← Shared sidebar
│   │   ├── /videos            ← VideosPage
│   │   ├── /videos/:id        ← VideoDetailsPage
│   │   ├── /channels          ← ChannelsPage
│   │   ├── /dashboard         ← Dashboard
│   │   └── /settings/schemas  ← SettingsPage
│   │
│   ├── /lists                 ← ListsPage (no sidebar)
│   ├── /                      ← Redirect to /videos
│   └── *                      ← NotFound
```

## Proposed Auth UI Structure

```
main.tsx
├── <ClerkProvider>
│   └── <QueryClientProvider>
│       └── <BrowserRouter>
│           └── <WebSocketProvider>
│               └── App.tsx
│                   ├── <SignedIn>
│                   │   └── <Routes>
│                   │       └── ... (existing routes)
│                   │
│                   ├── <SignedOut>
│                   │   └── <Routes>
│                   │       ├── /sign-in    ← Clerk Sign-In
│                   │       ├── /sign-up    ← Clerk Sign-Up
│                   │       └── *           ← Redirect to /sign-in
```

---

## UI Components to Add

### 1. User Button (Header)

**Location:** Inside `MainLayout` header

```tsx
import { UserButton } from '@clerk/clerk-react'

// In MainLayout.tsx header section
<header className="flex items-center justify-between p-4 border-b">
  <h1>Smart YouTube Bookmarks</h1>

  {/* NEW: User profile dropdown */}
  <UserButton
    appearance={{
      elements: {
        avatarBox: "w-10 h-10"
      }
    }}
    afterSignOutUrl="/sign-in"
  />
</header>
```

**Clerk's UserButton includes:**
- User avatar
- Profile management link
- Sign out option
- Account switching (if enabled)

### 2. Sign-In Page

**Option A: Clerk Hosted (Recommended)**

```tsx
// Just redirect - Clerk handles the UI
import { RedirectToSignIn } from '@clerk/clerk-react'

<Route path="/sign-in/*" element={<RedirectToSignIn />} />
```

**Option B: Custom Sign-In Page**

```tsx
// frontend/src/pages/SignIn.tsx
import { SignIn } from '@clerk/clerk-react'

export function SignInPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="w-full max-w-md">
        <h1 className="mb-8 text-center text-2xl font-bold">
          Smart YouTube Bookmarks
        </h1>
        <SignIn
          routing="path"
          path="/sign-in"
          signUpUrl="/sign-up"
          appearance={{
            elements: {
              rootBox: "mx-auto",
              card: "shadow-lg"
            }
          }}
        />
      </div>
    </div>
  )
}
```

### 3. Sign-Up Page

```tsx
// frontend/src/pages/SignUp.tsx
import { SignUp } from '@clerk/clerk-react'

export function SignUpPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="w-full max-w-md">
        <h1 className="mb-8 text-center text-2xl font-bold">
          Smart YouTube Bookmarks
        </h1>
        <SignUp
          routing="path"
          path="/sign-up"
          signInUrl="/sign-in"
        />
      </div>
    </div>
  )
}
```

### 4. Loading State (Auth Check)

```tsx
// frontend/src/components/AuthLoading.tsx
export function AuthLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto" />
        <p className="mt-4 text-gray-600">Checking authentication...</p>
      </div>
    </div>
  )
}
```

---

## Updated App.tsx Structure

```tsx
// frontend/src/App.tsx
import { SignedIn, SignedOut, SignIn, SignUp, useAuth } from '@clerk/clerk-react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthLoading } from './components/AuthLoading'

// ... existing imports

function App() {
  const { isLoaded } = useAuth()

  // Show loading while Clerk initializes
  if (!isLoaded) {
    return <AuthLoading />
  }

  return (
    <>
      {/* Authenticated users see the app */}
      <SignedIn>
        <AuthenticatedApp />
      </SignedIn>

      {/* Unauthenticated users see sign-in/sign-up */}
      <SignedOut>
        <Routes>
          <Route path="/sign-in/*" element={<SignInPage />} />
          <Route path="/sign-up/*" element={<SignUpPage />} />
          <Route path="*" element={<Navigate to="/sign-in" replace />} />
        </Routes>
      </SignedOut>
    </>
  )
}

// Extracted for clarity - this is the current app
function AuthenticatedApp() {
  const { data: lists, isLoading, isError } = useLists()
  const actualListId = lists?.[0]?.id ?? null

  return (
    <Routes>
      {/* Routes with MainLayout (shared sidebar) */}
      <Route element={<MainLayout />}>
        <Route path="/videos" element={...} />
        <Route path="/videos/:videoId" element={<VideoDetailsPage />} />
        <Route path="/channels" element={<ChannelsPage />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/settings/schemas" element={<SettingsPage />} />
      </Route>

      {/* Routes without MainLayout */}
      <Route path="/lists" element={<ListsPage />} />
      <Route path="/" element={<Navigate to="/videos" replace />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}
```

---

## MainLayout Changes

```tsx
// frontend/src/components/MainLayout.tsx
import { UserButton } from '@clerk/clerk-react'

export function MainLayout() {
  return (
    <div className="flex h-screen">
      {/* Sidebar */}
      <aside className="w-64 border-r">
        {/* ... existing sidebar content */}
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col">
        {/* Header - ADD USER BUTTON */}
        <header className="h-14 border-b flex items-center justify-between px-4">
          <div>{/* Breadcrumbs or title */}</div>

          {/* User profile & sign out */}
          <UserButton
            afterSignOutUrl="/sign-in"
            appearance={{
              elements: {
                avatarBox: "w-8 h-8"
              }
            }}
          />
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
```

---

## Navigation Flow

### Unauthenticated User

```
User visits /videos
        ↓
App checks auth (isLoaded = false)
        ↓
Show <AuthLoading />
        ↓
Clerk finishes loading (isLoaded = true, isSignedIn = false)
        ↓
<SignedOut> renders
        ↓
Route /videos doesn't match sign-in routes
        ↓
Redirect to /sign-in
        ↓
Show Clerk Sign-In UI
```

### Authenticated User

```
User visits /videos
        ↓
App checks auth (isLoaded = false)
        ↓
Show <AuthLoading />
        ↓
Clerk finishes loading (isLoaded = true, isSignedIn = true)
        ↓
<SignedIn> renders
        ↓
<AuthenticatedApp> renders
        ↓
Route /videos matches
        ↓
Show VideosPage
```

---

## Styling & Design System

### Clerk Appearance Customization

```tsx
// frontend/src/lib/clerkAppearance.ts
import type { Appearance } from '@clerk/types'

export const clerkAppearance: Appearance = {
  // Match your app's design system
  variables: {
    colorPrimary: '#2563eb',       // blue-600
    colorTextOnPrimaryBackground: '#ffffff',
    borderRadius: '0.5rem',
  },
  elements: {
    card: 'shadow-lg rounded-lg',
    formButtonPrimary: 'bg-blue-600 hover:bg-blue-700',
    socialButtonsBlockButton: 'border-gray-300 hover:bg-gray-50',
  }
}

// Usage in ClerkProvider
<ClerkProvider
  publishableKey={...}
  appearance={clerkAppearance}
>
```

### Consistent Loading States

```tsx
// Match existing loading patterns in the app
function AuthLoading() {
  return (
    <div className="flex items-center justify-center h-full">
      <p className="text-gray-600">Lade...</p>
    </div>
  )
}
```

---

## Mobile/Responsive Considerations

### Sign-In/Sign-Up Pages

- Clerk components are responsive by default
- Full-width on mobile, centered card on desktop
- Touch-friendly OAuth buttons

### User Button

```tsx
// Responsive header
<header className="flex items-center justify-between px-4 py-2">
  {/* Mobile: Show hamburger menu */}
  <button className="md:hidden">
    <MenuIcon />
  </button>

  {/* Desktop: Show title */}
  <h1 className="hidden md:block">Smart YouTube Bookmarks</h1>

  {/* User button - works on all sizes */}
  <UserButton />
</header>
```

---

## Accessibility

### Clerk's Built-in A11y

- Keyboard navigation for all forms
- ARIA labels for inputs
- Focus management during flows
- Screen reader announcements

### Additional Considerations

```tsx
// Auth loading state with ARIA
<div
  role="status"
  aria-live="polite"
  className="flex items-center justify-center h-screen"
>
  <span className="sr-only">Checking authentication...</span>
  <LoadingSpinner aria-hidden="true" />
</div>
```

---

## Routes Summary

| Route | Authenticated | Unauthenticated | Component |
|-------|--------------|-----------------|-----------|
| `/sign-in/*` | Redirect to `/videos` | Show SignIn | `<SignIn />` |
| `/sign-up/*` | Redirect to `/videos` | Show SignUp | `<SignUp />` |
| `/videos` | Show VideosPage | Redirect to `/sign-in` | `<VideosPage />` |
| `/channels` | Show ChannelsPage | Redirect to `/sign-in` | `<ChannelsPage />` |
| `/dashboard` | Show Dashboard | Redirect to `/sign-in` | `<Dashboard />` |
| `/settings/*` | Show Settings | Redirect to `/sign-in` | `<SettingsPage />` |
| `/lists` | Show ListsPage | Redirect to `/sign-in` | `<ListsPage />` |

---

## Design Mockups (ASCII)

### Sign-In Page
```
┌─────────────────────────────────────────────┐
│                                             │
│     ┌─────────────────────────────────┐     │
│     │                                 │     │
│     │   Smart YouTube Bookmarks       │     │
│     │                                 │     │
│     │   ┌─────────────────────────┐   │     │
│     │   │ Email                   │   │     │
│     │   └─────────────────────────┘   │     │
│     │   ┌─────────────────────────┐   │     │
│     │   │ Password                │   │     │
│     │   └─────────────────────────┘   │     │
│     │                                 │     │
│     │   [      Sign In           ]   │     │
│     │                                 │     │
│     │   ─────── or ────────          │     │
│     │                                 │     │
│     │   [G] Continue with Google     │     │
│     │   [GH] Continue with GitHub    │     │
│     │                                 │     │
│     │   Don't have an account?       │     │
│     │   Sign up →                    │     │
│     │                                 │     │
│     └─────────────────────────────────┘     │
│                                             │
└─────────────────────────────────────────────┘
```

### App with User Button
```
┌─────────────────────────────────────────────────────────┐
│ ☰ Smart YouTube Bookmarks                    [Avatar ▼] │
├───────────────┬─────────────────────────────────────────┤
│               │                                         │
│  📹 Videos    │  Your Videos                           │
│  📺 Channels  │  ┌──────────────────────────────────┐  │
│  📊 Dashboard │  │ Video 1                          │  │
│  ⚙️ Settings  │  │ Video 2                          │  │
│               │  │ Video 3                          │  │
│               │  └──────────────────────────────────┘  │
│               │                                         │
└───────────────┴─────────────────────────────────────────┘
```

**Exit Condition:** ✅ Klares UI-Integrationskonzept das existierendes Design respektiert
