# Implementation Plan

## Overview

Single-file modification to `ChannelsPage.tsx` with UI additions.

## Phase 1: Fix Bug - Show All Channels

**Goal:** Hidden channels appear on Channels page

**Changes:**
1. Change `useChannels()` to `useChannels(true)` in ChannelsPage
2. Add visual indicator for hidden channels (EyeOff icon)

**Files:** `frontend/src/pages/ChannelsPage.tsx`

## Phase 2: Add Dropdown Menu

**Goal:** Each channel has 3-dot menu with options

**Changes:**
1. Import DropdownMenu components from shadcn/ui
2. Import useUpdateChannel, useDeleteChannel hooks
3. Add menu button to channel card
4. Add toggle visibility menu item
5. Add delete menu item
6. Handle click propagation (menu click shouldn't navigate)

**Files:** `frontend/src/pages/ChannelsPage.tsx`

## Phase 3: Add Delete Confirmation Dialog

**Goal:** Prevent accidental deletion

**Changes:**
1. Import AlertDialog components from shadcn/ui
2. Add channelToDelete state
3. Add AlertDialog at component level
4. Wire up delete confirmation flow

**Files:** `frontend/src/pages/ChannelsPage.tsx`

## Phase 4: Polish

**Goal:** Smooth UX

**Changes:**
1. Add loading states during mutations
2. Disable buttons during pending requests
3. Optional: Add toast notifications

**Files:** `frontend/src/pages/ChannelsPage.tsx`

## Verification

After each phase:
1. Run `npm run dev` in frontend
2. Test the specific functionality
3. Verify no regressions

## Dependencies

Already available:
- DropdownMenu (shadcn/ui)
- AlertDialog (shadcn/ui)
- useUpdateChannel hook
- useDeleteChannel hook
- Lucide icons
