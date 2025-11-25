# Video Enrichment - Backward Compatibility

## Kompatibilitäts-Checkliste

| Bereich | Risiko | Status | Maßnahme |
|---------|--------|--------|----------|
| API Contracts | ✅ Kein Risiko | Sicher | Neue Endpoints, keine Änderungen |
| Database Schema | ✅ Kein Risiko | Sicher | Additive Migration |
| Video Model | ✅ Kein Risiko | Sicher | Keine Änderungen am Model |
| Frontend | ✅ Kein Risiko | Sicher | Optional Props, Graceful Handling |
| Worker System | ✅ Kein Risiko | Sicher | Neue Funktion, keine Änderungen |
| Video Playback | ✅ Kein Risiko | Sicher | Funktioniert ohne Enrichment |

---

## 1. API Kompatibilität

### Bestehende Endpoints - KEINE Änderungen

| Endpoint | Änderung | Impact |
|----------|----------|--------|
| `POST /api/lists/{id}/videos` | Keine | Video-Import unverändert |
| `GET /api/lists/{id}/videos` | Keine | Video-Liste unverändert |
| `GET /api/videos/{id}` | Keine | Video-Details unverändert |
| `PUT /api/videos/{id}/watch-progress` | Keine | Watch Progress unverändert |

### Neue Endpoints - Additiv

| Endpoint | Typ | Beschreibung |
|----------|-----|--------------|
| `GET /api/videos/{id}/enrichment` | NEU | Enrichment-Daten abrufen |
| `POST /api/videos/{id}/enrichment/retry` | NEU | Retry bei Fehler |

**Garantie:** Alle bestehenden API-Consumers funktionieren ohne Änderung.

---

## 2. Datenbank-Kompatibilität

### Migration ist additiv

```sql
-- Migration: add_video_enrichments

CREATE TABLE video_enrichments (
    id UUID PRIMARY KEY,
    video_id UUID REFERENCES videos(id) ON DELETE CASCADE,
    -- ... weitere Felder
);

-- Keine Änderungen an bestehenden Tabellen!
```

### Rollback möglich

```sql
-- Rollback: drop_video_enrichments
DROP TABLE IF EXISTS video_enrichments;
```

**Garantie:**
- Videos-Tabelle bleibt unverändert
- Bestehende Daten bleiben intakt
- Migration kann rückgängig gemacht werden

---

## 3. Video Model Kompatibilität

### Kein Breaking Change

```python
# Video Model - KEINE Änderungen
class Video(Base):
    # Alle bestehenden Felder bleiben
    pass

# VideoEnrichment ist SEPARATES Model mit Relationship
class VideoEnrichment(Base):
    video_id = Column(UUID, ForeignKey('videos.id'))
    video = relationship('Video', backref=backref('enrichment', uselist=False))
```

### Optional Relationship

```python
# Video.enrichment ist optional (kann None sein)
video = await db.get(Video, video_id)
if video.enrichment:
    # Enrichment vorhanden
    pass
else:
    # Kein Enrichment - Video funktioniert trotzdem
    pass
```

---

## 4. Frontend Kompatibilität

### VideoPlayer Props sind optional

```typescript
// Aktuell (funktioniert weiterhin)
<VideoPlayer
  youtubeId="abc123"
  videoId="uuid"
/>

// Neu (optionale Props)
<VideoPlayer
  youtubeId="abc123"
  videoId="uuid"
  textTracks={enrichment?.textTracks}  // Optional
  thumbnailsVtt={enrichment?.thumbnails?.vtt_url}  // Optional
/>
```

### Graceful Handling im Hook

```typescript
// useVideoEnrichment.ts

export function useVideoEnrichment(videoId: string | undefined) {
  return useQuery({
    queryKey: ['video-enrichment', videoId],
    queryFn: async () => {
      if (!videoId) return null  // Kein Video = kein Enrichment

      try {
        const { data } = await api.get(`/videos/${videoId}/enrichment`)
        return data
      } catch (error) {
        if (error.response?.status === 404) {
          return null  // Kein Enrichment vorhanden = OK
        }
        throw error
      }
    },
    enabled: !!videoId,
  })
}
```

### VideoDetailsPage - Backward Compatible

```typescript
// Bestehender Code funktioniert weiterhin
const { data: video } = useVideo(videoId)

// Neuer Code ist optional
const { data: enrichment } = useVideoEnrichment(videoId)

// VideoPlayer funktioniert mit oder ohne Enrichment
<VideoPlayer
  youtubeId={video.youtubeId}
  videoId={video.id}
  // Enrichment nur wenn vorhanden
  {...(enrichment && {
    textTracks: buildTextTracks(enrichment),
    thumbnailsVtt: enrichment.thumbnails?.vtt_url
  })}
/>
```

---

## 5. Worker System Kompatibilität

### Bestehende Worker unberührt

```python
# settings.py

class WorkerSettings:
    functions = [
        process_video,       # Unverändert
        process_video_list,  # Unverändert
        enrich_video,        # NEU - additiv
    ]
```

### Unabhängige Queues (optional für Zukunft)

```python
# Aktuell: Alle Jobs in einer Queue (ausreichend)
# Zukunft: Separate Queues für Prioritäten

class WorkerSettings:
    queue_name = 'arq:default'  # Standard
    # Später: 'arq:enrichment' für niedrigere Priorität
```

---

## 6. Video Playback Kompatibilität

### Video funktioniert immer

| Szenario | Verhalten |
|----------|-----------|
| Enrichment `pending` | Video spielt, keine Untertitel |
| Enrichment `processing` | Video spielt, "Wird verarbeitet" Badge |
| Enrichment `completed` | Video spielt MIT Untertiteln |
| Enrichment `failed` | Video spielt, "Fehler" Badge + Retry |
| Kein Enrichment-Record | Video spielt normal |

### Kein Blocking

```typescript
// Video-Daten und Enrichment-Daten sind unabhängig
const { data: video, isLoading: videoLoading } = useVideo(videoId)
const { data: enrichment } = useVideoEnrichment(videoId)

// Video wird angezeigt sobald video-Daten da sind
// Enrichment kommt asynchron nach (oder nie)
if (videoLoading) return <Loading />
if (!video) return <NotFound />

// Render Video - Enrichment ist optional
return <VideoPlayer {...video} enrichment={enrichment} />
```

---

## 7. Bestehende Tests

### Keine Test-Änderungen nötig

| Test-Suite | Änderung |
|------------|----------|
| `tests/api/test_videos.py` | Keine |
| `tests/api/test_lists.py` | Keine |
| `tests/workers/test_processor.py` | Keine |

### Neue Tests additiv

| Neue Test-Datei | Inhalt |
|-----------------|--------|
| `tests/services/test_enrichment.py` | EnrichmentService Tests |
| `tests/api/test_enrichment.py` | API Endpoint Tests |
| `tests/workers/test_enrichment.py` | Worker Tests |

---

## 8. Feature Toggle (Sicherheitsnetz)

### Einfaches Flag für Rollout

```python
# config.py
class Settings:
    enrichment_enabled: bool = Field(default=True, env='ENRICHMENT_ENABLED')

# videos.py - Video Import
if settings.enrichment_enabled:
    await arq_pool.enqueue_job('enrich_video', str(video.id))

# enrichment.py - API
@router.get("/{video_id}/enrichment")
async def get_enrichment(video_id: UUID):
    if not settings.enrichment_enabled:
        raise HTTPException(503, "Enrichment temporarily disabled")
    ...
```

### Schnelles Disable bei Problemen

```bash
# In Production: Sofort deaktivieren
ENRICHMENT_ENABLED=false

# Restart API + Worker
# → Alle neuen Videos bekommen kein Enrichment
# → Bestehende Videos funktionieren weiter
```

---

## 9. Rollback-Strategie

### Bei Problemen nach Deployment

1. **Feature Flag deaktivieren**
   ```bash
   ENRICHMENT_ENABLED=false
   ```

2. **Worker neu starten** (beendet laufende Jobs)
   ```bash
   supervisorctl restart arq-worker
   ```

3. **Optional: Migration zurückrollen**
   ```bash
   alembic downgrade -1
   ```

4. **Optional: Enrichment-Daten löschen**
   ```sql
   TRUNCATE video_enrichments;
   ```

### Recovery

- Videos sind NICHT betroffen
- API funktioniert normal
- Nur Enrichment-Feature ist weg
- Kann jederzeit wieder aktiviert werden

---

## Zusammenfassung

| Kompatibilitäts-Garantie | ✅ Status |
|--------------------------|----------|
| Bestehende API funktioniert | ✅ |
| Bestehende UI funktioniert | ✅ |
| Videos spielen ohne Enrichment | ✅ |
| Datenbank-Rollback möglich | ✅ |
| Feature kann deaktiviert werden | ✅ |
| Keine Breaking Changes | ✅ |

---

**Exit Condition:** ✅ Bestehende User sind nicht betroffen
**Nächste Phase:** User Stories
