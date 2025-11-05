# Custom Fields System Design

**Date:** 2025-11-05
**Status:** Design Approved
**Author:** Claude Code (Brainstorming Session)

## Executive Summary

This design introduces a flexible custom fields system that allows users to create reusable rating criteria for their video collections. Fields are organized into schemas that can be bound to tags, enabling context-specific evaluation (e.g., "Makeup Tutorials" have different criteria than "Keto Recipes").

**Key Features:**
- ✅ Four field types: Dropdown/Select, Rating (1-5 stars), Text, Boolean
- ✅ Reusable field definitions (no duplicates across the system)
- ✅ Schema templates for grouping related fields
- ✅ Tag-bound schemas with multi-tag union support
- ✅ Inline editing on video cards (max 3 fields visible)
- ✅ Detail modal for all fields with schema grouping

## Requirements Summary

### User Goals
- Create custom evaluation criteria for videos (e.g., "Presentation Style", "Recipe Difficulty")
- Reuse common criteria across different tag types
- Quickly rate videos without opening separate forms
- Group related criteria into templates (schemas)
- Avoid duplicate field definitions

### Constraints
- Fields are list-scoped (like tags, tied to workspace concept)
- Max 3 fields shown directly on video cards to avoid visual clutter
- No duplicate field names within a list (case-insensitive)
- Performance must not degrade with 1000+ videos and 10+ fields each

### Success Criteria
- User can create a tag with custom fields in < 2 minutes
- Inline field editing works without page reload
- Filtering by field values is performant (< 500ms for 1000 videos)
- Schema reuse reduces redundant field creation

## Architecture

### Design Decision: Relational Schema-First

**Chosen Approach:** Relational database model with normalized tables

**Alternatives Considered:**
1. **JSONB-Flex (Document-Style):** Store field definitions and values in JSONB columns
   - ❌ Rejected: Poor query performance for filtering, no type safety
2. **Hybrid (Schema + JSONB):** Normalized field definitions but JSONB for values
   - ❌ Rejected: Still complex queries, limited benefit over full relational

**Why Relational:**
- ✅ **Performance:** Filtering by field values requires indexes on typed columns (value_numeric, value_text)
- ✅ **Type Safety:** Database enforces data types and foreign key constraints
- ✅ **Scalability:** PostgreSQL excels at joins with proper indexes (100k rows trivial)
- ✅ **Consistency:** Prevents orphaned field values via CASCADE deletes
- ✅ **Query Optimization:** PostgreSQL query planner optimizes multi-table joins efficiently

## Data Model

### Database Schema

**New Tables:**

#### 1. `custom_fields` (Global Field Definitions)
```sql
CREATE TABLE custom_fields (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    list_id UUID NOT NULL REFERENCES lists(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    field_type VARCHAR(50) NOT NULL CHECK (field_type IN ('select', 'rating', 'text', 'boolean')),
    config JSONB NOT NULL DEFAULT '{}',  -- Type-specific config (e.g., {"options": [...], "max_rating": 5})
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(list_id, name)  -- Prevent duplicates within list
);

CREATE INDEX idx_custom_fields_list ON custom_fields(list_id);
```

**Config Examples:**
- Select: `{"options": ["bad", "good", "great"]}`
- Rating: `{"max_rating": 5}`
- Text: `{"max_length": 500}` (optional)
- Boolean: `{}` (no config needed)

#### 2. `field_schemas` (Reusable Field Collections)
```sql
CREATE TABLE field_schemas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    list_id UUID NOT NULL REFERENCES lists(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_field_schemas_list ON field_schemas(list_id);
```

#### 3. `schema_fields` (Many-to-Many Join)
```sql
CREATE TABLE schema_fields (
    schema_id UUID NOT NULL REFERENCES field_schemas(id) ON DELETE CASCADE,
    field_id UUID NOT NULL REFERENCES custom_fields(id) ON DELETE CASCADE,
    display_order INTEGER NOT NULL DEFAULT 0,
    show_on_card BOOLEAN NOT NULL DEFAULT FALSE,  -- Max 3 per schema should be true
    PRIMARY KEY (schema_id, field_id)
);

CREATE INDEX idx_schema_fields_schema ON schema_fields(schema_id);
CREATE INDEX idx_schema_fields_field ON schema_fields(field_id);
```

#### 4. `video_field_values` (Video-Specific Values)
```sql
CREATE TABLE video_field_values (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    video_id UUID NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
    field_id UUID NOT NULL REFERENCES custom_fields(id) ON DELETE CASCADE,
    value_text TEXT,       -- For 'text' and 'select' types
    value_numeric NUMERIC, -- For 'rating' type
    value_boolean BOOLEAN, -- For 'boolean' type
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(video_id, field_id)  -- One value per field per video
);

-- Performance indexes for filtering
CREATE INDEX idx_vfv_field_numeric ON video_field_values(field_id, value_numeric);
CREATE INDEX idx_vfv_field_text ON video_field_values(field_id, value_text);
CREATE INDEX idx_vfv_video_field ON video_field_values(video_id, field_id);
```

**Modified Table:**

#### 5. `tags` (Add Schema Binding)
```sql
ALTER TABLE tags ADD COLUMN schema_id UUID REFERENCES field_schemas(id) ON DELETE SET NULL;
CREATE INDEX idx_tags_schema ON tags(schema_id);
```

### Relationships

```
List
 ├─> CustomField (1:N)
 ├─> FieldSchema (1:N)
 └─> Tag (1:N)
      └─> FieldSchema (1:1, optional)
           └─> SchemaField (N:M via schema_fields)
                └─> CustomField

Video
 ├─> VideoTag (N:M)
 │    └─> Tag (gets fields via Tag.schema)
 └─> VideoFieldValue (1:N)
      └─> CustomField
```

### Multi-Tag Field Union Logic

When a video has multiple tags with different schemas:
1. Collect all `schema_id` from video's tags
2. Union all fields from all schemas (via `schema_fields`)
3. If field names conflict with **different types**:
   - Add schema name prefix: `"Video Quality: Rating"` vs `"Content: Rating"`
4. If field names match with **same type**:
   - Show once, use value from first tag's schema

**Example:**
- Video has tags: `["Makeup Tutorial", "Product Review"]`
- "Makeup Tutorial" schema: `[Presentation (Select), Overall Rating (Rating)]`
- "Product Review" schema: `[Product Quality (Rating), Overall Rating (Rating)]`
- Resulting fields: `[Presentation, Product Quality, Overall Rating]` (3 fields total)

## Backend API Design

### New Endpoints

**Base Path:** `/api/lists/{list_id}/`

#### Custom Fields Management
```
GET    /custom-fields                     # List all fields for list
POST   /custom-fields                     # Create new field
PUT    /custom-fields/{field_id}          # Update field definition
DELETE /custom-fields/{field_id}          # Delete field (fails if used in any schema)
POST   /custom-fields/check-duplicate     # Check if field name exists (case-insensitive)
```

**POST /custom-fields Request:**
```json
{
  "name": "Presentation Quality",
  "field_type": "select",
  "config": {
    "options": ["bad", "all over the place", "confusing", "great"]
  }
}
```

**POST /custom-fields/check-duplicate Request:**
```json
{"name": "presentation quality"}
```
**Response (if exists):**
```json
{
  "exists": true,
  "field": {
    "id": "uuid",
    "name": "Presentation Quality",
    "field_type": "select",
    "config": {...}
  }
}
```

#### Schemas Management
```
GET    /schemas                           # List all schemas
POST   /schemas                           # Create new schema
PUT    /schemas/{schema_id}               # Update schema metadata
DELETE /schemas/{schema_id}               # Delete schema (warns if used by tags)
GET    /schemas/{schema_id}/fields        # Get fields in schema (ordered)
POST   /schemas/{schema_id}/fields        # Add field to schema
PUT    /schemas/{schema_id}/fields/{field_id}  # Update display_order or show_on_card
DELETE /schemas/{schema_id}/fields/{field_id}  # Remove field from schema
```

**POST /schemas Request:**
```json
{
  "name": "Video Quality",
  "description": "Standard video quality metrics",
  "fields": [
    {
      "field_id": "uuid-presentation",
      "display_order": 0,
      "show_on_card": true
    },
    {
      "field_id": "uuid-rating",
      "display_order": 1,
      "show_on_card": true
    }
  ]
}
```

#### Tag-Schema Binding (Extension of Existing API)
```
PUT    /tags/{tag_id}                     # Add {"schema_id": "uuid"} to request body
```

#### Video Field Values (Extension of Existing API)
```
GET    /videos/{video_id}                 # Response includes "field_values" array
PUT    /videos/{video_id}/fields          # Batch update all field values
```

**GET /videos/{video_id} Response (Extended):**
```json
{
  "id": "video-uuid",
  "title": "How to Apply Eyeliner",
  "tags": [...],
  "field_values": [
    {
      "field_id": "uuid-presentation",
      "field": {
        "name": "Presentation Quality",
        "field_type": "select",
        "config": {"options": ["bad", "good", "great"]}
      },
      "value": "great",
      "schema_name": "Video Quality",
      "show_on_card": true
    },
    {
      "field_id": "uuid-rating",
      "field": {
        "name": "Overall Rating",
        "field_type": "rating",
        "config": {"max_rating": 5}
      },
      "value": 4,
      "schema_name": "Video Quality",
      "show_on_card": true
    }
  ]
}
```

**PUT /videos/{video_id}/fields Request:**
```json
{
  "field_values": [
    {"field_id": "uuid-presentation", "value": "great"},
    {"field_id": "uuid-rating", "value": 4}
  ]
}
```

### Backend Validation Logic

**Field Value Validation:**
- `rating`: Must be integer, `0 <= value <= config.max_rating`
- `select`: Must be in `config.options` list
- `boolean`: Must be boolean
- `text`: Optional `max_length` check

**Schema Validation:**
- Max 3 fields can have `show_on_card = true` per schema
- Field must exist in same list as schema

**Duplicate Check:**
- Case-insensitive: `"Presentation Quality"` = `"presentation quality"`
- Later: Levenshtein distance for typo detection

## Frontend Design

### Component Architecture

#### 1. Tag Edit Dialog Extension

**Location:** `frontend/src/components/tags/TagEditDialog.tsx` (existing, extend)

**New Sections:**
```tsx
<TagEditDialog>
  {/* Existing: name, color */}

  <SchemaSection>
    <SchemaSelector
      schemas={schemas}
      selectedSchemaId={formData.schema_id}
      onSelect={handleSchemaSelect}
    />

    {isCreatingNewSchema && (
      <SchemaEditor
        listId={listId}
        onSave={handleSchemaSave}
        availableFields={customFields}
      />
    )}
  </SchemaSection>
</TagEditDialog>
```

**Components:**
- `SchemaSelector`: Dropdown with "Existing Schema" or "Create New"
- `SchemaEditor`: Form for creating/editing schemas
  - `FieldMultiSelect`: Select from existing fields
  - `NewFieldForm`: Inline form for creating new field
  - `FieldOrderManager`: Drag-drop for display_order + "Show on Card" toggles
  - `DuplicateWarning`: Real-time check when typing field name

#### 2. Video Card Custom Fields Preview

**Location:** `frontend/src/components/videos/VideoCard.tsx` (existing, extend)

```tsx
<VideoCard>
  {/* Existing: thumbnail, title, tags */}

  <CustomFieldsPreview
    fieldValues={video.field_values.filter(fv => fv.show_on_card)}
    onValueChange={handleInlineEdit}
  />

  {video.field_values.length > 3 && (
    <MoreInfoButton onClick={() => setShowDetailsModal(true)} />
  )}
</VideoCard>
```

**Field Display Components:**
```tsx
// frontend/src/components/fields/FieldDisplay.tsx
function FieldDisplay({ field, value, editable, onChange }) {
  switch (field.field_type) {
    case 'rating':
      return <RatingStars value={value} max={field.config.max_rating} onChange={onChange} />
    case 'select':
      return <SelectBadge value={value} options={field.config.options} onChange={onChange} />
    case 'boolean':
      return <Checkbox checked={value} onChange={onChange} />
    case 'text':
      return <TextSnippet value={value} maxLength={50} onClick={openFullEdit} />
  }
}
```

#### 3. Video Details Modal (NEW)

**Location:** `frontend/src/components/videos/VideoDetailsModal.tsx`

```tsx
<VideoDetailsModal video={video} onClose={handleClose}>
  <VideoHeader
    title={video.title}
    thumbnail={video.thumbnail_url}
    tags={video.tags}
  />

  <CustomFieldsSection>
    {groupedBySchema(video.field_values).map(group => (
      <SchemaGroup key={group.schema_name} name={group.schema_name}>
        {group.fields.map(fv => (
          <FieldEditor
            key={fv.field_id}
            field={fv.field}
            value={fv.value}
            onChange={handleFieldChange}
          />
        ))}
      </SchemaGroup>
    ))}
  </CustomFieldsSection>

  <Actions>
    <Button onClick={handleSave}>Save</Button>
    <Button variant="ghost" onClick={onClose}>Cancel</Button>
  </Actions>
</VideoDetailsModal>
```

#### 4. Settings Page (Phase 2 - Later)

**Location:** `frontend/src/pages/SettingsPage.tsx` (NEW)

**Route:** `/settings/schemas`

```tsx
<SettingsPage>
  <Tabs>
    <TabPanel value="schemas">
      <SchemasList
        schemas={schemas}
        onEdit={handleSchemaEdit}
        onDelete={handleSchemaDelete}
        onDuplicate={handleSchemaDuplicate}
      />
    </TabPanel>

    <TabPanel value="fields">
      <FieldsList
        fields={customFields}
        onEdit={handleFieldEdit}
        onDelete={handleFieldDelete}
        showUsageCount={true}
      />
    </TabPanel>
  </Tabs>
</SettingsPage>
```

### State Management

**TanStack Query Hooks:**

```typescript
// frontend/src/hooks/useCustomFields.ts
export function useCustomFields(listId: string) {
  return useQuery(['custom-fields', listId], () =>
    api.getCustomFields(listId)
  )
}

export function useCreateField(listId: string) {
  return useMutation(
    (data: CreateFieldRequest) => api.createCustomField(listId, data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['custom-fields', listId])
      }
    }
  )
}

// frontend/src/hooks/useSchemas.ts
export function useSchemas(listId: string) {
  return useQuery(['schemas', listId], () => api.getSchemas(listId))
}

// frontend/src/hooks/useVideoFieldValues.ts
export function useUpdateVideoFields(videoId: string) {
  return useMutation(
    (values: FieldValue[]) => api.updateVideoFields(videoId, values),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['videos'])
      }
    }
  )
}
```

### User Flow Example

**Scenario:** User creates "Makeup Tutorials" tag with custom rating criteria

1. User clicks "New Tag" → `TagEditDialog` opens
2. User enters tag name "Makeup Tutorials"
3. User sees "Schema" section → clicks "Create New Schema"
4. `SchemaEditor` appears
5. User clicks "Add Field" → `FieldMultiSelect` dropdown shows existing fields (empty)
6. User clicks "+ New Field"
7. `NewFieldForm` inline appears:
   - Name: "Presentation Quality" → no duplicate warning
   - Type: Select → Config shows "Add options"
   - Options: "bad", "all over the place", "confusing", "great"
8. User clicks "Add" → Field created and added to schema
9. User repeats for "Overall Rating" (type: Rating, max: 5)
10. User toggles "Show on Card" for both fields
11. User saves tag → Tag created with new schema and fields
12. User opens video → sees 2 new editable fields on card

## Error Handling & Edge Cases

### Edge Case Solutions

**1. Tag Deletion with Schema**
- **Issue:** User deletes tag, schema still exists
- **Solution:** Show warning: "This tag uses schema 'Video Quality'. Schema will remain available for other tags."
- **Implementation:** `ON DELETE SET NULL` on `tags.schema_id`

**2. Field Deletion with Existing Values**
- **Issue:** Field deleted but videos have values
- **Solution:**
  - Before delete: Check count of `video_field_values` for this field
  - Show confirmation: "This field is used by 47 videos. All values will be deleted."
  - `ON DELETE CASCADE` removes values automatically

**3. Schema Modification (Field Removed)**
- **Issue:** Schema removes a field, but videos still have values
- **Solution:** Keep values in DB (historical data), just don't display them anymore
- **Benefit:** If field re-added to schema, values reappear

**4. Multi-Tag Field Name Conflict**
- **Issue:** Video has Tag A (Field "Rating" as stars) and Tag B (Field "Rating" as text)
- **Solution:** Detect same name + different type → prepend schema name
- **Display:** "Video Quality: Rating" (5 stars) vs "Content: Rating" (text)

**5. Duplicate Check with Typos**
- **Issue:** User creates "Presentaton" but "Presentation Quality" exists
- **Solution (Phase 1):** Case-insensitive exact match
- **Solution (Phase 2):** Levenshtein distance < 3 → suggest existing field

**6. Too Many Fields (10 Tags × 5 Fields Each)**
- **Issue:** Video gets 50+ fields, UI overwhelmed
- **Solution:**
  - Card: Max 3 fields (enforced by `show_on_card`)
  - Modal: Group by schema with collapse/expand
  - Warning when video has > 5 tags: "Many tags may result in many fields"

### Frontend Error States

**Loading States:**
- Card field preview: Skeleton loaders (3 rectangles)
- Modal: Shimmer effect while fetching full field list

**API Errors:**
- Field save fails → Toast notification: "Could not save rating. Please try again."
- Duplicate field creation → Inline error: "A field named 'Presentation Quality' already exists."

**Validation Errors:**
- Rating out of range → Red border + message: "Rating must be between 1-5"
- Select invalid option → Dropdown shows error state

## Testing Strategy

### Backend Tests

**Unit Tests (pytest):**
```python
# tests/api/test_custom_fields.py
def test_custom_field_duplicate_check_case_insensitive(db_session):
    """Duplicate check ignores case"""
    create_field(name="Overall Rating", field_type="rating")
    result = check_duplicate(name="overall rating")
    assert result["exists"] is True

def test_field_validation_rating_out_of_range(db_session):
    """Rating value must be <= max_rating"""
    field = create_field(config={"max_rating": 5})
    with pytest.raises(ValidationError):
        set_video_field_value(field_id, value=6)

def test_schema_field_union_multiple_tags(db_session):
    """Video with multiple tags gets union of all fields"""
    schema_a = create_schema(fields=["field1", "field2"])
    schema_b = create_schema(fields=["field2", "field3"])
    tag_a = create_tag(schema=schema_a)
    tag_b = create_tag(schema=schema_b)
    video = create_video(tags=[tag_a, tag_b])

    fields = get_video_applicable_fields(video.id)
    assert len(fields) == 3  # Union: field1, field2, field3

def test_field_name_conflict_resolution(db_session):
    """Same name + different type → adds schema prefix"""
    schema_a = create_schema(fields=[
        create_field(name="Rating", field_type="rating")
    ])
    schema_b = create_schema(fields=[
        create_field(name="Rating", field_type="text")
    ])
    video = create_video(tags=[tag_a, tag_b])

    fields = get_video_applicable_fields(video.id)
    field_names = [f["display_name"] for f in fields]
    assert "Schema A: Rating" in field_names
    assert "Schema B: Rating" in field_names
```

**Integration Tests:**
```python
# tests/integration/test_custom_fields_flow.py
def test_create_tag_with_new_schema_and_field(client, db_session):
    """End-to-end: Create tag with new schema and field"""
    response = client.post("/api/lists/{list_id}/tags", json={
        "name": "Makeup Tutorials",
        "schema": {
            "name": "Video Quality",
            "fields": [
                {
                    "name": "Presentation",
                    "field_type": "select",
                    "config": {"options": ["bad", "good", "great"]},
                    "show_on_card": True
                }
            ]
        }
    })
    assert response.status_code == 201
    tag = response.json()
    assert tag["schema"]["fields"][0]["name"] == "Presentation"

def test_cascade_delete_field_removes_values(client, db_session):
    """Deleting field cascades to video_field_values"""
    field = create_field()
    video = create_video()
    set_field_value(video.id, field.id, value=5)

    client.delete(f"/api/lists/{list_id}/custom-fields/{field.id}")

    values = db_session.query(VideoFieldValue).filter_by(field_id=field.id).all()
    assert len(values) == 0
```

### Frontend Tests

**Component Tests (Vitest + React Testing Library):**
```typescript
// frontend/src/components/tags/TagEditDialog.test.tsx
describe('TagEditDialog', () => {
  it('shows schema selector when creating tag', () => {
    render(<TagEditDialog mode="create" />)
    expect(screen.getByText('Schema')).toBeInTheDocument()
  })

  it('allows creating new schema inline', async () => {
    render(<TagEditDialog mode="create" />)
    await userEvent.click(screen.getByText('Create New Schema'))
    expect(screen.getByLabelText('Schema Name')).toBeInTheDocument()
  })
})

// frontend/src/components/videos/CustomFieldsPreview.test.tsx
describe('CustomFieldsPreview', () => {
  it('shows max 3 fields on card', () => {
    const fields = createFieldValues(5, { show_on_card: true })
    render(<CustomFieldsPreview fieldValues={fields} />)
    expect(screen.getAllByRole('field-display')).toHaveLength(3)
  })

  it('allows inline editing of rating field', async () => {
    const onChange = vi.fn()
    render(<CustomFieldsPreview fieldValues={[ratingField]} onValueChange={onChange} />)

    await userEvent.click(screen.getByLabelText('4 stars'))
    expect(onChange).toHaveBeenCalledWith(ratingField.field_id, 4)
  })
})

// frontend/src/components/fields/DuplicateWarning.test.tsx
describe('DuplicateWarning', () => {
  it('shows warning when field name exists', async () => {
    server.use(
      http.post('/api/lists/:id/custom-fields/check-duplicate', () => {
        return HttpResponse.json({ exists: true, field: mockField })
      })
    )

    render(<NewFieldForm />)
    await userEvent.type(screen.getByLabelText('Field Name'), 'Overall Rating')

    await waitFor(() => {
      expect(screen.getByText(/field already exists/i)).toBeInTheDocument()
    })
  })
})
```

**Integration Tests:**
```typescript
// frontend/src/tests/CustomFieldsFlow.integration.test.tsx
describe('Custom Fields Flow', () => {
  it('creates tag with schema and sets field value on video', async () => {
    render(<VideosPage />, { wrapper: RouterWrapper })

    // Create tag with schema
    await userEvent.click(screen.getByText('New Tag'))
    await userEvent.type(screen.getByLabelText('Tag Name'), 'Makeup')
    await userEvent.click(screen.getByText('Create New Schema'))
    // ... create field ...
    await userEvent.click(screen.getByText('Save'))

    // Apply tag to video
    await userEvent.click(screen.getByTestId('video-card-1'))
    await userEvent.click(screen.getByText('Add Tag'))
    await userEvent.click(screen.getByText('Makeup'))

    // Set field value
    expect(screen.getByLabelText('Overall Rating')).toBeInTheDocument()
    await userEvent.click(screen.getByLabelText('5 stars'))

    // Verify saved
    await waitFor(() => {
      expect(screen.getByDisplayValue('5')).toBeInTheDocument()
    })
  })
})
```

## Database Migration

### Alembic Migration Script

**File:** `backend/alembic/versions/YYYY_MM_DD_add_custom_fields_system.py`

```python
"""Add custom fields system

Revision ID: abc123def456
Revises: previous_revision
Create Date: 2025-11-05

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB

revision = 'abc123def456'
down_revision = 'previous_revision'

def upgrade():
    # 1. Create custom_fields table
    op.create_table(
        'custom_fields',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('list_id', UUID(as_uuid=True), sa.ForeignKey('lists.id', ondelete='CASCADE'), nullable=False),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('field_type', sa.String(50), nullable=False),
        sa.Column('config', JSONB, nullable=False, server_default='{}'),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.TIMESTAMP(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now()),
        sa.UniqueConstraint('list_id', 'name', name='uq_custom_fields_list_name'),
        sa.CheckConstraint("field_type IN ('select', 'rating', 'text', 'boolean')", name='ck_field_type')
    )
    op.create_index('idx_custom_fields_list', 'custom_fields', ['list_id'])

    # 2. Create field_schemas table
    op.create_table(
        'field_schemas',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('list_id', UUID(as_uuid=True), sa.ForeignKey('lists.id', ondelete='CASCADE'), nullable=False),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('description', sa.Text),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.TIMESTAMP(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now())
    )
    op.create_index('idx_field_schemas_list', 'field_schemas', ['list_id'])

    # 3. Create schema_fields join table
    op.create_table(
        'schema_fields',
        sa.Column('schema_id', UUID(as_uuid=True), sa.ForeignKey('field_schemas.id', ondelete='CASCADE'), nullable=False),
        sa.Column('field_id', UUID(as_uuid=True), sa.ForeignKey('custom_fields.id', ondelete='CASCADE'), nullable=False),
        sa.Column('display_order', sa.Integer, nullable=False, server_default='0'),
        sa.Column('show_on_card', sa.Boolean, nullable=False, server_default='false'),
        sa.PrimaryKeyConstraint('schema_id', 'field_id')
    )
    op.create_index('idx_schema_fields_schema', 'schema_fields', ['schema_id'])
    op.create_index('idx_schema_fields_field', 'schema_fields', ['field_id'])

    # 4. Create video_field_values table
    op.create_table(
        'video_field_values',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('video_id', UUID(as_uuid=True), sa.ForeignKey('videos.id', ondelete='CASCADE'), nullable=False),
        sa.Column('field_id', UUID(as_uuid=True), sa.ForeignKey('custom_fields.id', ondelete='CASCADE'), nullable=False),
        sa.Column('value_text', sa.Text),
        sa.Column('value_numeric', sa.Numeric),
        sa.Column('value_boolean', sa.Boolean),
        sa.Column('updated_at', sa.TIMESTAMP(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now()),
        sa.UniqueConstraint('video_id', 'field_id', name='uq_video_field_values')
    )
    # Performance indexes for filtering
    op.create_index('idx_vfv_field_numeric', 'video_field_values', ['field_id', 'value_numeric'])
    op.create_index('idx_vfv_field_text', 'video_field_values', ['field_id', 'value_text'])
    op.create_index('idx_vfv_video_field', 'video_field_values', ['video_id', 'field_id'])

    # 5. Extend tags table
    op.add_column('tags', sa.Column('schema_id', UUID(as_uuid=True), sa.ForeignKey('field_schemas.id', ondelete='SET NULL')))
    op.create_index('idx_tags_schema', 'tags', ['schema_id'])

def downgrade():
    # Remove in reverse order
    op.drop_index('idx_tags_schema', table_name='tags')
    op.drop_column('tags', 'schema_id')

    op.drop_index('idx_vfv_video_field', table_name='video_field_values')
    op.drop_index('idx_vfv_field_text', table_name='video_field_values')
    op.drop_index('idx_vfv_field_numeric', table_name='video_field_values')
    op.drop_table('video_field_values')

    op.drop_index('idx_schema_fields_field', table_name='schema_fields')
    op.drop_index('idx_schema_fields_schema', table_name='schema_fields')
    op.drop_table('schema_fields')

    op.drop_index('idx_field_schemas_list', table_name='field_schemas')
    op.drop_table('field_schemas')

    op.drop_index('idx_custom_fields_list', table_name='custom_fields')
    op.drop_table('custom_fields')
```

## Implementation Phases

### Phase 1: Core Functionality (MVP)

**Scope:**
- ✅ Database migrations
- ✅ Backend API for fields, schemas, and values
- ✅ Tag edit dialog with inline schema creation
- ✅ Custom fields preview on video cards (max 3, inline edit)
- ✅ Video details modal with all fields
- ✅ Duplicate field check (case-insensitive exact match)
- ✅ Multi-tag field union logic
- ✅ Basic tests (unit + integration)

**Deliverables:**
- Working end-to-end flow: Create tag → define schema → rate videos
- Performance validated with 1000 videos

**Estimated Effort:** 5-7 days

### Phase 2: Settings & Management UI

**Scope:**
- ✅ Settings page at `/settings/schemas`
- ✅ Global schema management (edit, delete, duplicate)
- ✅ Global field management (view usage, edit, delete)
- ✅ Schema templates (predefined common schemas)
- ✅ Bulk operations (apply schema to multiple tags)

**Deliverables:**
- Power-user features for managing many schemas/fields
- Analytics (most-used fields, unused schemas)

**Estimated Effort:** 3-4 days

### Phase 3: Advanced Features

**Scope:**
- ✅ AI-powered duplicate detection (Levenshtein + semantic similarity)
- ✅ Field-based filtering in video list ("Show videos with Rating ≥ 4")
- ✅ Field-based sorting
- ✅ Export custom field data to CSV
- ✅ Import field values from CSV

**Deliverables:**
- Enhanced UX with smart suggestions and powerful querying

**Estimated Effort:** 4-5 days

## Future Considerations

### Workspace Migration (Lists → Workspaces)
When lists become workspaces:
- Custom fields remain list-scoped (now workspace-scoped)
- Option to "Copy schema to another workspace"
- Global field library across all workspaces (if user enables)

### AI Integration Ideas
- **Auto-suggest field values:** Analyze video transcript → suggest "Presentation: great"
- **Smart field creation:** User says "I want to rate clarity" → AI suggests existing "Clarity Rating" field
- **Field recommendations:** "Videos tagged 'Tutorial' often have these fields: [Difficulty, Length, Quality]"

### Performance Optimizations
- **Field values cache:** Redis cache for frequently accessed video field values
- **Materialized view:** Pre-compute field statistics (avg rating per tag, etc.)
- **Lazy loading:** Load field values only when card is visible (viewport intersection)

### API Enhancements
- **GraphQL alternative:** For complex queries with nested field data
- **Bulk field updates:** Update same field across multiple videos at once
- **Field value history:** Track changes over time (audit log)

## Appendix

### Example SQL Queries

**Get all fields for a video (via its tags):**
```sql
SELECT DISTINCT cf.*
FROM custom_fields cf
JOIN schema_fields sf ON cf.id = sf.field_id
JOIN field_schemas fs ON sf.schema_id = fs.id
JOIN tags t ON fs.id = t.schema_id
JOIN video_tags vt ON t.id = vt.tag_id
WHERE vt.video_id = :video_id
ORDER BY sf.display_order;
```

**Filter videos by field value:**
```sql
SELECT v.*
FROM videos v
JOIN video_field_values vfv ON v.id = vfv.video_id
WHERE vfv.field_id = :rating_field_id
  AND vfv.value_numeric >= 4;
```

**Find duplicate field name (case-insensitive):**
```sql
SELECT * FROM custom_fields
WHERE list_id = :list_id
  AND LOWER(name) = LOWER(:field_name);
```

### TypeScript Types

```typescript
// frontend/src/types/customFields.ts

export type FieldType = 'select' | 'rating' | 'text' | 'boolean'

export interface CustomField {
  id: string
  list_id: string
  name: string
  field_type: FieldType
  config: FieldConfig
  created_at: string
  updated_at: string
}

export type FieldConfig =
  | { options: string[] }              // select
  | { max_rating: number }             // rating
  | { max_length?: number }            // text
  | {}                                 // boolean

export interface FieldSchema {
  id: string
  list_id: string
  name: string
  description?: string
  fields: SchemaField[]
  created_at: string
  updated_at: string
}

export interface SchemaField {
  field_id: string
  field: CustomField
  display_order: number
  show_on_card: boolean
}

export interface VideoFieldValue {
  id: string
  video_id: string
  field_id: string
  field: CustomField
  value: string | number | boolean
  schema_name?: string  // For display with multi-tag videos
  show_on_card: boolean
  updated_at: string
}
```

### SQLAlchemy Models (Preview)

```python
# backend/app/models/custom_field.py
from sqlalchemy import Column, String, ForeignKey, UniqueConstraint, CheckConstraint
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from app.models.base import BaseModel

class CustomField(BaseModel):
    __tablename__ = "custom_fields"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    list_id = Column(UUID(as_uuid=True), ForeignKey("lists.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(255), nullable=False)
    field_type = Column(String(50), nullable=False)
    config = Column(JSONB, nullable=False, default={})

    # Relationships
    list = relationship("VideoList", back_populates="custom_fields")
    schemas = relationship("SchemaField", back_populates="field")
    values = relationship("VideoFieldValue", back_populates="field", cascade="all, delete-orphan")

    __table_args__ = (
        UniqueConstraint('list_id', 'name', name='uq_custom_fields_list_name'),
        CheckConstraint("field_type IN ('select', 'rating', 'text', 'boolean')", name='ck_field_type'),
    )
```

---

**End of Design Document**
