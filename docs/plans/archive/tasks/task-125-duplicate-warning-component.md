# Task #125: Create DuplicateWarning Component with Real-Time Check

**Plan Task:** #125
**Wave/Phase:** Phase 1 MVP - Frontend Components (Custom Fields System)
**Dependencies:** Task #64 (CustomField Pydantic Schemas - DuplicateCheckRequest/Response)

---

## 🎯 Ziel

Create a reusable `DuplicateWarning` component that performs real-time, debounced checks against the backend to detect duplicate field names (case-insensitive). The component displays a warning badge with existing field details when a duplicate is detected, preventing users from creating duplicate fields.

**Expected Outcome:**
- User types field name in NewFieldForm
- After 300ms of inactivity, component checks backend API
- If duplicate exists, shows warning with field details (type + config preview)
- Warning updates in real-time as user types
- Handles API errors gracefully without breaking form

---

## 📋 Acceptance Criteria

- [ ] Component performs debounced API calls (300ms delay)
- [ ] Case-insensitive duplicate detection works correctly
- [ ] Warning badge displays existing field name, type, and config preview
- [ ] Component shows loading state during API request
- [ ] API errors are handled gracefully (network failures, 500 errors)
- [ ] No API calls for empty/whitespace-only names
- [ ] Component integrates cleanly into NewFieldForm
- [ ] 8+ unit tests covering all edge cases
- [ ] Tests pass with 100% branch coverage for component logic
- [ ] Code reviewed

**Evidence:**
- All Vitest tests pass (`npm test -- DuplicateWarning`)
- Manual test: Type "Overall Rating" → warning appears after 300ms
- Manual test: Clear input → warning disappears
- Manual test: Disconnect network → error handled gracefully

---

## 🛠️ Implementation Steps

### 1. Install use-debounce library
**Files:** `frontend/package.json`
**Action:** Add `use-debounce` for debouncing field name input

```bash
cd frontend
npm install use-debounce
```

**Why use-debounce:**
- Battle-tested library (recommended by React core team)
- Small size (< 1 KB)
- Built-in TypeScript support
- Works correctly with React 18 Strict Mode (no double-invocation issues)
- Provides both `useDebounce` (value) and `useDebouncedCallback` (function)

---

### 2. Create TypeScript types for duplicate check API
**Files:** `frontend/src/types/customField.ts` (new file)
**Action:** Define request/response types matching backend Pydantic schemas

```typescript
import { UUID } from './common'

// Field type definitions (matches backend Literal types)
export type FieldType = 'select' | 'rating' | 'text' | 'boolean'

// Type-specific config interfaces
export interface SelectConfig {
  options: string[]
}

export interface RatingConfig {
  max_rating: number // 1-10
}

export interface TextConfig {
  max_length?: number // Optional, >= 1 if specified
}

export interface BooleanConfig {
  // Empty object, no config needed
}

// Union type for all configs
export type FieldConfig = SelectConfig | RatingConfig | TextConfig | BooleanConfig

// CustomField response (matches backend CustomFieldResponse)
export interface CustomFieldResponse {
  id: UUID
  list_id: UUID
  name: string
  field_type: FieldType
  config: FieldConfig
  created_at: string
  updated_at: string
}

// Duplicate check request (matches backend DuplicateCheckRequest)
export interface DuplicateCheckRequest {
  name: string
}

// Duplicate check response (matches backend DuplicateCheckResponse)
export interface DuplicateCheckResponse {
  exists: boolean
  field: CustomFieldResponse | null
}

// Create request (for future use)
export interface CustomFieldCreate {
  name: string
  field_type: FieldType
  config: FieldConfig
}

// Update request (for future use)
export interface CustomFieldUpdate {
  name?: string
  field_type?: FieldType
  config?: FieldConfig
}
```

**Note:** Also need to define `UUID` type in `common.ts`:

```typescript
// frontend/src/types/common.ts
export type UUID = string // UUID v4 format
```

---

### 3. Create custom React Query hook for duplicate check
**Files:** `frontend/src/hooks/useCustomFields.ts` (new file)
**Action:** Create hook with duplicate check mutation using TanStack Query

```typescript
import { useMutation } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { DuplicateCheckRequest, DuplicateCheckResponse } from '@/types/customField'

/**
 * Hook for checking if a custom field name already exists (case-insensitive).
 *
 * Used by DuplicateWarning component to validate field names in real-time.
 * Performs debounced API calls to avoid overwhelming the backend.
 *
 * @param listId - The list ID to check for duplicate field names
 * @returns Mutation object with mutate(), data, isPending, and error
 *
 * @example
 * ```tsx
 * const { mutate, data, isPending } = useCheckDuplicateField(listId)
 *
 * // In useEffect:
 * if (fieldName.trim()) {
 *   mutate({ name: fieldName })
 * }
 *
 * // In render:
 * if (data?.exists) {
 *   return <Alert>Field "{data.field.name}" already exists</Alert>
 * }
 * ```
 */
export const useCheckDuplicateField = (listId: string) => {
  return useMutation<DuplicateCheckResponse, Error, DuplicateCheckRequest>({
    mutationKey: ['checkDuplicateField', listId],
    mutationFn: async (request: DuplicateCheckRequest) => {
      const { data } = await api.post<DuplicateCheckResponse>(
        `/lists/${listId}/custom-fields/check-duplicate`,
        request
      )
      return data
    },
    // Note: We intentionally don't handle errors here - let component decide
    // This allows component to show appropriate error messages or fallback UI
  })
}
```

**Design Decision:**
- Use `useMutation` instead of `useQuery` because:
  - We want manual control over when to trigger the check (debounced)
  - We don't want automatic refetching on window focus
  - Mutation semantics are clearer for "check this specific value"
- No `onError` handler - component handles errors for better control

---

### 4. Install shadcn/ui Alert component
**Files:** `frontend/src/components/ui/alert.tsx` (new file)
**Action:** Install Alert component from shadcn/ui for warning display

```bash
cd frontend
npx shadcn-ui@latest add alert
```

**Manual Installation (if CLI fails):**

Create `frontend/src/components/ui/alert.tsx`:

```tsx
import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const alertVariants = cva(
  "relative w-full rounded-lg border p-4 [&>svg~*]:pl-7 [&>svg+div]:translate-y-[-3px] [&>svg]:absolute [&>svg]:left-4 [&>svg]:top-4 [&>svg]:text-foreground",
  {
    variants: {
      variant: {
        default: "bg-background text-foreground",
        destructive:
          "border-destructive/50 text-destructive dark:border-destructive [&>svg]:text-destructive",
        warning:
          "border-yellow-500/50 text-yellow-900 bg-yellow-50 dark:border-yellow-500 dark:bg-yellow-950 dark:text-yellow-100 [&>svg]:text-yellow-600 dark:[&>svg]:text-yellow-400",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

const Alert = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof alertVariants>
>(({ className, variant, ...props }, ref) => (
  <div
    ref={ref}
    role="alert"
    className={cn(alertVariants({ variant }), className)}
    {...props}
  />
))
Alert.displayName = "Alert"

const AlertTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h5
    ref={ref}
    className={cn("mb-1 font-medium leading-none tracking-tight", className)}
    {...props}
  />
))
AlertTitle.displayName = "AlertTitle"

const AlertDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("text-sm [&_p]:leading-relaxed", className)}
    {...props}
  />
))
AlertDescription.displayName = "AlertDescription"

export { Alert, AlertTitle, AlertDescription }
```

**Note:** Added custom `warning` variant for yellow warning badge styling.

---

### 5. Create DuplicateWarning component
**Files:** `frontend/src/components/fields/DuplicateWarning.tsx` (new file)
**Action:** Implement main component with debouncing and API integration

```tsx
import { useEffect } from 'react'
import { useDebounce } from 'use-debounce'
import { AlertCircle, Loader2 } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { useCheckDuplicateField } from '@/hooks/useCustomFields'
import type { FieldType, FieldConfig } from '@/types/customField'

export interface DuplicateWarningProps {
  /**
   * Current field name being typed by user.
   * Component will check this value for duplicates after debounce delay.
   */
  fieldName: string

  /**
   * List ID to check for duplicate field names.
   * Field names must be unique within a list (case-insensitive).
   */
  listId: string

  /**
   * Debounce delay in milliseconds.
   * Prevents excessive API calls while user is typing.
   * @default 300
   */
  debounceMs?: number
}

/**
 * Real-time duplicate field name checker with visual warning badge.
 *
 * Features:
 * - Debounced API calls (300ms default) to reduce backend load
 * - Case-insensitive duplicate detection
 * - Loading state during API request
 * - Error handling for network failures
 * - Displays existing field details (type + config preview)
 *
 * @example
 * ```tsx
 * <DuplicateWarning
 *   fieldName={formData.name}
 *   listId={currentListId}
 *   debounceMs={300}
 * />
 * ```
 */
export function DuplicateWarning({
  fieldName,
  listId,
  debounceMs = 300
}: DuplicateWarningProps) {
  // Debounce the field name to avoid excessive API calls
  const [debouncedName] = useDebounce(fieldName.trim(), debounceMs)

  // Get duplicate check mutation
  const { mutate, data, isPending, error, reset } = useCheckDuplicateField(listId)

  // Trigger duplicate check when debounced name changes
  useEffect(() => {
    // Skip check for empty names (no need to call API)
    if (!debouncedName) {
      reset() // Clear previous results
      return
    }

    // Trigger duplicate check
    mutate({ name: debouncedName })
  }, [debouncedName, mutate, reset])

  // Don't render anything if name is empty or whitespace
  if (!fieldName.trim()) {
    return null
  }

  // Show loading state while checking
  if (isPending) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span>Checking for duplicates...</span>
      </div>
    )
  }

  // Handle API errors gracefully
  if (error) {
    return (
      <Alert variant="destructive" className="mt-2">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Error checking for duplicates</AlertTitle>
        <AlertDescription>
          Could not verify if this field name already exists.
          Please check your connection and try again.
        </AlertDescription>
      </Alert>
    )
  }

  // Show warning if duplicate exists
  if (data?.exists && data.field) {
    const configPreview = formatConfigPreview(data.field.field_type, data.field.config)

    return (
      <Alert variant="warning" className="mt-2">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Field already exists</AlertTitle>
        <AlertDescription>
          <p className="mb-1">
            A field named <strong>"{data.field.name}"</strong> already exists.
          </p>
          <p className="text-xs text-muted-foreground">
            Type: {formatFieldType(data.field.field_type)} • {configPreview}
          </p>
        </AlertDescription>
      </Alert>
    )
  }

  // No duplicate found - don't render anything (success state is silent)
  return null
}

/**
 * Format field type for display (capitalize first letter).
 */
function formatFieldType(fieldType: FieldType): string {
  const typeMap: Record<FieldType, string> = {
    select: 'Dropdown',
    rating: 'Rating',
    text: 'Text',
    boolean: 'Checkbox',
  }
  return typeMap[fieldType] || fieldType
}

/**
 * Format config for preview display (truncated for readability).
 *
 * Examples:
 * - select: "Options: bad, good, great"
 * - rating: "Max: 5 stars"
 * - text: "Max length: 500 characters"
 * - boolean: "Yes/No"
 */
function formatConfigPreview(fieldType: FieldType, config: FieldConfig): string {
  switch (fieldType) {
    case 'select': {
      const selectConfig = config as { options: string[] }
      const options = selectConfig.options || []
      const preview = options.slice(0, 3).join(', ')
      const more = options.length > 3 ? `, +${options.length - 3} more` : ''
      return `Options: ${preview}${more}`
    }
    case 'rating': {
      const ratingConfig = config as { max_rating: number }
      const max = ratingConfig.max_rating || 5
      return `Max: ${max} stars`
    }
    case 'text': {
      const textConfig = config as { max_length?: number }
      const maxLength = textConfig.max_length
      return maxLength ? `Max length: ${maxLength} characters` : 'Unlimited length'
    }
    case 'boolean':
      return 'Yes/No'
    default:
      return 'Unknown config'
  }
}
```

**Design Decisions:**
- **Debounce delay 300ms:** Balances responsiveness vs. backend load (industry standard)
- **Silent success:** No UI element when no duplicate found (reduces visual noise)
- **Loading state:** Shows spinner to indicate backend check is in progress
- **Error handling:** Shows destructive alert for network errors, allows retry
- **Config preview:** Truncates long option lists (first 3 items) to keep UI clean
- **No duplicate found:** Returns `null` instead of "No duplicate found" message

---

### 6. Create barrel export for fields components
**Files:** `frontend/src/components/fields/index.ts` (new file)
**Action:** Create barrel export for clean imports

```typescript
export { DuplicateWarning } from './DuplicateWarning'
export type { DuplicateWarningProps } from './DuplicateWarning'

// Future exports (from other tasks):
// export { NewFieldForm } from './NewFieldForm'
// export { FieldSelector } from './FieldSelector'
// export { SchemaEditor } from './SchemaEditor'
```

---

### 7. Update NewFieldForm to integrate DuplicateWarning (placeholder example)
**Files:** `frontend/src/components/fields/NewFieldForm.tsx` (future task)
**Action:** Document integration pattern for future implementation

```tsx
// Example integration (will be implemented in Task #123):

import { useState } from 'react'
import { DuplicateWarning } from '@/components/fields'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export function NewFieldForm({ listId }: { listId: string }) {
  const [fieldName, setFieldName] = useState('')
  const [fieldType, setFieldType] = useState<FieldType>('text')
  const [config, setConfig] = useState<FieldConfig>({})

  return (
    <form className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="field-name">Field Name</Label>
        <Input
          id="field-name"
          placeholder="e.g., Presentation Quality"
          value={fieldName}
          onChange={(e) => setFieldName(e.target.value)}
        />

        {/* DuplicateWarning integration */}
        <DuplicateWarning
          fieldName={fieldName}
          listId={listId}
          debounceMs={300}
        />
      </div>

      {/* Field type selector, config editors, etc. */}
    </form>
  )
}
```

---

### 8. Create comprehensive unit tests
**Files:** `frontend/src/components/fields/DuplicateWarning.test.tsx` (new file)
**Action:** Write 8+ tests covering all component logic paths

```tsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { DuplicateWarning } from './DuplicateWarning'
import type { DuplicateCheckResponse } from '@/types/customField'

// Mock API server
const server = setupServer()

// Test utilities
function renderWithQueryClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      {ui}
    </QueryClientProvider>
  )
}

// Mock data
const mockExistingField = {
  id: '123e4567-e89b-12d3-a456-426614174000',
  list_id: '987fcdeb-51a2-43d1-9012-345678901234',
  name: 'Overall Rating',
  field_type: 'rating' as const,
  config: { max_rating: 5 },
  created_at: '2025-11-07T10:00:00Z',
  updated_at: '2025-11-07T10:00:00Z',
}

describe('DuplicateWarning', () => {
  beforeEach(() => {
    server.listen({ onUnhandledRequest: 'error' })
  })

  afterEach(() => {
    server.resetHandlers()
    server.close()
  })

  it('renders nothing when field name is empty', () => {
    const { container } = renderWithQueryClient(
      <DuplicateWarning fieldName="" listId="test-list-id" />
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('renders nothing when field name is only whitespace', () => {
    const { container } = renderWithQueryClient(
      <DuplicateWarning fieldName="   " listId="test-list-id" />
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('shows loading state while checking for duplicates', async () => {
    server.use(
      http.post('/api/lists/:listId/custom-fields/check-duplicate', async () => {
        // Delay response to ensure loading state is visible
        await new Promise((resolve) => setTimeout(resolve, 100))
        return HttpResponse.json({ exists: false, field: null })
      })
    )

    renderWithQueryClient(
      <DuplicateWarning fieldName="New Field" listId="test-list-id" />
    )

    // Wait for loading state to appear
    await waitFor(() => {
      expect(screen.getByText('Checking for duplicates...')).toBeInTheDocument()
    })
  })

  it('shows warning when duplicate field exists (case-insensitive)', async () => {
    server.use(
      http.post('/api/lists/:listId/custom-fields/check-duplicate', () => {
        return HttpResponse.json({
          exists: true,
          field: mockExistingField,
        } as DuplicateCheckResponse)
      })
    )

    renderWithQueryClient(
      <DuplicateWarning fieldName="overall rating" listId="test-list-id" />
    )

    // Wait for warning to appear
    await waitFor(() => {
      expect(screen.getByText('Field already exists')).toBeInTheDocument()
    })

    expect(screen.getByText(/"Overall Rating"/)).toBeInTheDocument()
    expect(screen.getByText(/Rating/)).toBeInTheDocument()
    expect(screen.getByText(/Max: 5 stars/)).toBeInTheDocument()
  })

  it('renders nothing when no duplicate exists (silent success)', async () => {
    server.use(
      http.post('/api/lists/:listId/custom-fields/check-duplicate', () => {
        return HttpResponse.json({
          exists: false,
          field: null,
        } as DuplicateCheckResponse)
      })
    )

    const { container } = renderWithQueryClient(
      <DuplicateWarning fieldName="Unique Field" listId="test-list-id" />
    )

    // Wait for API call to complete
    await waitFor(() => {
      expect(container).toBeEmptyDOMElement()
    })
  })

  it('handles API errors gracefully', async () => {
    server.use(
      http.post('/api/lists/:listId/custom-fields/check-duplicate', () => {
        return HttpResponse.json(
          { detail: 'Internal server error' },
          { status: 500 }
        )
      })
    )

    renderWithQueryClient(
      <DuplicateWarning fieldName="Test Field" listId="test-list-id" />
    )

    // Wait for error alert to appear
    await waitFor(() => {
      expect(screen.getByText('Error checking for duplicates')).toBeInTheDocument()
    })

    expect(
      screen.getByText(/Could not verify if this field name already exists/)
    ).toBeInTheDocument()
  })

  it('handles network errors gracefully', async () => {
    server.use(
      http.post('/api/lists/:listId/custom-fields/check-duplicate', () => {
        return HttpResponse.error()
      })
    )

    renderWithQueryClient(
      <DuplicateWarning fieldName="Test Field" listId="test-list-id" />
    )

    // Wait for error alert to appear
    await waitFor(() => {
      expect(screen.getByText('Error checking for duplicates')).toBeInTheDocument()
    })
  })

  it('debounces API calls (waits 300ms before checking)', async () => {
    const checkDuplicateSpy = vi.fn(() =>
      HttpResponse.json({ exists: false, field: null })
    )

    server.use(
      http.post('/api/lists/:listId/custom-fields/check-duplicate', checkDuplicateSpy)
    )

    const { rerender } = renderWithQueryClient(
      <DuplicateWarning fieldName="T" listId="test-list-id" debounceMs={300} />
    )

    // Simulate rapid typing
    rerender(<DuplicateWarning fieldName="Te" listId="test-list-id" debounceMs={300} />)
    rerender(<DuplicateWarning fieldName="Tes" listId="test-list-id" debounceMs={300} />)
    rerender(<DuplicateWarning fieldName="Test" listId="test-list-id" debounceMs={300} />)

    // API should not be called yet (debounce in progress)
    expect(checkDuplicateSpy).not.toHaveBeenCalled()

    // Wait for debounce delay + API response
    await waitFor(
      () => {
        expect(checkDuplicateSpy).toHaveBeenCalledTimes(1)
      },
      { timeout: 500 }
    )

    // Verify request payload
    const request = checkDuplicateSpy.mock.calls[0][0]
    const body = await request.json()
    expect(body).toEqual({ name: 'Test' })
  })

  it('formats select field config preview (truncates long option lists)', async () => {
    server.use(
      http.post('/api/lists/:listId/custom-fields/check-duplicate', () => {
        return HttpResponse.json({
          exists: true,
          field: {
            ...mockExistingField,
            field_type: 'select',
            config: {
              options: ['bad', 'good', 'great', 'excellent', 'outstanding'],
            },
          },
        } as DuplicateCheckResponse)
      })
    )

    renderWithQueryClient(
      <DuplicateWarning fieldName="test" listId="test-list-id" />
    )

    await waitFor(() => {
      expect(screen.getByText(/Options: bad, good, great, \+2 more/)).toBeInTheDocument()
    })
  })

  it('formats text field config preview (shows max length)', async () => {
    server.use(
      http.post('/api/lists/:listId/custom-fields/check-duplicate', () => {
        return HttpResponse.json({
          exists: true,
          field: {
            ...mockExistingField,
            field_type: 'text',
            config: { max_length: 500 },
          },
        } as DuplicateCheckResponse)
      })
    )

    renderWithQueryClient(
      <DuplicateWarning fieldName="test" listId="test-list-id" />
    )

    await waitFor(() => {
      expect(screen.getByText(/Max length: 500 characters/)).toBeInTheDocument()
    })
  })

  it('formats boolean field config preview', async () => {
    server.use(
      http.post('/api/lists/:listId/custom-fields/check-duplicate', () => {
        return HttpResponse.json({
          exists: true,
          field: {
            ...mockExistingField,
            field_type: 'boolean',
            config: {},
          },
        } as DuplicateCheckResponse)
      })
    )

    renderWithQueryClient(
      <DuplicateWarning fieldName="test" listId="test-list-id" />
    )

    await waitFor(() => {
      expect(screen.getByText(/Yes\/No/)).toBeInTheDocument()
    })
  })

  it('clears warning when field name is cleared', async () => {
    server.use(
      http.post('/api/lists/:listId/custom-fields/check-duplicate', () => {
        return HttpResponse.json({
          exists: true,
          field: mockExistingField,
        } as DuplicateCheckResponse)
      })
    )

    const { rerender, container } = renderWithQueryClient(
      <DuplicateWarning fieldName="Overall Rating" listId="test-list-id" />
    )

    // Wait for warning to appear
    await waitFor(() => {
      expect(screen.getByText('Field already exists')).toBeInTheDocument()
    })

    // Clear field name
    rerender(<DuplicateWarning fieldName="" listId="test-list-id" />)

    // Warning should disappear
    expect(container).toBeEmptyDOMElement()
  })
})
```

---

### 9. Add MSW setup for testing (if not already configured)
**Files:** `frontend/src/test/setup.ts` (or `vitest.setup.ts`)
**Action:** Configure Mock Service Worker for API mocking in tests

```typescript
import { beforeAll, afterEach, afterAll } from 'vitest'
import { setupServer } from 'msw/node'

// Create MSW server instance (without handlers - each test defines its own)
export const server = setupServer()

// Start server before all tests
beforeAll(() => {
  server.listen({ onUnhandledRequest: 'error' })
})

// Reset handlers after each test to ensure test isolation
afterEach(() => {
  server.resetHandlers()
})

// Close server after all tests
afterAll(() => {
  server.close()
})
```

**Update `vitest.config.ts`:**

```typescript
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts', // Add this line
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
```

---

### 10. Install MSW if not already installed
**Files:** `frontend/package.json`
**Action:** Install MSW for API mocking in tests

```bash
cd frontend
npm install --save-dev msw@latest
```

**Note:** MSW v2+ is required for the modern `http` API (used in tests above).

---

## 🧪 Testing Strategy

### Unit Tests (8+ tests in `DuplicateWarning.test.tsx`)

1. **Empty field name** - Verify no render when fieldName is empty string
   - Assert: `container.toBeEmptyDOMElement()`

2. **Whitespace-only field name** - Verify no render when fieldName is "   "
   - Assert: `container.toBeEmptyDOMElement()`

3. **Loading state** - Verify spinner appears while API request is pending
   - Mock: Delayed API response (100ms)
   - Assert: "Checking for duplicates..." text visible

4. **Duplicate exists** - Verify warning badge shows when duplicate found
   - Mock: API returns `exists: true` with field details
   - Assert: "Field already exists" title, field name, type, and config preview visible

5. **No duplicate (silent success)** - Verify nothing rendered when no duplicate
   - Mock: API returns `exists: false`
   - Assert: `container.toBeEmptyDOMElement()`

6. **API error handling** - Verify error alert shows on 500 response
   - Mock: API returns 500 status
   - Assert: "Error checking for duplicates" title visible

7. **Network error handling** - Verify error alert shows on network failure
   - Mock: API returns `HttpResponse.error()`
   - Assert: Error alert visible

8. **Debouncing** - Verify API called only once after 300ms of inactivity
   - Mock: API call spy
   - Simulate: Rapid typing (4 characters in quick succession)
   - Assert: API called exactly once after 300ms

9. **Config preview - select (truncated)** - Verify long option lists truncated to 3
   - Mock: API returns select field with 5 options
   - Assert: "Options: bad, good, great, +2 more" visible

10. **Config preview - text (max length)** - Verify max_length displayed
    - Mock: API returns text field with max_length: 500
    - Assert: "Max length: 500 characters" visible

11. **Config preview - boolean** - Verify "Yes/No" displayed
    - Mock: API returns boolean field
    - Assert: "Yes/No" visible

12. **Clear field name** - Verify warning disappears when field cleared
    - Initial: Field name "Overall Rating" → warning appears
    - Rerender: Field name "" → warning disappears
    - Assert: `container.toBeEmptyDOMElement()`

### Integration Tests (with NewFieldForm)

**Note:** Integration tests will be added in Task #123 (NewFieldForm component)

1. **Full flow test** - Type field name → warning appears → change name → warning updates
2. **Form submission blocked** - Verify form cannot be submitted when duplicate exists
3. **Multiple field names** - Test switching between duplicate and non-duplicate names

### Manual Testing Checklist

**Prerequisites:**
- Backend server running (`uvicorn app.main:app --reload`)
- Frontend dev server running (`npm run dev`)
- At least one list created
- At least one custom field created (e.g., "Overall Rating" with type=rating, max_rating=5)

**Test Cases:**

1. **Basic duplicate detection**
   - Open NewFieldForm (future task - use Storybook or dedicated test page)
   - Type "Overall Rating" slowly
   - Expected: After 300ms, warning badge appears with message:
     ```
     Field already exists
     A field named "Overall Rating" already exists.
     Type: Rating • Max: 5 stars
     ```

2. **Case-insensitive detection**
   - Type "overall rating" (lowercase)
   - Expected: Same warning appears

3. **Debouncing behavior**
   - Type "Overall" quickly, then pause
   - Expected: No API call until you stop typing for 300ms
   - Type "Rating" after 200ms
   - Expected: Previous API call cancelled, new call after 300ms from last keystroke

4. **No duplicate (silent success)**
   - Type "Unique Field Name 123"
   - Expected: No warning badge, no "success" message (silent)

5. **Clear field**
   - Type "Overall Rating" → warning appears
   - Clear field to empty string
   - Expected: Warning disappears immediately

6. **Network error**
   - Stop backend server
   - Type "Test Field"
   - Expected: Red error alert appears:
     ```
     Error checking for duplicates
     Could not verify if this field name already exists.
     Please check your connection and try again.
     ```

7. **Loading state**
   - Throttle network to "Slow 3G" (Chrome DevTools)
   - Type "Test"
   - Expected: Spinner with "Checking for duplicates..." appears during request

---

## 📚 Reference

### Related Docs

- **Design Document:** `docs/plans/2025-11-05-custom-fields-system-design.md`
  - Section: "6.2 Frontend Components" (lines 356-359)
  - Section: "6.3.3 NewFieldForm Test" (lines 689-705)
  - Section: "Duplicate Check API" (lines 202-217)

- **Backend Schemas:** `backend/app/schemas/custom_field.py`
  - `DuplicateCheckRequest` schema (lines 320-357)
  - `DuplicateCheckResponse` schema (lines 359-393)

### Related Code

- **Similar pattern (TanStack Query mutation):** `frontend/src/hooks/useLists.ts`
  - Example: `useCreateList()` and `useDeleteList()` mutations
  - Pattern: `useMutation` with `mutationKey`, `mutationFn`, and error handling

- **Similar pattern (React Query with debounce):**
  - External example: [TanStack Query + Debounce](https://github.com/TanStack/query/discussions/1141)
  - Pattern: Use `useDebounce` from `use-debounce` + `useEffect` to trigger mutation

- **shadcn/ui Alert component:** `frontend/src/components/ui/alert.tsx` (new file)
  - Reference: [shadcn/ui Alert docs](https://ui.shadcn.com/docs/components/alert)
  - Custom variant added: `warning` (yellow badge)

### REF MCP Research Findings

#### 1. React Query Best Practices (TanStack Query Blog)
- **Source:** [Practical React Query](https://tkdodo.eu/blog/practical-react-query)
- **Key Takeaways:**
  - Use `queryOptions()` helper for type-safe query key sharing
  - Keep server state (React Query) separate from client state (Zustand)
  - Use `enabled` option for dependent queries
  - Prefer `useMutation` for imperative operations (like our duplicate check)

#### 2. shadcn/ui Alert Component
- **Source:** [shadcn/ui Alert docs](https://ui.shadcn.com/docs/components/alert)
- **Usage Pattern:**
  ```tsx
  <Alert variant="warning">
    <AlertCircle className="h-4 w-4" />
    <AlertTitle>Heads up!</AlertTitle>
    <AlertDescription>Your warning message here</AlertDescription>
  </Alert>
  ```
- **Custom Variant:** Added `warning` variant with yellow styling (not in default shadcn/ui)

#### 3. use-debounce Library
- **Source:** [use-debounce README](https://github.com/xnimorz/use-debounce)
- **Why chosen over alternatives:**
  - Recommended by React core team (Dan Abramov tweet)
  - Works correctly with React 18 Strict Mode (no double-invocation issues)
  - Small size (< 1 KB)
  - Built-in TypeScript support
  - Provides both `useDebounce` (value) and `useDebouncedCallback` (function)

- **Usage Pattern:**
  ```tsx
  const [debouncedValue] = useDebounce(value, 300)

  useEffect(() => {
    // Trigger API call with debounced value
  }, [debouncedValue])
  ```

- **Key Options:**
  - `maxWait`: Max time before forced invocation (not needed here)
  - `leading`: Execute immediately on first call (not needed here)
  - `trailing`: Execute after timeout (default: true, used here)

#### 4. Pydantic ValidationError Patterns
- **Source:** [Pydantic Error Messages](https://docs.pydantic.dev/latest/errors/errors/)
- **Key Insight:** Backend already handles validation at Pydantic level
- **Frontend approach:**
  - Display user-friendly messages (not raw Pydantic errors)
  - Map common errors to readable strings
  - Show field-specific context (name, type, config)

### Design Decisions

**1. Why useMutation instead of useQuery?**
- Mutation semantics clearer for "check this specific value"
- Manual control over when to trigger check (debounced)
- No automatic refetching on window focus (would cause unnecessary API calls)
- Better for imperative operations triggered by user input

**2. Why 300ms debounce delay?**
- Industry standard for search inputs (Google, Amazon use similar delays)
- Balances responsiveness (not too slow) vs. backend load (not too many requests)
- User types at ~200ms/character average → 300ms catches natural pauses

**3. Why silent success (no "No duplicate found" message)?**
- Reduces visual noise in the form
- Warning appears only when user needs to take action
- Follows "don't make me think" UX principle

**4. Why show config preview in warning?**
- Helps user identify which existing field matches
- Prevents confusion if multiple similar field names exist
- Provides context for "why can't I use this name?"

**5. Why truncate select options to 3?**
- Keeps UI clean and readable
- Full config visible in field editor if needed
- "+N more" indicator shows there's more data

**6. Why use Alert component instead of inline text?**
- More visually prominent (harder to miss)
- Consistent with app-wide warning/error patterns
- Better accessibility (role="alert" announces to screen readers)
- Icon provides quick visual recognition

### Constraints & Considerations

**Performance:**
- Debouncing reduces API load (max ~3 requests/second if user types continuously)
- No caching between different field names (each name is unique check)
- Backend query uses indexed LOWER(name) for fast case-insensitive lookup

**Accessibility:**
- Alert component has `role="alert"` for screen reader announcements
- Loading state announced by screen readers ("Checking for duplicates...")
- Error messages provide clear guidance ("check your connection")

**Error Handling:**
- Network errors handled gracefully (no crash, shows user-friendly message)
- 500 errors handled same as network errors (can't distinguish at client level)
- No retry mechanism (user can fix input and trigger new check)

**Future Extensions:**
- Could add "Use existing field" button in warning (navigate to field editor)
- Could show list of similar field names (fuzzy matching)
- Could allow "force create anyway" with confirmation modal
- Could add custom debounce delay in form props (currently hardcoded 300ms)

---

## 📝 Notes

**Implementation Order:**
1. Install dependencies (use-debounce, msw if needed)
2. Create type definitions
3. Create React Query hook
4. Install/create Alert component
5. Create DuplicateWarning component
6. Write unit tests
7. Integrate into NewFieldForm (Task #123)

**Testing Notes:**
- MSW v2+ required for modern `http` API
- Use `QueryClientProvider` wrapper in tests with `retry: false`
- Mock server must be set up in `beforeAll` and cleaned up in `afterAll`
- Each test should define its own handler (don't share state)

**Backend Prerequisites:**
- Duplicate check endpoint must be implemented (Task #64)
- Endpoint path: `POST /api/lists/{list_id}/custom-fields/check-duplicate`
- Case-insensitive comparison must use SQL `LOWER()` function

**File Structure:**
```
frontend/src/
├── components/
│   ├── fields/
│   │   ├── DuplicateWarning.tsx        # Main component
│   │   ├── DuplicateWarning.test.tsx   # Unit tests
│   │   └── index.ts                    # Barrel export
│   └── ui/
│       └── alert.tsx                   # shadcn/ui Alert component
├── hooks/
│   └── useCustomFields.ts              # React Query hook
├── types/
│   ├── customField.ts                  # API types
│   └── common.ts                       # Shared types (UUID)
└── test/
    └── setup.ts                        # MSW setup
```

**Dependencies Added:**
- `use-debounce` (runtime) - ~1 KB, MIT license
- `msw` (dev) - ~150 KB, MIT license (already might be installed)

**Estimated Effort:**
- Implementation: ~2-3 hours
- Testing: ~2 hours
- Integration into NewFieldForm: ~30 minutes (Task #123)
- Total: ~4-5 hours

---

**Status:** Ready for implementation
**Reviewed by:** [Pending review]
**Last updated:** 2025-11-07
