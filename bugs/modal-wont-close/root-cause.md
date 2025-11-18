# Root Cause Analysis: Video Details Modal Won't Close

## Date
2025-11-17

## Root Cause: Event Propagation / Event Bubbling

### The Problem

The VideoDetailsModal is rendered **inside** the VideoCard component, which itself is a clickable element. This creates an event propagation issue where clicks intended to close the modal bubble up to the parent card and immediately reopen the modal.

### Code Flow Breakdown

**Location**: `frontend/src/components/VideoCard.tsx`

#### 1. Card Structure (Lines 115-238)
```tsx
<div
  role="button"
  onClick={handleCardClick}  // <-- Parent click handler
  onKeyDown={handleKeyDown}
  className="video-card group cursor-pointer ..."
>
  {/* Card content: thumbnail, title, etc. */}

  {/* Modal rendered INSIDE clickable card */}
  <VideoDetailsModal
    video={video}
    open={showModal}
    onOpenChange={setShowModal}  // <-- Called when modal closes
    listId={video.list_id}
    onFieldChange={...}
  />
</div>
```

#### 2. Click Handler (Lines 73-82)
```tsx
const handleCardClick = () => {
  // Early return pattern
  if (videoDetailsView === 'modal') {
    setShowModal(true)  // <-- ALWAYS opens modal
    return
  }

  // Default: navigate to page
  navigate(`/videos/${video.id}`)
}
```

#### 3. The Event Propagation Sequence

When user tries to close the modal:

```
1. User clicks X button OR clicks outside modal (backdrop)
   ↓
2. Radix Dialog (via shadcn/ui) calls onOpenChange(false)
   ↓
3. setShowModal(false) executes → Modal starts closing
   ↓
4. Click event bubbles up DOM tree (event propagation)
   ↓
5. Event reaches VideoCard's <div onClick={handleCardClick}>
   ↓
6. handleCardClick() fires
   ↓
7. Checks: videoDetailsView === 'modal' → TRUE
   ↓
8. setShowModal(true) executes → Modal opens again
   ↓
9. RESULT: Modal immediately reopens (infinite loop)
```

### Why This Happens

1. **React Portal Pattern**: Radix Dialog uses React Portal to render the modal outside the DOM tree (for z-index and positioning)
2. **Event Bubbling**: Despite the portal, the click event still propagates through the React component tree
3. **No stopPropagation**: Neither the Dialog nor the VideoCard stops event propagation
4. **Parent Click Handler**: The VideoCard's click handler is too broad - it captures ALL clicks

### Evidence

**VideoCard.tsx:228-237** - Modal is child of clickable card:
```tsx
{/* VideoDetailsModal for modal view */}
<VideoDetailsModal
  video={video}
  open={showModal}
  onOpenChange={setShowModal}  // <-- This gets called with false...
  listId={video.list_id}
  onFieldChange={(fieldId, value) => {
    updateField.mutate([{ field_id: fieldId, value }])
  }}
/>
```

**VideoCard.tsx:115-123** - Parent div is clickable:
```tsx
<div
  role="button"
  onClick={handleCardClick}  // <-- ...but then this fires and sets it back to true!
  ...
>
```

### Why Standard Patterns Fail Here

Normally, Radix Dialog handles this correctly because:
1. The Dialog is rendered at root level via Portal
2. Click events on overlay/close don't propagate to parent components

However, in this case:
1. The VideoCard itself is the parent component
2. The onClick handler doesn't check modal state
3. The handler unconditionally opens the modal when in 'modal' view mode

### Technical Details

- **Browser**: All browsers (not browser-specific)
- **React**: Event system propagates through component tree regardless of DOM portals
- **Radix UI**: Works as designed - calls onOpenChange correctly
- **Issue**: VideoCard's onClick is too aggressive

### Root Cause Statement

**The VideoCard's onClick handler unconditionally opens the modal whenever clicked in 'modal' view mode, without checking if the modal is already open. This causes a race condition where closing the modal (setShowModal(false)) is immediately overridden by the card's click handler (setShowModal(true)).**

## Fix Requirements

The fix must:
1. Prevent the card's onClick from firing when the modal is closing
2. OR check modal state before opening
3. OR move the modal outside the clickable card
4. Maintain existing navigation behavior (page vs modal)
5. Not break keyboard navigation or accessibility
