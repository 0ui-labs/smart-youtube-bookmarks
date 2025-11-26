# Phase 7: UI/UX Integration

## Design System Integration

### Bestehende Komponenten nutzen

| shadcn/ui Komponente | Verwendung im Editor |
|---------------------|---------------------|
| `Button` | Bubble Menu Buttons |
| `Popover` | Link URL Input |
| `DropdownMenu` | Heading Selector |
| `Separator` | Button-Gruppen trennen |

### Design Tokens

```css
/* Aus index.css - konsistent nutzen */
--primary: ...        /* Aktive Buttons */
--accent: ...         /* Hover State */
--muted: ...          /* Code Background */
--border: ...         /* Bubble Menu Border */
--popover: ...        /* Bubble Menu Background */
```

## Bubble Menu Design

### Layout

```
┌─────────────────────────────────────────────────────────┐
│ [B] [I] [S] │ [H▾] │ [•] [1.] ["] │ [</>] [```] │ [🔗] │
└─────────────────────────────────────────────────────────┘
     Text     │ Struct │    Lists     │   Code    │ Link
```

### Button Gruppen

1. **Text Formatting:** Bold, Italic, Strikethrough
2. **Structure:** Heading Dropdown
3. **Lists:** Bullet, Ordered, Blockquote
4. **Code:** Inline Code, Code Block
5. **Link:** Link einfügen/bearbeiten

### Styling

```tsx
// Bubble Menu Container
<div className="flex items-center gap-1 p-1.5 rounded-lg
               bg-popover border border-border shadow-lg">

// Button (inaktiv)
<Button variant="ghost" size="sm" className="h-8 w-8 p-0">

// Button (aktiv)
<Button variant="ghost" size="sm"
        className="h-8 w-8 p-0 bg-accent text-accent-foreground">

// Separator
<Separator orientation="vertical" className="h-6" />
```

### Icons (Lucide React)

| Aktion | Icon |
|--------|------|
| Bold | `<Bold />` |
| Italic | `<Italic />` |
| Strikethrough | `<Strikethrough />` |
| Heading | `<Heading />` |
| Bullet List | `<List />` |
| Ordered List | `<ListOrdered />` |
| Blockquote | `<Quote />` |
| Code | `<Code />` |
| Code Block | `<FileCode />` |
| Link | `<Link2 />` |
| Unlink | `<Unlink />` |

## Editor Content Styling

### Tailwind Typography

```tsx
// Editor Container
<div className="prose prose-sm max-w-none dark:prose-invert">
  <EditorContent editor={editor} />
</div>
```

### Custom Styles (index.css)

```css
/* Tiptap Editor Styles */
.tiptap-editor {
  @apply min-h-[80px] p-3 rounded-md border border-input
         bg-background focus-within:ring-2 focus-within:ring-ring;
}

.tiptap-editor .ProseMirror {
  @apply outline-none;
}

.tiptap-editor .ProseMirror p.is-editor-empty:first-child::before {
  @apply text-muted-foreground pointer-events-none float-left h-0;
  content: attr(data-placeholder);
}

/* Prose Overrides */
.tiptap-editor h1 { @apply text-xl font-bold mt-4 mb-2; }
.tiptap-editor h2 { @apply text-lg font-semibold mt-3 mb-2; }
.tiptap-editor h3 { @apply text-base font-medium mt-2 mb-1; }

.tiptap-editor ul { @apply list-disc ml-6 my-2; }
.tiptap-editor ol { @apply list-decimal ml-6 my-2; }
.tiptap-editor li { @apply my-0.5; }

.tiptap-editor blockquote {
  @apply border-l-4 border-muted pl-4 italic my-2;
}

.tiptap-editor code {
  @apply bg-muted px-1.5 py-0.5 rounded text-sm font-mono;
}

.tiptap-editor pre {
  @apply bg-muted p-4 rounded-md overflow-x-auto my-2;
}

.tiptap-editor pre code {
  @apply bg-transparent p-0;
}

.tiptap-editor a {
  @apply text-primary underline cursor-pointer;
}
```

## Link Input Popover

### Design

```
┌─────────────────────────────────┐
│ 🔗 Link URL                     │
│ ┌─────────────────────────────┐ │
│ │ https://example.com         │ │
│ └─────────────────────────────┘ │
│            [Entfernen] [Speichern] │
└─────────────────────────────────┘
```

### Implementation

```tsx
<Popover>
  <PopoverTrigger asChild>
    <Button variant="ghost" size="sm">
      <Link2 className="h-4 w-4" />
    </Button>
  </PopoverTrigger>
  <PopoverContent className="w-80">
    <div className="space-y-2">
      <Label htmlFor="url">Link URL</Label>
      <Input
        id="url"
        placeholder="https://..."
        value={url}
        onChange={(e) => setUrl(e.target.value)}
      />
      <div className="flex justify-end gap-2">
        {hasLink && (
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
```

## Heading Dropdown

### Design

```
┌──────────────┐
│ ▾ Heading    │
├──────────────┤
│   Normal     │ ← Paragraph
│   Heading 1  │ ← H1
│   Heading 2  │ ← H2
│   Heading 3  │ ← H3
└──────────────┘
```

### Implementation

```tsx
<DropdownMenu>
  <DropdownMenuTrigger asChild>
    <Button variant="ghost" size="sm">
      <Heading className="h-4 w-4" />
      <ChevronDown className="h-3 w-3 ml-1" />
    </Button>
  </DropdownMenuTrigger>
  <DropdownMenuContent>
    <DropdownMenuItem onClick={() => editor.chain().setParagraph().run()}>
      Normal
    </DropdownMenuItem>
    <DropdownMenuItem onClick={() => editor.chain().setHeading({ level: 1 }).run()}>
      <span className="text-xl font-bold">Heading 1</span>
    </DropdownMenuItem>
    <DropdownMenuItem onClick={() => editor.chain().setHeading({ level: 2 }).run()}>
      <span className="text-lg font-semibold">Heading 2</span>
    </DropdownMenuItem>
    <DropdownMenuItem onClick={() => editor.chain().setHeading({ level: 3 }).run()}>
      <span className="text-base font-medium">Heading 3</span>
    </DropdownMenuItem>
  </DropdownMenuContent>
</DropdownMenu>
```

## Read-Only Display

### Styling konsistent mit Editor

```tsx
// Read-only Container
<div className="prose prose-sm max-w-none dark:prose-invert
               [&_a]:text-primary [&_a]:underline
               [&_code]:bg-muted [&_code]:px-1.5 [&_code]:rounded
               [&_blockquote]:border-l-4 [&_blockquote]:pl-4">
  <div dangerouslySetInnerHTML={{ __html: value }} />
</div>
```

## Responsive Design

### Mobile Anpassungen

```css
/* Bubble Menu auf kleinen Screens */
@media (max-width: 640px) {
  .bubble-menu {
    @apply flex-wrap max-w-[280px];
  }

  .bubble-menu .separator {
    @apply hidden;
  }
}
```

## Accessibility

### Keyboard Navigation

| Taste | Aktion |
|-------|--------|
| Tab | Fokus durch Bubble Menu |
| Enter | Button aktivieren |
| Escape | Bubble Menu schließen |
| Cmd+B | Bold |
| Cmd+I | Italic |
| Cmd+K | Link |

### ARIA Labels

```tsx
<Button aria-label="Text fett formatieren" aria-pressed={isBold}>
  <Bold className="h-4 w-4" />
</Button>
```

## Exit Condition

✅ UI/UX Design vollständig:

> Bubble Menu mit shadcn/ui Komponenten, Lucide Icons, konsistentes Styling mit Design System, Tailwind Typography für Editor Content, Popover für Link-Input, Dropdown für Headings, Responsive Design, Accessibility berücksichtigt.
