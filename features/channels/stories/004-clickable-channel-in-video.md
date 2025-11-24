# User Story 004: Klickbarer Kanal in Video-Items

**Als** Nutzer der App
**möchte ich** in der Video-Liste auf den Kanalnamen klicken können
**damit** ich schnell alle Videos dieses Kanals sehen kann, ohne die Sidebar zu nutzen

## Akzeptanzkriterien

- [ ] Kanalname in List-View ist klickbar
- [ ] Kanalname in Grid-View ist klickbar
- [ ] Klick aktiviert Channel-Filter (wie Sidebar-Klick)
- [ ] Hover zeigt visuelles Feedback (Underline, Farbe)
- [ ] Klick propagiert NICHT zum Video-Row-Click

## UX Flow

```
1. User sieht Video-Liste/Grid

2. Video-Item zeigt:
   ┌─────────────────────────────────────┐
   │ [Thumbnail] │ Video Title           │
   │             │ MrBeast  ← klickbar   │
   │             │ 12:34                 │
   └─────────────────────────────────────┘

3. User klickt auf "MrBeast"
   ├── Channel-Filter wird aktiviert
   ├── URL aktualisiert: ?channel=uuid
   └── Sidebar zeigt MrBeast als selected

4. Video-Row-Click wird NICHT ausgelöst
   (sonst würde Modal/Page öffnen)
```

## Technische Details

### List-View (VideosPage.tsx)

**Aktuell (Zeile ~501-504):**
```tsx
{channel && (
  <span className="text-sm text-gray-600 truncate">
    {channel}
  </span>
)}
```

**Neu:**
```tsx
{video.channel_id && (
  <button
    onClick={(e) => {
      e.stopPropagation();  // Verhindert Row-Click
      selectChannel(video.channel_id);
    }}
    className="text-sm text-gray-600 hover:text-blue-600 hover:underline truncate transition-colors"
  >
    {video.channel}
  </button>
)}
```

### Grid-View (VideoCard.tsx)

```tsx
<div className="video-card-meta">
  <button
    onClick={(e) => {
      e.stopPropagation();
      onChannelClick?.(video.channel_id);
    }}
    className="text-sm text-gray-500 hover:text-blue-600 hover:underline"
  >
    {video.channel}
  </button>
</div>
```

### Props Erweiterung

```typescript
// VideoGrid.tsx
interface VideoGridProps {
  videos: VideoResponse[];
  onDeleteVideo: (video: VideoResponse) => void;
  onVideoClick: (video: VideoResponse) => void;
  onChannelClick: (channelId: string) => void;  // NEU
}

// VideoCard.tsx
interface VideoCardProps {
  video: VideoResponse;
  onDelete: () => void;
  onClick: () => void;
  onChannelClick?: (channelId: string) => void;  // NEU
}
```

## UI Spezifikation

### Kanal-Link States

| State | Styling |
|-------|---------|
| Default | `text-gray-600` |
| Hover | `text-blue-600 underline` |
| Active/Click | `text-blue-700` |

### Cursor
```css
cursor: pointer;
```

### Event Handling
```typescript
onClick={(e) => {
  e.stopPropagation();  // KRITISCH: Verhindert Video-Click
  e.preventDefault();
  selectChannel(channelId);
}}
```

## Edge Cases

| Szenario | Verhalten |
|----------|-----------|
| Video hat kein channel_id | Kanalname als normaler Text (nicht klickbar) |
| Kanal-Name sehr lang | Truncation mit "..." |
| Klick während API-Call | Debounce/Loading-State |

## Accessibility

```tsx
<button
  onClick={handleChannelClick}
  aria-label={`Filter by channel ${channelName}`}
  className="..."
>
  {channelName}
</button>
```

## Abhängigkeiten

- Story 003 (Channel Filter) muss implementiert sein
- channelStore muss existieren
