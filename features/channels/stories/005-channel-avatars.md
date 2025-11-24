# User Story 005: Kanal-Avatare (Optional)

**Als** Nutzer der App
**möchte ich** optional Kanal-Avatare in der Sidebar anzeigen lassen
**damit** ich Kanäle schneller visuell erkennen kann

## Akzeptanzkriterien

- [ ] Per Default: Nur Kanalname (keine Avatare)
- [ ] In Settings: Toggle "Kanal-Avatare anzeigen"
- [ ] Aktiviert: 24x24px rundes Avatar-Bild vor Kanalname
- [ ] Avatar wird aus YouTube-Thumbnail geladen
- [ ] Fallback bei fehlendem/fehlerhaftem Bild

## UX Flow

```
1. Default: Nur Text
   ┌─────────────────────────────────┐
   │ Kanäle                          │
   │ ├── MrBeast (12)                │
   │ ├── Fireship (8)                │
   └─────────────────────────────────┘

2. User geht zu Settings → aktiviert "Kanal-Avatare"

3. Sidebar zeigt jetzt:
   ┌─────────────────────────────────┐
   │ Kanäle                          │
   │ ├── [🔵] MrBeast (12)           │
   │ ├── [🟠] Fireship (8)           │
   └─────────────────────────────────┘
        │
        └── 24x24px, rund
```

## Technische Details

### Settings Store Erweiterung

```typescript
// tableSettingsStore.ts
interface TableSettingsStore {
  // ... existing
  showChannelAvatars: boolean;
  setShowChannelAvatars: (show: boolean) => void;
}

// Default
showChannelAvatars: false,

// Action
setShowChannelAvatars: (show) => set({ showChannelAvatars: show }),
```

### ChannelNavigation Component

```tsx
interface ChannelNavigationProps {
  channels: Channel[];
  selectedChannelId: string | null;
  onChannelSelect: (channelId: string) => void;
  showAvatars: boolean;  // Von Settings
}

const ChannelNavigation = ({ channels, showAvatars, ... }) => (
  <div>
    {channels.map((channel) => (
      <button key={channel.id} onClick={() => onChannelSelect(channel.id)}>
        {showAvatars && (
          <ChannelAvatar
            src={channel.thumbnail_url}
            name={channel.name}
          />
        )}
        <span>{channel.name}</span>
        <span>({channel.video_count})</span>
      </button>
    ))}
  </div>
);
```

### ChannelAvatar Component

```tsx
const ChannelAvatar = ({ src, name }: { src: string | null; name: string }) => {
  const [hasError, setHasError] = useState(false);

  // Fallback: Erster Buchstabe des Kanalnamens
  if (!src || hasError) {
    return (
      <div className="w-6 h-6 rounded-full bg-gray-300 flex items-center justify-center text-xs font-medium">
        {name.charAt(0).toUpperCase()}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={`${name} avatar`}
      className="w-6 h-6 rounded-full object-cover"
      onError={() => setHasError(true)}
    />
  );
};
```

### Settings UI

```tsx
// In SettingsPage.tsx oder eigene Settings-Sektion
<div className="setting-item">
  <label>
    <input
      type="checkbox"
      checked={showChannelAvatars}
      onChange={(e) => setShowChannelAvatars(e.target.checked)}
    />
    Kanal-Avatare in Sidebar anzeigen
  </label>
  <p className="text-sm text-gray-500">
    Zeigt kleine Profilbilder neben den Kanalnamen
  </p>
</div>
```

## UI Spezifikation

### Avatar Styling
```css
/* Avatar Container */
width: 24px;
height: 24px;
border-radius: 50%;
overflow: hidden;

/* Image */
object-fit: cover;
width: 100%;
height: 100%;

/* Fallback (Initial) */
background-color: #d1d5db; /* gray-300 */
display: flex;
align-items: center;
justify-content: center;
font-size: 12px;
font-weight: 500;
color: #4b5563; /* gray-600 */
```

### Layout mit Avatar
```
┌─────────────────────────────────┐
│ [24x24] Kanalname         (12)  │
│   │      │                 │    │
│   │      │                 │    │
│   │      └── flex-1        │    │
│   └── gap-2                │    │
│                            └── ml-auto
└─────────────────────────────────┘
```

## Edge Cases

| Szenario | Verhalten |
|----------|-----------|
| Kein thumbnail_url | Fallback: Initial-Buchstabe |
| Bild lädt nicht | onError → Fallback anzeigen |
| Sehr langsame Verbindung | Placeholder während Laden |
| thumbnail_url ist 404 | Fallback anzeigen |

## YouTube Thumbnail URLs

YouTube liefert Kanal-Thumbnails in verschiedenen Größen:
- `default`: 88x88px
- `medium`: 240x240px
- `high`: 800x800px

Für 24x24px Display: `default` Größe ausreichend und schnell.

## Abhängigkeiten

- Story 002 (Sidebar Channel List) muss implementiert sein
- Channel.thumbnail_url muss im Backend gespeichert werden
