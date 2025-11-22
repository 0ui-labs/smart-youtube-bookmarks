# ESLint Cleanup Tasks

**Erstellt:** 2025-11-22
**Status:** Offen
**Priorität:** Niedrig (nicht blockierend)

## Zusammenfassung

Nach Einrichtung der ESLint-Konfiguration wurden **243 Issues** gefunden:
- **4 Errors** (müssen behoben werden)
- **239 Warnings** (sollten behoben werden)

## Errors (4)

### 1. `no-useless-catch` - Unnötiger try/catch

**Datei:** `src/components/CreateTagDialog.tsx:62`

```typescript
// Vorher (Zeile 62):
try {
  // code
} catch (error) {
  throw error  // <- unnötig, wirft nur weiter
}

// Nachher:
// try/catch entfernen oder Error verarbeiten
```

**Fix:** Try/catch entfernen oder sinnvolle Error-Behandlung hinzufügen.

---

### 2. `prefer-const` - `let` statt `const`

**Datei:** `src/components/CustomFieldsFlow.integration.test.tsx:105`

```typescript
// Vorher:
let mockVideos = [...]  // wird nie reassigned

// Nachher:
const mockVideos = [...]
```

**Fix:** `let` zu `const` ändern.

---

### 3-4. Weitere `no-useless-catch` Errors

**Dateien:**
- `src/components/schemas/SchemaEditor.tsx:116`
- `src/pages/SettingsPage.tsx` (falls vorhanden)

**Fix:** Wie oben - try/catch entfernen oder Error sinnvoll behandeln.

---

## Warnings nach Kategorie

### A. `@typescript-eslint/no-unused-vars` (ca. 80 Warnings)

Unbenutzte Variablen/Imports. Meist in Test-Dateien.

**Betroffene Dateien (Auswahl):**
- `src/App.test.tsx`
- `src/components/BulkApplySchema.integration.test.tsx`
- `src/components/CollapsibleSidebar.test.tsx`
- `src/hooks/__tests__/*.test.tsx`
- `src/pages/*.test.tsx`

**Fix-Optionen:**

1. **Unbenutzte Imports entfernen:**
   ```typescript
   // Vorher:
   import { vi, useTags, useBulkApplySchema } from '...'

   // Nachher (wenn nicht verwendet):
   import { vi } from '...'
   ```

2. **Mit Underscore prefixen (wenn absichtlich unbenutzt):**
   ```typescript
   // Vorher:
   } catch (err) {

   // Nachher:
   } catch (_err) {
   ```

3. **Auto-Fix mit ESLint:**
   ```bash
   # Zeigt was entfernt werden kann
   npx eslint --fix src/
   ```

---

### B. `@typescript-eslint/no-explicit-any` (ca. 150 Warnings)

Verwendung von `any` Type statt spezifischer Types.

**Betroffene Dateien (Auswahl):**
- `src/components/CreateTagDialog.tsx:118`
- `src/components/EditTagDialog.tsx:131`
- `src/components/CustomFieldsFlow.integration.test.tsx` (viele)
- `src/hooks/*.ts`
- `src/lib/*.ts`
- `src/pages/*.tsx`

**Fix:**

```typescript
// Vorher:
const handleError = (error: any) => { ... }

// Nachher - Option 1: unknown
const handleError = (error: unknown) => {
  if (error instanceof Error) {
    console.error(error.message)
  }
}

// Nachher - Option 2: spezifischer Type
interface ApiError {
  response?: { data?: { detail?: string } }
}
const handleError = (error: ApiError) => { ... }
```

---

## Priorisierte Fix-Reihenfolge

### Phase 1: Errors beheben (schnell, ~30 min)

1. [ ] `CreateTagDialog.tsx` - try/catch fixen
2. [ ] `CustomFieldsFlow.integration.test.tsx` - `let` → `const`
3. [ ] `SchemaEditor.tsx` - try/catch fixen

### Phase 2: Unused Vars in Source-Code (~1h)

1. [ ] `src/components/*.tsx` - Unbenutzte Imports entfernen
2. [ ] `src/hooks/*.ts` - Unbenutzte Imports entfernen
3. [ ] `src/pages/*.tsx` - Unbenutzte Imports entfernen

### Phase 3: Unused Vars in Tests (~2h)

1. [ ] `src/**/*.test.tsx` - Unbenutzte Test-Utilities entfernen
2. [ ] Test-Helper mit `_` prefixen wenn absichtlich unbenutzt

### Phase 4: `any` Types ersetzen (~4-8h)

1. [ ] Error-Handler Types definieren
2. [ ] API Response Types verwenden
3. [ ] Mock-Daten typisieren

---

## Schnelle Wins

### Auto-fixbare Issues

```bash
cd frontend
npx eslint --fix src/
```

Dies behebt automatisch:
- `prefer-const` Errors
- Einige Formatting-Issues

### VSCode Integration

In `.vscode/settings.json`:
```json
{
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  }
}
```

---

## Notizen

- Diese Issues sind **pre-existing** und wurden nicht durch das Category-Fields Feature verursacht
- Die Warnings blockieren den Build nicht
- Die 4 Errors sollten vor dem nächsten Release behoben werden
- Biome als ESLint-Alternative wurde diskutiert, aber aus Pragmatismus bei ESLint geblieben

---

## Verwandte Dateien

- ESLint Config: `frontend/.eslintrc.cjs`
- Package Scripts: `frontend/package.json` → `"lint": "eslint . --ext ts,tsx"`
