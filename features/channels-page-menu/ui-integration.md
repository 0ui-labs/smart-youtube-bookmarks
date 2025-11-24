# UI/UX Integration

## Component Structure

```
ChannelsPage
├── Header (unchanged)
├── Channel List
│   └── Channel Card (modified)
│       ├── Avatar (unchanged)
│       ├── Channel Info (unchanged)
│       ├── Hidden Indicator (NEW)
│       └── Dropdown Menu (NEW)
│           ├── Toggle Visibility Item
│           └── Delete Item
└── Delete Confirmation Dialog (NEW)
```

## UI Mockup

### Channel Card with Menu

```
┌──────────────────────────────────────────────────────────────┐
│                                                              │
│  [  Avatar  ]   Channel Name  [👁‍🗨]                    [⋮]  │
│  [  80x80   ]   Description here that can go                 │
│  [  round   ]   over two lines maximum...                    │
│                                                              │
└──────────────────────────────────────────────────────────────┘
                      │                              │
                      │                              └── Menu (hover)
                      └── Hidden indicator (if is_hidden=true)
```

### Dropdown Menu

```
┌─────────────────────────────────┐
│ 👁 In Navigation einblenden    │  ← wenn ausgeblendet
│ ─────────────────────────────── │
│ 🗑️ Kanal löschen               │
└─────────────────────────────────┘

oder

┌─────────────────────────────────┐
│ 👁‍🗨 In Navigation ausblenden   │  ← wenn sichtbar
│ ─────────────────────────────── │
│ 🗑️ Kanal löschen               │
└─────────────────────────────────┘
```

### Delete Confirmation Dialog

```
┌─────────────────────────────────────────────────────────────┐
│                     Kanal löschen?                          │
│                                                             │
│  Möchtest du "[Channel Name]" wirklich löschen?             │
│                                                             │
│  Die [X] Videos dieses Kanals bleiben erhalten,             │
│  verlieren aber ihre Kanal-Zuordnung.                       │
│                                                             │
│                                                             │
│                         [Abbrechen]    [Löschen]            │
└─────────────────────────────────────────────────────────────┘
```

## Design Tokens

### Colors
- Delete button: `destructive` variant (red)
- Hidden indicator: `text-muted-foreground`
- Menu trigger: `text-muted-foreground`, `hover:bg-accent`

### Icons (Lucide)
- Menu trigger: `MoreHorizontal`
- Show in nav: `Eye`
- Hide from nav: `EyeOff`
- Delete: `Trash2`

### Spacing
- Menu trigger: `p-2` padding, `mr-2` margin
- Channel card: existing `p-4` maintained
- Dialog content: standard AlertDialog padding

## Responsive Considerations

- Menu button always visible on mobile (no hover)
- Dialog uses full width on small screens
- Touch targets minimum 44x44px

## Accessibility

- Menu has proper ARIA labels
- Dialog traps focus
- Delete action has clear warning text
- Hidden state communicated via aria-label
