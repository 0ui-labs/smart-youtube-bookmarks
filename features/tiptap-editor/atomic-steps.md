# Phase 10: Atomic Steps

## Übersicht

Jeder Schritt ist:
- ✅ In 15-60 Minuten abschließbar
- ✅ Ändert 1-3 Dateien
- ✅ Hat klaren Pass/Fail Test
- ✅ Unabhängig committbar

---

## Step 1: Install Tiptap Dependencies

**Dauer:** 5 min
**Dateien:** `package.json`, `package-lock.json`

### Aktion
```bash
cd frontend
npm install @tiptap/react @tiptap/pm @tiptap/starter-kit \
            @tiptap/extension-link @tiptap/extension-placeholder \
            @tiptap/extension-code-block-lowlight lowlight
```

### Verifikation
```bash
npm ls @tiptap/react  # Version angezeigt
npm run build         # Build erfolgreich
```

### Commit Message
`feat(editor): install tiptap dependencies`

---

## Step 2: Create TiptapEditor Component (Basic)

**Dauer:** 20 min
**Dateien:** `TiptapEditor.tsx`

### Aktion
Erstelle `frontend/src/components/fields/TiptapEditor.tsx` mit:
- useEditor Hook
- StarterKit Extension
- EditorContent
- Basic props (content, onChange)

### Verifikation
- [ ] Komponente kompiliert
- [ ] `npm run build` erfolgreich
- [ ] Import in Storybook/Test möglich

### Commit Message
`feat(editor): create basic TiptapEditor component`

---

## Step 3: Add Placeholder Extension

**Dauer:** 10 min
**Dateien:** `TiptapEditor.tsx`

### Aktion
- Import Placeholder Extension
- Konfiguriere mit "Notizen eingeben..."
- Füge placeholder CSS hinzu

### Verifikation
- [ ] Placeholder sichtbar bei leerem Editor
- [ ] Verschwindet bei Eingabe

### Commit Message
`feat(editor): add placeholder support`

---

## Step 4: Add Link Extension

**Dauer:** 10 min
**Dateien:** `TiptapEditor.tsx`

### Aktion
- Import Link Extension
- Konfiguriere openOnClick: false
- Füge CSS class für Links hinzu

### Verifikation
- [ ] Links können programmatisch gesetzt werden
- [ ] Link-Styling angewendet

### Commit Message
`feat(editor): add link support`

---

## Step 5: Add Code Block Extension

**Dauer:** 15 min
**Dateien:** `TiptapEditor.tsx`

### Aktion
- Import CodeBlockLowlight
- Konfiguriere lowlight mit common languages
- Deaktiviere StarterKit codeBlock

### Verifikation
- [ ] ``` erstellt Code Block
- [ ] Syntax Highlighting funktioniert

### Commit Message
`feat(editor): add code block with syntax highlighting`

---

## Step 6: Add CSS Styles for Editor

**Dauer:** 15 min
**Dateien:** `index.css`

### Aktion
Füge zu index.css hinzu:
- `.tiptap-editor` Container Styles
- Typography Styles (h1-h3, lists, blockquote)
- Code Styles
- Link Styles

### Verifikation
- [ ] Editor hat Border und Padding
- [ ] Alle Formatierungen visuell korrekt

### Commit Message
`style(editor): add tiptap editor styles`

---

## Step 7: Create BubbleMenu Component (Structure)

**Dauer:** 15 min
**Dateien:** `TiptapBubbleMenu.tsx`

### Aktion
Erstelle `frontend/src/components/fields/TiptapBubbleMenu.tsx`:
- Import BubbleMenu from @tiptap/react
- Basic Container mit Styling
- Props: editor

### Verifikation
- [ ] Komponente kompiliert
- [ ] Menu erscheint bei Selektion (leer)

### Commit Message
`feat(editor): create bubble menu structure`

---

## Step 8: Add Text Formatting Buttons

**Dauer:** 15 min
**Dateien:** `TiptapBubbleMenu.tsx`

### Aktion
- Füge Bold, Italic, Strikethrough Buttons hinzu
- Implementiere Toggle-Logik
- Füge active State Styling hinzu

### Verifikation
- [ ] Bold Button macht Text fett
- [ ] Aktiver State wird angezeigt
- [ ] Toggle funktioniert

### Commit Message
`feat(editor): add text formatting buttons`

---

## Step 9: Add Heading Dropdown

**Dauer:** 15 min
**Dateien:** `TiptapBubbleMenu.tsx`

### Aktion
- Import DropdownMenu from shadcn/ui
- Füge Heading Trigger Button hinzu
- Implementiere H1, H2, H3, Normal Optionen

### Verifikation
- [ ] Dropdown öffnet sich
- [ ] Heading Levels werden angewendet
- [ ] Normal setzt zurück auf Paragraph

### Commit Message
`feat(editor): add heading dropdown`

---

## Step 10: Add List Buttons

**Dauer:** 10 min
**Dateien:** `TiptapBubbleMenu.tsx`

### Aktion
- Füge Bullet List Button hinzu
- Füge Ordered List Button hinzu
- Füge Blockquote Button hinzu

### Verifikation
- [ ] Listen werden erstellt
- [ ] Toggle funktioniert

### Commit Message
`feat(editor): add list and quote buttons`

---

## Step 11: Add Code Buttons

**Dauer:** 10 min
**Dateien:** `TiptapBubbleMenu.tsx`

### Aktion
- Füge Inline Code Button hinzu
- Füge Code Block Button hinzu

### Verifikation
- [ ] Inline Code wird angewendet
- [ ] Code Block wird erstellt

### Commit Message
`feat(editor): add code buttons`

---

## Step 12: Add Link Popover

**Dauer:** 20 min
**Dateien:** `TiptapBubbleMenu.tsx`

### Aktion
- Import Popover, Input from shadcn/ui
- Implementiere Link Button mit Popover
- URL Input mit Speichern/Entfernen

### Verifikation
- [ ] Popover öffnet sich
- [ ] Link wird gesetzt
- [ ] Link kann entfernt werden

### Commit Message
`feat(editor): add link popover`

---

## Step 13: Integrate BubbleMenu in Editor

**Dauer:** 5 min
**Dateien:** `TiptapEditor.tsx`

### Aktion
- Import TiptapBubbleMenu
- Füge als Child von TiptapEditor hinzu

### Verifikation
- [ ] Menu erscheint bei Selektion
- [ ] Alle Buttons funktionieren

### Commit Message
`feat(editor): integrate bubble menu`

---

## Step 14: Update TextSnippet - Read Only

**Dauer:** 15 min
**Dateien:** `TextSnippet.tsx`

### Aktion
- Füge normalizeContent Funktion hinzu
- Füge getTextContent Funktion hinzu
- Update Read-Only Rendering auf HTML

### Verifikation
- [ ] Plain Text wird als Paragraph gerendert
- [ ] HTML wird korrekt angezeigt
- [ ] Truncation funktioniert

### Commit Message
`feat(editor): update TextSnippet read-only rendering`

---

## Step 15: Update TextSnippet - Edit Mode

**Dauer:** 10 min
**Dateien:** `TextSnippet.tsx`

### Aktion
- Entferne Textarea Import
- Import TiptapEditor
- Ersetze Textarea mit TiptapEditor

### Verifikation
- [ ] Tiptap Editor erscheint im Edit Mode
- [ ] onChange wird mit HTML aufgerufen

### Commit Message
`feat(editor): replace textarea with tiptap in edit mode`

---

## Step 16: Add Read-Only Prose Styles

**Dauer:** 10 min
**Dateien:** `index.css`

### Aktion
- Füge `.tiptap-prose` Klasse hinzu
- Kopiere Editor Styles für Read-Only

### Verifikation
- [ ] Read-Only sieht aus wie Editor
- [ ] Konsistentes Styling

### Commit Message
`style(editor): add read-only prose styles`

---

## Step 17: Add Character Count

**Dauer:** 10 min
**Dateien:** `TiptapEditor.tsx`

### Aktion
- Import CharacterCount Extension (oder manuell zählen)
- Zeige Counter bei maxLength

### Verifikation
- [ ] Counter wird angezeigt
- [ ] Zählt korrekt

### Commit Message
`feat(editor): add character count display`

---

## Step 18: Write TiptapEditor Tests

**Dauer:** 20 min
**Dateien:** `TiptapEditor.test.tsx`

### Aktion
- Erstelle Test-Datei
- Basic Render Tests
- Interaction Tests

### Verifikation
- [ ] Alle Tests grün
- [ ] Coverage > 80%

### Commit Message
`test(editor): add TiptapEditor tests`

---

## Step 19: Write TextSnippet Tests

**Dauer:** 15 min
**Dateien:** `TextSnippet.test.tsx`

### Aktion
- Update bestehende Tests
- Füge HTML Rendering Tests hinzu
- Backward Compatibility Tests

### Verifikation
- [ ] Alle Tests grün
- [ ] Legacy Tests funktionieren

### Commit Message
`test(editor): update TextSnippet tests`

---

## Step 20: Final Integration Test

**Dauer:** 15 min
**Dateien:** -

### Aktion
- Manueller Test in der App
- Teste alle User Stories
- Prüfe Backward Compatibility

### Verifikation
- [ ] Text eingeben funktioniert
- [ ] Formatierungen funktionieren
- [ ] Speichern funktioniert
- [ ] Read-Only funktioniert
- [ ] Legacy Daten werden angezeigt

### Commit Message
`feat(editor): complete tiptap integration`

---

## Zusammenfassung

| Steps | Beschreibung | Zeit |
|-------|--------------|------|
| 1-5 | Dependencies & Extensions | 60 min |
| 6 | CSS Styles | 15 min |
| 7-12 | Bubble Menu | 85 min |
| 13 | Integration | 5 min |
| 14-17 | TextSnippet Update | 45 min |
| 18-20 | Tests & Final | 50 min |

**Gesamt: ~4 Stunden** (konservative Schätzung)

## Exit Condition

✅ 20 Atomic Steps definiert:

> Jeder Step ist unabhängig committbar, hat klare Verifikation, und dauert maximal 20 Minuten. Gesamte Implementation in ~4 Stunden möglich.
