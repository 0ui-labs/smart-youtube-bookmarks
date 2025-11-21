# Feature Understanding: Hybrid Category-Fields System

**Feature ID:** category-fields-hybrid
**Date:** 2025-11-20
**Status:** Phase 1 - Understanding

---

## What is this feature?

A complete redesign of the Tag/Schema/Field system into a user-friendly "Category with Fields" system that:

1. **Replaces "Tags" with "Categories"** in the UI (technically still Tags in backend)
2. **Max 1 Category per Video** (instead of N tags)
3. **"Alle Videos" special category** with workspace-wide fields (inherited by all other categories)
4. **Hides technical concepts** from users (no "Schema", no "Field" terminology)
5. **Backup system** for category changes (preserves field values when switching categories)

---

## Why is this feature needed?

### Current Problems

1. **Conceptual confusion:** Tags, Schemas, and Fields are three separate concepts users must understand
2. **Unclear purpose:** Tags serve dual purpose (labels + field containers) which is confusing
3. **Field overload:** Videos with multiple tags get fields from all schemas → UI becomes cluttered
4. **Orphaned data:** Removing tags leaves VideoFieldValues invisible but present in database
5. **Technical terminology:** "Schema", "Field", "Tag" confuses non-technical users

### Solution Benefits

1. **Single mental model:** "Categories can have custom information fields" 
2. **Clear inheritance:** All categories inherit workspace-wide fields
3. **Predictable fields:** 1 category = clear set of fields (workspace + category-specific)
4. **Data preservation:** Backup system prevents accidental data loss
5. **User-friendly language:** "Categories", "Information", "Workspace" instead of technical terms

---

## Who will use it?

**Primary Users:** Non-technical YouTube video collectors who want to organize videos by type with custom metadata

**User Personas:**

1. **Recipe Collector Sarah**
   - Has categories: "Keto Rezepte", "Vegan Rezepte", "Desserts"
   - Wants fields like: Kalorien, Kochzeit, Schwierigkeit
   - Also wants workspace-wide: Rating, Notes, Favorite

2. **Tutorial Learner Mike**
   - Has categories: "Python Tutorials", "Docker Tutorials", "Git Tutorials"
   - Wants fields like: Difficulty, Duration, Prerequisites
   - Also wants workspace-wide: Progress, Completed Date, Notes

3. **Music Curator Lisa**
   - Has categories: "Entspannung", "Workout", "Konzentration"
   - Wants fields like: Mood, Energy Level, BPM
   - Also wants workspace-wide: Favorite, Play Count

---

## Expected User Flow

### Initial Setup (First Time User)

1. User opens app → sees default "Alle Videos" category
2. Adds first video → appears under "Alle Videos" or in "Python Tutorials" if added while in "Python Tutorials"
3. Creates first category "Python Tutorials" → adds fields "Difficulty", "Duration"
4. Assigns video to "Python Tutorials" → sees workspace fields + category fields

### Daily Usage

1. User adds new video → appears under "Alle Videos" or in selected category
2. Assigns category (or leaves in "Alle Videos")
3. Fills out fields (workspace + category-specific)
4. Uses sidebar to filter by category
5. Filters within category using category-specific or workspace fields

### Category Change Flow

1. User opens video detail 
2. Changes category dropdown "Tutorial" → "Rezept"
3. Sees warning: "Fields from Tutorial will be hidden (not deleted). Restore if you switch back?"
4. Confirms change
5. Tutorial field values backed up to JSON file
6. Video now shows workspace fields + Rezept fields
7. If user switches back to Tutorial → prompted to restore backed up values

---

## Feature Scope

### In Scope (Phase 1)

- ✅ Backend: `VideoList.default_schema_id` for workspace-wide fields
- ✅ Backend: `Video.category_id` (1:1 relation to Tag)
- ✅ Backend: Backup system for category changes
- ✅ Backend: Field name conflict prevention (workspace vs category)
- ✅ Frontend: Rename "Tags" → "Categories" in UI
- ✅ Frontend: Settings page redesign (show categories with fields)
- ✅ Frontend: Video detail category selector (max 1)
- ✅ Frontend: Category change warning dialog
- ✅ Frontend: Backup restore prompt
- ✅ API: Endpoints for category assignment
- ✅ API: Backup/restore endpoints

### Out of Scope (Future Phases)

- ❌ Multiple categories per video
- ❌ Folder/Treeview organization
- ❌ Drag & drop category assignment
- ❌ AI-powered field suggestions
- ❌ Field templates/presets

### Edge Cases

1. **Video without category:** Stays in "Alle Videos", only has workspace fields and Youtube fields ferom the youtube video api
2. **Category without schema:** Valid (category can exist without custom fields)
3. **Field name conflicts:** Prevented by validation (workspace field name can't be used in category)
4. **Rapid category switching:** Each switch creates new backup entry
5. **Backup restoration failure:** Keep old values, show error, don't block category change
6. **Deleting category with videos:** Videos move to "Alle Videos", field values backed up

---

## User-Facing Terminology

| Technical Term | User-Facing Term |
|----------------|------------------|
| Tag | Kategorie (Category) |
| FieldSchema | (Hidden - never mentioned) |
| CustomField | Information / Feld |
| VideoList | Workspace| (has custom name like "Private oder "Work" for example)
| Schema.fields | "Informationen dieser Kategorie" |
| default_schema | "Informationen für alle Videos" |
| video_tags M:N relation | video.category_id 1:1 relation |

---

## Success Criteria

Feature successful if:

1. ✅ Non-technical user can understand system without reading docs
2. ✅ No data loss when switching categories
3. ✅ Field name conflicts clearly prevented with user-friendly message
4. ✅ All existing functionality preserved (backward compatible)
5. ✅ Settings UI is self-explanatory
6. ✅ Video detail shows clear category assignment

---

## Questions Answered

**Q: Can one field be used in multiple categories?**
A: Yes, CustomFields are reusable across all categories.

**Q: What happens to old field values when changing category?**
A: Backed up to JSON file, can be restored if user switches back.

**Q: Can workspace fields have same name as category fields?**
A: No, prevented with clear error message.

**Q: How are fields displayed in video detail?**
A: All together (workspace + category), no visual separation.

**Q: Is migration needed?**
A: Yes, but we have no production users, so can be done freely.

---

## Two-Sentence Summary

This feature transforms the confusing Tag/Schema/Field system into a simple "Categories with Information" model where each video belongs to max one category, all categories inherit workspace-wide fields, and switching categories backs up old field values for later restoration.

The system hides all technical concepts (Schema, Field) from users and uses everyday language (Category, Information, Workspace) to make video organization intuitive for non-technical users.
