# Feature Understanding: Tag Management UI & Settings Reorganization

**Feature ID:** FE-001-tag-management-ui
**Created:** 2025-11-18
**Status:** Planning Phase

## Feature Summary

Add comprehensive tag management capabilities and reorganize the application's settings/filter UI layout for better usability.

## Core Requirements

### 1. Tag Management Interface

**Location:** Central Settings page with tabbed navigation

The Settings page should contain tabs for:
- Schema Management
- Field Management
- **Tag Management** (NEW)
- KI (AI) Analysis Filters

### 2. Tag Management Actions

Users should be able to:
- ✅ **Create** new tags
- ✅ **List/View** all existing tags
- ✅ **Edit** tag name/title
- ✅ **Edit** tag schema (custom fields associated with tag)
- ✅ **Delete** tags (removes from all associated videos)
- ✅ **Merge** tags (combine multiple tags into one)
- ✅ **View statistics** (how many videos use each tag)

### 3. Delete Behavior

When a tag is deleted:
- Tag is removed from ALL videos that use it
- No confirmation per-video required
- System handles cascading deletion automatically

### 4. UI Reorganization

**Current Layout:**
- Settings button: Above video grid/listing
- Add Filter button: Somewhere else (needs location confirmation)

**New Layout:**
- Settings button: **Moves to sidebar navigation**
- Add Filter button: **Takes the exact position of the old Settings button** (above video grid)

## Why This Feature?

**User Goal:** Simplify tag management and improve UI layout for better workflow

**Current Pain Points:**
- No central place to manage all tags
- Cannot edit tag names or schemas after creation
- Cannot merge duplicate/similar tags
- Settings button location not intuitive in sidebar navigation

**Expected Benefits:**
- Centralized management interface for all app configuration
- Easier tag maintenance and organization
- Better UI layout with Settings in sidebar (standard pattern)
- Filter controls closer to the content they filter

## Scope

**In Scope:**
- Complete tag CRUD operations (Create, Read, Update, Delete)
- Tag merging functionality
- Tag usage statistics
- Settings page tab structure
- UI button reorganization (Settings → Sidebar, Add Filter → above grid)

**Out of Scope:**
- Tag search/filtering (may add later if needed)
- Tag categories/hierarchies
- Bulk tag operations beyond merge
- Tag auto-suggestions

## Edge Cases to Consider

1. **Deleting tags with many videos:** What happens to videos when their tag is deleted?
   - **Decision:** Tag removed from all videos automatically

2. **Merging tags:** What happens to schemas when merging tags with different custom fields?
   - **Needs investigation:** How to handle schema conflicts

3. **Empty tag names:** Can users create tags with empty/whitespace-only names?
   - **Needs validation:** Require non-empty tag names

4. **Duplicate tag names:** Can multiple tags have the same name?
   - **Needs investigation:** Current behavior and desired behavior

## Success Criteria

Feature is successful if:
- ✅ Users can perform all CRUD operations on tags from Settings page
- ✅ Tag merging works and preserves video associations
- ✅ Statistics accurately reflect tag usage
- ✅ Settings button is in sidebar
- ✅ Add Filter button is above video grid
- ✅ No existing functionality breaks
- ✅ UI feels more intuitive than before

## Open Questions

1. How are tag schemas currently stored and associated with tags?
2. What happens when merging tags with different schemas?
3. What's the current location of the "Add Filter" button?
4. Are there any existing tag management capabilities we're replacing?
5. Should merged tags keep both schemas or require user to choose?

---

**Next Phase:** Codebase Analysis - Explore existing tag implementation and UI structure
