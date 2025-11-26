# Phase 3: Impact Assessment

## Übersicht

| Bereich | Impact | Komplexität |
|---------|--------|-------------|
| Frontend | Hoch | Mittel |
| Backend | Keiner | - |
| Database | Keiner | - |
| API | Keiner | - |
| Tests | Mittel | Niedrig |

## Frontend Impact

### Dateien mit Änderungen

| Datei | Art der Änderung | Aufwand |
|-------|------------------|---------|
| `frontend/src/components/fields/TextSnippet.tsx` | **Komplett neu schreiben** | Hoch |
| `frontend/src/components/fields/editors/TextEditor.tsx` | Anpassen (falls verwendet) | Niedrig |
| `frontend/src/index.css` | Tiptap Styles hinzufügen | Niedrig |
| `frontend/package.json` | Tiptap Dependencies | Niedrig |

### Neue Dateien

| Datei | Zweck |
|-------|-------|
| `frontend/src/components/fields/TiptapEditor.tsx` | Neue Editor-Komponente |
| `frontend/src/components/fields/TiptapBubbleMenu.tsx` | Bubble Menu Komponente |
| `frontend/src/lib/tiptap-extensions.ts` | Extension Konfiguration (optional) |

### Indirekt betroffene Komponenten

Diese Komponenten nutzen TextSnippet/FieldDisplay, sollten aber ohne Änderungen funktionieren:

| Komponente | Grund |
|------------|-------|
| `CustomFieldsSection.tsx` | Nutzt FieldDisplay → keine Änderung |
| `VideoDetailsPage.tsx` | Nutzt CustomFieldsSection → keine Änderung |
| `VideoDetailsModal.tsx` | Nutzt CustomFieldsSection → keine Änderung |
| `CustomFieldsModal.tsx` | Nutzt CustomFieldsSection → keine Änderung |

## Backend Impact

### Keine Änderungen erforderlich

- **Datenbank-Schema:** `value_text` ist PostgreSQL TEXT (unbegrenzte Länge)
- **API Endpoints:** Akzeptieren bereits strings beliebiger Länge
- **Validierung:** `max_length` ist optional und Frontend-only

## API Impact

### Keine Änderungen erforderlich

- `PUT /videos/{id}/fields` akzeptiert `value: string`
- HTML-Strings werden als normale Strings behandelt
- Kein neuer Endpoint nötig

## Test Impact

### Anzupassende Tests

| Test-Datei | Änderung |
|------------|----------|
| `frontend/src/components/fields/TextSnippet.test.tsx` | Komplett neu schreiben für Tiptap |
| `frontend/src/components/fields/FieldDisplay.test.tsx` | Anpassen für HTML output |

### Neue Tests

| Test-Datei | Zweck |
|------------|-------|
| `TiptapEditor.test.tsx` | Unit Tests für Editor |
| `TiptapBubbleMenu.test.tsx` | Tests für Bubble Menu |

### Unveränderte Tests

- Backend-Tests → keine Änderung
- API-Tests → keine Änderung (strings bleiben strings)
- Integration-Tests → sollten funktionieren (E2E)

## Dependencies Impact

### Neue NPM Packages

```json
{
  "@tiptap/react": "^2.x",
  "@tiptap/starter-kit": "^2.x",
  "@tiptap/extension-link": "^2.x",
  "@tiptap/extension-placeholder": "^2.x",
  "@tiptap/extension-code-block-lowlight": "^2.x",
  "lowlight": "^3.x"
}
```

### Bundle Size Impact

- Tiptap Core: ~50KB gzipped
- Extensions: ~20KB gzipped
- **Total:** ~70KB zusätzlich

## Security Impact

### XSS Prävention

- **Risiko:** HTML wird vom User eingegeben und später gerendert
- **Mitigation:** Tiptap sanitized HTML automatisch
- **Read-Only Rendering:** `dangerouslySetInnerHTML` mit Sanitization (DOMPurify optional)

### Empfehlung

Tiptap's eingebaute Sanitization ist ausreichend, da nur erlaubte Nodes/Marks gerendert werden.

## Performance Impact

### Editor Performance
- Tiptap ist optimiert für Performance
- Bubble Menu wird lazy gerendert
- Keine merkliche Verschlechterung erwartet

### Bundle Size
- +70KB ist akzeptabel für Rich-Text Funktionalität
- Tree-shaking reduziert ungenutzten Code

## Risiko-Einschätzung

| Risiko | Wahrscheinlichkeit | Impact | Mitigation |
|--------|-------------------|--------|------------|
| Breaking existing text display | Niedrig | Hoch | Plain text als HTML paragraph rendern |
| Performance issues | Sehr niedrig | Mittel | Tiptap ist optimiert |
| Styling conflicts | Niedrig | Niedrig | Scoped CSS / Tailwind |
| XSS vulnerabilities | Sehr niedrig | Hoch | Tiptap sanitization |

## Komplexitäts-Einschätzung

**Gesamt: MITTEL**

- Hauptänderung konzentriert auf eine Komponente (TextSnippet)
- Kein Backend-Aufwand
- Kein Schema-Migration
- Gut isolierter Scope

## Exit Condition

✅ Vollständige Liste der betroffenen Bereiche:

> **Frontend:** 2-4 Dateien zu ändern, 2-3 neue Dateien. **Backend/API/DB:** Keine Änderungen. **Tests:** TextSnippet Tests neu schreiben. **Dependencies:** +70KB Bundle Size durch Tiptap.
