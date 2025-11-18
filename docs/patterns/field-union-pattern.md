# Field Union Pattern (Option D)

**Status:** Active
**Last Updated:** 2025-11-12

## Overview

The Field Union Pattern (Option D - "Intelligente Lösung") provides a two-tier response strategy for efficiently handling custom field data in list and detail views.

## Two-Tier Response Strategy

### List Endpoints (Fast)

**Endpoint:** `GET /lists/{id}/videos`
**Returns:** Only `field_values` (filled fields)
**Performance:** ~50KB for 100 videos

```json
{
  "id": "...",
  "title": "Video Title",
  "field_values": [
    {"field_name": "Rating", "value": 4, ...}
  ],
  "available_fields": null
}
```

### Detail Endpoint (Complete)

**Endpoint:** `GET /videos/{id}`
**Returns:** `field_values` + `available_fields` (all fields)
**Performance:** ~5KB for 1 video, <100ms target

```json
{
  "id": "...",
  "title": "Video Title",
  "field_values": [
    {"field_name": "Rating", "value": 4, ...},
    {"field_name": "Quality", "value": null, ...}
  ],
  "available_fields": [
    {"field_name": "Rating", "field_type": "rating", "config": {...}},
    {"field_name": "Quality", "field_type": "select", "config": {...}}
  ]
}
```

## Use Cases

- **List/Grid View:** Shows only filled fields on cards (user configures which fields to display)
- **Detail Modal/Page:** Shows ALL available fields for editing (filled + empty)

## Implementation

### Helper Module

**Location:** `backend/app/api/helpers/field_union.py`

**Functions:**
- `get_available_fields_for_video()` - Single video field union with conflict resolution
- `get_available_fields_for_videos()` - Batch version for multiple videos
- `compute_field_union_with_conflicts()` - Two-pass algorithm for name conflicts

### Conflict Resolution Algorithm (Two-Pass)

```
Pass 1: Detect conflicts
- Group fields by name (case-insensitive)
- If same name + different type → mark as conflict

Pass 2: Apply schema prefix
- Conflicting fields get prefix: "Schema Name: Field Name"
- Non-conflicting fields keep original name
```

### Example Scenario

```
Video has tags: ["Makeup Tutorial", "Product Review"]

Schemas:
- "Makeup Tutorial": [Rating (rating), Quality (select)]
- "Product Review": [Rating (select), Price (number)]

Result after conflict resolution:
- "Makeup Tutorial: Rating" (type: rating)
- "Product Review: Rating" (type: select)
- "Quality" (type: select, no conflict)
- "Price" (type: number, no conflict)
```

## Performance

- **List endpoint:** 2-3 DB queries for 100 videos (batch loading with selectinload)
- **Detail endpoint:** 2-3 DB queries for 1 video (<100ms target)
- **Conflict resolution:** Pure Python, in-memory (0 DB queries)

## Testing

- Unit tests: `backend/tests/api/helpers/test_field_union.py` (9 passing)
- Integration tests: Task #71 tests verify batch loading works correctly

## Related Documentation

- Task #71: Video GET endpoint with field_values (batch loading foundation)
- Task #74: Multi-tag field union query with conflict resolution (Option D implementation)
- Components: `docs/components/custom-fields-section.md`
