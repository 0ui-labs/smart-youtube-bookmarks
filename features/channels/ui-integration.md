# UI-Integration Plan: YouTube-Kanäle

## Überblick

Das Channel-Feature fügt sich nahtlos in die bestehende UI ein:
- Sidebar: Neue Sektion "Kanäle"
- Video-Items: Klickbare Kanalnamen
- Settings: Avatar-Toggle + Hidden Channels Management

## Design-System Konformität

### Verwendete UI-Komponenten (shadcn/ui)
- `Button` - Für Kanal-Buttons in Sidebar
- `DropdownMenu` - Für Kanal-Kontext-Menü (Ausblenden)
- `Switch` - Für Avatar-Toggle in Settings
- `Badge` - Für Video-Count (optional)

### Tailwind Klassen (konsistent mit bestehendem Code)
```css
/* Sidebar Items */
hover:bg-accent
bg-accent font-medium  /* Selected */

/* Text Colors */
text-gray-600  /* Secondary text */
text-blue-600  /* Links/Hover */

/* Spacing */
px-3 py-2  /* Item padding */
gap-2  /* Element spacing */
```

## Sidebar Layout

### Aktuelle Struktur
```
┌─────────────────────────────────┐
│ Kategorien           [+]        │
├─────────────────────────────────┤
│ Tutorial                        │
│ Entertainment                   │
│ Music                           │
├─────────────────────────────────┤
│ ⚙️ Einstellungen                │
└─────────────────────────────────┘
```

### Neue Struktur mit Kanälen
```
┌─────────────────────────────────┐
│ Kategorien           [+]        │
├─────────────────────────────────┤
│ Tutorial                        │
│ Entertainment                   │
│ Music                           │
├─────────────────────────────────┤
│ Kanäle                          │  ← NEU
├─────────────────────────────────┤
│ MrBeast (12)              [⋮]  │
│ Fireship (8)              [⋮]  │
│ ThePrimeagen (4)          [⋮]  │
├─────────────────────────────────┤
│ ⚙️ Einstellungen                │
└─────────────────────────────────┘
```

## Component Hierarchie

```
VideosPage.tsx
└── CollapsibleSidebar
    ├── TagNavigation          (bestehend)
    │   └── Tag Items
    │
    ├── ChannelNavigation      (NEU)
    │   ├── Section Header "Kanäle"
    │   └── Channel Items
    │       ├── ChannelAvatar (optional)
    │       ├── Channel Name
    │       ├── Video Count Badge
    │       └── ContextMenu
    │
    └── Settings Button        (bestehend)
```

## ChannelNavigation Component

### Props Interface
```typescript
interface ChannelNavigationProps {
  channels: Channel[];
  selectedChannelId: string | null;
  onChannelSelect: (channelId: string) => void;
  showAvatars: boolean;
  isLoading?: boolean;
}
```

### JSX Struktur
```tsx
export const ChannelNavigation = ({
  channels,
  selectedChannelId,
  onChannelSelect,
  showAvatars,
  isLoading,
}: ChannelNavigationProps) => {
  // Keine Anzeige wenn keine Channels
  if (channels.length === 0 && !isLoading) {
    return null;
  }

  return (
    <div className="channel-navigation p-4 border-t">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 px-3">
        <h2 className="text-lg font-semibold">Kanäle</h2>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="px-3 text-sm text-gray-500">Lädt Kanäle...</div>
      )}

      {/* Channel List */}
      <div className="space-y-1">
        {channels.map((channel) => (
          <ChannelItem
            key={channel.id}
            channel={channel}
            isSelected={selectedChannelId === channel.id}
            onSelect={() => onChannelSelect(channel.id)}
            showAvatar={showAvatars}
          />
        ))}
      </div>
    </div>
  );
};
```

## ChannelItem Component

### Visuelle Spezifikation
```
┌─────────────────────────────────────────┐
│ [●] Channel Name                  (12) [⋮]│
│  │       │                         │    │ │
│  │       │                         │    │ └─ Context Menu (hover)
│  │       │                         │    └─── Video Count
│  │       └─────────────────────────└────── flex-1, truncate
│  └── Avatar (24x24, optional)
└─────────────────────────────────────────┘
```

### Zustände

| State | Background | Font | Avatar Border |
|-------|------------|------|---------------|
| Default | transparent | normal | none |
| Hover | `bg-accent/50` | normal | none |
| Selected | `bg-accent` | `font-medium` | `ring-2` |
| Loading | `bg-gray-100` | `text-gray-400` | `opacity-50` |

### JSX
```tsx
const ChannelItem = ({
  channel,
  isSelected,
  onSelect,
  showAvatar,
}: ChannelItemProps) => {
  const hideChannel = useHideChannel();

  return (
    <div className="group relative flex items-center">
      <button
        onClick={onSelect}
        aria-pressed={isSelected}
        aria-label={`Kanal ${channel.name} ${isSelected ? 'abwählen' : 'auswählen'}`}
        className={cn(
          'w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors',
          'hover:bg-accent/50',
          isSelected && 'bg-accent font-medium'
        )}
      >
        {/* Avatar (optional) */}
        {showAvatar && (
          <ChannelAvatar src={channel.thumbnail_url} name={channel.name} />
        )}

        {/* Name */}
        <span className="flex-1 text-left truncate">{channel.name}</span>

        {/* Video Count */}
        <span className="text-xs text-gray-500">({channel.video_count})</span>
      </button>

      {/* Context Menu */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className="absolute right-2 opacity-0 group-hover:opacity-100 p-1 hover:bg-gray-200 rounded"
            aria-label={`Menü für ${channel.name}`}
          >
            <MoreVertical className="h-4 w-4" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem onClick={() => hideChannel.mutate(channel.id)}>
            <EyeOff className="h-4 w-4 mr-2" />
            Ausblenden
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};
```

## Video-Items: Klickbarer Kanal

### List View (Table Row)
```tsx
// In VideosPage.tsx, Title Column
<div className="flex flex-col gap-1">
  <span className="font-medium line-clamp-2">{title}</span>
  {video.channel_id ? (
    <button
      onClick={(e) => {
        e.stopPropagation();
        selectChannel(video.channel_id);
      }}
      className="text-sm text-gray-600 hover:text-blue-600 hover:underline truncate text-left"
    >
      {video.channel}
    </button>
  ) : (
    <span className="text-sm text-gray-600 truncate">{video.channel}</span>
  )}
</div>
```

### Grid View (VideoCard)
```tsx
// In VideoCard.tsx
<div className="p-3">
  <h3 className="font-medium line-clamp-2">{video.title}</h3>
  {video.channel_id ? (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onChannelClick?.(video.channel_id);
      }}
      className="text-sm text-gray-500 hover:text-blue-600 hover:underline"
    >
      {video.channel}
    </button>
  ) : (
    <span className="text-sm text-gray-500">{video.channel}</span>
  )}
</div>
```

## Settings Integration

### Neue Settings-Sektion
```
┌─────────────────────────────────────────────────────┐
│ Darstellung                                         │
├─────────────────────────────────────────────────────┤
│                                                     │
│ Ansichtsmodus          [List ▼]                     │
│ Thumbnail-Größe        [Medium ▼]                   │
│ Grid-Spalten           [3 ▼]                        │
│                                                     │
│ Kanal-Avatare anzeigen [Switch]                     │  ← NEU
│ Zeigt Profilbilder in der Sidebar                   │
│                                                     │
├─────────────────────────────────────────────────────┤
│ Ausgeblendete Kanäle                                │  ← NEU
├─────────────────────────────────────────────────────┤
│ MrBeast                         [Einblenden]        │
│ PewDiePie                       [Einblenden]        │
│                                                     │
│ Keine ausgeblendeten Kanäle.                        │
└─────────────────────────────────────────────────────┘
```

### Settings Component
```tsx
// In SettingsPage.tsx oder neue Sektion
<div className="space-y-6">
  {/* Avatar Toggle */}
  <div className="flex items-center justify-between">
    <div>
      <Label htmlFor="channel-avatars">Kanal-Avatare anzeigen</Label>
      <p className="text-sm text-gray-500">
        Zeigt Profilbilder in der Sidebar
      </p>
    </div>
    <Switch
      id="channel-avatars"
      checked={showChannelAvatars}
      onCheckedChange={setShowChannelAvatars}
    />
  </div>

  {/* Hidden Channels */}
  <div>
    <h3 className="font-medium mb-2">Ausgeblendete Kanäle</h3>
    {hiddenChannels.length === 0 ? (
      <p className="text-sm text-gray-500">Keine ausgeblendeten Kanäle.</p>
    ) : (
      <div className="space-y-2">
        {hiddenChannels.map((channel) => (
          <div key={channel.id} className="flex items-center justify-between">
            <span>{channel.name}</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => unhideChannel(channel.id)}
            >
              Einblenden
            </Button>
          </div>
        ))}
      </div>
    )}
  </div>
</div>
```

## Header mit Channel-Filter aktiv

### Aktuell (Tag-Filter)
```
┌─────────────────────────────────────────────────────┐
│ Python, Tutorial                                    │
│ Alle Videos anzeigen                                │
└─────────────────────────────────────────────────────┘
```

### Mit Channel-Filter
```
┌─────────────────────────────────────────────────────┐
│ MrBeast                                             │  ← Channel Name
│ Alle Videos anzeigen                                │
└─────────────────────────────────────────────────────┘
```

### Kombination Tag + Channel
```
┌─────────────────────────────────────────────────────┐
│ Tutorial • MrBeast                                  │  ← Beide Filter
│ Alle Videos anzeigen                                │
└─────────────────────────────────────────────────────┘
```

## Responsive Verhalten

### Desktop (>1024px)
- Sidebar voll sichtbar
- Kanäle mit Video-Count
- Context-Menu on Hover

### Tablet (768-1024px)
- Sidebar collapsible
- Kanäle in vollem Umfang
- Context-Menu via Touch

### Mobile (<768px)
- Sidebar als Drawer/Overlay
- Kanäle bleiben voll funktional
- Video-Count evtl. ausblenden für Platz

## Accessibility

### Keyboard Navigation
- `Tab` navigiert durch Kanal-Buttons
- `Enter/Space` wählt Kanal aus
- `Escape` schließt Context-Menu

### Screen Reader
```tsx
aria-label={`Kanal ${channel.name} mit ${channel.video_count} Videos`}
aria-pressed={isSelected}
role="listitem"  // Für Kanal-Liste
```

### Farb-Kontrast
- Alle Text-Farben erfüllen WCAG AA
- Selected-State hat ausreichend Kontrast
