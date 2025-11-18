# Tag Management UI & Settings Reorganization Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add comprehensive tag management interface to Settings page and reorganize UI layout for better usability.

**Architecture:** Frontend-only changes adding CRUD UI for tags (backend endpoints already exist). New components follow existing patterns (FieldsList → TagsList). UI reorganization moves Settings button to sidebar and Add Filter button to controls bar for improved discoverability.

**Tech Stack:** React 18, TypeScript, TanStack Query, React Hook Form, Zod, Radix UI, Tailwind CSS

---

## Prerequisites

- Backend is running: `cd backend && python -m uvicorn app.main:app --reload`
- Frontend dev server: `cd frontend && npm run dev`
- All existing tests passing: `cd frontend && npm test`

---

## Task 1: Create Tag Update/Delete Hooks

**Files:**
- Modify: `frontend/src/hooks/useTags.ts` (append after `useBulkApplySchema`)
- Test: `frontend/src/hooks/__tests__/useTags.test.tsx` (new file)

### Step 1: Write the failing test for useUpdateTag

Create `frontend/src/hooks/__tests__/useTags.test.tsx`:

```tsx
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { rest } from 'msw'
import { setupServer } from 'msw/node'
import { useUpdateTag, useDeleteTag } from '../useTags'
import type { Tag } from '@/types/tag'

const mockTag: Tag = {
  id: 'tag-123',
  name: 'Python',
  color: '#3B82F6',
  schema_id: null,
  user_id: 'user-456',
  created_at: '2025-11-18T10:00:00Z',
  updated_at: '2025-11-18T10:00:00Z',
}

const server = setupServer(
  rest.put('/api/tags/:tagId', (req, res, ctx) => {
    return res(ctx.json({ ...mockTag, name: 'Updated Name' }))
  }),
  rest.delete('/api/tags/:tagId', (req, res, ctx) => {
    return res(ctx.status(204))
  })
)

beforeAll(() => server.listen())
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

describe('useUpdateTag', () => {
  it('updates a tag', async () => {
    const { result } = renderHook(() => useUpdateTag(), { wrapper: createWrapper() })

    result.current.mutate({
      tagId: 'tag-123',
      data: { name: 'Updated Name', color: '#3B82F6', schema_id: null },
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.name).toBe('Updated Name')
  })
})

describe('useDeleteTag', () => {
  it('deletes a tag', async () => {
    const { result } = renderHook(() => useDeleteTag(), { wrapper: createWrapper() })

    result.current.mutate('tag-123')

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
  })
})
```

### Step 2: Run test to verify it fails

```bash
cd frontend
npm test -- src/hooks/__tests__/useTags.test.tsx
```

**Expected:** FAIL - "useUpdateTag is not exported" and "useDeleteTag is not exported"

### Step 3: Implement useUpdateTag and useDeleteTag

Add to `frontend/src/hooks/useTags.ts` after `useBulkApplySchema`:

```tsx
/**
 * React Query mutation hook to update an existing tag
 *
 * Automatically invalidates tags query after successful update or error
 *
 * @returns Mutation result with mutate function
 *
 * @example
 * ```tsx
 * const updateTag = useUpdateTag()
 *
 * updateTag.mutate({
 *   tagId: 'uuid',
 *   data: { name: 'New Name', color: '#FF0000', schema_id: 'uuid-or-null' }
 * })
 * ```
 */
export const useUpdateTag = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationKey: ['updateTag'],
    mutationFn: async ({ tagId, data }: { tagId: string; data: Partial<TagCreate> }) => {
      const { data: responseData } = await api.put<Tag>(`/tags/${tagId}`, data)
      // Validate response with Zod schema
      return TagSchema.parse(responseData)
    },
    onError: (error) => {
      console.error('Failed to update tag:', error)
    },
    onSettled: async () => {
      // Invalidate tags query to refresh UI
      await queryClient.invalidateQueries({ queryKey: tagsOptions().queryKey })
    },
  })
}

/**
 * React Query mutation hook to delete a tag
 *
 * Automatically invalidates tags AND videos queries after successful deletion
 * to ensure tag badges disappear from video cards
 *
 * @returns Mutation result with mutate function
 *
 * @example
 * ```tsx
 * const deleteTag = useDeleteTag()
 *
 * deleteTag.mutate('tag-uuid')
 * ```
 */
export const useDeleteTag = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationKey: ['deleteTag'],
    mutationFn: async (tagId: string) => {
      await api.delete(`/tags/${tagId}`)
      // 204 No Content - no response body
    },
    onError: (error) => {
      console.error('Failed to delete tag:', error)
    },
    onSettled: async () => {
      // Invalidate both tags and videos queries
      // Videos query needs refresh to remove deleted tag badges
      await queryClient.invalidateQueries({ queryKey: tagsOptions().queryKey })
      await queryClient.invalidateQueries({ queryKey: ['videos'] })
    },
  })
}
```

### Step 4: Run test to verify it passes

```bash
npm test -- src/hooks/__tests__/useTags.test.tsx
```

**Expected:** PASS - All tests green

### Step 5: Commit

```bash
git add frontend/src/hooks/useTags.ts frontend/src/hooks/__tests__/useTags.test.tsx
git commit -m "feat(tags): add useUpdateTag and useDeleteTag hooks"
```

---

## Task 2: Create TagActionsMenu Component

**Files:**
- Create: `frontend/src/components/settings/TagActionsMenu.tsx`
- Test: `frontend/src/components/settings/TagActionsMenu.test.tsx`

### Step 1: Write the failing test

Create `frontend/src/components/settings/TagActionsMenu.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { TagActionsMenu } from './TagActionsMenu'
import type { Tag } from '@/types/tag'

const mockTag: Tag = {
  id: 'tag-123',
  name: 'Python',
  color: '#3B82F6',
  schema_id: null,
  user_id: 'user-456',
  created_at: '2025-11-18T10:00:00Z',
  updated_at: '2025-11-18T10:00:00Z',
}

describe('TagActionsMenu', () => {
  it('renders actions menu trigger', () => {
    render(<TagActionsMenu tag={mockTag} onEdit={vi.fn()} onDelete={vi.fn()} />)
    expect(screen.getByRole('button', { name: /actions/i })).toBeInTheDocument()
  })

  it('opens dropdown on click', async () => {
    render(<TagActionsMenu tag={mockTag} onEdit={vi.fn()} onDelete={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: /actions/i }))

    expect(await screen.findByText('Edit')).toBeInTheDocument()
    expect(screen.getByText('Delete')).toBeInTheDocument()
  })

  it('calls onEdit when Edit clicked', async () => {
    const onEdit = vi.fn()
    render(<TagActionsMenu tag={mockTag} onEdit={onEdit} onDelete={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: /actions/i }))
    fireEvent.click(await screen.findByText('Edit'))

    expect(onEdit).toHaveBeenCalledWith(mockTag)
  })

  it('calls onDelete when Delete clicked', async () => {
    const onDelete = vi.fn()
    render(<TagActionsMenu tag={mockTag} onEdit={vi.fn()} onDelete={onDelete} />)

    fireEvent.click(screen.getByRole('button', { name: /actions/i }))
    fireEvent.click(await screen.findByText('Delete'))

    expect(onDelete).toHaveBeenCalledWith(mockTag)
  })
})
```

### Step 2: Run test to verify it fails

```bash
npm test -- src/components/settings/TagActionsMenu.test.tsx
```

**Expected:** FAIL - "TagActionsMenu is not defined"

### Step 3: Implement TagActionsMenu component

Create `frontend/src/components/settings/TagActionsMenu.tsx`:

```tsx
import { MoreVertical, Pencil, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { Tag } from '@/types/tag'

interface TagActionsMenuProps {
  tag: Tag
  onEdit: (tag: Tag) => void
  onDelete: (tag: Tag) => void
}

/**
 * Actions dropdown menu for tag management
 * Provides Edit and Delete options
 *
 * @example
 * <TagActionsMenu
 *   tag={tag}
 *   onEdit={(tag) => openEditDialog(tag)}
 *   onDelete={(tag) => openDeleteDialog(tag)}
 * />
 */
export function TagActionsMenu({ tag, onEdit, onDelete }: TagActionsMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0"
          aria-label={`Actions for ${tag.name}`}
        >
          <MoreVertical className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => onEdit(tag)}>
          <Pencil className="mr-2 h-4 w-4" />
          Edit
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => onDelete(tag)}
          className="text-red-600 focus:text-red-600"
        >
          <Trash2 className="mr-2 h-4 w-4" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
```

### Step 4: Run test to verify it passes

```bash
npm test -- src/components/settings/TagActionsMenu.test.tsx
```

**Expected:** PASS - All tests green

### Step 5: Commit

```bash
git add frontend/src/components/settings/TagActionsMenu.tsx frontend/src/components/settings/TagActionsMenu.test.tsx
git commit -m "feat(tags): add TagActionsMenu component"
```

---

## Task 3: Create TagsList Component

**Files:**
- Create: `frontend/src/components/settings/TagsList.tsx`
- Test: `frontend/src/components/settings/TagsList.test.tsx`

### Step 1: Write the failing test

Create `frontend/src/components/settings/TagsList.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TagsList } from './TagsList'
import type { Tag } from '@/types/tag'

const mockTags: Tag[] = [
  {
    id: 'tag-1',
    name: 'Python',
    color: '#3B82F6',
    schema_id: 'schema-1',
    user_id: 'user-1',
    created_at: '2025-11-18T10:00:00Z',
    updated_at: '2025-11-18T10:00:00Z',
  },
  {
    id: 'tag-2',
    name: 'Tutorial',
    color: '#10B981',
    schema_id: null,
    user_id: 'user-1',
    created_at: '2025-11-18T11:00:00Z',
    updated_at: '2025-11-18T11:00:00Z',
  },
]

describe('TagsList', () => {
  it('renders all tags in table', () => {
    render(<TagsList tags={mockTags} onEdit={vi.fn()} onDelete={vi.fn()} />)

    expect(screen.getByText('Python')).toBeInTheDocument()
    expect(screen.getByText('Tutorial')).toBeInTheDocument()
  })

  it('shows empty state when no tags', () => {
    render(<TagsList tags={[]} onEdit={vi.fn()} onDelete={vi.fn()} />)

    expect(screen.getByText(/no tags yet/i)).toBeInTheDocument()
  })

  it('displays "No Schema" for tags without schema', () => {
    render(<TagsList tags={mockTags} onEdit={vi.fn()} onDelete={vi.fn()} />)

    expect(screen.getByText('No Schema')).toBeInTheDocument()
  })

  it('shows loading state', () => {
    render(<TagsList tags={[]} isLoading={true} onEdit={vi.fn()} onDelete={vi.fn()} />)

    expect(screen.getByText(/loading/i)).toBeInTheDocument()
  })
})
```

### Step 2: Run test to verify it fails

```bash
npm test -- src/components/settings/TagsList.test.tsx
```

**Expected:** FAIL - "TagsList is not defined"

### Step 3: Implement TagsList component

Create `frontend/src/components/settings/TagsList.tsx`:

```tsx
import { TagActionsMenu } from './TagActionsMenu'
import { Badge } from '@/components/ui/badge'
import type { Tag } from '@/types/tag'

interface TagsListProps {
  tags: Tag[]
  onEdit: (tag: Tag) => void
  onDelete: (tag: Tag) => void
  isLoading?: boolean
}

/**
 * Table displaying all tags with actions
 *
 * @example
 * <TagsList
 *   tags={tags}
 *   onEdit={(tag) => setSelectedTag(tag)}
 *   onDelete={(tag) => setDeleteTag(tag)}
 *   isLoading={isLoading}
 * />
 */
export function TagsList({ tags, onEdit, onDelete, isLoading }: TagsListProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">Loading tags...</p>
      </div>
    )
  }

  if (tags.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <p className="text-muted-foreground mb-2">
          No tags yet. Create your first tag from the sidebar.
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-md border">
      <table className="w-full">
        <thead>
          <tr className="border-b bg-muted/50">
            <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">
              Name
            </th>
            <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">
              Color
            </th>
            <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">
              Schema
            </th>
            <th className="h-12 px-4 text-right align-middle font-medium text-muted-foreground">
              Actions
            </th>
          </tr>
        </thead>
        <tbody>
          {tags.map((tag) => (
            <tr
              key={tag.id}
              className="border-b transition-colors hover:bg-muted/50"
            >
              <td className="p-4 align-middle font-medium">{tag.name}</td>
              <td className="p-4 align-middle">
                <div className="flex items-center gap-2">
                  <div
                    className="h-4 w-4 rounded-full border"
                    style={{ backgroundColor: tag.color || '#3B82F6' }}
                    aria-label={`Color: ${tag.color || 'default'}`}
                  />
                  <span className="text-sm text-muted-foreground">
                    {tag.color || '#3B82F6'}
                  </span>
                </div>
              </td>
              <td className="p-4 align-middle">
                {tag.schema_id ? (
                  <Badge variant="secondary">Schema</Badge>
                ) : (
                  <span className="text-sm text-muted-foreground">No Schema</span>
                )}
              </td>
              <td className="p-4 align-middle text-right">
                <TagActionsMenu tag={tag} onEdit={onEdit} onDelete={onDelete} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
```

### Step 4: Run test to verify it passes

```bash
npm test -- src/components/settings/TagsList.test.tsx
```

**Expected:** PASS - All tests green

### Step 5: Commit

```bash
git add frontend/src/components/settings/TagsList.tsx frontend/src/components/settings/TagsList.test.tsx
git commit -m "feat(tags): add TagsList component"
```

---

## Task 4: Create EditTagDialog Component

**Files:**
- Create: `frontend/src/components/EditTagDialog.tsx`
- Test: `frontend/src/components/EditTagDialog.test.tsx`

### Step 1: Write the failing test

Create `frontend/src/components/EditTagDialog.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { rest } from 'msw'
import { setupServer } from 'msw/node'
import { EditTagDialog } from './EditTagDialog'
import type { Tag } from '@/types/tag'

const mockTag: Tag = {
  id: 'tag-123',
  name: 'Python',
  color: '#3B82F6',
  schema_id: null,
  user_id: 'user-456',
  created_at: '2025-11-18T10:00:00Z',
  updated_at: '2025-11-18T10:00:00Z',
}

const server = setupServer(
  rest.put('/api/tags/:tagId', (req, res, ctx) => {
    return res(ctx.json({ ...mockTag, name: 'Updated Name' }))
  }),
  rest.get('/api/schemas', (req, res, ctx) => {
    return res(ctx.json([]))
  })
)

beforeAll(() => server.listen())
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

describe('EditTagDialog', () => {
  it('pre-fills form with tag data', () => {
    render(
      <EditTagDialog tag={mockTag} open={true} onClose={vi.fn()} />,
      { wrapper: createWrapper() }
    )

    expect(screen.getByDisplayValue('Python')).toBeInTheDocument()
    expect(screen.getByDisplayValue('#3B82F6')).toBeInTheDocument()
  })

  it('shows validation error when name is empty', async () => {
    render(
      <EditTagDialog tag={mockTag} open={true} onClose={vi.fn()} />,
      { wrapper: createWrapper() }
    )

    const nameInput = screen.getByLabelText(/name/i)
    fireEvent.change(nameInput, { target: { value: '' } })
    fireEvent.click(screen.getByText('Save'))

    expect(await screen.findByText(/name is required/i)).toBeInTheDocument()
  })

  it('calls onClose after successful update', async () => {
    const onClose = vi.fn()
    render(
      <EditTagDialog tag={mockTag} open={true} onClose={onClose} />,
      { wrapper: createWrapper() }
    )

    const nameInput = screen.getByLabelText(/name/i)
    fireEvent.change(nameInput, { target: { value: 'Updated Name' } })
    fireEvent.click(screen.getByText('Save'))

    await waitFor(() => expect(onClose).toHaveBeenCalled())
  })
})
```

### Step 2: Run test to verify it fails

```bash
npm test -- src/components/EditTagDialog.test.tsx
```

**Expected:** FAIL - "EditTagDialog is not defined"

### Step 3: Implement EditTagDialog component

Create `frontend/src/components/EditTagDialog.tsx`:

```tsx
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useUpdateTag } from '@/hooks/useTags'
import { useSchemas } from '@/hooks/useSchemas'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogFooter,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { Tag } from '@/types/tag'

const TagFormSchema = z.object({
  name: z.string().min(1, 'Tag name is required').max(100),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).nullable(),
  schema_id: z.string().uuid().nullable(),
})

type TagFormData = z.infer<typeof TagFormSchema>

interface EditTagDialogProps {
  tag: Tag
  open: boolean
  onClose: () => void
}

export function EditTagDialog({ tag, open, onClose }: EditTagDialogProps) {
  const updateTag = useUpdateTag()
  const { data: schemas = [] } = useSchemas()

  const form = useForm<TagFormData>({
    resolver: zodResolver(TagFormSchema),
    defaultValues: {
      name: tag.name,
      color: tag.color || '#3B82F6',
      schema_id: tag.schema_id,
    },
  })

  const handleSubmit = form.handleSubmit(async (data) => {
    try {
      await updateTag.mutateAsync({
        tagId: tag.id,
        data: {
          name: data.name,
          color: data.color,
          schema_id: data.schema_id,
        },
      })
      onClose()
    } catch (error: any) {
      form.setError('name', {
        message: error.response?.data?.detail || 'Failed to update tag',
      })
    }
  })

  return (
    <AlertDialog open={open} onOpenChange={onClose}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Edit Tag</AlertDialogTitle>
        </AlertDialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="name">Name *</Label>
            <Input
              id="name"
              {...form.register('name')}
              placeholder="Enter tag name"
            />
            {form.formState.errors.name && (
              <p className="text-sm text-red-600 mt-1">
                {form.formState.errors.name.message}
              </p>
            )}
          </div>

          <div>
            <Label htmlFor="color">Color</Label>
            <div className="flex gap-2">
              <input
                type="color"
                id="color"
                {...form.register('color')}
                className="h-10 w-16 rounded border cursor-pointer"
              />
              <Input
                {...form.register('color')}
                placeholder="#3B82F6"
                className="flex-1"
              />
            </div>
            {form.formState.errors.color && (
              <p className="text-sm text-red-600 mt-1">
                {form.formState.errors.color.message}
              </p>
            )}
          </div>

          <div>
            <Label htmlFor="schema">Schema (optional)</Label>
            <Select
              value={form.watch('schema_id') || 'none'}
              onValueChange={(value) =>
                form.setValue('schema_id', value === 'none' ? null : value)
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select schema" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No Schema</SelectItem>
                {schemas.map((schema) => (
                  <SelectItem key={schema.id} value={schema.id}>
                    {schema.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel onClick={onClose}>Cancel</AlertDialogCancel>
            <Button type="submit" disabled={updateTag.isPending}>
              {updateTag.isPending ? 'Saving...' : 'Save'}
            </Button>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  )
}
```

### Step 4: Run test to verify it passes

```bash
npm test -- src/components/EditTagDialog.test.tsx
```

**Expected:** PASS - All tests green

### Step 5: Commit

```bash
git add frontend/src/components/EditTagDialog.tsx frontend/src/components/EditTagDialog.test.tsx
git commit -m "feat(tags): add EditTagDialog component"
```

---

## Task 5: Create ConfirmDeleteTagDialog Component

**Files:**
- Create: `frontend/src/components/ConfirmDeleteTagDialog.tsx`
- Test: `frontend/src/components/ConfirmDeleteTagDialog.test.tsx`

### Step 1: Write the failing test

Create `frontend/src/components/ConfirmDeleteTagDialog.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { rest } from 'msw'
import { setupServer } from 'msw/node'
import { ConfirmDeleteTagDialog } from './ConfirmDeleteTagDialog'
import type { Tag } from '@/types/tag'

const mockTag: Tag = {
  id: 'tag-123',
  name: 'Python',
  color: '#3B82F6',
  schema_id: null,
  user_id: 'user-456',
  created_at: '2025-11-18T10:00:00Z',
  updated_at: '2025-11-18T10:00:00Z',
}

const server = setupServer(
  rest.delete('/api/tags/:tagId', (req, res, ctx) => {
    return res(ctx.status(204))
  })
)

beforeAll(() => server.listen())
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

describe('ConfirmDeleteTagDialog', () => {
  it('shows tag name in warning', () => {
    render(
      <ConfirmDeleteTagDialog tag={mockTag} open={true} onConfirm={vi.fn()} onCancel={vi.fn()} />,
      { wrapper: createWrapper() }
    )

    expect(screen.getByText(/Python/)).toBeInTheDocument()
  })

  it('calls onConfirm after successful deletion', async () => {
    const onConfirm = vi.fn()
    render(
      <ConfirmDeleteTagDialog tag={mockTag} open={true} onConfirm={onConfirm} onCancel={vi.fn()} />,
      { wrapper: createWrapper() }
    )

    fireEvent.click(screen.getByText('Delete'))

    await waitFor(() => expect(onConfirm).toHaveBeenCalled())
  })

  it('calls onCancel when cancelled', () => {
    const onCancel = vi.fn()
    render(
      <ConfirmDeleteTagDialog tag={mockTag} open={true} onConfirm={vi.fn()} onCancel={onCancel} />,
      { wrapper: createWrapper() }
    )

    fireEvent.click(screen.getByText('Cancel'))

    expect(onCancel).toHaveBeenCalled()
  })
})
```

### Step 2: Run test to verify it fails

```bash
npm test -- src/components/ConfirmDeleteTagDialog.test.tsx
```

**Expected:** FAIL - "ConfirmDeleteTagDialog is not defined"

### Step 3: Implement ConfirmDeleteTagDialog component

Create `frontend/src/components/ConfirmDeleteTagDialog.tsx`:

```tsx
import { AlertTriangle } from 'lucide-react'
import { useDeleteTag } from '@/hooks/useTags'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import type { Tag } from '@/types/tag'

interface ConfirmDeleteTagDialogProps {
  tag: Tag
  open: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDeleteTagDialog({
  tag,
  open,
  onConfirm,
  onCancel,
}: ConfirmDeleteTagDialogProps) {
  const deleteTag = useDeleteTag()

  const handleConfirm = async () => {
    try {
      await deleteTag.mutateAsync(tag.id)
      onConfirm()
    } catch (error) {
      console.error('Failed to delete tag:', error)
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onCancel}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-600" />
            Delete Tag
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-2">
            <p>
              Are you sure you want to delete the tag{' '}
              <strong className="font-semibold text-foreground">&quot;{tag.name}&quot;</strong>?
            </p>
            <p>This will remove the tag from all videos.</p>
            <p className="text-sm text-muted-foreground">
              This action cannot be undone.
            </p>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>Cancel</AlertDialogCancel>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={deleteTag.isPending}
          >
            {deleteTag.isPending ? 'Deleting...' : 'Delete'}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
```

### Step 4: Run test to verify it passes

```bash
npm test -- src/components/ConfirmDeleteTagDialog.test.tsx
```

**Expected:** PASS - All tests green

### Step 5: Commit

```bash
git add frontend/src/components/ConfirmDeleteTagDialog.tsx frontend/src/components/ConfirmDeleteTagDialog.test.tsx
git commit -m "feat(tags): add ConfirmDeleteTagDialog component"
```

---

## Task 6: Add Tags Tab to SettingsPage

**Files:**
- Modify: `frontend/src/pages/SettingsPage.tsx`
- Test: `frontend/src/pages/SettingsPage.integration.test.tsx`

### Step 1: Write the failing integration test

Add to `frontend/src/pages/SettingsPage.integration.test.tsx`:

```tsx
describe('SettingsPage - Tags Tab', () => {
  it('renders Tags tab and displays TagsList', async () => {
    render(<SettingsPage />)

    const tagsTab = screen.getByRole('tab', { name: /tags/i })
    expect(tagsTab).toBeInTheDocument()

    fireEvent.click(tagsTab)

    expect(await screen.findByText(/manage your tags/i)).toBeInTheDocument()
  })
})
```

### Step 2: Run test to verify it fails

```bash
npm test -- src/pages/SettingsPage.integration.test.tsx
```

**Expected:** FAIL - "Unable to find tab with name /tags/i"

### Step 3: Modify SettingsPage to add Tags tab

In `frontend/src/pages/SettingsPage.tsx`:

**Add imports:**
```tsx
import { TagsList } from '@/components/settings/TagsList'
import { EditTagDialog } from '@/components/EditTagDialog'
import { ConfirmDeleteTagDialog } from '@/components/ConfirmDeleteTagDialog'
import { useTags } from '@/hooks/useTags'
```

**Add state management (after existing state):**
```tsx
const { data: tags = [], isLoading: tagsLoading } = useTags()
const [editTagDialogOpen, setEditTagDialogOpen] = useState(false)
const [deleteTagDialogOpen, setDeleteTagDialogOpen] = useState(false)
const [selectedTag, setSelectedTag] = useState<Tag | null>(null)

const handleEditTag = (tag: Tag) => {
  setSelectedTag(tag)
  setEditTagDialogOpen(true)
}

const handleDeleteTag = (tag: Tag) => {
  setSelectedTag(tag)
  setDeleteTagDialogOpen(true)
}
```

**Add Tags tab trigger (BEFORE Analytics tab):**
```tsx
<TabsList>
  <TabsTrigger value="schemas">Schemas</TabsTrigger>
  <TabsTrigger value="fields">Fields</TabsTrigger>
  <TabsTrigger value="tags">Tags</TabsTrigger>
  <TabsTrigger value="analytics">Analytics</TabsTrigger>
</TabsList>
```

**Add Tags tab content (BEFORE Analytics content):**
```tsx
<TabsContent value="tags">
  <div className="space-y-6">
    <div>
      <h2 className="text-2xl font-bold tracking-tight">Tags</h2>
      <p className="text-muted-foreground">
        Manage your tags and their schemas
      </p>
    </div>

    {tagsLoading ? (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">Loading tags...</p>
      </div>
    ) : (
      <TagsList
        tags={tags}
        onEdit={handleEditTag}
        onDelete={handleDeleteTag}
      />
    )}
  </div>
</TabsContent>
```

**Add dialogs (after </Tabs> closing tag):**
```tsx
{selectedTag && (
  <>
    <EditTagDialog
      tag={selectedTag}
      open={editTagDialogOpen}
      onClose={() => {
        setEditTagDialogOpen(false)
        setSelectedTag(null)
      }}
    />

    <ConfirmDeleteTagDialog
      tag={selectedTag}
      open={deleteTagDialogOpen}
      onConfirm={() => {
        setDeleteTagDialogOpen(false)
        setSelectedTag(null)
      }}
      onCancel={() => {
        setDeleteTagDialogOpen(false)
        setSelectedTag(null)
      }}
    />
  </>
)}
```

### Step 4: Run test to verify it passes

```bash
npm test -- src/pages/SettingsPage.integration.test.tsx
```

**Expected:** PASS - Tags tab renders and displays TagsList

### Step 5: Commit

```bash
git add frontend/src/pages/SettingsPage.tsx frontend/src/pages/SettingsPage.integration.test.tsx
git commit -m "feat(tags): add Tags tab to SettingsPage"
```

---

## Task 7: Extract FilterPopover Component

**Files:**
- Create: `frontend/src/components/videos/FilterPopover.tsx`
- Modify: `frontend/src/components/videos/FilterBar.tsx`
- Test: `frontend/src/components/videos/FilterPopover.test.tsx`

### Step 1: Write the failing test

Create `frontend/src/components/videos/FilterPopover.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { FilterPopover } from './FilterPopover'

const createWrapper = () => {
  const queryClient = new QueryClient()
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

describe('FilterPopover', () => {
  it('renders Add Filter button', () => {
    render(<FilterPopover listId="list-1" />, { wrapper: createWrapper() })

    expect(screen.getByText('Add Filter')).toBeInTheDocument()
  })

  it('opens popover on click', async () => {
    render(<FilterPopover listId="list-1" />, { wrapper: createWrapper() })

    fireEvent.click(screen.getByText('Add Filter'))

    // Popover content should appear (exact content depends on implementation)
    expect(await screen.findByRole('dialog')).toBeInTheDocument()
  })
})
```

### Step 2: Run test to verify it fails

```bash
npm test -- src/components/videos/FilterPopover.test.tsx
```

**Expected:** FAIL - "FilterPopover is not defined"

### Step 3: Extract FilterPopover from FilterBar

Create `frontend/src/components/videos/FilterPopover.tsx`:

Copy the Add Filter button logic from FilterBar.tsx. The exact implementation depends on your current FilterBar code, but it should look like:

```tsx
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
// ... other imports based on your filter logic

interface FilterPopoverProps {
  listId: string
}

export function FilterPopover({ listId }: FilterPopoverProps) {
  // Extract filter addition logic from FilterBar
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button size="sm" variant="outline">
          <Plus className="h-4 w-4 mr-2" />
          Add Filter
        </Button>
      </PopoverTrigger>
      <PopoverContent>
        {/* Filter selection UI - copy from FilterBar */}
      </PopoverContent>
    </Popover>
  )
}
```

### Step 4: Update FilterBar to remove Add Filter button

In `frontend/src/components/videos/FilterBar.tsx`:

Remove the Add Filter button and popover code. Keep only the active filter badges and Clear All button.

### Step 5: Run test to verify it passes

```bash
npm test -- src/components/videos/FilterPopover.test.tsx
npm test -- src/components/videos/FilterBar.test.tsx
```

**Expected:** PASS - Both tests green

### Step 6: Commit

```bash
git add frontend/src/components/videos/FilterPopover.tsx frontend/src/components/videos/FilterBar.tsx frontend/src/components/videos/FilterPopover.test.tsx
git commit -m "refactor(filters): extract FilterPopover component from FilterBar"
```

---

## Task 8: Move Settings Button to Sidebar

**Files:**
- Modify: `frontend/src/components/VideosPage.tsx`
- Test: Update `frontend/src/components/VideosPage.test.tsx`

### Step 1: Write the failing test

Add to `frontend/src/components/VideosPage.test.tsx`:

```tsx
describe('VideosPage - UI Reorganization', () => {
  it('Settings button is in sidebar, not controls bar', () => {
    render(<VideosPage listId="list-1" />)

    const sidebar = screen.getByRole('complementary')
    const controlsBar = screen.getByRole('toolbar')

    expect(within(sidebar).getByText('Settings')).toBeInTheDocument()
    expect(within(controlsBar).queryByText('Settings')).not.toBeInTheDocument()
  })
})
```

### Step 2: Run test to verify it fails

```bash
npm test -- src/components/VideosPage.test.tsx
```

**Expected:** FAIL - "Unable to find Settings in sidebar"

### Step 3: Move Settings button to sidebar

In `frontend/src/components/VideosPage.tsx`:

**Remove Settings button from controls bar (around line 779-787):**
```tsx
// DELETE these lines:
<Button
  variant="outline"
  size="sm"
  onClick={() => navigate('/settings/schemas')}
>
  <Settings className="h-4 w-4 mr-2" />
  Settings
</Button>
```

**Add Settings button to sidebar (in CollapsibleSidebar section):**

Find the CollapsibleSidebar component usage and add Settings button:

```tsx
<CollapsibleSidebar>
  <TagNavigation
    tags={tags}
    selectedTagIds={selectedTagIds}
    onTagSelect={toggleTag}
    onTagCreate={() => setCreateTagDialogOpen(true)}
  />

  {/* NEW: Settings button at bottom of sidebar */}
  <div className="mt-auto pt-4 border-t border-gray-200">
    <Button
      variant="ghost"
      className="w-full justify-start text-gray-700 hover:text-gray-900 hover:bg-gray-100"
      onClick={() => navigate('/settings/schemas')}
    >
      <Settings className="h-4 w-4 mr-2" />
      Settings
    </Button>
  </div>
</CollapsibleSidebar>
```

### Step 4: Run test to verify it passes

```bash
npm test -- src/components/VideosPage.test.tsx
```

**Expected:** PASS - Settings button now in sidebar

### Step 5: Commit

```bash
git add frontend/src/components/VideosPage.tsx frontend/src/components/VideosPage.test.tsx
git commit -m "feat(ui): move Settings button to sidebar"
```

---

## Task 9: Move Add Filter Button to Controls Bar

**Files:**
- Modify: `frontend/src/components/VideosPage.tsx`
- Test: Update `frontend/src/components/VideosPage.test.tsx`

### Step 1: Write the failing test

Add to `frontend/src/components/VideosPage.test.tsx`:

```tsx
it('Add Filter button is in controls bar, not FilterBar', () => {
  render(<VideosPage listId="list-1" />)

  const controlsBar = screen.getByRole('toolbar')

  expect(within(controlsBar).getByText('Add Filter')).toBeInTheDocument()
})
```

### Step 2: Run test to verify it fails

```bash
npm test -- src/components/VideosPage.test.tsx
```

**Expected:** FAIL - "Unable to find Add Filter in controls bar"

### Step 3: Add FilterPopover import and use in controls bar

In `frontend/src/components/VideosPage.tsx`:

**Add import:**
```tsx
import { FilterPopover } from '@/components/videos/FilterPopover'
```

**Add FilterPopover to controls bar (where Settings button was, around line 779):**
```tsx
<div className="flex gap-1 items-center flex-shrink-0 ml-auto">
  {/* NEW: Add Filter button (replaces Settings position) */}
  <FilterPopover listId={listId} />

  <ViewModeToggle viewMode={viewMode} onToggle={setViewMode} />
  <TableSettingsDropdown />
</div>
```

### Step 4: Run test to verify it passes

```bash
npm test -- src/components/VideosPage.test.tsx
```

**Expected:** PASS - Add Filter button now in controls bar

### Step 5: Run all tests to ensure no regressions

```bash
npm test
```

**Expected:** All tests passing

### Step 6: Commit

```bash
git add frontend/src/components/VideosPage.tsx frontend/src/components/VideosPage.test.tsx
git commit -m "feat(ui): move Add Filter button to controls bar"
```

---

## Task 10: Final Testing & Documentation

**Files:**
- Update: `frontend/README.md` (if exists)
- Update: `docs/features/tag-management.md` (create if needed)

### Step 1: Run full test suite

```bash
cd frontend
npm test
```

**Expected:** All tests passing (target: >90% coverage for new files)

### Step 2: Manual testing checklist

**Tag Management:**
- [ ] Navigate to Settings → Tags tab
- [ ] View all tags in table
- [ ] Click Edit on a tag → dialog opens with pre-filled form
- [ ] Change tag name → save → list updates
- [ ] Change tag color → save → sidebar tag color updates
- [ ] Change tag schema → save → video custom fields update
- [ ] Click Delete on a tag → confirmation dialog
- [ ] Confirm deletion → tag removed from list and videos

**UI Reorganization:**
- [ ] Settings button visible in sidebar (bottom)
- [ ] Click Settings button → navigates to /settings/schemas
- [ ] Add Filter button visible in controls bar (right side)
- [ ] Click Add Filter → popover opens with field selection
- [ ] Add a filter → filter badge appears in FilterBar

### Step 3: Document new features

Create `docs/features/tag-management.md`:

```markdown
# Tag Management Feature

## Overview
Comprehensive tag management UI added to Settings page with full CRUD operations.

## User Guide

### Viewing Tags
1. Click Settings button in sidebar
2. Click "Tags" tab
3. View all tags in table

### Editing Tags
1. In Tags list, click actions menu (⋮)
2. Click "Edit"
3. Modify name, color, or schema
4. Click "Save"

### Deleting Tags
1. In Tags list, click actions menu (⋮)
2. Click "Delete"
3. Confirm deletion
4. Tag removed from all videos

## Technical Details

### Components
- `TagsList`: Table displaying all tags
- `EditTagDialog`: Modal for editing tag properties
- `ConfirmDeleteTagDialog`: Confirmation dialog for deletion
- `TagActionsMenu`: Dropdown menu with Edit/Delete options

### Hooks
- `useUpdateTag()`: Mutation hook for updating tags
- `useDeleteTag()`: Mutation hook for deleting tags

### API Endpoints (existing)
- `PUT /api/tags/{id}`: Update tag
- `DELETE /api/tags/{id}`: Delete tag
```

### Step 4: Commit documentation

```bash
git add docs/features/tag-management.md frontend/README.md
git commit -m "docs: add tag management feature documentation"
```

---

## Verification & Rollout

### Pre-Deployment Checklist

- [ ] All tests passing (`npm test`)
- [ ] No TypeScript errors (`npm run type-check` if available)
- [ ] No linting errors (`npm run lint`)
- [ ] Manual testing completed (see Task 10 Step 2)
- [ ] Documentation updated
- [ ] All commits follow conventional commits format

### Build & Deploy

```bash
# Build frontend
cd frontend
npm run build

# Test production build locally
npm run preview

# Deploy (adjust based on your deployment process)
# Example for Vercel:
# vercel --prod
```

### Post-Deployment Monitoring

1. **Monitor error rates:**
   - Check for 404s on `/api/tags/*` endpoints
   - Check frontend console errors related to tags

2. **User feedback:**
   - Observe user behavior in analytics
   - Track clicks on Tags tab
   - Track tag edit/delete operations

3. **Performance:**
   - Page load time unchanged
   - TagsList renders < 100ms for typical tag counts

---

## Rollback Plan

If critical issues arise:

```bash
# Revert all changes
git revert <commit-range>

# Or comment out Tags tab (quick fix)
# In SettingsPage.tsx:
# - Comment out <TabsTrigger value="tags">
# - Comment out <TabsContent value="tags">

# Redeploy
npm run build && deploy
```

**Rollback time:** ~5 minutes

---

## Future Enhancements

- Tag merge functionality (US-05)
- Bulk tag operations (US-06)
- Tag analytics (US-07)
- Tag search & filter (US-08)
- Soft delete / archive (US-09)

---

## Success Criteria

✅ **Feature complete when:**
- [ ] Users can view all tags in Settings → Tags tab
- [ ] Users can edit tag name, color, schema
- [ ] Users can delete tags with confirmation
- [ ] Settings button in sidebar works on desktop & mobile
- [ ] Add Filter button in controls bar works
- [ ] All tests passing (>90% coverage)
- [ ] No regressions in existing functionality
- [ ] Documentation complete

---

**Total Estimated Time:** 8-12 hours
**Complexity:** Medium
**Risk Level:** Low (frontend-only, backend exists)
