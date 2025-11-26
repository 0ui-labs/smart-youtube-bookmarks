# Phase 4: Integration Strategy

## Strategie-Übersicht

**Ansatz:** Komponenten-Ersetzung mit Interface-Kompatibilität

Die bestehende `TextSnippet` Komponente wird intern umgebaut, behält aber das gleiche Props-Interface. Dadurch bleiben alle Parent-Komponenten unverändert.

## Integration Points

### 1. TextSnippet Komponente (Hauptänderung)

**Vorher:**
```tsx
<Textarea
  value={value ?? ''}
  onChange={(e) => onChange?.(e.target.value)}
/>
```

**Nachher:**
```tsx
<TiptapEditor
  content={value ?? ''}
  onChange={(html) => onChange?.(html)}
/>
```

### 2. Props-Interface bleibt kompatibel

```tsx
// Keine Änderung am Interface!
interface TextSnippetProps {
  value: string | null | undefined  // Jetzt HTML statt Plain Text
  truncateAt: number
  readOnly?: boolean
  onChange?: (value: string) => void  // Gibt HTML zurück
  onExpand?: () => void
  maxLength?: number  // Wird auf Character-Count angewendet
  className?: string
}
```

## Architektur-Entscheidungen

### Option A: Inline Integration ✅ (Gewählt)
- TiptapEditor direkt in TextSnippet integrieren
- Weniger Dateien, einfacher zu verstehen
- Bubble Menu als Teil der Komponente

### Option B: Wrapper Pattern ❌
- Separater TiptapEditor Wrapper
- Mehr Indirektion, komplexer

### Option C: Context-basiert ❌
- Editor State in React Context
- Overkill für diesen Use Case

## Komponenten-Struktur

```
TextSnippet.tsx (überarbeitet)
├── Read-Only Mode
│   └── HTML Content Rendering (dangerouslySetInnerHTML)
│
└── Edit Mode
    └── Tiptap Editor
        ├── EditorContent (Hauptbereich)
        └── BubbleMenu (bei Selektion)
            ├── Bold Button
            ├── Italic Button
            ├── Strikethrough Button
            ├── Heading Dropdown
            ├── List Buttons
            ├── Blockquote Button
            ├── Code Button
            └── Link Button
```

## Tiptap Extension Setup

```typescript
const extensions = [
  StarterKit.configure({
    heading: { levels: [1, 2, 3] },
    codeBlock: false,  // Verwende CodeBlockLowlight
  }),
  Link.configure({
    openOnClick: false,
    HTMLAttributes: { class: 'text-primary underline' },
  }),
  Placeholder.configure({
    placeholder: 'Notizen eingeben...',
  }),
  CodeBlockLowlight.configure({
    lowlight,
  }),
]
```

## Bubble Menu Strategie

### Erscheint bei:
- Text-Selektion (mindestens 1 Zeichen)

### Verschwindet bei:
- Klick außerhalb
- Cursor-Bewegung ohne Selektion
- Escape-Taste

### Positionierung:
- Über dem selektierten Text
- Mittig ausgerichtet
- Automatische Flip bei Bildschirmrand

## Read-Only Rendering

### HTML Rendering
```tsx
// Read-only mode: HTML rendern
if (readOnly) {
  return (
    <div
      className="prose prose-sm max-w-none"
      dangerouslySetInnerHTML={{ __html: value || '' }}
    />
  )
}
```

### Sicherheit
- Tiptap generiert nur sauberes HTML
- Keine Script-Tags möglich (keine Script Extension)
- Nur erlaubte Tags werden gerendert

## Styling Integration

### Tailwind Typography Plugin
```css
/* Editor Content Styling */
.tiptap-editor {
  @apply prose prose-sm max-w-none;
}

/* Bubble Menu Styling */
.bubble-menu {
  @apply flex items-center gap-1 p-1 rounded-lg bg-popover border shadow-lg;
}

.bubble-menu button {
  @apply p-1.5 rounded hover:bg-accent;
}

.bubble-menu button.is-active {
  @apply bg-accent text-accent-foreground;
}
```

### Integration mit bestehenden Styles
- Verwendet CSS Variables aus index.css
- Konsistent mit shadcn/ui Design

## Character Count Handling

### maxLength Implementierung
```tsx
const characterCount = editor?.storage.characterCount?.characters() ?? 0

// Zeige Counter wenn maxLength gesetzt
{maxLength && (
  <div className="text-xs text-muted-foreground text-right mt-1">
    {characterCount} / {maxLength}
  </div>
)}

// Verhindere Eingabe über Limit
editor.setOptions({
  editorProps: {
    handleKeyDown: (view, event) => {
      if (characterCount >= maxLength && !isDeleteKey(event)) {
        return true // Block input
      }
      return false
    }
  }
})
```

## State Management

### Controlled Component Pattern
```tsx
const editor = useEditor({
  extensions,
  content: value ?? '',
  onUpdate: ({ editor }) => {
    onChange?.(editor.getHTML())
  },
})

// Sync external value changes
useEffect(() => {
  if (editor && value !== editor.getHTML()) {
    editor.commands.setContent(value ?? '')
  }
}, [value, editor])
```

## Error Handling

### Graceful Degradation
- Falls Tiptap nicht lädt → Fallback auf Textarea
- Falls HTML parsing fehlschlägt → Plain Text anzeigen

```tsx
if (!editor) {
  return <Textarea ... /> // Fallback
}
```

## Exit Condition

✅ Klare Integration-Strategie:

> TextSnippet behält sein Props-Interface, nutzt aber intern Tiptap statt Textarea. Bubble Menu erscheint bei Text-Selektion. Read-only Mode rendert HTML mit Tailwind Typography. Keine Änderungen an Parent-Komponenten nötig.
