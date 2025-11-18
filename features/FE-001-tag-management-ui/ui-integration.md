# UI/UX Integration: Tag Management & Settings Reorganization

**Feature ID:** FE-001-tag-management-ui  
**Phase:** 7 - UI/UX Integration  
**Date:** 2025-11-18

---

## Component Design System

### Following Existing Patterns

All new components follow existing design patterns from:
- `FieldsList.tsx` → `TagsList.tsx`
- `FieldEditDialog.tsx` → `EditTagDialog.tsx`
- `ConfirmDeleteFieldModal.tsx` → `ConfirmDeleteTagDialog.tsx`

---

## Component Specifications

### 1. TagsList Component

**Path:** `frontend/src/components/settings/TagsList.tsx`

**Layout:** Table with columns
```
┌────────────┬────────┬──────────────┬─────────┬─────────┐
│ Name       │ Color  │ Schema       │ Videos  │ Actions │
├────────────┼────────┼──────────────┼─────────┼─────────┤
│ Python     │ 🔵     │ Tech         │ 15      │ [⋮]     │
│ Tutorial   │ 🟢     │ Learning     │ 23      │ [⋮]     │
│ Music      │ 🔴     │ No Schema    │ 8       │ [⋮]     │
└────────────┴────────┴──────────────┴─────────┴─────────┘
```

**Design Tokens:**
- Table: Tailwind `table` classes
- Header: `text-sm font-medium text-gray-500`
- Rows: `hover:bg-gray-50 transition-colors`
- Color badge: `w-4 h-4 rounded-full` with tag's hex color
- Actions: `DropdownMenu` with Edit/Delete options

**States:**
- Loading: Skeleton loaders (3 rows)
- Empty: "No tags yet. Create your first tag from the sidebar."
- Error: "Failed to load tags. [Retry]"

---

### 2. EditTagDialog Component

**Path:** `frontend/src/components/EditTagDialog.tsx`

**Layout:** Modal dialog with form
```
┌─────────────────────────────────────┐
│ Edit Tag                        [×] │
├─────────────────────────────────────┤
│ Name *                              │
│ ┌─────────────────────────────────┐ │
│ │ Python Tutorials                │ │
│ └─────────────────────────────────┘ │
│                                     │
│ Color                               │
│ ┌──────┐                            │
│ │ 🔵   │ #3B82F6                    │
│ └──────┘                            │
│                                     │
│ Schema (optional)                   │
│ ┌─────────────────────────────────┐ │
│ │ Tech                      [▼]   │ │
│ └─────────────────────────────────┘ │
│                                     │
│                  [Cancel]  [Save]   │
└─────────────────────────────────────┘
```

**Design Tokens:**
- Dialog: Radix `AlertDialog` (max-width: `lg`)
- Input fields: Tailwind form controls
- Color picker: Native `<input type="color">`  or custom component
- Schema dropdown: Radix `Select` component
- Buttons: `variant="outline"` (Cancel), `variant="default"` (Save)

**Validation:**
- Name: Required, 1-100 chars, unique (case-insensitive)
- Color: Optional, hex format `#RRGGBB`
- Schema: Optional, valid schema ID or null

---

### 3. ConfirmDeleteTagDialog Component

**Path:** `frontend/src/components/ConfirmDeleteTagDialog.tsx`

**Layout:** Alert dialog
```
┌─────────────────────────────────────┐
│ Delete Tag                      [×] │
├─────────────────────────────────────┤
│ ⚠️  Delete tag "Python"?            │
│                                     │
│ This will remove the tag from       │
│ 15 videos.                          │
│                                     │
│ This action cannot be undone.       │
│                                     │
│                  [Cancel]  [Delete] │
│                           ^^^^^^^   │
│                         destructive │
└─────────────────────────────────────┘
```

**Design Tokens:**
- Dialog: Radix `AlertDialog`
- Warning icon: `⚠️` or Lucide `AlertTriangle`
- Delete button: `variant="destructive"` (red background)
- Text: Tag name in bold, video count emphasized

---

### 4. Settings Button in Sidebar

**Location:** `VideosPage.tsx` → `CollapsibleSidebar` section

**Layout:** Button at bottom of sidebar
```
┌─────────────────┐
│ TagNavigation   │
│ - Python        │
│ - Tutorial      │
│ + Create Tag    │
│─────────────────│ ← divider
│ ⚙️  Settings    │ ← NEW
└─────────────────┘
```

**Design Tokens:**
- Button: `variant="ghost"`, `className="w-full justify-start"`
- Icon: Lucide `Settings`, size `h-4 w-4`
- Border: `border-t` to separate from tags
- Padding: `pt-4 mt-auto`

---

### 5. Add Filter Button in Controls Bar

**Location:** `VideosPage.tsx` → Controls bar (replaces Settings)

**Layout:** Button in controls bar
```
Controls Bar:
[Add Filter +] [View Mode] [Table Settings]
     ↑
   Moved here from FilterBar
```

**Design Tokens:**
- Button: `variant="outline"`, `size="sm"`
- Icon: Lucide `Plus`, size `h-4 w-4`
- Same styling as other control buttons

---

## Color Scheme & Typography

**Following App Design System:**

```tsx
// Colors (from Tailwind config)
primary: '#3B82F6'     // Blue
success: '#10B981'     // Green
destructive: '#EF4444' // Red
muted: '#6B7280'       // Gray

// Typography
headings: 'font-bold text-2xl tracking-tight'
body: 'text-sm text-gray-600'
labels: 'text-sm font-medium text-gray-700'
```

**Tag Color Badges:**
- Display tag's custom hex color
- Fallback to primary blue if no color set
- Circular badge, 16x16px minimum
- Border for very light colors (visibility)

---

## Responsive Design

### Desktop (≥768px)
- Sidebar: Fixed, always visible, 250px width
- TagsList: Full-width table
- Dialogs: Centered modals (max-width: lg)

### Mobile (<768px)
- Sidebar: Drawer (swipe from left)
- TagsList: Stacked cards instead of table
- Dialogs: Full-screen modals

---

## Accessibility (WCAG 2.1 AA)

### Keyboard Navigation
- Tab through table rows
- Enter/Space to open actions menu
- Arrow keys in dropdowns
- Escape to close dialogs

### Screen Reader Support
- Table headers announced
- Tag colors announced (e.g., "Python, blue tag, Tech schema, 15 videos")
- Form labels properly associated
- Error messages announced on validation

### Focus Management
- Dialog opens → focus first input
- Dialog closes → focus returns to trigger button
- Delete button focused on Enter (Cancel on Escape)

---

## Animation & Transitions

**Following App Patterns:**

```tsx
// Dialog entrance
className="animate-in fade-in-0 zoom-in-95 duration-200"

// Table row hover
className="transition-colors hover:bg-gray-50"

// Toast notifications
position="bottom-right"
duration={3000}
```

**No Excessive Animation:**
- Simple fade-ins for dialogs
- Smooth color transitions on hover
- Instant updates (no artificial delays)

---

## Error States

### API Errors
```tsx
// Example error handling
{error && (
  <div className="p-4 bg-red-50 border-l-4 border-red-400 rounded">
    <p className="text-sm text-red-700">{error.message}</p>
    <Button size="sm" onClick={retry}>Retry</Button>
  </div>
)}
```

### Validation Errors
- Inline below input field
- Red text, clear message
- Icon indicator (❌)

---

**Next Phase:** Implementation Plan
