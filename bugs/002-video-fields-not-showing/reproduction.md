# Bug #002: Video Fields Not Showing in Detail View

## Phase 1: Reproduction

### Bug Description
When clicking on a video (either in modal mode or full page mode), custom fields are not visible or editable, even though tags appear to be linked to schemas.

### Reproduction Steps
1. Create a tag named "Test Tag With Schema"
2. Create or use an existing schema with fields (e.g., "Tutorial Difficulty" schema)
3. Add a video and assign the tag to it
4. Click on the video to open detail view (modal or page)
5. **Expected**: Custom fields from the schema should be visible
6. **Actual**: No custom fields appear

### Reproduction Confirmation
✅ Bug successfully reproduced on 2025-11-18

#### Test Video
- **Video ID**: `bf53b132-d12e-428f-bad8-019989c79e19`
- **Title**: "TOON — Stop using JSON for LLM Calls"
- **Tag**: "Test Tag With Schema" (ID: 01275161-3631-4927-b43b-5d6c5ea8ab1e)

#### API Response Analysis
```bash
curl http://localhost:8000/api/videos/bf53b132-d12e-428f-bad8-019989c79e19
```

**Result**:
```json
{
    "tags": [{
        "name": "Test Tag With Schema",
        "schema_id": null,   ← PROBLEM: Tag has no schema link
        "schema": null
    }],
    "field_values": [],       ← Empty (expected given no schema)
    "available_fields": []    ← Empty (expected given no schema)
}
```

#### Available Schema Confirmed
Schema "Tutorial Difficulty" (ID: 71f69fa1-d45c-40b3-8fc4-870e23adc5b2) exists with 4 fields:
1. "Difficulty Level" (select)
2. "Teaching Quality" (rating)
3. "Follows Best Practices" (boolean)
4. "Key Takeaways" (text)

### Root Cause Hypothesis
The tag `"Test Tag With Schema"` is **not actually linked** to a schema (`schema_id: null`). This could be:
1. **UI Bug**: Tag creation/editing UI doesn't save the schema link
2. **User Error**: Tag created separately without linking to schema
3. **API Bug**: Tag-schema linking endpoint not working

### Next Steps
→ Phase 2: Root Cause Analysis - Investigate tag-schema linking mechanism
