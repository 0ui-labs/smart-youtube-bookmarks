# Backward Compatibility: Robust Video Import

## Compatibility Garantien

Dieses Feature ist **100% abwärtskompatibel**:
- Bestehende Videos funktionieren unverändert
- Bestehende API-Contracts bleiben intakt
- Frontend funktioniert ohne WebSocket (Graceful Degradation)
- Keine Breaking Changes an Datenstrukturen

## Kompatibilitäts-Matrix

### API Endpoints

| Endpoint | Änderung | Bestehende Clients |
|----------|----------|-------------------|
| `POST /videos` | Response hat neue optionale Felder | ✅ Ignorieren neue Felder |
| `GET /videos` | Response hat neue optionale Felder | ✅ Ignorieren neue Felder |
| `GET /videos/{id}/enrichment` | Unverändert | ✅ Keine Änderung |
| `WS /ws/progress` | Neue Message-Types | ✅ Unbekannte Types ignoriert |

**Response-Erweiterungen:**
```json
// Bisherige Response
{
  "id": "...",
  "youtube_id": "...",
  "title": "...",
  "processing_status": "completed"
}

// Neue Response (additiv)
{
  "id": "...",
  "youtube_id": "...",
  "title": "...",
  "processing_status": "completed",
  "import_progress": 100,        // NEU, optional
  "import_stage": "complete"     // NEU, optional
}
```

### Datenbank

| Tabelle | Änderung | Migration |
|---------|----------|-----------|
| `videos` | 2 neue nullable Spalten | Non-Breaking |
| `video_enrichments` | Optional: 1 neues Feld | Non-Breaking |

**Migration-Script:**
```sql
-- Diese Migration ist NON-BREAKING weil:
-- 1. Felder sind NULLABLE (kein NOT NULL)
-- 2. Felder haben DEFAULT-Werte
-- 3. Bestehende Rows werden nicht verändert

ALTER TABLE videos
  ADD COLUMN import_progress INTEGER DEFAULT 100;
  -- Default 100 = bestehende Videos sind "fertig importiert"

ALTER TABLE videos
  ADD COLUMN import_stage VARCHAR(20) DEFAULT 'complete';
  -- Default 'complete' = bestehende Videos sind vollständig
```

### Frontend Components

| Component | Änderung | Ohne WebSocket |
|-----------|----------|----------------|
| VideoCard | Neue optionale Props | ✅ Zeigt Video normal an |
| VideoGrid | Unverändert | ✅ Funktioniert |
| ProgressOverlay | Neu, optional | ✅ Wird nicht gerendert |

**Graceful Degradation:**
```typescript
// VideoCard funktioniert OHNE importProgress
function VideoCard({ video, importProgress }: Props) {
  // Wenn kein importProgress → normales Rendering
  const isImporting = importProgress?.progress !== undefined
    && importProgress.progress < 100

  if (!isImporting) {
    // Bestehende Logik - unverändert
    return <ExistingVideoCard video={video} />
  }

  // Neue Import-Logik
  return <ImportingVideoCard video={video} progress={importProgress} />
}
```

### WebSocket

| Szenario | Verhalten |
|----------|-----------|
| WebSocket nicht verbunden | Polling-Fallback via useVideoEnrichment |
| Unbekannter Message-Type | Wird ignoriert |
| Alte Frontend-Version | Ignoriert neue Messages |

**Fallback-Strategie:**
```typescript
// useImportProgress.ts
function useImportProgress(videoId: string) {
  const { isConnected, subscribe } = useWebSocket()
  const [progress, setProgress] = useState<ImportProgress | null>(null)

  // WebSocket-Updates
  useEffect(() => {
    if (isConnected) {
      return subscribe(videoId, setProgress)
    }
  }, [videoId, isConnected])

  // Fallback: Polling wenn kein WebSocket
  const { data: enrichment } = useVideoEnrichment(videoId, {
    enabled: !isConnected,  // Nur wenn WS nicht verbunden
    refetchInterval: 2000
  })

  // Kombinierte Logik
  if (isConnected && progress) {
    return progress
  }

  // Fallback auf Polling-Daten
  if (enrichment) {
    return {
      progress: enrichment.status === 'completed' ? 100 : 50,
      stage: enrichment.status
    }
  }

  return null
}
```

## Risiko-Analyse

### Breaking Change Risiken

| Risiko | Wahrscheinlichkeit | Mitigation |
|--------|-------------------|------------|
| API-Response Parsing bricht | Sehr niedrig | JSON ignoriert unbekannte Felder |
| DB Migration schlägt fehl | Niedrig | Nullable + Defaults |
| WebSocket stört bestehende Logik | Niedrig | Separater Hook, opt-in |
| Frontend Crash | Sehr niedrig | Optional Chaining überall |

### Test-Plan für Kompatibilität

```gherkin
Feature: Backward Compatibility

  Scenario: Bestehende Videos unverändert
    Given Ein Video das vor dem Feature importiert wurde
    When Ich das Video im Grid ansehe
    Then Zeigt es normale Darstellung (kein Overlay)
    And Alle Funktionen (Play, Edit, Delete) funktionieren

  Scenario: API ohne neue Felder
    Given Ein Client der alte API-Response erwartet
    When Er POST /videos aufruft
    Then Response enthält alle bisherigen Felder
    And Neue Felder werden ignoriert (keine Exceptions)

  Scenario: Frontend ohne WebSocket
    Given WebSocket ist nicht verbunden
    When Ein Video importiert wird
    Then Polling-Fallback zeigt Progress
    And Video erscheint nach Completion

  Scenario: Migration auf bestehender DB
    Given Datenbank mit 1000 bestehenden Videos
    When Migration läuft
    Then Alle Videos haben import_progress=100
    And Alle Videos haben import_stage='complete'
    And Keine Downtime
```

## Kompatibilitäts-Checkliste

- [x] API Response Format: Additiv, kein Breaking Change
- [x] DB Migration: Nullable Felder mit Defaults
- [x] Frontend Props: Optional, undefined-safe
- [x] WebSocket: Neue Message-Types, alte ignoriert
- [x] Fallback: Polling wenn WebSocket nicht verfügbar
- [x] Feature-Flag: Kann deaktiviert werden
- [x] Rollback: Migration umkehrbar

## Graceful Degradation Szenarien

### Szenario 1: WebSocket Server Down
```
Frontend → Versucht WS-Connect
       → Timeout nach 5s
       → Fallback auf Polling
       → User sieht Progress (langsamer, aber funktioniert)
```

### Szenario 2: Groq API Down
```
Backend → yt-dlp versucht Captions
       → 3 Retries mit Backoff
       → Groq Fallback
       → Groq nicht erreichbar
       → Video ohne Captions importiert
       → User-Nachricht: "Untertitel konnten nicht geladen werden"
       → Video ist trotzdem nutzbar
```

### Szenario 3: Rate Limiting
```
Backend → YouTube gibt 429 zurück
       → Circuit Breaker öffnet
       → 30s Cooldown
       → Retry
       → User sieht: Videos bleiben bei 60% für ~30s
       → Dann weiter
       → Keine Fehlermeldung an User
```

## Exit Condition ✅

**Bestehende User sind unaffected?**

> - Bestehende Videos: 100% unverändert (Defaults setzen import_progress=100)
> - API-Contracts: Nur additive Änderungen
> - Frontend: Graceful Degradation wenn WebSocket fehlt
> - Rollback: Jederzeit möglich via Feature Flag
> - Migration: Non-Breaking, umkehrbar

✅ Backward Compatibility sichergestellt, bereit für Phase 6.
