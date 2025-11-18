# Bug Reproduction: 500 Error When Updating Tag with schema_id

## Bug ID
`schema-id-500-error`

## Reported By
User

## Date
2025-11-18

## Summary
When attempting to create or update a tag with a `schema_id`, the backend returns a 500 Internal Server Error. This prevents users from associating tags with schemas and causes downstream errors when loading videos.

## Steps to Reproduce

### Via Frontend
1. Navigate to VideosPage
2. Click "Neuen Tag erstellen" (Create new tag)
3. Enter tag name (e.g., "Test Tag")
4. Select a schema from the dropdown
5. Click "Erstellen" (Create)
6. **Expected**: Tag is created with schema association
7. **Actual**: Backend returns 500 error, tag is created WITHOUT schema_id

### Via API (Direct)
```bash
# Create a tag
curl -X POST http://localhost:8000/api/tags \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Tag",
    "schema_id": "71f69fa1-d45c-40b3-8fc4-870e23adc5b2"
  }'

# Result: Tag created but schema_id is null
# { "id": "...", "name": "Test Tag", "schema_id": null, ... }

# Update tag with schema_id
curl -X PUT http://localhost:8000/api/tags/{tag_id} \
  -H "Content-Type: application/json" \
  -d '{
    "schema_id": "71f69fa1-d45c-40b3-8fc4-870e23adc5b2"
  }'

# Result: 500 Internal Server Error
```

## Environment
- **Backend**: Running uvicorn with --reload
- **Frontend**: React + Vite dev server
- **Database**: PostgreSQL
- **List ID**: 58b1af58-b02c-410c-915c-a512a3631483
- **Schema ID**: 71f69fa1-d45c-40b3-8fc4-870e23adc5b2

## Observed Behavior
1. Frontend sends `schema_id` in tag creation request
2. Backend creates tag but ignores `schema_id` (always null)
3. When attempting to UPDATE tag with `schema_id`, backend returns 500 error
4. This causes videos page to fail loading with repeated 500 errors

## Expected Behavior
1. Tag should be created with `schema_id` when provided
2. Tag should be updatable with `schema_id`
3. Videos page should load successfully with schema-tagged videos

## Related Files
- `/backend/app/api/tags.py` - Tag CRUD endpoints (lines 100-286)
- `/backend/app/schemas/tag.py` - TagCreate/TagUpdate schemas
- `/frontend/src/components/CreateTagDialog.tsx` - Frontend tag creation UI

## Error Messages
- Frontend: `Server error: 500 - /lists/58b1af58-b02c-410c-915c-a512a3631483/videos`
- Backend: Internal Server Error (exact error TBD)

## Reproduction Success Rate
100% - Consistently reproducible
