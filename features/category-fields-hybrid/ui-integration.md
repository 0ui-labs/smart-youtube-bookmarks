# UI/UX Integration: Category-Fields Hybrid System

**Feature ID:** category-fields-hybrid
**Date:** 2025-11-20
**Phase:** 7 - UI/UX Integration

---

## Design Philosophy

### Core Principles

1. **Simplicity First** - Hide complexity, reveal power progressively
2. **User Language** - "Kategorien", "Informationen", not "Tags", "Schemas"
3. **Forgiving** - Hard to make mistakes, easy to undo
4. **Consistent** - Same patterns across all features

---

## Design System Integration

### Using shadcn/ui Components

**Component Library:** shadcn/ui (built on Radix UI + Tailwind)

**Key Components Used:**
- `Dialog` - Modal dialogs (category change, field editing)
- `DropdownMenu` - Category selector, filter dropdowns
- `Button` - Actions throughout
- `Input` - Text fields
- `Select` - Field type selection
- `Checkbox` - Boolean fields, restore checkbox
- `Badge` - Category labels, filter pills
- `Tabs` - Settings page navigation
- `Alert` - Warning dialogs

**Tailwind Patterns:**
- Spacing: `space-y-4`, `gap-4`
- Colors: `text-muted-foreground`, `bg-secondary`
- Typography: `text-sm`, `font-medium`

---

## Component Specifications

### Component 1: CategorySelector

**File:** `frontend/src/components/CategorySelector.tsx` (NEW)

**Purpose:** Dropdown to select video's category

**Props:**
```typescript
interface CategorySelectorProps {
  videoId: string
  currentCategoryId: string | null
  onCategoryChange?: (categoryId: string | null) => void
  disabled?: boolean
}
```

**Visual Design:**
```
┌─────────────────────────────────────┐
│ Kategorie                           │
│ ┌─────────────────────────────────┐ │
│ │ 🟢 Keto Rezepte           ▼    │ │  ← Selected state
│ └─────────────────────────────────┘ │
│                          [×]        │  ← Clear button (appears on hover)
└─────────────────────────────────────┘

When opened:
┌─────────────────────────────────────┐
│ │ Keine Kategorie                 │ │
│ │ ────────────────                │ │
│ │ 🟢 Keto Rezepte        ✓        │ │  ← Currently selected
│ │ 🔵 Vegane Rezepte               │ │
│ │ 🟡 Desserts                     │ │
│ └─────────────────────────────────┘ │
└─────────────────────────────────────┘
```

**States:**
- **Default:** Category name with color indicator
- **No category:** "Keine Kategorie" in muted text
- **Hover:** Show clear button (×)
- **Disabled:** Gray out, no interaction
- **Loading:** Spinner in dropdown button

**Interactions:**
```typescript
const handleCategoryChange = async (newCategoryId: string | null) => {
  // 1. Check if backup exists
  const hasBackup = await checkBackup(videoId, newCategoryId)

  // 2. Show warning dialog
  const confirmed = await showCategoryChangeWarning({
    oldCategory: currentCategory,
    newCategory: newCategory,
    hasBackup,
  })

  if (!confirmed) return

  // 3. Call mutation
  setVideoCategory.mutate({
    videoId,
    categoryId: newCategoryId,
    restoreBackup: confirmed.restoreBackup,
  })
}
```

**Accessibility:**
- `aria-label="Video-Kategorie auswählen"`
- `aria-expanded` on dropdown
- `aria-selected` on current option
- Keyboard: Tab to focus, Enter to open, Arrow keys to navigate

---

### Component 2: CategoryChangeWarning

**File:** `frontend/src/components/CategoryChangeWarning.tsx` (NEW)

**Purpose:** Warning dialog before category change

**Props:**
```typescript
interface CategoryChangeWarningProps {
  oldCategory: Category | null
  newCategory: Category | null
  fieldValuesToBackup: FieldValue[]
  fieldValuesThatPersist: FieldValue[]
  hasBackup: boolean
  backupTimestamp?: string
  onConfirm: (restoreBackup: boolean) => void
  onCancel: () => void
}
```

**Visual Design (No Backup):**
```
┌─────────────────────────────────────────────┐
│ ⚠️ Kategorie ändern                          │
│                                             │
│ Die Informationen von "Keto Rezepte"       │
│ werden ausgeblendet (nicht gelöscht).      │
│                                             │
│ Folgende Werte werden gesichert:           │
│ ┌─────────────────────────────────────────┐ │
│ │ • Kalorien: 320                         │ │
│ │ • Lecker: Ja                            │ │
│ │ • Zubereitungszeit: 45                  │ │
│ └─────────────────────────────────────────┘ │
│                                             │
│ Die folgenden Felder bleiben:              │
│ ┌─────────────────────────────────────────┐ │
│ │ • Bewertung: ⭐⭐⭐⭐⭐                   │ │
│ │ • Notizen: "Sehr saftig..."             │ │
│ └─────────────────────────────────────────┘ │
│                                             │
│ Diese Werte sind wieder verfügbar wenn du  │
│ zurück zu "Keto Rezepte" wechselst.        │
│                                             │
│ [Abbrechen]           [Kategorie ändern]   │
└─────────────────────────────────────────────┘
```

**Visual Design (With Backup):**
```
┌─────────────────────────────────────────────┐
│ ⚠️ Kategorie ändern                          │
│                                             │
│ ✨ Gesicherte Werte gefunden!                │
│                                             │
│ Du hattest dieses Video schon mal als      │
│ "Keto Rezepte" kategorisiert.              │
│                                             │
│ Gesicherte Werte (von vor 1 Woche):        │
│ ┌─────────────────────────────────────────┐ │
│ │ • Kalorien: 320                         │ │
│ │ • Lecker: Ja                            │ │
│ │ • Zubereitungszeit: 45                  │ │
│ └─────────────────────────────────────────┘ │
│                                             │
│ ☑ Gesicherte Werte wiederherstellen        │
│                                             │
│ [Abbrechen]           [Kategorie ändern]   │
└─────────────────────────────────────────────┘
```

**Color Coding:**
- ⚠️ Warning icon: `text-amber-500`
- ✨ Sparkles icon: `text-blue-500`
- Backup box: `bg-blue-50 border border-blue-200`
- Persist box: `bg-green-50 border border-green-200`

**Component Structure:**
```tsx
<Dialog open={open} onOpenChange={setOpen}>
  <DialogContent className="max-w-lg">
    <DialogHeader>
      <DialogTitle className="flex items-center gap-2">
        <AlertTriangle className="h-5 w-5 text-amber-500" />
        Kategorie ändern
      </DialogTitle>
    </DialogHeader>

    {hasBackup && (
      <div className="flex items-start gap-2 rounded-lg bg-blue-50 p-4">
        <Sparkles className="h-5 w-5 text-blue-500 mt-0.5" />
        <div>
          <p className="font-medium">Gesicherte Werte gefunden!</p>
          <p className="text-sm text-muted-foreground mt-1">
            Du hattest dieses Video schon mal als "{newCategory.name}"
            kategorisiert.
          </p>
        </div>
      </div>
    )}

    {/* Field values to backup */}
    {fieldValuesToBackup.length > 0 && (
      <div>
        <p className="text-sm font-medium mb-2">
          {hasBackup ? "Gesicherte Werte:" : "Folgende Werte werden gesichert:"}
        </p>
        <div className="rounded-lg border bg-muted/50 p-3 space-y-1">
          {fieldValuesToBackup.map(fv => (
            <div key={fv.id} className="text-sm">
              • {fv.field.name}: {formatValue(fv)}
            </div>
          ))}
        </div>
      </div>
    )}

    {/* Fields that persist */}
    {fieldValuesThatPersist.length > 0 && (
      <div>
        <p className="text-sm font-medium mb-2">
          Die folgenden Felder bleiben:
        </p>
        <div className="rounded-lg border bg-green-50 p-3 space-y-1">
          {fieldValuesThatPersist.map(fv => (
            <div key={fv.id} className="text-sm text-green-900">
              • {fv.field.name}: {formatValue(fv)}
            </div>
          ))}
        </div>
      </div>
    )}

    {hasBackup && (
      <div className="flex items-center space-x-2">
        <Checkbox
          id="restore"
          checked={restoreBackup}
          onCheckedChange={setRestoreBackup}
        />
        <label htmlFor="restore" className="text-sm cursor-pointer">
          Gesicherte Werte wiederherstellen
        </label>
      </div>
    )}

    <p className="text-sm text-muted-foreground">
      {hasBackup
        ? "Du kannst jederzeit wieder zurückwechseln."
        : `Diese Werte sind wieder verfügbar wenn du zurück zu "${oldCategory?.name}" wechselst.`
      }
    </p>

    <DialogFooter>
      <Button variant="outline" onClick={onCancel}>
        Abbrechen
      </Button>
      <Button onClick={() => onConfirm(restoreBackup)}>
        Kategorie ändern
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

---

### Component 3: WorkspaceFieldsCard

**File:** `frontend/src/components/settings/WorkspaceFieldsCard.tsx` (NEW)

**Purpose:** Special card for "Alle Videos" workspace fields

**Visual Design:**
```
┌─────────────────────────────────────────────┐
│ 🏠 Alle Videos                  [Bearbeiten] │
│                                             │
│ Diese Felder haben alle Videos             │
│                                             │
│ Felder:                                     │
│   • Bewertung (Auswahl)                     │
│   • Notizen (Text)                          │
│   • Zuletzt gesehen (Datum)                 │
│                                             │
│ (3 Felder definiert)                        │
└─────────────────────────────────────────────┘
```

**Styling:**
- Background: `bg-gradient-to-r from-blue-50 to-indigo-50`
- Border: `border-2 border-blue-200`
- Icon: `text-blue-600`
- Different from category cards to indicate special status

**On Click "Bearbeiten":**
Opens `WorkspaceFieldsEditor` dialog

---

### Component 4: WorkspaceFieldsEditor

**File:** `frontend/src/components/settings/WorkspaceFieldsEditor.tsx` (NEW)

**Purpose:** Edit workspace-wide fields

**Visual Design:**
```
┌─────────────────────────────────────────────┐
│ Informationen für alle Videos               │
│                                             │
│ Diese Felder sind für ALLE Videos in       │
│ diesem Workspace verfügbar.                 │
│                                             │
│ ℹ️ Tipp: Felder die für alle Kategorien    │
│   nützlich sind (z.B. Bewertung, Notizen)  │
│                                             │
│ Felder:                                     │
│ ┌─────────────────────────────────────────┐ │
│ │ Bewertung (Auswahl)              [×]    │ │
│ │ Notizen (Text)                   [×]    │ │
│ │ Zuletzt gesehen (Datum)          [×]    │ │
│ └─────────────────────────────────────────┘ │
│                                             │
│ [+ Information hinzufügen]                  │
│                                             │
│ [Abbrechen]                    [Speichern]  │
└─────────────────────────────────────────────┘
```

**Special Behavior:**
- Can't rename (no name field shown)
- Can only add/remove fields
- Deleting field shows warning if used in videos

---

### Component 5: CategoryCard (Modified)

**File:** `frontend/src/components/settings/TagsList.tsx` (MODIFIED)

**Purpose:** Display category with its fields

**Before (Tags):**
```
┌─────────────────────────────────────────────┐
│ 🟢 Python                       [Bearbeiten] │
│    Schema: Video Quality                    │
└─────────────────────────────────────────────┘
```

**After (Categories):**
```
┌─────────────────────────────────────────────┐
│ 🟢 Keto Rezepte                 [Bearbeiten] │
│                                             │
│ Felder:                                     │
│   • Kalorien (Zahl)                         │
│   • Lecker (Ja/Nein)                        │
│   • Zubereitungszeit (Zahl)                 │
│                                             │
│ (3 Videos)                                  │
└─────────────────────────────────────────────┘
```

**Changes:**
- Remove "Schema:" line (hide technical concept)
- Show fields directly
- Show video count
- "Bearbeiten" opens CategoryFieldsEditor (not tag editor)

---

### Component 6: CategoryFieldsEditor (Modified EditTagDialog)

**File:** `frontend/src/components/EditTagDialog.tsx` (MODIFIED)

**Purpose:** Edit category (name, color, fields)

**Visual Design:**
```
┌─────────────────────────────────────────────┐
│ Keto Rezepte bearbeiten                     │
│                                             │
│ Name:                                       │
│ [Keto Rezepte                            ]  │
│                                             │
│ Farbe:                                      │
│ [🔴][🟢][🔵][🟡][⚪]  Selected: 🟢         │
│                                             │
│ Informationen für diese Kategorie:          │
│ ┌─────────────────────────────────────────┐ │
│ │ Kalorien (Zahl)                  [×]    │ │
│ │ Wird auch verwendet in:                 │ │
│ │   Desserts                              │ │
│ │                                         │ │
│ │ Lecker (Ja/Nein)                 [×]    │ │
│ │ Nur in dieser Kategorie                 │ │
│ │                                         │ │
│ │ Zubereitungszeit (Zahl)          [×]    │ │
│ │ Nur in dieser Kategorie                 │ │
│ └─────────────────────────────────────────┘ │
│                                             │
│ [+ Information hinzufügen]                  │
│                                             │
│ [Löschen]  [Abbrechen]         [Speichern]  │
└─────────────────────────────────────────────┘
```

**Key Changes:**
- "Informationen" instead of "Schema"
- Show field reuse info ("Wird auch verwendet in:")
- Add field button inline
- Delete shows videos affected

---

### Component 7: VideoDetailsPage (Modified)

**File:** `frontend/src/pages/VideoDetailsPage.tsx` (MODIFIED)

**Current Layout:**
```
┌─────────────────────────────────────────────┐
│ [Thumbnail]                                 │
│ Video Title                                 │
│ Channel • Duration                          │
│                                             │
│ Tags: [Python] [Tutorial] [2024]            │
│                                             │
│ Custom Fields (if tag has schema):          │
│   Field 1: value                            │
│   Field 2: value                            │
└─────────────────────────────────────────────┘
```

**New Layout:**
```
┌─────────────────────────────────────────────┐
│ [Thumbnail]                                 │
│ Video Title                                 │
│ Channel • Duration                          │
│                                             │
│ Kategorie                                   │
│ [🟢 Keto Rezepte ▼]              [×]       │
│                                             │
│ ─── Informationen ───                       │
│                                             │
│ Bewertung                                   │
│ [⭐⭐⭐⭐⭐ ▼]                                 │
│                                             │
│ Notizen                                     │
│ [Sehr lecker, Familie liebt es           ]  │
│                                             │
│ Kalorien                                    │
│ [320                                     ]  │
│                                             │
│ Lecker                                      │
│ ☑ Ja                                        │
│                                             │
│ Zubereitungszeit (Minuten)                  │
│ [45                                      ]  │
│                                             │
│ [Speichern]                                 │
└─────────────────────────────────────────────┘
```

**Layout Changes:**
- Category selector at top (prominent)
- Remove tag badges (or filter to labels only if we keep them)
- Fields shown without separation (workspace + category)
- Clear section header "Informationen"
- Save button at bottom

**Responsive:**
- Desktop: 2 columns for fields
- Mobile: 1 column, full width

---

### Component 8: SettingsPage Tabs (Modified)

**File:** `frontend/src/pages/SettingsPage.tsx` (MODIFIED)

**Current Tabs:**
```
[Schemas] [Fields] [Tags] [Analytics]
```

**New Tabs:**
```
[Kategorien] [Analytics]
```

**Rationale:**
- Combine Schemas + Fields + Tags into "Kategorien"
- Simpler navigation
- Fields are now under categories (not separate)

**Kategorien Tab Layout:**
```
┌─────────────────────────────────────────────┐
│ Kategorien                                  │
│                                             │
│ WorkspaceFieldsCard (special)               │
│ ┌─────────────────────────────────────────┐ │
│ │ 🏠 Alle Videos              [Bearbeiten] │ │
│ │ Diese Felder haben alle Videos          │ │
│ │ • Bewertung • Notizen • ...             │ │
│ └─────────────────────────────────────────┘ │
│                                             │
│ CategoryCard 1                              │
│ ┌─────────────────────────────────────────┐ │
│ │ 🟢 Keto Rezepte             [Bearbeiten] │ │
│ │ • Kalorien • Lecker • ...               │ │
│ │ (12 Videos)                             │ │
│ └─────────────────────────────────────────┘ │
│                                             │
│ CategoryCard 2                              │
│ ┌─────────────────────────────────────────┐ │
│ │ 🔵 Vegane Rezepte           [Bearbeiten] │ │
│ │ • Protein • Ist glutenfrei              │ │
│ │ (8 Videos)                              │ │
│ └─────────────────────────────────────────┘ │
│                                             │
│ [+ Neue Kategorie]                          │
└─────────────────────────────────────────────┘
```

---

## Interaction Patterns

### Pattern 1: Category Assignment

**Flow:**
```
User opens video detail
    ↓
Clicks category dropdown
    ↓
Sees list of categories
    ↓
Selects new category
    ↓
Warning dialog appears
    ↓
User reads what will be backed up / kept
    ↓
User confirms
    ↓
Category changes
    ↓
Fields update dynamically
    ↓
Toast notification: "Kategorie geändert zu 'X'"
```

**Duration:** ~5 seconds

**Micro-interactions:**
- Dropdown opens with smooth animation
- Selected item has checkmark
- Warning dialog fades in
- Field section re-renders with transition
- Toast slides in from top-right

---

### Pattern 2: Field Addition to Category

**Flow:**
```
User in CategoryFieldsEditor
    ↓
Clicks "+ Information hinzufügen"
    ↓
Dialog opens
    ↓
User types field name
    ↓
System checks for conflicts
    ↓
If exists: "Field already exists" dialog
    ↓
User chooses: Reuse existing OR different name
    ↓
User selects field type
    ↓
User clicks "Hinzufügen"
    ↓
Field appears in list
```

**Duration:** ~10 seconds

**Micro-interactions:**
- Inline validation on field name
- Type selector opens smoothly
- Field appears with slide-in animation
- Auto-focus on next "add field" button

---

### Pattern 3: Backup Restoration

**Flow:**
```
User changes category to previous one
    ↓
System detects backup exists
    ↓
Warning dialog shows with restore checkbox
    ↓
User checks "Restore values"
    ↓
User confirms
    ↓
Category changes
    ↓
Fields appear with restored values
    ↓
Toast: "Kategorie geändert. 3 Werte wiederhergestellt."
```

**Duration:** ~5 seconds

**Micro-interactions:**
- Backup notice highlighted in blue
- Checkbox has smooth check animation
- Restored values briefly highlight in green

---

## Visual Design System

### Color Palette

**Workspace (Alle Videos):**
- Background: `from-blue-50 to-indigo-50`
- Border: `border-blue-200`
- Icon: `text-blue-600`
- Badge: `bg-blue-100 text-blue-800`

**Categories:**
- User-selected color (circle indicator)
- Card background: `bg-card`
- Border: `border-border`
- Badge: Custom color from category

**Warnings:**
- Background: `bg-amber-50`
- Border: `border-amber-200`
- Icon: `text-amber-500`
- Text: `text-amber-900`

**Success:**
- Background: `bg-green-50`
- Border: `border-green-200`
- Icon: `text-green-500`
- Text: `text-green-900`

**Info (Backup available):**
- Background: `bg-blue-50`
- Border: `border-blue-200`
- Icon: `text-blue-500`
- Text: `text-blue-900`

---

### Typography

**Headings:**
- Dialog Title: `text-lg font-semibold`
- Section Header: `text-sm font-medium text-muted-foreground uppercase tracking-wide`
- Field Label: `text-sm font-medium`

**Body:**
- Primary: `text-sm`
- Secondary: `text-sm text-muted-foreground`
- Emphasis: `font-medium`

**Field Values:**
- Display: `text-base`
- Input: `text-sm`

---

### Spacing

**Component Spacing:**
- Dialog padding: `p-6`
- Card padding: `p-4`
- Section gap: `space-y-6`
- Field gap: `space-y-4`
- Inline gap: `gap-2`

**Responsive:**
- Mobile: Reduce padding by 25%
- Desktop: Standard spacing

---

### Icons

**Using lucide-react:**
- Home: `Home` (Alle Videos)
- Warning: `AlertTriangle`
- Info: `Info`
- Success: `CheckCircle2`
- Sparkles: `Sparkles` (backup available)
- Delete: `Trash2`
- Edit: `Pencil`
- Add: `Plus`
- Close: `X`

**Size:** `h-5 w-5` for inline, `h-4 w-4` for small

---

## Responsive Design

### Breakpoints

- **Mobile:** `< 640px` (sm)
- **Tablet:** `640px - 1024px` (md)
- **Desktop:** `> 1024px` (lg)

### Layouts

**SettingsPage:**
```css
/* Mobile */
.kategorien-grid {
  grid-template-columns: 1fr;
}

/* Tablet */
@media (min-width: 768px) {
  .kategorien-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

/* Desktop */
@media (min-width: 1024px) {
  .kategorien-grid {
    grid-template-columns: repeat(3, 1fr);
  }
}
```

**VideoDetailsPage:**
```css
/* Mobile: Stack fields */
.fields-container {
  display: flex;
  flex-direction: column;
}

/* Desktop: 2 columns */
@media (min-width: 768px) {
  .fields-container {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 1rem;
  }
}
```

---

## Animation & Transitions

### Dialog Animations

**Enter:**
```css
@keyframes dialogIn {
  from {
    opacity: 0;
    transform: scale(0.95) translateY(-10px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

.dialog-content {
  animation: dialogIn 200ms ease-out;
}
```

**Exit:**
```css
@keyframes dialogOut {
  from {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
  to {
    opacity: 0;
    transform: scale(0.95) translateY(-10px);
  }
}
```

---

### Field Update Transition

**When category changes and fields update:**
```tsx
<div className="transition-all duration-300 ease-in-out">
  {availableFields.map(field => (
    <div
      key={field.id}
      className="animate-in slide-in-from-bottom-2 duration-300"
    >
      <FieldInput field={field} />
    </div>
  ))}
</div>
```

---

### Toast Notifications

**Position:** Top-right
**Duration:** 4 seconds
**Animation:** Slide in from right

```tsx
<Toast>
  <ToastTitle>Kategorie geändert</ToastTitle>
  <ToastDescription>
    Video ist jetzt in "Keto Rezepte"
  </ToastDescription>
</Toast>
```

---

## Accessibility (a11y)

### Keyboard Navigation

**Category Selector:**
- `Tab` - Focus dropdown
- `Enter` / `Space` - Open dropdown
- `↑` / `↓` - Navigate options
- `Enter` - Select option
- `Esc` - Close dropdown

**Dialog:**
- `Tab` - Cycle through focusable elements
- `Esc` - Close dialog
- Focus trap within dialog

**Form Fields:**
- `Tab` - Next field
- `Shift + Tab` - Previous field

---

### Screen Reader Support

**Announcements:**
```tsx
<div role="status" aria-live="polite" className="sr-only">
  Kategorie geändert zu {newCategory.name}
</div>

<div role="alert" aria-live="assertive" className="sr-only">
  {fieldValuesToBackup.length} Werte werden gesichert
</div>
```

**Labels:**
```tsx
<Select aria-label="Video-Kategorie auswählen">
  {/* options */}
</Select>

<Checkbox
  aria-label="Gesicherte Werte wiederherstellen"
  aria-describedby="restore-description"
/>
<span id="restore-description" className="sr-only">
  Stellt {backupFieldCount} gespeicherte Feldwerte wieder her
</span>
```

---

### Focus Management

**After Category Change:**
```tsx
const handleCategoryChange = async () => {
  await setVideoCategory.mutateAsync()

  // Focus first field
  firstFieldRef.current?.focus()
}
```

**Dialog Close:**
```tsx
const handleDialogClose = () => {
  setOpen(false)

  // Return focus to trigger element
  triggerRef.current?.focus()
}
```

---

## Error States

### Category Change Failed

**UI:**
```
┌─────────────────────────────────────────────┐
│ ❌ Kategorie konnte nicht geändert werden    │
│                                             │
│ Ein Fehler ist aufgetreten beim Speichern. │
│                                             │
│ Fehler: [Error message from API]           │
│                                             │
│ Möchtest du es erneut versuchen?           │
│                                             │
│ [Abbrechen]               [Erneut versuchen] │
└─────────────────────────────────────────────┘
```

**Behavior:**
- Previous category remains selected
- No backup created (transaction failed)
- User can retry

---

### Backup Restoration Failed

**UI:**
```
Toast (warning):
⚠️ Werte konnten nicht wiederhergestellt werden
Backup-Datei beschädigt oder nicht gefunden.
```

**Behavior:**
- Category change completes
- Fields appear empty
- User can manually fill

---

### Field Name Conflict

**UI:**
```
┌─────────────────────────────────────────────┐
│ ⚠️ Name bereits verwendet                    │
│                                             │
│ Die Information "Bewertung" existiert       │
│ bereits für alle Videos in diesem Workspace.│
│                                             │
│ Bitte wähle einen anderen Namen oder nutze  │
│ die existierende Information.              │
│                                             │
│ Möchtest du:                                │
│   [Bestehende Information verwenden]        │
│   [Anderen Namen wählen]                    │
└─────────────────────────────────────────────┘
```

---

## Loading States

### Category Selector

**While loading categories:**
```tsx
<Select disabled>
  <SelectTrigger>
    <Loader2 className="h-4 w-4 animate-spin mr-2" />
    Lade Kategorien...
  </SelectTrigger>
</Select>
```

---

### Category Change in Progress

**UI:**
```
CategorySelector shows spinner:
[🟢 Keto Rezepte] → [⏳ Ändere Kategorie...]
```

**Dialog Footer:**
```
[Abbrechen (disabled)]  [⏳ Ändere... (loading spinner)]
```

**Field Section:**
```
Skeleton loaders for fields while fetching new available fields
```

---

### Settings Page

**While loading:**
```
┌─────────────────────────────────────────────┐
│ Kategorien                                  │
│                                             │
│ [Skeleton Card]                             │
│ [Skeleton Card]                             │
│ [Skeleton Card]                             │
└─────────────────────────────────────────────┘
```

---

## Empty States

### No Categories

**UI:**
```
┌─────────────────────────────────────────────┐
│ Kategorien                                  │
│                                             │
│ 🏠 Alle Videos (Workspace fields card)      │
│                                             │
│ ┌─────────────────────────────────────────┐ │
│ │         📁                              │ │
│ │   Keine Kategorien vorhanden            │ │
│ │                                         │ │
│ │   Kategorien helfen dir, Videos nach   │ │
│ │   Typ zu organisieren.                  │ │
│ │                                         │ │
│ │   [+ Erste Kategorie erstellen]         │ │
│ └─────────────────────────────────────────┘ │
└─────────────────────────────────────────────┘
```

---

### Video Without Category

**UI:**
```
Kategorie: [Keine Kategorie ▼]

(Nur Workspace-Felder werden angezeigt)

Bewertung: [        ]
Notizen: [          ]
```

---

## Success States

### Category Changed Successfully

**Toast:**
```
✅ Kategorie geändert
Video ist jetzt in "Keto Rezepte"
```

**Visual feedback:**
- Category dropdown updates immediately
- Fields transition smoothly
- Brief green highlight on new fields (200ms)

---

### Field Added Successfully

**Toast:**
```
✅ Information hinzugefügt
"Kalorien" ist jetzt verfügbar
```

**Visual:**
- Field appears in list with slide-in
- Auto-scroll to new field

---

## Mobile Optimizations

### Touch Targets

**Minimum size:** 44x44px (iOS guidelines)

**Examples:**
- Buttons: `min-h-11 px-4`
- Checkbox: `h-5 w-5` (wrapped in larger clickable area)
- Dropdown triggers: `min-h-11`

---

### Mobile-Specific UI

**Category Selector (Mobile):**
- Full-width bottom sheet instead of dropdown
- Larger touch targets
- Swipe to dismiss

**Dialogs (Mobile):**
- Full-screen on small screens
- Slide up from bottom
- Fixed footer buttons

---

## Performance Considerations

### Optimistic Updates

```tsx
const setVideoCategory = useMutation({
  mutationFn: setVideoCategoryAPI,
  onMutate: async ({ categoryId }) => {
    // Cancel outgoing queries
    await queryClient.cancelQueries({ queryKey: ['video', videoId] })

    // Snapshot previous value
    const previousVideo = queryClient.getQueryData(['video', videoId])

    // Optimistically update
    queryClient.setQueryData(['video', videoId], (old) => ({
      ...old,
      category_id: categoryId,
    }))

    return { previousVideo }
  },
  onError: (err, variables, context) => {
    // Rollback on error
    queryClient.setQueryData(['video', videoId], context.previousVideo)
  },
})
```

---

### Virtualization

**For large category lists (>50):**
```tsx
import { useVirtualizer } from '@tanstack/react-virtual'

const rowVirtualizer = useVirtualizer({
  count: categories.length,
  getScrollElement: () => scrollRef.current,
  estimateSize: () => 100,
})
```

---

## Summary: Design Decisions

| Decision | Rationale |
|----------|-----------|
| "Kategorien" not "Tags" | User-friendly language |
| "Alle Videos" for workspace | Clear special status |
| No field separation in video detail | Simplicity, no confusion |
| Warning dialogs before category change | Prevent mistakes, build trust |
| Backup restore checkbox | User control, opt-in |
| shadcn/ui components | Consistency with existing codebase |
| Blue for workspace, custom colors for categories | Visual distinction |
| Inline field addition | Reduce clicks, faster workflow |
| Toast notifications | Non-blocking feedback |
| Optimistic updates | Perceived performance |

---

## Next Phase

✅ Ready for Phase 8: Implementation Plan
- Break down into tasks
- Assign priorities
- Define milestones
- Create timeline
