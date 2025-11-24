# Atomic Implementation Steps

## Step 1: Fix useChannels Call (5 min)

**Files:** `ChannelsPage.tsx`

**Change:**
```tsx
// Line ~31
- const { data: channels = [], isLoading, isError } = useChannels()
+ const { data: channels = [], isLoading, isError } = useChannels(true)
```

**Test:** Hidden channels now appear on `/channels`

---

## Step 2: Add Hidden Indicator (10 min)

**Files:** `ChannelsPage.tsx`

**Changes:**
1. Import `EyeOff` from lucide-react
2. Add indicator next to channel name if `channel.is_hidden`

**Test:** Hidden channels show EyeOff icon

---

## Step 3: Add Dropdown Menu Structure (15 min)

**Files:** `ChannelsPage.tsx`

**Changes:**
1. Import DropdownMenu components
2. Import MoreHorizontal, Eye, EyeOff, Trash2 icons
3. Add group class to channel button wrapper
4. Add DropdownMenu with trigger button
5. Add placeholder menu items

**Test:** 3-dot menu appears on hover, opens on click

---

## Step 4: Implement Toggle Visibility (15 min)

**Files:** `ChannelsPage.tsx`

**Changes:**
1. Import `useUpdateChannel` hook
2. Add toggle handler function
3. Wire up menu item onClick
4. Use correct icon/text based on is_hidden state

**Test:** Clicking toggle updates channel visibility

---

## Step 5: Add Delete Dialog Structure (15 min)

**Files:** `ChannelsPage.tsx`

**Changes:**
1. Import AlertDialog components
2. Add `channelToDelete` state
3. Add AlertDialog component at end of JSX
4. Wire up menu item to set `channelToDelete`

**Test:** Clicking delete opens dialog with channel info

---

## Step 6: Implement Delete Confirmation (10 min)

**Files:** `ChannelsPage.tsx`

**Changes:**
1. Import `useDeleteChannel` hook
2. Wire up confirm button to delete mutation
3. Clear `channelToDelete` after delete
4. Add loading state to button

**Test:** Confirming delete removes channel

---

## Step 7: Prevent Click Propagation (5 min)

**Files:** `ChannelsPage.tsx`

**Changes:**
1. Add `e.stopPropagation()` to menu trigger
2. Ensure menu doesn't trigger navigation

**Test:** Clicking menu doesn't navigate to videos

---

## Total Estimated Time: ~75 minutes

## Commit Points

1. After Step 2: "fix: show hidden channels on channels page"
2. After Step 4: "feat: add toggle visibility from channels page"
3. After Step 7: "feat: add channel delete with confirmation"
