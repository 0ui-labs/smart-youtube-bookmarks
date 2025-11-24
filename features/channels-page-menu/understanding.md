# Feature Understanding: Channels Page Menu & Visibility Fix

## Summary

Fix the bug where hidden channels disappear from the Channels overview page, and add a 3-dot context menu to manage channels directly from the overview page.

## Problem Statement

**Current Bug:** When a user hides a channel in the sidebar navigation, it also disappears from `/channels` (ChannelsPage). This is incorrect - the Channels page should show ALL channels, including hidden ones.

**Missing Feature:** The Channels page has no way to:
1. Show/hide channels in the navigation
2. Delete channels

## Requirements

### 1. Bug Fix: Show All Channels on ChannelsPage
- `ChannelsPage` currently uses `useChannels()` which excludes hidden channels
- Should use `useChannels(true)` to include hidden channels
- Hidden channels should have a visual indicator (e.g., EyeOff icon)

### 2. New Feature: 3-Dot Context Menu per Channel
Each channel on the Channels page needs a dropdown menu with:
- **"In Navigation einblenden/ausblenden"** - Toggle `is_hidden` status
- **"Kanal löschen"** - Delete the channel (with confirmation)

### 3. Delete Confirmation Dialog
- Deleting a channel is a significant action
- Must show an AlertDialog confirmation
- Explain that videos will remain but lose channel association
- Require explicit confirmation (not just a click)

## Behavior Specification

### Visibility Toggle
- If channel is visible (not hidden): Option shows "In Navigation ausblenden"
- If channel is hidden: Option shows "In Navigation einblenden"
- After toggling, channel remains visible on Channels page (with updated indicator)

### Delete Behavior
- On delete: Channel is removed from database
- Videos of that channel remain (channel_id set to NULL via FK ON DELETE SET NULL)
- Query caches are invalidated (channels + videos)
- User returns to channel list

### Visual Indicator for Hidden Channels
- Hidden channels should show an EyeOff icon or similar
- Could also use reduced opacity or a badge

## User Flow

```text
1. User navigates to /channels
2. All channels displayed (including hidden ones)
3. Hidden channels have visual indicator (e.g., EyeOff icon)
4. User hovers over channel → 3-dot menu appears
5. User clicks menu → Options: "In Navigation einblenden/ausblenden", "Kanal löschen"

For Toggle:
6a. User clicks toggle option
7a. Channel visibility updated
8a. Visual indicator updates immediately

For Delete:
6b. User clicks "Kanal löschen"
7b. Confirmation dialog appears with warning
8b. User confirms → Channel deleted
9b. Toast notification: "Kanal gelöscht"
```

## Exit Condition

Feature is understood when we can explain in 2-3 sentences:
> The Channels overview page should display ALL channels (including hidden ones) with visual indicators for hidden channels. Each channel needs a 3-dot menu to toggle navigation visibility and delete channels, with a confirmation dialog to prevent accidental deletion.
