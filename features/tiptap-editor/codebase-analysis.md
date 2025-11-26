# Phase 2: Codebase Analysis

## Architektur-Übersicht

### Frontend Stack
- **React 18** mit TypeScript
- **Tailwind CSS** für Styling
- **shadcn/ui** Komponenten-Bibliothek
- **Zod** für Schema-Validierung
- **React Query** (TanStack Query) für API-Calls
- **Vite** als Build-Tool

### Backend Stack
- **FastAPI** (Python)
- **SQLAlchemy** ORM
- **PostgreSQL** Datenbank

## Relevante Dateien für Text-Felder

### Komponenten-Hierarchie

```
CustomFieldsSection.tsx
└── FieldDisplay.tsx (Dispatcher)
    └── TextSnippet.tsx (Text-Felder)
        └── Textarea (shadcn/ui)
```

### Datei-Übersicht

| Datei | Zweck | Relevanz |
|-------|-------|----------|
| `frontend/src/components/fields/TextSnippet.tsx` | Text-Feld Komponente | **Hauptänderung** - Tiptap hier integrieren |
| `frontend/src/components/fields/FieldDisplay.tsx` | Dispatcher für Feld-Typen | Geringfügige Änderung |
| `frontend/src/components/CustomFieldsSection.tsx` | Container für alle Felder | Keine Änderung |
| `frontend/src/types/video.ts` | VideoFieldValue Types | Keine Änderung |
| `frontend/src/types/customFields.ts` | TextConfig Type | Keine Änderung |
| `backend/app/models/video_field_value.py` | DB Model | Keine Änderung |

## Bestehende TextSnippet-Implementierung

### Aktueller Code (vereinfacht)

```tsx
// frontend/src/components/fields/TextSnippet.tsx
export const TextSnippet = ({
  value,
  truncateAt,
  readOnly,
  onChange,
  maxLength,
}) => {
  if (readOnly) {
    // Truncated text display mit expand button
    return <div>{displayText}</div>
  }

  // Editable mode: auto-resizing textarea
  return (
    <Textarea
      value={value ?? ''}
      onChange={(e) => onChange?.(e.target.value)}
      maxLength={maxLength}
      rows={3}
      className="resize-none overflow-hidden min-h-[80px]"
    />
  )
}
```

### Props Interface

```tsx
interface TextSnippetProps {
  value: string | null | undefined
  truncateAt: number           // Display truncation (read-only)
  readOnly?: boolean           // Toggle edit/view mode
  onChange?: (value: string) => void
  onExpand?: () => void        // Expand button callback
  maxLength?: number           // Input max characters
  className?: string
}
```

## Datenfluss

```
User types → TextSnippet.onChange()
  → FieldDisplay.onChange()
  → CustomFieldsSection.onFieldChange()
  → API PUT /videos/{id}/fields
  → Backend: VideoFieldValue.value_text = "HTML string"
```

## Datenbank-Schema

### VideoFieldValue Model

```python
# backend/app/models/video_field_value.py
class VideoFieldValue(BaseModel):
    value_text: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    # Text = PostgreSQL TEXT type (unbegrenzte Länge!)
```

**Wichtig:** Das `value_text` Feld nutzt PostgreSQL `TEXT` Typ - keine Längenbeschränkung. HTML-Content kann problemlos gespeichert werden.

### TextConfig Schema

```typescript
// frontend/src/types/customFields.ts
type TextConfig = {
  max_length?: number  // Optional, nur Frontend-Validierung
}
```

## Design Patterns im Projekt

### 1. Field Component Pattern
- Jeder Feld-Typ hat eigene Komponente (RatingStars, SelectBadge, BooleanCheckbox, TextSnippet)
- FieldDisplay dispatcht basierend auf `field.field_type`

### 2. Discriminated Union Pattern
```typescript
switch (fieldValue.field.field_type) {
  case 'text':
    return <TextSnippet ... />
}
```

### 3. shadcn/ui Komponenten
- Button, Input, Textarea, Dialog, etc.
- Tailwind-basiert mit CSS Variables
- Konsistentes Design-System

### 4. Controlled Components
- Alle Inputs sind controlled (value + onChange)
- State wird von Parent verwaltet

## Styling Patterns

### Tailwind Classes (Beispiel TextSnippet)
```tsx
className={cn(
  'resize-none overflow-hidden min-h-[80px]',
  className
)}
```

### cn() Utility
```typescript
import { cn } from '@/lib/utils'
// Kombiniert Tailwind classes mit clsx
```

## API Integration

### Field Update Flow
```typescript
// VideoDetailsPage.tsx / VideoDetailsModal.tsx
const handleFieldChange = (fieldId: string, value: string | number | boolean) => {
  updateField.mutate({ fieldId, value })
}

// API Call
const { data } = await api.put(`/videos/${videoId}/fields`, {
  field_values: [{ field_id: fieldId, value }],
})
```

## Erkenntnisse für Tiptap-Integration

### Was bleibt gleich
- Datenstruktur (`value: string | null`)
- API Endpoints
- Parent-Komponenten (FieldDisplay, CustomFieldsSection)
- Datenbank-Schema

### Was sich ändert
- TextSnippet: Textarea → Tiptap Editor
- Read-only Anzeige: Plain Text → HTML rendering
- onChange output: Plain string → HTML string

## Exit Condition

✅ Klares Bild der Architektur und Integration Points:

> TextSnippet.tsx ist der einzige Ort, wo die Hauptänderung stattfindet. Die Komponente muss von Textarea auf Tiptap umgestellt werden. Die Datenstruktur (string) und API bleiben unverändert - nur der Content wechselt von Plain-Text zu HTML.
