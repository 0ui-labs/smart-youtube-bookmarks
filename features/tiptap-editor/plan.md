# Phase 8: Implementation Plan

## Übersicht

| Phase | Beschreibung | Abhängigkeiten |
|-------|--------------|----------------|
| 1 | Dependencies installieren | - |
| 2 | Tiptap Editor Komponente | Phase 1 |
| 3 | Bubble Menu Komponente | Phase 2 |
| 4 | CSS Styles | Phase 2 |
| 5 | TextSnippet Integration | Phase 2, 3, 4 |
| 6 | Tests | Phase 5 |

---

## Phase 1: Dependencies installieren

### Aufgabe
Tiptap und benötigte Extensions installieren.

### Commands

```bash
cd frontend
npm install @tiptap/react @tiptap/pm @tiptap/starter-kit
npm install @tiptap/extension-link @tiptap/extension-placeholder
npm install @tiptap/extension-code-block-lowlight lowlight
npm install @tiptap/extension-character-count
```

### Verifikation

```bash
npm ls @tiptap/react  # Version anzeigen
npm run build         # Build erfolgreich
```

---

## Phase 2: Tiptap Editor Komponente

### Aufgabe
Neue `TiptapEditor.tsx` Komponente erstellen.

### Datei
`frontend/src/components/fields/TiptapEditor.tsx`

### Implementation

```tsx
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import Placeholder from '@tiptap/extension-placeholder'
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight'
import CharacterCount from '@tiptap/extension-character-count'
import { common, createLowlight } from 'lowlight'
import { useEffect } from 'react'
import { cn } from '@/lib/utils'
import { TiptapBubbleMenu } from './TiptapBubbleMenu'

const lowlight = createLowlight(common)

interface TiptapEditorProps {
  content: string
  onChange: (html: string) => void
  placeholder?: string
  maxLength?: number
  className?: string
  disabled?: boolean
}

export const TiptapEditor = ({
  content,
  onChange,
  placeholder = 'Notizen eingeben...',
  maxLength,
  className,
  disabled = false,
}: TiptapEditorProps) => {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        codeBlock: false,
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-primary underline',
        },
      }),
      Placeholder.configure({
        placeholder,
      }),
      CodeBlockLowlight.configure({
        lowlight,
      }),
      CharacterCount.configure({
        limit: maxLength,
      }),
    ],
    content,
    editable: !disabled,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML())
    },
  })

  // Sync external content changes
  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content)
    }
  }, [content, editor])

  if (!editor) {
    return null
  }

  return (
    <div className={cn('tiptap-editor', className)}>
      <TiptapBubbleMenu editor={editor} />
      <EditorContent editor={editor} />
      {maxLength && (
        <div className="text-xs text-muted-foreground text-right mt-1">
          {editor.storage.characterCount?.characters() ?? 0} / {maxLength}
        </div>
      )}
    </div>
  )
}
```

### Verifikation

- [ ] Komponente kompiliert ohne Fehler
- [ ] Editor rendert leeren Content
- [ ] onChange wird bei Eingabe aufgerufen

---

## Phase 3: Bubble Menu Komponente

### Aufgabe
`TiptapBubbleMenu.tsx` mit allen Formatierungsoptionen.

### Datei
`frontend/src/components/fields/TiptapBubbleMenu.tsx`

### Implementation

```tsx
import { BubbleMenu, Editor } from '@tiptap/react'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Bold, Italic, Strikethrough, Heading,
  List, ListOrdered, Quote, Code, FileCode,
  Link2, Unlink, ChevronDown,
} from 'lucide-react'
import { useState } from 'react'
import { cn } from '@/lib/utils'

interface TiptapBubbleMenuProps {
  editor: Editor
}

export const TiptapBubbleMenu = ({ editor }: TiptapBubbleMenuProps) => {
  const [linkUrl, setLinkUrl] = useState('')
  const [linkPopoverOpen, setLinkPopoverOpen] = useState(false)

  const setLink = () => {
    if (linkUrl) {
      editor.chain().focus().setLink({ href: linkUrl }).run()
    }
    setLinkPopoverOpen(false)
    setLinkUrl('')
  }

  const removeLink = () => {
    editor.chain().focus().unsetLink().run()
    setLinkPopoverOpen(false)
  }

  const MenuButton = ({
    onClick,
    isActive,
    children,
    ariaLabel,
  }: {
    onClick: () => void
    isActive?: boolean
    children: React.ReactNode
    ariaLabel: string
  }) => (
    <Button
      variant="ghost"
      size="sm"
      onClick={onClick}
      aria-label={ariaLabel}
      aria-pressed={isActive}
      className={cn('h-8 w-8 p-0', isActive && 'bg-accent')}
    >
      {children}
    </Button>
  )

  return (
    <BubbleMenu
      editor={editor}
      tippyOptions={{ duration: 100 }}
      className="flex items-center gap-0.5 p-1 rounded-lg bg-popover
                 border border-border shadow-lg"
    >
      {/* Text Formatting */}
      <MenuButton
        onClick={() => editor.chain().focus().toggleBold().run()}
        isActive={editor.isActive('bold')}
        ariaLabel="Fett"
      >
        <Bold className="h-4 w-4" />
      </MenuButton>
      <MenuButton
        onClick={() => editor.chain().focus().toggleItalic().run()}
        isActive={editor.isActive('italic')}
        ariaLabel="Kursiv"
      >
        <Italic className="h-4 w-4" />
      </MenuButton>
      <MenuButton
        onClick={() => editor.chain().focus().toggleStrike().run()}
        isActive={editor.isActive('strike')}
        ariaLabel="Durchgestrichen"
      >
        <Strikethrough className="h-4 w-4" />
      </MenuButton>

      <Separator orientation="vertical" className="h-6 mx-1" />

      {/* Headings */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="h-8 px-2">
            <Heading className="h-4 w-4" />
            <ChevronDown className="h-3 w-3 ml-1" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem onClick={() => editor.chain().focus().setParagraph().run()}>
            Normal
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}>
            <span className="text-xl font-bold">Heading 1</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
            <span className="text-lg font-semibold">Heading 2</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>
            <span className="text-base font-medium">Heading 3</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Separator orientation="vertical" className="h-6 mx-1" />

      {/* Lists */}
      <MenuButton
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        isActive={editor.isActive('bulletList')}
        ariaLabel="Aufzählung"
      >
        <List className="h-4 w-4" />
      </MenuButton>
      <MenuButton
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        isActive={editor.isActive('orderedList')}
        ariaLabel="Nummerierte Liste"
      >
        <ListOrdered className="h-4 w-4" />
      </MenuButton>
      <MenuButton
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        isActive={editor.isActive('blockquote')}
        ariaLabel="Zitat"
      >
        <Quote className="h-4 w-4" />
      </MenuButton>

      <Separator orientation="vertical" className="h-6 mx-1" />

      {/* Code */}
      <MenuButton
        onClick={() => editor.chain().focus().toggleCode().run()}
        isActive={editor.isActive('code')}
        ariaLabel="Inline Code"
      >
        <Code className="h-4 w-4" />
      </MenuButton>
      <MenuButton
        onClick={() => editor.chain().focus().toggleCodeBlock().run()}
        isActive={editor.isActive('codeBlock')}
        ariaLabel="Code Block"
      >
        <FileCode className="h-4 w-4" />
      </MenuButton>

      <Separator orientation="vertical" className="h-6 mx-1" />

      {/* Link */}
      <Popover open={linkPopoverOpen} onOpenChange={setLinkPopoverOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className={cn('h-8 w-8 p-0', editor.isActive('link') && 'bg-accent')}
            aria-label="Link"
          >
            {editor.isActive('link') ? (
              <Unlink className="h-4 w-4" />
            ) : (
              <Link2 className="h-4 w-4" />
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80">
          <div className="space-y-2">
            <Label htmlFor="link-url">Link URL</Label>
            <Input
              id="link-url"
              placeholder="https://..."
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && setLink()}
            />
            <div className="flex justify-end gap-2">
              {editor.isActive('link') && (
                <Button variant="ghost" size="sm" onClick={removeLink}>
                  Entfernen
                </Button>
              )}
              <Button size="sm" onClick={setLink}>
                Speichern
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </BubbleMenu>
  )
}
```

### Verifikation

- [ ] Bubble Menu erscheint bei Text-Selektion
- [ ] Alle Buttons vorhanden und klickbar
- [ ] Formatierungen werden angewendet
- [ ] Link Popover funktioniert

---

## Phase 4: CSS Styles

### Aufgabe
Tiptap-spezifische Styles zu index.css hinzufügen.

### Datei
`frontend/src/index.css`

### Implementation

```css
/* Tiptap Editor Styles */
.tiptap-editor {
  @apply min-h-[80px] p-3 rounded-md border border-input
         bg-background focus-within:ring-2 focus-within:ring-ring
         focus-within:ring-offset-2;
}

.tiptap-editor .ProseMirror {
  @apply outline-none min-h-[60px];
}

.tiptap-editor .ProseMirror p.is-editor-empty:first-child::before {
  @apply text-muted-foreground pointer-events-none float-left h-0;
  content: attr(data-placeholder);
}

/* Typography */
.tiptap-editor h1 { @apply text-xl font-bold mt-4 mb-2 first:mt-0; }
.tiptap-editor h2 { @apply text-lg font-semibold mt-3 mb-2 first:mt-0; }
.tiptap-editor h3 { @apply text-base font-medium mt-2 mb-1 first:mt-0; }
.tiptap-editor p { @apply my-1 first:mt-0 last:mb-0; }

/* Lists */
.tiptap-editor ul { @apply list-disc ml-6 my-2; }
.tiptap-editor ol { @apply list-decimal ml-6 my-2; }
.tiptap-editor li { @apply my-0.5; }
.tiptap-editor li p { @apply my-0; }

/* Blockquote */
.tiptap-editor blockquote {
  @apply border-l-4 border-muted-foreground/30 pl-4 italic my-2;
}

/* Code */
.tiptap-editor code {
  @apply bg-muted px-1.5 py-0.5 rounded text-sm font-mono;
}

.tiptap-editor pre {
  @apply bg-muted p-4 rounded-md overflow-x-auto my-2;
}

.tiptap-editor pre code {
  @apply bg-transparent p-0;
}

/* Links */
.tiptap-editor a {
  @apply text-primary underline cursor-pointer;
}

/* Read-only prose (for HTML rendering) */
.tiptap-prose h1 { @apply text-xl font-bold mt-4 mb-2 first:mt-0; }
.tiptap-prose h2 { @apply text-lg font-semibold mt-3 mb-2 first:mt-0; }
.tiptap-prose h3 { @apply text-base font-medium mt-2 mb-1 first:mt-0; }
.tiptap-prose p { @apply my-1 first:mt-0 last:mb-0; }
.tiptap-prose ul { @apply list-disc ml-6 my-2; }
.tiptap-prose ol { @apply list-decimal ml-6 my-2; }
.tiptap-prose li { @apply my-0.5; }
.tiptap-prose blockquote { @apply border-l-4 border-muted-foreground/30 pl-4 italic my-2; }
.tiptap-prose code { @apply bg-muted px-1.5 py-0.5 rounded text-sm font-mono; }
.tiptap-prose pre { @apply bg-muted p-4 rounded-md overflow-x-auto my-2; }
.tiptap-prose pre code { @apply bg-transparent p-0; }
.tiptap-prose a { @apply text-primary underline; }
```

### Verifikation

- [ ] Editor hat korrektes Border/Padding
- [ ] Placeholder sichtbar
- [ ] Alle Formatierungen visuell korrekt

---

## Phase 5: TextSnippet Integration

### Aufgabe
TextSnippet.tsx anpassen, um TiptapEditor zu nutzen.

### Datei
`frontend/src/components/fields/TextSnippet.tsx`

### Implementation

```tsx
import React from 'react'
import { ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { TiptapEditor } from './TiptapEditor'

export interface TextSnippetProps {
  value: string | null | undefined
  truncateAt: number
  readOnly?: boolean
  onChange?: (value: string) => void
  onExpand?: () => void
  maxLength?: number
  className?: string
}

// Normalize content: wrap plain text in paragraph
function normalizeContent(value: string | null | undefined): string {
  if (!value) return ''
  // Already HTML? Return as-is
  if (value.trim().startsWith('<')) return value
  // Plain text → wrap in paragraph
  return `<p>${value.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>`
}

// Strip HTML for truncation check
function getTextContent(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  return doc.body.textContent || ''
}

export const TextSnippet = React.forwardRef<HTMLDivElement, TextSnippetProps>(
  ({ value, truncateAt, readOnly = true, onChange, onExpand, maxLength, className }, ref) => {
    const normalizedValue = normalizeContent(value)
    const textContent = getTextContent(normalizedValue)
    const isTruncated = textContent.length > truncateAt

    if (readOnly) {
      // Read-only: Render HTML
      const displayHtml = isTruncated
        ? normalizedValue.slice(0, truncateAt) + '...'
        : normalizedValue

      return (
        <div ref={ref} className={cn('inline-flex items-start gap-2 text-sm', className)}>
          {!textContent ? (
            <span className="text-muted-foreground">—</span>
          ) : (
            <div
              className="tiptap-prose"
              dangerouslySetInnerHTML={{ __html: displayHtml }}
            />
          )}
          {isTruncated && onExpand && (
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5 shrink-0 p-0"
              onClick={onExpand}
              aria-label="Text erweitern"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          )}
        </div>
      )
    }

    // Edit mode: Tiptap Editor
    return (
      <TiptapEditor
        content={normalizedValue}
        onChange={(html) => onChange?.(html)}
        maxLength={maxLength}
        className={className}
      />
    )
  }
)

TextSnippet.displayName = 'TextSnippet'
```

### Verifikation

- [ ] Read-only zeigt formatiertes HTML
- [ ] Edit mode zeigt Tiptap Editor
- [ ] onChange gibt HTML zurück
- [ ] Truncation funktioniert
- [ ] Legacy plain text wird korrekt angezeigt

---

## Phase 6: Tests

### Aufgabe
Tests aktualisieren und neue Tests schreiben.

### Dateien
- `frontend/src/components/fields/TiptapEditor.test.tsx` (neu)
- `frontend/src/components/fields/TiptapBubbleMenu.test.tsx` (neu)
- `frontend/src/components/fields/TextSnippet.test.tsx` (update)

### Test Cases

```tsx
// TiptapEditor.test.tsx
describe('TiptapEditor', () => {
  it('renders empty editor', () => { ... })
  it('renders with initial content', () => { ... })
  it('calls onChange on input', () => { ... })
  it('shows placeholder when empty', () => { ... })
  it('respects disabled prop', () => { ... })
})

// TextSnippet.test.tsx (updated)
describe('TextSnippet', () => {
  it('renders HTML in read-only mode', () => { ... })
  it('renders plain text wrapped in paragraph', () => { ... })
  it('truncates long content', () => { ... })
  it('shows Tiptap editor in edit mode', () => { ... })
})
```

### Verifikation

- [ ] Alle Tests grün
- [ ] Coverage für neue Komponenten

---

## Zusammenfassung

| Phase | Aufwand | Priorität |
|-------|---------|-----------|
| 1. Dependencies | 5 min | Hoch |
| 2. TiptapEditor | 30 min | Hoch |
| 3. BubbleMenu | 45 min | Hoch |
| 4. CSS Styles | 15 min | Hoch |
| 5. TextSnippet | 20 min | Hoch |
| 6. Tests | 30 min | Mittel |

**Gesamt: ~2-3 Stunden**
