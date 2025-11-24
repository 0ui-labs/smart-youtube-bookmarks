# Research & Validation: YouTube-Kanäle Feature

## 1. YouTube API Verfügbarkeit

### channelId in Video-Response

**Validiert:** YouTube Data API v3 liefert `channelId` im `snippet` Teil.

```json
{
  "snippet": {
    "channelId": "UCX6OQ3DkcsbYNE6H8uQQuVA",
    "channelTitle": "MrBeast",
    "thumbnails": { ... }
  }
}
```

**Status:** ✅ Verfügbar ohne zusätzlichen API-Call

### Channel-Thumbnail

**Option A:** Aus Video-Response (nicht verfügbar)
- Video-Response enthält nur Video-Thumbnails, nicht Channel-Avatar

**Option B:** Separater channels.list API-Call
```
GET https://www.googleapis.com/youtube/v3/channels
?part=snippet
&id=UCX6OQ3DkcsbYNE6H8uQQuVA
```

**Empfehlung:** Channel-Avatare initial NICHT laden.
- Spart API-Quota
- Kann später nachgerüstet werden
- Default: nur Text-Anzeige

**Status:** ⚠️ Möglich, aber nicht in Phase 1

---

## 2. Datenbank-Design Validierung

### Gewählter Ansatz: Separate Channel-Tabelle

**Pro:**
- Saubere Normalisierung
- Eindeutige Beziehung (1:n)
- Einfache Queries mit JOIN
- Erweiterbar (Metadata, Settings pro Channel)

**Contra:**
- Zusätzlicher JOIN bei Video-Queries
- Migration für bestehende Videos nötig

### Alternative: Channel als JSON im Video

```python
# NICHT empfohlen
channel_info: Mapped[dict] = mapped_column(JSONB)
# {"id": "UC...", "name": "MrBeast", "thumbnail": "..."}
```

**Warum nicht:**
- Redundante Daten
- Schwer zu aktualisieren wenn Channel-Name sich ändert
- Keine referentielle Integrität
- Ineffiziente Queries

### Alternative: Channel als Tag (is_video_type)

**Warum nicht:**
- Tags sind n:m, Channels sind 1:n
- Tags sind user-created, Channels sind auto-created
- Unterschiedliche Semantik

**Fazit:** Gewählter Ansatz ist korrekt ✅

---

## 3. Frontend State Management

### Single-Select vs Multi-Select

**Validiert:** Single-Select ist korrekt für Channels
- Ein Video gehört zu genau einem Channel
- Multi-Select würde leere Ergebnisse liefern (AND-Logik)
- YouTube selbst nutzt Single-Select für Channel-Filter

### URL Parameter

**Validiert:** `?channel=uuid` ist konsistent mit:
- `?tags=name1,name2` (bestehend)
- `?sort_by=title` (bestehend)

**Alternative:** `?channel=UCX6...` (YouTube-ID statt UUID)

**Entscheidung:** UUID verwenden
- Konsistent mit anderen IDs im System
- Kürzer in URL
- YouTube-ID als Backup in DB gespeichert

---

## 4. Performance-Betrachtungen

### Channel-Liste laden

**Query:**
```sql
SELECT c.*, COUNT(v.id) as video_count
FROM channels c
LEFT JOIN videos v ON v.channel_id = c.id
WHERE c.user_id = ? AND c.is_hidden = false
GROUP BY c.id
ORDER BY c.name
```

**Erwartete Performance:**
- Mit 100 Channels: < 10ms
- Mit 1000 Channels: < 50ms
- Index auf `user_id` und `channel_id` vorhanden

**Optimierung (falls nötig):**
- Video-Count cachen (materialized view oder Trigger)
- Pagination einführen (> 100 Channels)

### Video-Filter mit Channel

**Query:**
```sql
SELECT * FROM videos
WHERE list_id = ?
  AND channel_id = ?
  AND (tag_filter OR field_filter)
```

**Performance:** Gleich wie bestehende Filter
- Index auf `channel_id` vorhanden
- Keine zusätzlichen JOINs nötig

---

## 5. Best Practices Vergleich

### YouTube Studio

YouTube selbst zeigt Channels in der Sidebar:
- ✅ Alphabetische Sortierung
- ✅ Video-Count als Badge
- ✅ Single-Select
- ✅ Klickbarer Channel-Name in Video-Liste

**Unser Design folgt diesen Patterns.**

### Pocket / Instapaper

Bookmark-Apps zeigen Source/Domain:
- ✅ Auto-Detection
- ✅ Filter by Source
- ❌ Kein Hide-Feature (wir haben es)

### Notion

Notion's Database-Views:
- ✅ Filter als Sidebar-Element
- ✅ Kombinierbare Filter
- ✅ URL-Persistenz

---

## 6. Security Considerations

### Authorization

**Validiert:**
- Channels sind user-scoped
- Jeder Query filtert nach `user_id`
- Keine Cross-User-Zugriffe möglich

```python
query = query.where(Channel.user_id == current_user.id)
```

### Input Validation

**channel_id aus YouTube:**
- Max 24 Zeichen
- Alphanumerisch + Underscore
- Wird als String gespeichert (VARCHAR 50)

**Validierung:**
```python
youtube_channel_id: str = Field(max_length=50)
```

---

## 7. Risiken und Mitigationen

### Risiko 1: YouTube ändert channelId Format

**Wahrscheinlichkeit:** Sehr niedrig
**Impact:** Mittel (Duplikate möglich)
**Mitigation:** Unique Constraint + Error Handling

### Risiko 2: Viele Channels (>100)

**Wahrscheinlichkeit:** Niedrig (Power User)
**Impact:** UI wird unübersichtlich
**Mitigation:**
- Scrollbare Liste (implementiert)
- Später: Suche/Filter für Channels
- Später: Gruppierung (Most Used, Recent)

### Risiko 3: Channel-Name ändert sich auf YouTube

**Wahrscheinlichkeit:** Mittel
**Impact:** Niedrig (nur Display)
**Mitigation:** Name wird beim nächsten Video-Add aktualisiert

---

## 8. Offene Entscheidungen

### Entschieden

| Frage | Entscheidung | Grund |
|-------|--------------|-------|
| Separate Tabelle vs. Tag | Separate Tabelle | Korrekte Kardinalität |
| UUID vs. YouTube-ID in URL | UUID | Konsistenz |
| Default Avatar | Aus | API-Quota sparen |
| Auto-Delete leere Channels | Ja | Sauberkeit |

### Offen (für spätere Iterationen)

| Frage | Optionen | Entscheidung bei |
|-------|----------|------------------|
| Channel-Suche in Sidebar | Suchfeld / Filter | >50 Channels |
| Channel-Statistiken | Views, Subscribers | User Request |
| Bulk-Import von Channels | YouTube Subscriptions | User Request |
| Channel-Avatar aus API | Lazy Load | Performance-Test |

---

## 9. Validierungs-Checkliste

### Architektur
- [x] Datenbank-Design ist normalisiert
- [x] API folgt RESTful Patterns
- [x] Frontend State ist minimal
- [x] Keine zirkulären Abhängigkeiten

### Kompatibilität
- [x] Bestehende APIs unverändert
- [x] Migration ist non-breaking
- [x] localStorage wird gemerged
- [x] Rollback-Plan existiert

### Performance
- [x] Queries haben Indizes
- [x] Keine N+1 Queries
- [x] Caching-Strategie definiert

### Security
- [x] Authorization auf allen Endpoints
- [x] Input Validation
- [x] Kein Data Leakage

### UX
- [x] Konsistent mit bestehendem Design
- [x] Accessibility berücksichtigt
- [x] Mobile-responsive
- [x] URL-Persistenz

---

## 10. Fazit

**Technischer Ansatz ist validiert und empfohlen.**

Die gewählte Architektur (separate Channel-Tabelle, Single-Select Filter, Auto-Create) ist:
- Technisch sauber
- Performance-optimiert
- Erweiterbar
- Konsistent mit Best Practices

**Bereit für Implementierung.**
