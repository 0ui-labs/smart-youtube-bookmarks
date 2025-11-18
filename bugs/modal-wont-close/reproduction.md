# Bug Reproduction: Video Details Modal Won't Close

## Bug ID
`modal-wont-close`

## Date
2025-11-17

## Summary
When the user selects "Modal Dialog" option in Table Settings for video details display, clicking a video card opens the modal, but the modal cannot be closed. Clicking the close icon (X) or clicking outside the modal causes the modal to reload instead of closing.

## Steps to Reproduce

1. Open the application and navigate to the Videos page
2. Open Table Settings dropdown (Settings icon)
3. Under "Video Details", select "Modal Dialog" (instead of "Eigene Seite")
4. Switch to Grid view (if not already in Grid view)
5. Click on any video card
6. **Expected**: Modal opens with video details
7. **Actual**: Modal opens (✓)
8. Try to close the modal by:
   - Clicking the X icon in top-right corner
   - Clicking outside the modal (on the backdrop/overlay)
9. **Expected**: Modal closes
10. **Actual**: Modal reloads/reopens immediately

## Affected Components

- `frontend/src/components/VideoCard.tsx` (Lines 59-240)
- `frontend/src/components/VideoDetailsModal.tsx` (Lines 1-124)
- `frontend/src/stores/tableSettingsStore.ts` (videoDetailsView setting)

## Environment

- Browser: Any
- View Mode: Grid view
- Setting: videoDetailsView = 'modal'

## Visual Evidence

The modal structure:
```
VideoCard (clickable)
  └─ VideoDetailsModal (nested inside card)
       └─ Dialog (Radix UI)
```

## Observable Behavior

1. Modal opens successfully
2. Clicking X or backdrop triggers close
3. Modal immediately reopens
4. User is stuck in modal (cannot close it)

## Initial Hypothesis

**Event Propagation Issue**: The VideoDetailsModal is rendered INSIDE the VideoCard component. When the user clicks the close button or backdrop:

1. Dialog's `onOpenChange` is called with `false`
2. `setShowModal(false)` executes
3. Click event propagates up to VideoCard
4. VideoCard's `onClick` handler fires
5. `handleCardClick()` checks `videoDetailsView === 'modal'`
6. `setShowModal(true)` executes
7. Modal reopens immediately

This creates an endless loop where the modal cannot be closed.

## Root Cause Location

**VideoCard.tsx:114-124** - The entire card is clickable:
```tsx
<div
  role="button"
  onClick={handleCardClick}  // <-- This is the problem
  ...
>
  {/* ... card content ... */}

  {/* Modal rendered INSIDE clickable card */}
  <VideoDetailsModal
    open={showModal}
    onOpenChange={setShowModal}
  />
</div>
```

When the modal closes, the click event bubbles up to the card's `onClick` handler, causing it to reopen.
