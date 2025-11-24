# Integration Strategy

## Approach: Minimal Modification

This feature requires changes to only ONE component: `ChannelsPage.tsx`

## Integration Steps

### 1. Fix Hidden Channels Bug

```tsx
// Before
const { data: channels = [], isLoading, isError } = useChannels()

// After
const { data: channels = [], isLoading, isError } = useChannels(true)
```

### 2. Add Hooks for Mutations

```tsx
const updateChannel = useUpdateChannel()
const deleteChannel = useDeleteChannel()
```

### 3. Add State for Delete Confirmation

```tsx
const [channelToDelete, setChannelToDelete] = useState<Channel | null>(null)
```

### 4. Add Dropdown Menu to Each Channel

Modify the channel card to include a 3-dot menu:
- Keep existing click behavior (navigate to videos)
- Add menu button that doesn't trigger navigation
- Menu items: Toggle visibility, Delete

### 5. Add Delete Confirmation Dialog

Add AlertDialog at component level:
- Shows when `channelToDelete` is set
- Explains videos will remain
- Confirms deletion
- Clears `channelToDelete` on cancel/confirm

## Extension Points

- Channel card: Add `group` class for hover effects
- Menu trigger: Stop propagation to prevent navigation
- Visual indicator: Add EyeOff icon for hidden channels

## Interface Boundaries

- All state management within ChannelsPage
- No props needed from parent
- Uses existing hooks for API calls
- Uses existing UI components
