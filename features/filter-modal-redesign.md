# Filter Modal Redesign

**Feature-ID:** filter-modal-redesign
**Status:** Planning Complete
**Datum:** 2025-01-24

---

## Überblick

Redesign des Filter-UI von Dropdown (Popover) zu Modal mit Kategorie-basierten Tabs und Settings-Icon.

### Aktuell (Ist-Zustand)
- Button: `+ Add Filter` (Plus-Icon)
- UI-Element: Popover/Dropdown mit Command-Palette
- Zeigt: Alle CustomFields der Liste als einfache Liste

### Neu (Soll-Zustand)
- Button: `⚙️ Filter` (Settings-Icon)
- UI-Element: Modal/Dialog
- Zeigt: CustomFields gruppiert nach ausgewählten Kategorien
- Tabs: Bei mehreren Kategorien - ein Tab pro Kategorie
- Fallback: Keine Kategorie ausgewählt → alle Filter zeigen

---

## Phase 1: Feature Understanding

### Datenmodell

```
Kategorie (Tag mit is_video_type=true)
    └── schema_id → FieldSchema
                      └── schema_fields[] → CustomField[]
                            ├── rating ("Bewertung", 1-5 Sterne)
                            ├── select ("Status", Optionen: ...)
                            ├── text ("Notizen")
                            └── boolean ("Angeschaut")
```

### Verhalten

| Szenario | Verhalten |
|----------|-----------|
| **1 Kategorie ausgewählt** | Modal ohne Tabs, zeigt nur Filter dieser Kategorie |
| **Mehrere Kategorien** | Modal mit Tabs (ein Tab pro Kategorie) |
| **Keine Kategorie** | Modal zeigt alle CustomFields der Liste |
| **Kategorie ohne Schema** | Tab wird angezeigt mit Hinweis "Keine Filter verfügbar" |

### Datenfluss

```
1. selectedTagIds (aus tagStore)
   ↓
2. Tags mit useCategories() filtern
   ↓
3. Für jeden Tag: tag.schema_id holen
   ↓
4. Schema mit useSchema(listId, schemaId) laden
   ↓
5. schema.schema_fields enthält CustomFields
   ↓
6. Im Modal anzeigen (mit Tabs wenn mehrere)
```

---

## Phase 2: Codebase Analysis

### Vorhandene Bausteine

| Komponente | Pfad | Verwendung |
|------------|------|------------|
| `Dialog` | `ui/dialog.tsx` | Radix UI Modal ✓ |
| `Tabs` | `ui/tabs.tsx` | Radix UI Tabs ✓ |
| `Settings` Icon | `lucide-react` | Verfügbar ✓ |

### Hooks für Datenzugriff

| Hook | Rückgabe | Beschreibung |
|------|----------|--------------|
| `useTags()` | `Tag[]` | Alle Tags |
| `useCategories()` | `Tag[]` | Nur `is_video_type=true` |
| `useSchemas(listId)` | `Schema[]` | Alle Schemata einer Liste |
| `useSchema(listId, schemaId)` | `Schema` | Ein Schema mit `schema_fields[]` |
| `useCustomFields(listId)` | `CustomField[]` | Alle CustomFields einer Liste |

### Aktuelles Problem

```typescript
// FilterPopover.tsx - aktuell:
const { data: customFields } = useCustomFields(listId) // ← Holt ALLE Felder

// Benötigt für Modal:
// selectedTagIds → Tags → schema_id → Schema → schema_fields → CustomFields
```

---

## Phase 3: Impact Assessment

### Betroffene Dateien

| Kategorie | Datei | Änderungsart |
|-----------|-------|--------------|
| **Komponente (neu)** | `FilterSettingsModal.tsx` | Komplett neu erstellen |
| **Komponente (neu)** | `FilterTable.tsx` | Komplett neu erstellen |
| **Hook (neu)** | `useFiltersByCategory.ts` | Neuer Hook für Schema-basierte Filter |
| **Komponente (anpassen)** | `VideosPage.tsx` | Import/Props anpassen |
| **Tests (neu)** | `FilterSettingsModal.test.tsx` | Komplett neu schreiben |
| **Tests (neu)** | `useFiltersByCategory.test.ts` | Komplett neu schreiben |
| **Cleanup** | `FilterPopover.tsx` | Löschen oder deprecaten |

### Keine Änderungen nötig
- `FilterBar.tsx` - zeigt weiterhin aktive Filter
- `fieldFilterStore.ts` - Logik bleibt gleich
- Backend - keine API-Änderungen

### Komplexität: **Mittel**

```
Neue Komponente FilterSettingsModal:  ~120 Zeilen
Neue Komponente FilterTable:          ~150 Zeilen
Neuer Hook useFiltersByCategory:      ~80 Zeilen
Test-Anpassungen:                     ~180 Zeilen
────────────────────────────────────────────────
Gesamt:                               ~530 Zeilen
```

---

## Phase 4: Integration Strategy

### Strategie: In-Place Refactoring

```
FilterPopover.tsx (aktuell)              FilterSettingsModal.tsx (neu)
├── Button: Plus + "Add Filter"    →    ├── Button: Settings + "Filter"
├── Popover → Command Liste         →    ├── Dialog → Modal
└── useCustomFields(listId)         →    ├── Tabs (wenn mehrere Kategorien)
                                         ├── Filter-Tabelle pro Kategorie
                                         └── useFiltersByCategory(listId, selectedTagIds)
```

### Integration Points

#### 1. Button-Austausch in VideosPage.tsx

```tsx
// Vorher (Zeile 866):
<FilterPopover listId={listId} />

// Nachher:
<FilterSettingsModal
  listId={listId}
  selectedTagIds={selectedTagIds}
/>
```

#### 2. Neuer Hook: `useFiltersByCategory`

```typescript
// hooks/useFiltersByCategory.ts
type CategoryFilters = {
  categoryId: string
  categoryName: string
  schemaId: string | null
  fields: CustomField[]
}

function useFiltersByCategory(
  listId: string,
  selectedTagIds: string[]
): CategoryFilters[]
```

#### 3. Modal-Komponente Struktur

```tsx
<Dialog open={open} onOpenChange={setOpen}>
  <DialogTrigger>
    <Button variant="outline" size="sm">
      <Settings className="h-4 w-4 mr-1" />
      Filter
    </Button>
  </DialogTrigger>

  <DialogContent className="max-w-2xl">
    <DialogHeader>
      <DialogTitle>Filter konfigurieren</DialogTitle>
    </DialogHeader>

    {categoryFilters.length === 1 ? (
      <FilterTable fields={categoryFilters[0].fields} />
    ) : (
      <Tabs defaultValue={categoryFilters[0].categoryId}>
        <TabsList>
          {categoryFilters.map(cat => (
            <TabsTrigger value={cat.categoryId}>
              {cat.categoryName}
            </TabsTrigger>
          ))}
        </TabsList>
        {categoryFilters.map(cat => (
          <TabsContent value={cat.categoryId}>
            <FilterTable fields={cat.fields} />
          </TabsContent>
        ))}
      </Tabs>
    )}
  </DialogContent>
</Dialog>
```

### Minimale Disruption

| Aspekt | Strategie |
|--------|-----------|
| **Bestehende Filter** | `activeFilters` in `fieldFilterStore` bleiben kompatibel |
| **FilterBar** | Keine Änderung - zeigt weiterhin aktive Filter |
| **API** | Keine Backend-Änderungen nötig |
| **Store** | `fieldFilterStore` API bleibt unverändert |

---

## Phase 5: Backward Compatibility

### Kompatibilitäts-Checkliste

| Prüfpunkt | Status | Begründung |
|-----------|--------|------------|
| ✅ Bestehende API-Verträge unverändert | OK | Kein Backend-Change nötig |
| ✅ Datenbank-Migrationen nicht-brechend | OK | Keine DB-Änderungen |
| ✅ Bestehende UI-Flows funktionieren | OK | FilterBar bleibt gleich |
| ✅ Keine Änderungen an öffentlichen Interfaces | OK | Store-API bleibt gleich |
| ✅ Feature kann deaktiviert werden | OK | Alte Komponente bleibt im Repo |

### Kein Breaking Change weil:

1. **fieldFilterStore** - Interface bleibt identisch:
   ```typescript
   // Unverändert:
   addFilter(filter)
   removeFilter(id)
   updateFilter(id, updates)
   clearFilters()
   activeFilters[]
   ```

2. **FilterBar** - Keine Änderung:
   - Liest weiterhin `activeFilters` aus Store
   - Zeigt Filter-Badges unverändert an

3. **API-Aufrufe** - Identisch:
   - Filter werden weiterhin als `field_filters` an Backend geschickt
   - `useVideosFilter` Hook bleibt unverändert

### Migration

Keine Migration nötig - es ist ein reiner UI-Austausch:
- Alte Komponente: `FilterPopover.tsx`
- Neue Komponente: `FilterSettingsModal.tsx`
- Import in `VideosPage.tsx` wird angepasst

### Fallback-Strategie

Falls Probleme auftreten:
- Git revert auf vorherige Version
- Alte `FilterPopover.tsx` ist weiterhin funktionsfähig

---

## Phase 6: User Stories

### Story 1: Filter-Modal öffnen (Einzelne Kategorie)

**Als** User mit einer ausgewählten Kategorie
**Möchte ich** auf das Settings-Icon klicken
**Um** alle verfügbaren Filter dieser Kategorie zu sehen

**UX Flow:**
1. User hat "Tutorial" in Sidebar ausgewählt
2. User klickt auf ⚙️-Button neben Filter-Controls
3. Modal öffnet sich mit Titel "Filter konfigurieren"
4. Alle CustomFields der Kategorie "Tutorial" werden angezeigt
5. Kein Tab-System (nur eine Kategorie)

**Edge Cases:**
- Kategorie hat kein Schema → Meldung "Keine Filter verfügbar"
- Schema hat keine Felder → Leere Liste mit Hinweis

---

### Story 2: Filter-Modal mit Tabs (Mehrere Kategorien)

**Als** User mit mehreren ausgewählten Kategorien
**Möchte ich** Filter pro Kategorie in Tabs sehen
**Um** übersichtlich zwischen den Filter-Sets zu wechseln

**UX Flow:**
1. User hat "Tutorial" + "Podcast" ausgewählt
2. User klickt auf ⚙️-Button
3. Modal öffnet mit Tab-Leiste: [Tutorial] [Podcast]
4. Erster Tab ist automatisch aktiv
5. User kann zwischen Tabs wechseln
6. Jeder Tab zeigt nur die Filter seiner Kategorie

**Edge Cases:**
- Eine Kategorie hat kein Schema, andere schon → Tab trotzdem zeigen mit Hinweis
- Alle Kategorien ohne Schema → Modal zeigt allgemeine Meldung

---

### Story 3: Filter aktivieren

**Als** User im Filter-Modal
**Möchte ich** einen Filter per Toggle aktivieren
**Um** die Video-Liste zu filtern

**UX Flow:**
1. User sieht Filter "Bewertung ≥ 4" mit Toggle (aus)
2. User aktiviert Toggle
3. Filter wird zu `activeFilters` im Store hinzugefügt
4. FilterBar zeigt neuen Filter-Chip
5. Video-Liste aktualisiert sich

**Edge Cases:**
- Filter bereits aktiv → Toggle ist "ein", Deaktivieren entfernt ihn

---

### Story 4: Keine Kategorie ausgewählt

**Als** User ohne ausgewählte Kategorie
**Möchte ich** trotzdem Filter sehen können
**Um** auch bei "Alle Videos" filtern zu können

**UX Flow:**
1. User ist auf "Alle Videos" (keine Kategorie ausgewählt)
2. User klickt auf ⚙️-Button
3. Modal zeigt alle verfügbaren CustomFields (wie aktuell)
4. Keine Tabs nötig

---

## Phase 7: UI/UX Integration

### Button-Design (Ersetzt FilterPopover-Trigger)

```
┌──────────────┐
│ ⚙️  Filter   │  ← Settings Icon (lucide: Settings)
└──────────────┘
```

- **Icon:** `Settings` aus lucide-react (statt `Plus`)
- **Text:** "Filter" (statt "Add Filter")
- **Variant:** `outline`, `size="sm"` (wie bisher)
- **Position:** Gleiche Position wie alter Button (Zeile 866 in VideosPage.tsx)

### Modal-Layout

```
┌─────────────────────────────────────────────────────────┐
│  Filter konfigurieren                              [X]  │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐                   │
│  │Tutorial │ │ Podcast │ │ Kurs    │   ← Tabs (nur     │
│  └─────────┘ └─────────┘ └─────────┘     bei >1 Kat.)  │
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │ □  Bewertung          rating    ≥ [4]          │   │
│  │ ☑  Sprache            select    = [Deutsch ▼]  │   │
│  │ □  Angeschaut         boolean   = [✓]          │   │
│  │ □  Notizen            text      enthält [___]  │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  ← Checkbox = aktiv/inaktiv                            │
│  ← Name + Typ + Operator + Wert-Eingabe                │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### Filter-Zeile Komponente

Jede Zeile zeigt:
1. **Checkbox** - Filter aktiv/inaktiv
2. **Feldname** - z.B. "Bewertung"
3. **Feldtyp** - Badge: `rating`, `select`, `text`, `boolean`
4. **Operator** - Dropdown basierend auf Feldtyp
5. **Wert** - Input/Select basierend auf Feldtyp

### Responsive Design

- **Desktop:** Modal 600-800px breit
- **Mobile:** Modal fullscreen oder `max-w-full`
- **Tabs:** Horizontal scrollbar bei vielen Kategorien

### Accessibility

- Modal mit `aria-labelledby` für Titel
- Tabs mit korrekten ARIA-Rollen (Radix UI macht das automatisch)
- Checkbox-Labels verknüpft
- Fokus-Management beim Öffnen/Schließen
- ESC-Taste schließt Modal

---

## Phase 8: Implementation Plan

### Phase 1: Foundation - Hook erstellen

**Dateien:**
- `frontend/src/hooks/useFiltersByCategory.ts` (NEU)
- `frontend/src/types/filterSettings.ts` (NEU)

**Aufgaben:**
1. TypeScript-Typen definieren: `CategoryFilters`
2. Hook erstellen der `selectedTagIds` entgegennimmt
3. Tags laden und nach `is_video_type=true` filtern
4. Für jeden relevanten Tag das Schema laden
5. CustomFields pro Kategorie gruppieren
6. Fallback: Keine Kategorien → alle CustomFields zurückgeben

---

### Phase 2: Modal-Grundgerüst

**Dateien:**
- `frontend/src/components/videos/FilterSettingsModal.tsx` (NEU)

**Aufgaben:**
1. Dialog-Komponente mit Trigger-Button
2. Settings-Icon importieren
3. Basis-Layout ohne Tabs
4. Props-Interface definieren: `listId`, `selectedTagIds`
5. Hook `useFiltersByCategory` einbinden

---

### Phase 3: Filter-Tabelle Komponente

**Dateien:**
- `frontend/src/components/videos/FilterTable.tsx` (NEU)

**Aufgaben:**
1. Tabellen-Layout für Filter
2. Checkbox pro Zeile
3. Feldname + Typ-Badge anzeigen
4. Operator-Dropdown (Wiederverwendung von FieldFilterInput-Logik)
5. Wert-Input basierend auf Feldtyp
6. Store-Anbindung: `useFieldFilterStore`

---

### Phase 4: Tab-Integration

**Dateien:**
- `frontend/src/components/videos/FilterSettingsModal.tsx` (erweitern)

**Aufgaben:**
1. Tabs-Komponente einbauen
2. Konditionale Logik: Tabs nur bei >1 Kategorie
3. Tab-Header mit Kategorie-Namen
4. TabContent mit FilterTable
5. Default-Tab: Erster in der Liste

---

### Phase 5: Store-Integration

**Dateien:**
- `frontend/src/components/videos/FilterTable.tsx` (erweitern)

**Aufgaben:**
1. `useFieldFilterStore` vollständig anbinden
2. Checkbox-Toggle → `addFilter`/`removeFilter`
3. Aktive Filter markieren (Checkbox checked)
4. Wert-Änderungen → `updateFilter`
5. Operator-Änderungen → `updateFilter`

---

### Phase 6: VideosPage Integration

**Dateien:**
- `frontend/src/components/VideosPage.tsx` (anpassen)

**Aufgaben:**
1. Import ändern: `FilterSettingsModal` statt `FilterPopover`
2. Props übergeben: `listId`, `selectedTagIds`
3. Alte FilterPopover-Zeile ersetzen (Zeile 866)

---

### Phase 7: Tests

**Dateien:**
- `frontend/src/components/videos/FilterSettingsModal.test.tsx` (NEU)
- `frontend/src/components/videos/FilterTable.test.tsx` (NEU)
- `frontend/src/hooks/useFiltersByCategory.test.ts` (NEU)

**Aufgaben:**
1. Hook-Tests: Kategorie-Gruppierung, Fallbacks
2. Komponenten-Tests: Modal öffnen/schließen, Tabs
3. Integration: Filter aktivieren/deaktivieren
4. Edge Cases: Keine Kategorien, kein Schema, leere Fields

---

### Phase 8: Cleanup

**Dateien:**
- `frontend/src/components/videos/FilterPopover.tsx` (löschen)
- `frontend/src/components/videos/FilterPopover.test.tsx` (löschen)

**Aufgaben:**
1. Alte FilterPopover-Dateien löschen oder zu `.deprecated` umbenennen
2. Keine Imports mehr auf alte Dateien prüfen
3. Git commit mit "refactor: replace FilterPopover with FilterSettingsModal"

---

## Phase 9: Testing Strategy

### Unit Tests

#### `useFiltersByCategory.test.ts`

| Test | Beschreibung |
|------|--------------|
| Keine Tags ausgewählt | Gibt CategoryFilters mit allen CustomFields zurück |
| Ein Tag ohne Schema | Gibt Kategorie mit leeren Fields zurück |
| Ein Tag mit Schema | Gibt Kategorie mit CustomFields zurück |
| Mehrere Tags | Gibt Array mit mehreren Kategorien zurück |
| Tag mit `is_video_type=false` | Wird ignoriert (nur Kategorien) |
| Schema loading states | Hook handled loading/error states korrekt |

#### `FilterTable.test.tsx`

| Test | Beschreibung |
|------|--------------|
| Rendert alle Felder | Zeigt Name, Typ, Operator für jedes Feld |
| Checkbox aktivieren | Ruft `addFilter` auf |
| Checkbox deaktivieren | Ruft `removeFilter` auf |
| Operator ändern | Ruft `updateFilter` auf |
| Wert ändern | Ruft `updateFilter` auf |
| Aktive Filter markiert | Checkbox ist checked für aktive Filter |

---

### Integration Tests

#### `FilterSettingsModal.test.tsx`

| Test | Beschreibung |
|------|--------------|
| Modal öffnen | Klick auf Button öffnet Modal |
| Modal schließen | X-Button und ESC schließen Modal |
| Eine Kategorie → keine Tabs | Tabs nicht gerendert |
| Mehrere Kategorien → Tabs | Tabs mit Kategorie-Namen |
| Tab-Wechsel | Zeigt korrekte Filter pro Tab |
| Filter aktivieren → FilterBar | Aktiver Filter erscheint in FilterBar |
| Keine Kategorien | Zeigt alle CustomFields |

---

### Regression Tests

| Test | Sicherstellen dass... |
|------|----------------------|
| FilterBar funktioniert | Aktive Filter werden angezeigt |
| Clear All funktioniert | Alle Filter werden entfernt |
| Video-Filterung | API wird mit korrekten Parametern aufgerufen |
| Existing filters | Bestehende activeFilters bleiben funktional |

---

### Test-Daten (Mocks)

```typescript
const mockCategories = [
  {
    id: 'cat-1',
    name: 'Tutorial',
    schema_id: 'schema-1',
    is_video_type: true
  },
  {
    id: 'cat-2',
    name: 'Podcast',
    schema_id: 'schema-2',
    is_video_type: true
  },
]

const mockSchemas = {
  'schema-1': {
    id: 'schema-1',
    name: 'Tutorial Schema',
    schema_fields: [
      {
        field_id: 'f1',
        field: {
          id: 'f1',
          name: 'Bewertung',
          field_type: 'rating',
          config: { max_rating: 5 }
        }
      },
      {
        field_id: 'f2',
        field: {
          id: 'f2',
          name: 'Sprache',
          field_type: 'select',
          config: { options: ['Deutsch', 'English'] }
        }
      },
    ]
  },
  'schema-2': {
    id: 'schema-2',
    name: 'Podcast Schema',
    schema_fields: [
      {
        field_id: 'f3',
        field: {
          id: 'f3',
          name: 'Notizen',
          field_type: 'text',
          config: {}
        }
      },
    ]
  },
}
```

---

## Phase 10: Atomic Steps

### Step 1: TypeScript Types definieren
**Datei:** `frontend/src/types/filterSettings.ts`
**Änderungen:** 1 neue Datei (~20 Zeilen)
**Test:** TypeScript kompiliert ohne Fehler

```typescript
export type CategoryFilters = {
  categoryId: string
  categoryName: string
  schemaId: string | null
  fields: CustomField[]
}
```

**Dauer:** 15 Minuten

---

### Step 2: Hook `useFiltersByCategory` - Grundgerüst
**Datei:** `frontend/src/hooks/useFiltersByCategory.ts`
**Änderungen:** 1 neue Datei (~30 Zeilen)
**Test:** Hook gibt leeres Array bei leeren selectedTagIds

**Dauer:** 20 Minuten

---

### Step 3: Hook - Tags laden und filtern
**Datei:** `frontend/src/hooks/useFiltersByCategory.ts`
**Änderungen:** ~20 Zeilen
**Test:** Hook filtert nur `is_video_type=true` Tags

**Dauer:** 20 Minuten

---

### Step 4: Hook - Schema für jeden Tag laden
**Datei:** `frontend/src/hooks/useFiltersByCategory.ts`
**Änderungen:** ~30 Zeilen
**Test:** Hook lädt Schema für jeden ausgewählten Tag

**Dauer:** 30 Minuten

---

### Step 5: Hook - CategoryFilters zusammenbauen
**Datei:** `frontend/src/hooks/useFiltersByCategory.ts`
**Änderungen:** ~30 Zeilen
**Test:** Hook gibt korrektes CategoryFilters[] zurück

**Dauer:** 25 Minuten

---

### Step 6: Hook - Fallback für keine Kategorien
**Datei:** `frontend/src/hooks/useFiltersByCategory.ts`
**Änderungen:** ~15 Zeilen
**Test:** Hook gibt alle CustomFields bei leeren selectedTagIds

**Dauer:** 15 Minuten

---

### Step 7: Hook Tests schreiben
**Datei:** `frontend/src/hooks/useFiltersByCategory.test.ts`
**Änderungen:** 1 neue Datei (~120 Zeilen)
**Test:** Alle Tests grün

**Dauer:** 45 Minuten

---

### Step 8: FilterSettingsModal - Button mit Settings Icon
**Datei:** `frontend/src/components/videos/FilterSettingsModal.tsx`
**Änderungen:** 1 neue Datei (~40 Zeilen)
**Test:** Button rendert mit Settings-Icon

**Dauer:** 20 Minuten

---

### Step 9: FilterSettingsModal - Dialog Grundgerüst
**Datei:** `frontend/src/components/videos/FilterSettingsModal.tsx`
**Änderungen:** ~50 Zeilen
**Test:** Modal öffnet und schließt

**Dauer:** 30 Minuten

---

### Step 10: FilterTable - Grundgerüst
**Datei:** `frontend/src/components/videos/FilterTable.tsx`
**Änderungen:** 1 neue Datei (~60 Zeilen)
**Test:** Tabelle rendert Feldnamen und Typen

**Dauer:** 30 Minuten

---

### Step 11: FilterTable - Checkbox + Store-Anbindung
**Datei:** `frontend/src/components/videos/FilterTable.tsx`
**Änderungen:** ~50 Zeilen
**Test:** Checkbox aktiviert/deaktiviert Filter im Store

**Dauer:** 40 Minuten

---

### Step 12: FilterTable - Operator Dropdown
**Datei:** `frontend/src/components/videos/FilterTable.tsx`
**Änderungen:** ~40 Zeilen
**Test:** Operator wird basierend auf Feldtyp angezeigt

**Dauer:** 35 Minuten

---

### Step 13: FilterTable - Wert-Input
**Datei:** `frontend/src/components/videos/FilterTable.tsx`
**Änderungen:** ~50 Zeilen
**Test:** Wert-Input basierend auf Feldtyp (rating/select/text/boolean)

**Dauer:** 45 Minuten

---

### Step 14: FilterSettingsModal - Tabs Integration
**Datei:** `frontend/src/components/videos/FilterSettingsModal.tsx`
**Änderungen:** ~60 Zeilen
**Test:** Tabs bei >1 Kategorie, keine Tabs bei 1 Kategorie

**Dauer:** 40 Minuten

---

### Step 15: VideosPage - Integration
**Datei:** `frontend/src/components/VideosPage.tsx`
**Änderungen:** ~5 Zeilen (Import + Props)
**Test:** Modal erscheint in VideosPage, Button funktioniert

**Dauer:** 10 Minuten

---

### Step 16: Komponenten-Tests
**Dateien:**
- `frontend/src/components/videos/FilterSettingsModal.test.tsx` (NEU)
- `frontend/src/components/videos/FilterTable.test.tsx` (NEU)

**Änderungen:** 2 neue Dateien (~180 Zeilen gesamt)
**Test:** Alle Tests grün

**Dauer:** 60 Minuten

---

### Step 17: Cleanup alte FilterPopover
**Dateien:**
- `frontend/src/components/videos/FilterPopover.tsx` (LÖSCHEN)
- `frontend/src/components/videos/FilterPopover.test.tsx` (LÖSCHEN)

**Änderungen:** 2 Dateien löschen
**Test:** Keine Imports mehr auf alte Dateien, Build erfolgreich

**Dauer:** 10 Minuten

---

**Gesamtdauer:** ~7-8 Stunden (reine Implementierung)

---

## Phase 11: Research & Validation

### Verwendete Patterns validiert ✓

| Pattern | Quelle | Validiert |
|---------|--------|-----------|
| Radix UI Dialog | Bereits im Projekt (`ui/dialog.tsx`) | ✓ |
| Radix UI Tabs | Bereits im Projekt (`ui/tabs.tsx`) | ✓ |
| Zustand Store | `fieldFilterStore.ts` | ✓ |
| React Query Hooks | `useSchemas.ts`, `useTags.ts` | ✓ |
| Lucide Icons | `lucide-react` (Settings) | ✓ |

### Architektur-Entscheidungen

#### 1. Mehrere `useSchema` Aufrufe vs. einmaliges Laden aller Schemas
- **Entscheidung:** Mehrere Aufrufe pro ausgewähltem Tag
- **Begründung:** React Query cached automatisch, Schemas werden parallel geladen
- **Alternative:** `useSchemas(listId)` und dann filtern - würde auch funktionieren, aber mehr Daten laden

#### 2. Neuer Hook vs. Inline-Logik
- **Entscheidung:** Neuer Hook `useFiltersByCategory`
- **Begründung:** Wiederverwendbar, testbar, saubere Trennung von UI und Logik

#### 3. FilterTable als eigene Komponente
- **Entscheidung:** Ja, separate Komponente
- **Begründung:** Wird in jedem Tab wiederverwendet, einfacher zu testen

#### 4. Fallback bei keinen Kategorien
- **Entscheidung:** Alle Filter zeigen
- **Begründung:**
  - User verliert keine Funktionalität
  - Realer Use Case: Video-übergreifendes Filtern
  - Kein frustrierender Blocker
  - Progressive Enhancement (mit/ohne Kategorien funktioniert)

### Bekannte Limitationen

| Limitation | Auswirkung | Workaround |
|------------|------------|------------|
| Viele Kategorien → viele API-Calls | Performance | React Query Caching mindert Impact |
| Keine Kategorie → alle Filter | Kann unübersichtlich sein | Später: Gruppierung nach Feldtyp möglich |
| Kein "Filter-Suche" im Modal | Bei vielen Filtern schwer zu finden | Später: Command-Palette-Style Suche |

### Performance-Überlegungen

- React Query cacht Schema-Anfragen automatisch
- Paralleles Laden mehrerer Schemas (nicht sequenziell)
- Modal lazy-loaded (nur wenn geöffnet)
- FilterTable rendert nur sichtbaren Tab

---

## Zusammenfassung

### Was wird gebaut:
Filter-Modal mit **Settings-Icon** (⚙️) statt Dropdown, zeigt CustomFields **gruppiert nach Kategorien in Tabs**.

### Technische Entscheidungen:
- **Hook:** `useFiltersByCategory` lädt Schemas pro ausgewählter Kategorie
- **Komponenten:** `FilterSettingsModal` + `FilterTable` (neu)
- **UI:** Radix Dialog + Tabs
- **Fallback:** Keine Kategorie → zeigt alle Filter (wie bisher)
- **Backward Compatible:** FilterBar + Store bleiben unverändert

### Aufwand:
- **17 atomare Steps** (~530 Zeilen Code)
- **5 neue Dateien:** Hook, Modal, Table, Types, Tests
- **1 Änderung:** VideosPage.tsx Import
- **2 Löschungen:** Alte FilterPopover Dateien

### Geschätzte Implementierungszeit:
**7-8 Stunden** (reine Coding-Zeit, ohne Review/Bugfixes)

---

## Nächste Schritte

1. **Branch erstellen:** `git checkout -b feature/filter-modal-redesign`
2. **Step 1 starten:** TypeScript Types definieren
3. **Schrittweise implementieren:** 17 Steps nacheinander
4. **Tests laufen lassen:** Nach jedem Step
5. **PR erstellen:** Nach Step 17 (Cleanup)

---

**Status:** ✅ Planning Complete - Ready for Implementation
