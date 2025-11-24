# Codebase Analysis: Channels Implementation

## Existing Architecture

### Frontend Files

| File | Purpose |
|------|---------|
| `frontend/src/pages/ChannelsPage.tsx` | Channel overview page - needs modification |
| `frontend/src/components/ChannelNavigation.tsx` | Sidebar channel list - has working 3-dot menu pattern |
| `frontend/src/hooks/useChannels.ts` | React Query hooks - all needed hooks already exist |
| `frontend/src/types/channel.ts` | Zod schemas and types - complete |

### Backend Files

| File | Purpose |
|------|---------|
| `backend/app/api/channels.py` | API endpoints - GET, PATCH, DELETE all exist |
| `backend/app/services/channel_service.py` | Channel service - no changes needed |
| `backend/app/models/channel.py` | Channel model with `is_hidden` field |

## Key Findings

### 1. useChannels Hook Already Supports Hidden Channels

```typescript
// useChannels.ts:20-31
export function channelsOptions(includeHidden = false) {
  return queryOptions({
    queryKey: ['channels', { includeHidden }],
    queryFn: async () => {
      const { data } = await api.get<Channel[]>('/channels', {
        params: { include_hidden: includeHidden }
      })
      return ChannelsSchema.parse(data)
    },
  })
}
```

**Fix is simple:** Change `useChannels()` to `useChannels(true)` in ChannelsPage.

### 2. Update Hook Already Exists

```typescript
// useChannels.ts:72-89
export const useUpdateChannel = () => {
  // ... supports { is_hidden: boolean }
}
```

### 3. Delete Hook Already Exists

```typescript
// useChannels.ts:106-124
export const useDeleteChannel = () => {
  // ... deletes channel and invalidates queries
}
```

### 4. 3-Dot Menu Pattern in ChannelNavigation

```tsx
// ChannelNavigation.tsx:152-174
<DropdownMenu>
  <DropdownMenuTrigger asChild>
    <button className="p-1 mr-1 opacity-0 group-hover:opacity-100...">
      <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
    </button>
  </DropdownMenuTrigger>
  <DropdownMenuContent align="end">
    <DropdownMenuItem onClick={() => onChannelHide(channel.id)}>
      <EyeOff className="h-4 w-4 mr-2" />
      Kanal ausblenden
    </DropdownMenuItem>
  </DropdownMenuContent>
</DropdownMenu>
```

### 5. AlertDialog Pattern from Existing UI

The codebase uses shadcn/ui components. AlertDialog is already available.

## Integration Points

1. **ChannelsPage.tsx** - Add dropdown menu, change useChannels parameter
2. **UI Components** - Use existing DropdownMenu, AlertDialog from shadcn/ui
3. **Hooks** - All hooks already implemented

## Naming Conventions

- German UI text ("Kanal löschen", "In Navigation einblenden")
- React Query hooks: `use[Action][Entity]` pattern
- Zod validation for API responses

## Similar Features (Pattern Reference)

- `ChannelNavigation.tsx`: 3-dot menu for hiding channels
- `TagsList.tsx`: Delete functionality with confirmation
- Settings page patterns for list management
