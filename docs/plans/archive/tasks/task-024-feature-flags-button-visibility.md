# Task #24: Feature Flags für Button-Visibility (MVP UI Cleanup)

**Plan Task:** #24
**Wave/Phase:** Wave 2 - UI Cleanup
**Dependencies:** WebSocket Progress Implementation abgeschlossen

---

## 🎯 Ziel

Verstecke die drei Action-Buttons (Video hinzufügen, CSV Upload, CSV Export) in der VideosPage mittels Feature Flags, um die UI für das Single-List MVP zu vereinfachen. Die Funktionalität bleibt im Code und kann später durch Ändern der Flags reaktiviert werden.

**Erwartetes Ergebnis:** Saubere, minimalistische UI ohne unnötige Buttons, die im MVP nicht benötigt werden.

---

## 📋 Acceptance Criteria

- [ ] **Funktional:** Drei Buttons sind standardmäßig nicht sichtbar (SHOW_ADD_VIDEO_BUTTON = false, etc.)
- [ ] **Funktional:** Buttons erscheinen wenn Feature Flags auf true gesetzt werden
- [ ] **Funktional:** Add Video Dialog funktioniert weiterhin (wird in Task #30 via Plus Icon getriggert)
- [ ] **Tests:** Neue VideosPage.test.tsx erstellt mit Feature Flag Tests
- [ ] **Tests:** Tests prüfen bedingte Sichtbarkeit der Buttons
- [ ] **Tests:** Vitest Test Suite läuft erfolgreich durch
- [ ] **Code Review:** Code ist clean, Feature Flags sind selbstdokumentierend
- [ ] **Documentation:** Plan dokumentiert, status.md aktualisiert

---

## 🛠️ Implementation Steps

### 1. Feature Flag Konstanten in VideosPage definieren

**Files:** `frontend/src/components/VideosPage.tsx`
**Action:** Füge Feature Flag Konstanten nach den imports hinzu (vor der Component Definition, ca. Line 42)

```tsx
// Nach den imports und vor const getStatusColor (Line ~42)

// Feature Flags für MVP UI Cleanup (Wave 2 - Task #24)
// Diese Buttons werden in späteren Tasks durch andere UI-Elemente ersetzt:
// - "Video hinzufügen" → Plus Icon in Header (Task #30)
// - "CSV Upload/Export" → TableSettingsDropdown (Task #26)
const FEATURE_FLAGS = {
  SHOW_ADD_VIDEO_BUTTON: false,    // Wird durch Plus Icon ersetzt (Task #30)
  SHOW_CSV_UPLOAD_BUTTON: false,   // Wird in Settings Dropdown verschoben (Task #26)
  SHOW_CSV_EXPORT_BUTTON: false,   // Wird in Settings Dropdown verschoben (Task #26)
} as const
```

**Why:**
- Konstanten-Objekt ist besser als einzelne Variablen (gruppiert zusammengehörige Flags)
- `as const` macht Flags TypeScript-immutable (Type-Safety)
- JSDoc-Kommentare erklären WARUM Buttons versteckt sind und wo sie hinwandern
- Am Anfang der Component → leicht zu finden und zu ändern

**Alternatives:**
- ❌ Environment Variables: Overkill für MVP, erfordert Build-Process Changes
- ❌ React Context: Unnötig komplex für statische Flags
- ❌ Separate Config File: Overhead für 3 simple Flags
- ✅ Top-Level Konstanten: KISS-Prinzip, direkt sichtbar, einfach zu ändern

---

### 2. Buttons mit Feature Flags konditionalisieren

**Files:** `frontend/src/components/VideosPage.tsx`
**Action:** Wrap existierende Buttons in conditional rendering (Lines 291-314)

**Vorher (Lines 291-314):**
```tsx
<div className="flex gap-2">
  <button
    onClick={handleExportCSV}
    disabled={videos.length === 0}
    className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:bg-gray-400 transition-colors"
    aria-label="Videos als CSV exportieren"
  >
    CSV Export
  </button>
  <button
    onClick={() => setIsUploadingCSV(true)}
    className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
    aria-label="Videos per CSV hochladen"
  >
    CSV Upload
  </button>
  <button
    onClick={() => setIsAdding(true)}
    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
    aria-label="Einzelnes Video hinzufügen"
  >
    Video hinzufügen
  </button>
</div>
```

**Nachher:**
```tsx
<div className="flex gap-2">
  {FEATURE_FLAGS.SHOW_CSV_EXPORT_BUTTON && (
    <button
      onClick={handleExportCSV}
      disabled={videos.length === 0}
      className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:bg-gray-400 transition-colors"
      aria-label="Videos als CSV exportieren"
    >
      CSV Export
    </button>
  )}
  {FEATURE_FLAGS.SHOW_CSV_UPLOAD_BUTTON && (
    <button
      onClick={() => setIsUploadingCSV(true)}
      className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
      aria-label="Videos per CSV hochladen"
    >
      CSV Upload
    </button>
  )}
  {FEATURE_FLAGS.SHOW_ADD_VIDEO_BUTTON && (
    <button
      onClick={() => setIsAdding(true)}
      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
      aria-label="Einzelnes Video hinzufügen"
    >
      Video hinzufügen
    </button>
  )}
</div>
```

**Why:**
- `&&` short-circuit operator ist idiomatisches React Pattern für conditional rendering
- Buttons werden nicht nur versteckt (display: none) sondern aus DOM entfernt → bessere Performance
- aria-label bleibt erhalten → Accessibility

**Edge Case:**
- Wenn alle drei Flags false sind: `<div className="flex gap-2">` ist leer
- Das ist okay - div nimmt keinen Platz ein (flex mit gap ignoriert leere divs)
- Alternative: Ganzes div konditionalisieren → Aber nicht nötig, da andere Buttons später hier hinzukommen (Plus Icon, Settings)

---

### 3. Neue Test-Datei für VideosPage erstellen

**Files:** `frontend/src/components/VideosPage.test.tsx` (NEUE DATEI)
**Action:** Erstelle vollständige Test-Suite für VideosPage mit Feature Flag Tests

```tsx
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { VideosPage } from './VideosPage'

// Mock hooks
vi.mock('@/hooks/useVideos', () => ({
  useVideos: vi.fn(() => ({ 
    data: [], 
    isLoading: false, 
    error: null 
  })),
  useCreateVideo: vi.fn(() => ({ 
    mutateAsync: vi.fn() 
  })),
  useDeleteVideo: vi.fn(() => ({ 
    mutate: vi.fn() 
  })),
  exportVideosCSV: vi.fn(),
}))

vi.mock('@/hooks/useWebSocket', () => ({
  useWebSocket: vi.fn(() => ({
    jobProgress: new Map(),
    reconnecting: false,
    historyError: null
  }))
}))

vi.mock('@/hooks/useLists', () => ({
  useLists: vi.fn(() => ({
    data: [{ id: 'test-list-1', name: 'Test List', videos: [] }],
    isLoading: false,
    error: null
  }))
}))

const renderWithQueryClient = (component: React.ReactElement) => {
  const queryClient = new QueryClient({
    defaultOptions: { 
      queries: { retry: false }, 
      mutations: { retry: false } 
    }
  })
  return render(
    <QueryClientProvider client={queryClient}>
      {component}
    </QueryClientProvider>
  )
}

describe('VideosPage - Feature Flags', () => {
  const mockProps = { 
    listId: 'test-list-1', 
    onBack: vi.fn() 
  }

  it('hides all action buttons when feature flags are false (MVP mode)', () => {
    renderWithQueryClient(<VideosPage {...mockProps} />)

    // Verify buttons are not in DOM (not just hidden)
    expect(screen.queryByRole('button', { name: /CSV Export/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /CSV Upload/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Video hinzufügen/i })).not.toBeInTheDocument()
  })

  it('renders page without crashing when buttons are hidden', () => {
    renderWithQueryClient(<VideosPage {...mockProps} />)

    // Basic page elements should still be present
    expect(screen.getByText(/Videos in dieser Liste/i)).toBeInTheDocument()
  })
})

describe('VideosPage - Basic Functionality', () => {
  const mockProps = { 
    listId: 'test-list-1', 
    onBack: vi.fn() 
  }

  it('displays empty state when no videos', () => {
    renderWithQueryClient(<VideosPage {...mockProps} />)
    
    expect(screen.getByText(/Noch keine Videos in dieser Liste/i)).toBeInTheDocument()
  })

  it('calls onBack when back button is clicked', async () => {
    const mockOnBack = vi.fn()
    renderWithQueryClient(<VideosPage {...mockProps} onBack={mockOnBack} />)
    
    const backButton = screen.getByRole('button', { name: /Zurück/i })
    backButton.click()
    
    expect(mockOnBack).toHaveBeenCalledOnce()
  })
})
```

**Why neue Datei erstellen:**
- Keine existierende VideosPage.test.tsx vorhanden (basierend auf Codebase-Analyse)
- Feature Flag Tests brauchen eigenen Scope
- Vitest + @testing-library/react Setup bereits vorhanden (wie in useWebSocket.test.ts)
- QueryClient Provider nötig für React-Query hooks

---

### 4. Vitest Konfiguration prüfen

**Files:** `frontend/vite.config.ts`, `frontend/package.json`
**Action:** Verifizieren dass Vitest korrekt konfiguriert ist für neue Tests

**Check in vite.config.ts:**
```tsx
/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
  },
})
```

**Expected:** Konfiguration sollte bereits korrekt sein (basierend auf existierenden useWebSocket.test.ts)

**If Issues:** 
- Stelle sicher dass `@testing-library/jest-dom` in setup.ts importiert wird
- Verifiziere dass jsdom environment korrekt konfiguriert ist

---

### 5. Test Setup Datei prüfen

**Files:** `frontend/src/test/setup.ts`
**Action:** Verifizieren dass Testing Library korrekt konfiguriert ist

**Expected Content:**
```tsx
import '@testing-library/jest-dom'
```

**If Missing:** Erstelle Datei mit obigem Inhalt

---

### 6. Manual Testing Checklist

**Action:** Teste im Browser mit verschiedenen Flag-Kombinationen

**Test Cases:**

1. **MVP Mode (alle Flags false - DEFAULT):**
   - ✅ `npm run dev` starten
   - ✅ Zu `/videos` navigieren (oder List auswählen)
   - ✅ Buttons sind nicht sichtbar
   - ✅ Header sieht clean aus (nur Video-Liste und Zurück-Button)
   - ✅ Add Video Dialog kann nicht geöffnet werden (kein Button)
   - ✅ CSV Upload/Export nicht möglich (bis Task #26)

2. **Feature Flag Override (ein Flag auf true):**
   - ✅ In `VideosPage.tsx` ändern: `SHOW_ADD_VIDEO_BUTTON: true`
   - ✅ Vite Hot Reload activated automatisch
   - ✅ "Video hinzufügen" Button erscheint
   - ✅ Button funktioniert: Klick öffnet Dialog
   - ✅ Dialog funktioniert: Form kann ausgefüllt werden
   - ✅ Zurück auf `false` setzen → Button verschwindet

3. **Alle Flags aktiviert (alle auf true):**
   - ✅ Alle drei Buttons sichtbar
   - ✅ "CSV Export" funktioniert (Download triggered)
   - ✅ "CSV Upload" öffnet Modal
   - ✅ "Video hinzufügen" öffnet Dialog
   - ✅ Layout ist nicht gebrochen (flex gap handled das)

4. **Mixed Flags (verschiedene Kombinationen):**
   - ✅ Nur CSV Export: `SHOW_CSV_EXPORT_BUTTON: true`, rest false
   - ✅ Nur CSV Upload: `SHOW_CSV_UPLOAD_BUTTON: true`, rest false
   - ✅ Export + Upload: beide true, Add Video false

---

## 🧪 Testing Strategy

### Unit Tests

**Test 1: Feature Flags verstecken Buttons (MVP Mode)**
- **Given:** FEATURE_FLAGS alle false (default)
- **When:** VideosPage rendered
- **Then:** Keine der drei Buttons sind im DOM (`queryByRole` returns null)
- **Rationale:** Hauptziel von Task #24 - UI cleanup für MVP

**Test 2: Page rendert ohne Crashes**
- **Given:** Buttons versteckt durch Feature Flags
- **When:** VideosPage rendered
- **Then:** Basic page elements (Titel, Zurück-Button) sind sichtbar
- **Rationale:** Sicherstellen dass conditional rendering die Page nicht bricht

**Test 3: onBack Callback funktioniert weiterhin**
- **Given:** VideosPage rendered
- **When:** Zurück-Button geklickt
- **Then:** onBack prop wurde aufgerufen
- **Rationale:** Core Navigation darf nicht beeinträchtigt werden

### Integration Tests

**Keine speziellen Integration Tests nötig** - Feature Flags ändern nur UI-Sichtbarkeit, nicht API-Calls oder WebSocket-Funktionalität.

**Existing Integration Tests:** WebSocket Progress Tests bleiben unverändert (in `backend/tests/integration/`)

### Manual Testing

1. **Start Dev Environment:** 
   ```bash
   # Terminal 1: Backend
   cd backend && uvicorn app.main:app --reload
   
   # Terminal 2: Frontend  
   cd frontend && npm run dev
   ```

2. **Verify Default State:** Navigiere zu Videos Page → Keine Action Buttons sichtbar

3. **Test Feature Flag Toggle:**
   - Ändere `SHOW_ADD_VIDEO_BUTTON: true` in Source
   - Vite reloaded automatisch → Button erscheint