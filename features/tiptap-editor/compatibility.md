# Phase 5: Backward Compatibility

## Kompatibilitäts-Übersicht

| Bereich | Status | Risiko |
|---------|--------|--------|
| API Contracts | ✅ Unverändert | Keins |
| Database Schema | ✅ Unverändert | Keins |
| Props Interface | ✅ Unverändert | Keins |
| Bestehende Daten | ⚠️ Plain Text → HTML | Niedrig |
| UI Flows | ✅ Funktionieren weiter | Keins |

## Bestehende Daten

### Situation
- Bestehende Text-Felder enthalten Plain Text
- Neue Eingaben werden als HTML gespeichert
- Tiptap muss beide Formate verarbeiten

### Lösung: Automatische Konvertierung

```tsx
// Plain Text zu HTML konvertieren (beim Laden)
function normalizeContent(value: string | null): string {
  if (!value) return ''

  // Bereits HTML? → Zurückgeben
  if (value.trim().startsWith('<')) {
    return value
  }

  // Plain Text → Als Paragraph wrappen
  return `<p>${escapeHtml(value)}</p>`
}
```

### Beispiel

| Gespeicherter Wert | Wird zu |
|-------------------|---------|
| `"Hello World"` | `<p>Hello World</p>` |
| `"<p>Hello</p>"` | `<p>Hello</p>` (unverändert) |
| `null` | `""` (leerer Editor) |

## API Kompatibilität

### Keine Änderungen erforderlich

```typescript
// Vorher (Plain Text)
PUT /videos/{id}/fields
{ "field_values": [{ "field_id": "...", "value": "Hello World" }] }

// Nachher (HTML) - Gleicher Endpoint, gleiches Format
PUT /videos/{id}/fields
{ "field_values": [{ "field_id": "...", "value": "<p>Hello World</p>" }] }
```

Das Backend behandelt beides als `string` → Keine Änderung nötig.

## Props Interface Kompatibilität

### TextSnippet Props bleiben identisch

```tsx
// Vorher UND Nachher - Gleiches Interface!
<TextSnippet
  value={fieldValue.value}        // string | null
  truncateAt={50}                 // number
  readOnly={false}                // boolean
  onChange={(v) => save(v)}       // (string) => void
  maxLength={500}                 // number | undefined
/>
```

Keine Parent-Komponente muss geändert werden!

## UI Flow Kompatibilität

### Bestehende Flows funktionieren weiter

| Flow | Status |
|------|--------|
| Video öffnen → Text-Feld sehen | ✅ |
| Text eingeben → Speichern | ✅ |
| Text bearbeiten → Aktualisieren | ✅ |
| Feld im Modal anzeigen | ✅ |
| Read-only Anzeige | ✅ |

### Neue Capabilities (additiv)

| Neuer Flow | Beschreibung |
|------------|--------------|
| Text selektieren → Bubble Menu | Formatierungsoptionen |
| Bold/Italic anwenden | Inline-Formatierung |
| Liste erstellen | Strukturierte Inhalte |

## Datenbank Kompatibilität

### Keine Migration erforderlich

```sql
-- Bestehende Spalte
value_text TEXT  -- Akzeptiert beliebige Strings

-- HTML wird als String gespeichert
-- Keine Schema-Änderung nötig!
```

## Breaking Changes

### Keine Breaking Changes

| Potentielles Problem | Status |
|---------------------|--------|
| API Contract Änderung | ❌ Nein |
| DB Schema Änderung | ❌ Nein |
| Props Interface Änderung | ❌ Nein |
| Bestehende Daten unlesbar | ❌ Nein (Auto-Konvertierung) |

## Graceful Degradation

### Falls Tiptap nicht lädt

```tsx
// Fallback auf native Textarea
if (!editor) {
  return (
    <Textarea
      value={stripHtml(value)}
      onChange={(e) => onChange?.(e.target.value)}
    />
  )
}
```

### Falls HTML Parsing fehlschlägt

```tsx
try {
  editor.commands.setContent(value)
} catch {
  // Fallback: Als Plain Text behandeln
  editor.commands.setContent(`<p>${escapeHtml(value)}</p>`)
}
```

## Feature Toggle (Optional)

Falls gewünscht, könnte ein Feature Toggle implementiert werden:

```tsx
const ENABLE_RICH_TEXT = true  // Einfacher Toggle

if (!ENABLE_RICH_TEXT) {
  return <Textarea ... />  // Altes Verhalten
}

return <TiptapEditor ... />  // Neues Verhalten
```

**Empfehlung:** Nicht nötig, da Risiko minimal.

## Rollback-Strategie

### Falls Probleme auftreten

1. Git revert auf vorherige Version
2. Bestehende Daten bleiben lesbar (HTML wird als Text angezeigt)
3. Neue HTML-Daten werden als HTML-Text angezeigt (hässlich aber funktional)

### Daten-Recovery

```typescript
/**
 * Cross-platform HTML stripper.
 * Works in both browser (DOMParser) and Node/SSR (regex fallback).
 */
function stripHtml(html: string): string {
  if (!html) return ''

  // Browser environment: use DOMParser for accurate parsing
  if (typeof window !== 'undefined' && typeof DOMParser !== 'undefined') {
    const doc = new DOMParser().parseFromString(html, 'text/html')
    return doc.body.textContent || ''
  }

  // Node/SSR environment: regex-based fallback
  // For production SSR, consider using 'string-strip-html' package
  return html
    .replace(/<[^>]*>/g, '')           // Remove HTML tags
    .replace(/&nbsp;/g, ' ')           // Convert non-breaking spaces
    .replace(/&amp;/g, '&')            // Decode ampersands
    .replace(/&lt;/g, '<')             // Decode less-than
    .replace(/&gt;/g, '>')             // Decode greater-than
    .replace(/&quot;/g, '"')           // Decode quotes
    .replace(/&#39;/g, "'")            // Decode apostrophes
    .replace(/\s+/g, ' ')              // Normalize whitespace
    .trim()
}
```

## Kompatibilitäts-Checkliste

- [x] Bestehende API Contracts unverändert
- [x] Datenbank-Migrationen nicht nötig
- [x] Bestehende UI Flows funktionieren
- [x] Props Interface unverändert
- [x] Feature kann deaktiviert werden (optional)
- [x] Bestehende Daten werden korrekt angezeigt

## Exit Condition

✅ Backward Compatibility sichergestellt:

> Keine Breaking Changes. Plain Text wird automatisch zu HTML konvertiert. API und DB bleiben unverändert. Props Interface bleibt kompatibel. Graceful Degradation bei Fehlern. Rollback jederzeit möglich.
