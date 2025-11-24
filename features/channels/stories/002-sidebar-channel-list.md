# User Story 002: Kanal-Liste in Sidebar

**Als** Nutzer der App
**möchte ich** alle meine Kanäle in der Sidebar sehen
**damit** ich schnell einen Überblick habe, von welchen Kanälen ich Videos gespeichert habe

## Akzeptanzkriterien

- [ ] Neue Sektion "Kanäle" in der Sidebar (unter/über Kategorien)
- [ ] Alle Kanäle des Users werden aufgelistet
- [ ] Neben jedem Kanal steht die Anzahl der Videos als Badge
- [ ] Versteckte Kanäle werden nicht angezeigt
- [ ] Kanäle sind alphabetisch oder nach Video-Count sortiert

## UX Flow

```
1. User öffnet VideosPage
   └── Sidebar lädt Kanäle via GET /channels

2. Sidebar zeigt:
   ┌─────────────────────────┐
   │ Kategorien              │
   │ ├── Tutorial (5)        │
   │ ├── Entertainment (3)   │
   │ └── + Neue Kategorie    │
   ├─────────────────────────┤
   │ Kanäle                  │  ← NEU
   │ ├── MrBeast (12)        │
   │ ├── Fireship (8)        │
   │ └── ThePrimeagen (4)    │
   ├─────────────────────────┤
   │ ⚙️ Einstellungen        │
   └─────────────────────────┘

3. Bei Klick auf Kanal → Filter aktivieren (Story 003)
```

## Technische Details

### Frontend Component: ChannelNavigation
```tsx
interface ChannelNavigationProps {
  channels: Channel[];
  selectedChannelId: string | null;
  onChannelSelect: (channelId: string) => void;
  showAvatars: boolean;
}

// Ähnlich wie TagNavigation, aber:
// - Single-Select statt Multi-Select
// - Kein "+" Button (Channels werden automatisch erstellt)
// - Optional: Avatare anzeigen
```

### API Response
```json
GET /channels
{
  "channels": [
    {
      "id": "uuid",
      "name": "MrBeast",
      "youtube_channel_id": "UCX6OQ3DkcsbYNE6H8uQQuVA",
      "thumbnail_url": "https://...",
      "video_count": 12,
      "is_hidden": false
    }
  ]
}
```

## UI Spezifikation

### Kanal-Item
```
┌─────────────────────────────────┐
│ [Avatar] Kanalname        (12)  │
└─────────────────────────────────┘
   │         │               │
   │         │               └── Video-Count Badge
   │         └── Truncated wenn zu lang
   └── Optional, 24x24px, rund
```

### Zustände
- **Default:** Hintergrund transparent
- **Hover:** Leicht grauer Hintergrund
- **Selected:** Accent-Farbe Hintergrund

## Edge Cases

| Szenario | Verhalten |
|----------|-----------|
| Keine Kanäle vorhanden | Sektion "Kanäle" wird nicht angezeigt |
| Sehr viele Kanäle (>20) | Scrollbar innerhalb der Sektion |
| Kanal mit sehr langem Namen | Truncation mit "..." |
| Video-Count = 0 | Kanal nicht anzeigen (sollte nicht vorkommen) |

## Abhängigkeiten

- Story 001 (Auto-Channel-Creation) muss implementiert sein
- GET /channels API Endpoint muss existieren
