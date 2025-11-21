# Testing Strategy: Category-Fields Hybrid System

**Feature ID:** category-fields-hybrid
**Date:** 2025-11-20
**Phase:** 9 - Testing Strategy

---

## Testing Philosophy

### Principles

1. **Test Pyramid** - More unit tests, fewer E2E tests
2. **Test Behavior, Not Implementation** - Focus on what users see/do
3. **Fast Feedback** - Unit tests run in < 1s
4. **Isolated Tests** - No dependencies between tests
5. **Readable Tests** - Tests are documentation

---

## Test Levels

### Level 1: Unit Tests (70%)

**Goal:** Test individual functions/components in isolation

**Tools:**
- Backend: pytest
- Frontend: Vitest + React Testing Library

**Coverage Target:** 85%

---

### Level 2: Integration Tests (20%)

**Goal:** Test components working together

**Tools:**
- Backend: pytest with real database
- Frontend: Vitest with mock API

**Coverage Target:** Key workflows

---

### Level 3: E2E Tests (10%)

**Goal:** Test complete user flows

**Tools:**
- Playwright (future - not in this phase)
- Manual testing (current)

**Coverage Target:** Critical paths

---

## Backend Testing

### Unit Tests: Services

#### Test File: `backend/tests/unit/test_field_value_backup.py`

**Purpose:** Test backup service in isolation

**Test Cases:**

```python
class TestFieldValueBackupService:
    """Tests for field value backup/restore functionality."""

    def test_backup_creates_json_file(self, tmp_path):
        """Should create JSON backup file with correct structure."""
        # Arrange
        video_id = uuid4()
        category_id = uuid4()
        field_values = [
            MockFieldValue(field_name="Kalorien", value_numeric=320),
            MockFieldValue(field_name="Lecker", value_boolean=True),
        ]

        # Act
        backup_path = backup_field_values(
            video_id, category_id, field_values, backup_dir=tmp_path
        )

        # Assert
        assert backup_path.exists()
        backup_data = json.loads(backup_path.read_text())
        assert backup_data["video_id"] == str(video_id)
        assert backup_data["category_id"] == str(category_id)
        assert len(backup_data["values"]) == 2
        assert backup_data["values"][0]["field_name"] == "Kalorien"

    def test_backup_handles_empty_values(self, tmp_path):
        """Should not create backup if no values to backup."""
        # Arrange
        video_id = uuid4()
        category_id = uuid4()
        field_values = []

        # Act
        backup_path = backup_field_values(
            video_id, category_id, field_values, backup_dir=tmp_path
        )

        # Assert
        assert backup_path is None

    def test_restore_recreates_field_values(self, tmp_path, mock_db):
        """Should restore field values from backup file."""
        # Arrange: Create backup file
        video_id = uuid4()
        category_id = uuid4()
        backup_data = {
            "video_id": str(video_id),
            "category_id": str(category_id),
            "values": [
                {"field_id": str(uuid4()), "value_numeric": 320},
                {"field_id": str(uuid4()), "value_boolean": True},
            ]
        }
        backup_file = tmp_path / str(video_id) / f"{category_id}.json"
        backup_file.parent.mkdir(parents=True)
        backup_file.write_text(json.dumps(backup_data))

        # Act
        restored_count = restore_field_values(
            video_id, category_id, mock_db, backup_dir=tmp_path
        )

        # Assert
        assert restored_count == 2
        # Verify VideoFieldValue objects created in DB

    def test_restore_handles_corrupted_file(self, tmp_path, mock_db):
        """Should gracefully handle corrupted backup file."""
        # Arrange
        video_id = uuid4()
        category_id = uuid4()
        backup_file = tmp_path / str(video_id) / f"{category_id}.json"
        backup_file.parent.mkdir(parents=True)
        backup_file.write_text("CORRUPTED JSON {{{")

        # Act
        restored_count = restore_field_values(
            video_id, category_id, mock_db, backup_dir=tmp_path
        )

        # Assert
        assert restored_count == 0  # No values restored, but no crash

    def test_list_backups_returns_all_for_video(self, tmp_path):
        """Should list all backup files for a video."""
        # Arrange
        video_id = uuid4()
        cat1 = uuid4()
        cat2 = uuid4()

        # Create 2 backups
        (tmp_path / str(video_id)).mkdir(parents=True)
        (tmp_path / str(video_id) / f"{cat1}.json").write_text("{}")
        (tmp_path / str(video_id) / f"{cat2}.json").write_text("{}")

        # Act
        backups = list_backups(video_id, backup_dir=tmp_path)

        # Assert
        assert len(backups) == 2
        assert any(b.category_id == cat1 for b in backups)
        assert any(b.category_id == cat2 for b in backups)

    def test_delete_backup_removes_file(self, tmp_path):
        """Should delete specific backup file."""
        # Arrange
        video_id = uuid4()
        category_id = uuid4()
        backup_file = tmp_path / str(video_id) / f"{category_id}.json"
        backup_file.parent.mkdir(parents=True)
        backup_file.write_text("{}")

        # Act
        deleted = delete_backup(video_id, category_id, backup_dir=tmp_path)

        # Assert
        assert deleted is True
        assert not backup_file.exists()
```

**Coverage:** All functions in backup service

---

#### Test File: `backend/tests/unit/test_field_aggregation.py`

**Purpose:** Test field aggregation logic

**Test Cases:**

```python
class TestFieldAggregationService:
    """Tests for field aggregation (combining workspace + category fields)."""

    async def test_aggregates_workspace_fields_only(self, mock_db):
        """Video with no category should only get workspace fields."""
        # Arrange
        video = MockVideo(category=None)
        workspace_schema = MockSchema(fields=["Rating", "Notes"])
        video.list.default_schema = workspace_schema

        # Act
        fields = await get_available_fields(video, mock_db)

        # Assert
        assert len(fields) == 2
        assert "Rating" in [f.name for f in fields]
        assert "Notes" in [f.name for f in fields]

    async def test_aggregates_workspace_and_category_fields(self, mock_db):
        """Video with category should get both workspace + category fields."""
        # Arrange
        workspace_schema = MockSchema(fields=["Rating", "Notes"])
        category_schema = MockSchema(fields=["Kalorien", "Lecker"])
        video = MockVideo(
            category=MockTag(schema=category_schema),
            list=MockList(default_schema=workspace_schema)
        )

        # Act
        fields = await get_available_fields(video, mock_db)

        # Assert
        assert len(fields) == 4
        field_names = [f.name for f in fields]
        assert "Rating" in field_names
        assert "Notes" in field_names
        assert "Kalorien" in field_names
        assert "Lecker" in field_names

    async def test_deduplicates_shared_fields(self, mock_db):
        """Shared field should appear only once."""
        # Arrange
        shared_field = MockField(id=uuid4(), name="Level")
        workspace_schema = MockSchema(fields=[shared_field, "Rating"])
        category_schema = MockSchema(fields=[shared_field, "Duration"])
        video = MockVideo(
            category=MockTag(schema=category_schema),
            list=MockList(default_schema=workspace_schema)
        )

        # Act
        fields = await get_available_fields(video, mock_db)

        # Assert
        assert len(fields) == 3  # Level (once), Rating, Duration
        level_count = sum(1 for f in fields if f.name == "Level")
        assert level_count == 1

    async def test_handles_no_schemas(self, mock_db):
        """Video without any schemas should return empty list."""
        # Arrange
        video = MockVideo(
            category=None,
            list=MockList(default_schema=None)
        )

        # Act
        fields = await get_available_fields(video, mock_db)

        # Assert
        assert len(fields) == 0
```

**Coverage:** All branches in field aggregation

---

### Integration Tests: API

#### Test File: `backend/tests/integration/test_category_validation.py`

**Purpose:** Test category assignment validation

**Test Cases:**

```python
class TestCategoryValidation:
    """Tests for category assignment validation."""

    async def test_can_assign_single_category(self, client, test_video, test_category):
        """Should allow assigning one category to video."""
        # Act
        response = await client.post(
            f"/api/videos/{test_video.id}/tags",
            json={"tag_ids": [str(test_category.id)]}
        )

        # Assert
        assert response.status_code == 200
        # Verify video has category

    async def test_cannot_assign_multiple_categories(
        self, client, test_video, test_categories
    ):
        """Should reject assigning multiple categories."""
        # Arrange
        category1, category2 = test_categories  # Both have is_video_type=True

        # Act
        response = await client.post(
            f"/api/videos/{test_video.id}/tags",
            json={"tag_ids": [str(category1.id), str(category2.id)]}
        )

        # Assert
        assert response.status_code == 400
        assert "multiple categories" in response.json()["detail"].lower()

    async def test_cannot_assign_second_category_if_video_has_one(
        self, client, test_video, test_categories
    ):
        """Should reject if video already has a category."""
        # Arrange
        category1, category2 = test_categories
        # Video already has category1
        await assign_tag(test_video.id, category1.id)

        # Act
        response = await client.post(
            f"/api/videos/{test_video.id}/tags",
            json={"tag_ids": [str(category2.id)]}
        )

        # Assert
        assert response.status_code == 409  # Conflict
        assert category1.name in response.json()["detail"]

    async def test_can_assign_labels_with_category(
        self, client, test_video, test_category, test_labels
    ):
        """Should allow assigning labels even if video has category."""
        # Arrange: Video has category
        await assign_tag(test_video.id, test_category.id)
        label = test_labels[0]  # is_video_type=False

        # Act
        response = await client.post(
            f"/api/videos/{test_video.id}/tags",
            json={"tag_ids": [str(label.id)]}
        )

        # Assert
        assert response.status_code == 200  # Labels allowed

    async def test_can_reassign_same_category(
        self, client, test_video, test_category
    ):
        """Should allow reassigning same category (idempotent)."""
        # Arrange: Video has category
        await assign_tag(test_video.id, test_category.id)

        # Act
        response = await client.post(
            f"/api/videos/{test_video.id}/tags",
            json={"tag_ids": [str(test_category.id)]}
        )

        # Assert
        assert response.status_code == 200  # Allowed
```

---

#### Test File: `backend/tests/integration/test_category_change.py`

**Purpose:** Test category change endpoint with backup

**Test Cases:**

```python
class TestCategoryChange:
    """Tests for PUT /videos/{id}/category endpoint."""

    async def test_change_category_creates_backup(
        self, client, test_video_with_values, new_category
    ):
        """Should create backup when changing category."""
        # Arrange
        old_category = test_video_with_values.category
        old_values = test_video_with_values.field_values  # 3 values

        # Act
        response = await client.put(
            f"/api/videos/{test_video_with_values.id}/category",
            json={"category_id": str(new_category.id)}
        )

        # Assert
        assert response.status_code == 200
        data = response.json()
        assert data["backup_created"] is True
        assert data["backup_available"] is False

        # Verify backup file exists
        backup_file = get_backup_path(test_video_with_values.id, old_category.id)
        assert backup_file.exists()

        # Verify 3 values in backup
        backup_data = json.loads(backup_file.read_text())
        assert len(backup_data["values"]) == 3

    async def test_change_category_detects_existing_backup(
        self, client, test_video, category_with_existing_backup
    ):
        """Should return backup_available=True if backup exists."""
        # Arrange
        video_id = test_video.id
        category_id = category_with_existing_backup.id
        # Backup file already exists from previous switch

        # Act
        response = await client.put(
            f"/api/videos/{video_id}/category",
            json={"category_id": str(category_id)}
        )

        # Assert
        assert response.status_code == 200
        data = response.json()
        assert data["backup_available"] is True

    async def test_remove_category_creates_backup(self, client, test_video_with_category):
        """Should backup values when removing category."""
        # Act
        response = await client.put(
            f"/api/videos/{test_video_with_category.id}/category",
            json={"category_id": None}
        )

        # Assert
        assert response.status_code == 200
        assert response.json()["backup_created"] is True

        # Video should have no category
        video = await get_video(test_video_with_category.id)
        assert video.category is None

    async def test_change_category_without_values_no_backup(
        self, client, test_video_with_empty_category
    ):
        """Should not create backup if no field values."""
        # Arrange: Video in category but no field values filled

        # Act
        response = await client.put(
            f"/api/videos/{test_video_with_empty_category.id}/category",
            json={"category_id": str(new_category.id)}
        )

        # Assert
        assert response.status_code == 200
        assert response.json()["backup_created"] is False
```

---

## Frontend Testing

### Unit Tests: Components

#### Test File: `frontend/src/components/CategorySelector.test.tsx`

**Purpose:** Test category selector component

**Test Cases:**

```typescript
describe('CategorySelector', () => {
  it('displays current category', () => {
    const category = { id: '1', name: 'Keto Rezepte', color: '#00FF00' }
    render(<CategorySelector currentCategory={category} />)

    expect(screen.getByText('Keto Rezepte')).toBeInTheDocument()
    expect(screen.getByRole('button')).toHaveTextContent('Keto Rezepte')
  })

  it('shows "Keine Kategorie" when no category assigned', () => {
    render(<CategorySelector currentCategory={null} />)

    expect(screen.getByText('Keine Kategorie')).toBeInTheDocument()
  })

  it('opens dropdown on click', async () => {
    const categories = [
      { id: '1', name: 'Keto' },
      { id: '2', name: 'Vegan' }
    ]
    render(<CategorySelector categories={categories} />)

    await userEvent.click(screen.getByRole('button'))

    expect(screen.getByText('Keto')).toBeVisible()
    expect(screen.getByText('Vegan')).toBeVisible()
  })

  it('calls onChange when category selected', async () => {
    const onChange = vi.fn()
    const categories = [{ id: '1', name: 'Keto' }]
    render(<CategorySelector categories={categories} onChange={onChange} />)

    await userEvent.click(screen.getByRole('button'))
    await userEvent.click(screen.getByText('Keto'))

    expect(onChange).toHaveBeenCalledWith('1')
  })

  it('shows clear button on hover when category assigned', async () => {
    const category = { id: '1', name: 'Keto' }
    const onClear = vi.fn()
    render(<CategorySelector currentCategory={category} onClear={onClear} />)

    // Hover over selector
    await userEvent.hover(screen.getByRole('button'))

    const clearButton = screen.getByLabelText('Kategorie entfernen')
    expect(clearButton).toBeVisible()

    await userEvent.click(clearButton)
    expect(onClear).toHaveBeenCalled()
  })

  it('disables selector when disabled prop is true', () => {
    render(<CategorySelector disabled />)

    expect(screen.getByRole('button')).toBeDisabled()
  })

  it('shows loading state', () => {
    render(<CategorySelector isLoading />)

    expect(screen.getByText(/lade/i)).toBeInTheDocument()
    expect(screen.getByRole('button')).toBeDisabled()
  })

  it('supports keyboard navigation', async () => {
    const categories = [
      { id: '1', name: 'Keto' },
      { id: '2', name: 'Vegan' }
    ]
    const onChange = vi.fn()
    render(<CategorySelector categories={categories} onChange={onChange} />)

    // Tab to button
    await userEvent.tab()
    expect(screen.getByRole('button')).toHaveFocus()

    // Enter to open
    await userEvent.keyboard('{Enter}')
    expect(screen.getByText('Keto')).toBeVisible()

    // Arrow down to second option
    await userEvent.keyboard('{ArrowDown}')
    // Enter to select
    await userEvent.keyboard('{Enter}')

    expect(onChange).toHaveBeenCalledWith('2')
  })
})
```

---

#### Test File: `frontend/src/components/CategoryChangeWarning.test.tsx`

**Purpose:** Test warning dialog

**Test Cases:**

```typescript
describe('CategoryChangeWarning', () => {
  it('shows fields that will be backed up', () => {
    const fieldsTobBackup = [
      { field: { name: 'Kalorien' }, value_numeric: 320 },
      { field: { name: 'Lecker' }, value_boolean: true }
    ]

    render(
      <CategoryChangeWarning
        oldCategory={{ name: 'Keto' }}
        fieldValuesToBackup={fieldsToBackup}
        onConfirm={vi.fn()}
      />
    )

    expect(screen.getByText(/folgende werte werden gesichert/i)).toBeInTheDocument()
    expect(screen.getByText(/kalorien: 320/i)).toBeInTheDocument()
    expect(screen.getByText(/lecker: ja/i)).toBeInTheDocument()
  })

  it('shows fields that will persist', () => {
    const persist = [
      { field: { name: 'Bewertung' }, value_numeric: 5 }
    ]

    render(
      <CategoryChangeWarning
        fieldValuesThatPersist={persist}
        onConfirm={vi.fn()}
      />
    )

    expect(screen.getByText(/die folgenden felder bleiben/i)).toBeInTheDocument()
    expect(screen.getByText(/bewertung/i)).toBeInTheDocument()
  })

  it('shows restore checkbox when backup exists', () => {
    render(
      <CategoryChangeWarning
        hasBackup={true}
        backupTimestamp="2024-11-15"
        onConfirm={vi.fn()}
      />
    )

    expect(screen.getByText(/gesicherte werte gefunden/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/gesicherte werte wiederherstellen/i)).toBeInTheDocument()
  })

  it('calls onConfirm with restore=true when checkbox checked', async () => {
    const onConfirm = vi.fn()

    render(
      <CategoryChangeWarning
        hasBackup={true}
        onConfirm={onConfirm}
        onCancel={vi.fn()}
      />
    )

    const checkbox = screen.getByLabelText(/gesicherte werte wiederherstellen/i)
    await userEvent.click(checkbox)

    const confirmButton = screen.getByRole('button', { name: /kategorie ändern/i })
    await userEvent.click(confirmButton)

    expect(onConfirm).toHaveBeenCalledWith(true)
  })

  it('calls onCancel when cancel button clicked', async () => {
    const onCancel = vi.fn()

    render(<CategoryChangeWarning onConfirm={vi.fn()} onCancel={onCancel} />)

    await userEvent.click(screen.getByRole('button', { name: /abbrechen/i }))

    expect(onCancel).toHaveBeenCalled()
  })

  it('formats backup timestamp correctly', () => {
    render(
      <CategoryChangeWarning
        hasBackup={true}
        backupTimestamp="2024-11-15T10:30:00Z"
        onConfirm={vi.fn()}
      />
    )

    expect(screen.getByText(/von vor \d+ (tag|woche|monat)/i)).toBeInTheDocument()
  })
})
```

---

### Integration Tests: User Flows

#### Test File: `frontend/src/flows/category-assignment.test.tsx`

**Purpose:** Test complete category assignment flow

**Test Cases:**

```typescript
describe('Category Assignment Flow', () => {
  it('assigns category to video and shows fields', async () => {
    // Arrange: Mock API
    const mockVideo = { id: '1', category: null }
    const mockCategory = { id: 'cat1', name: 'Keto', schema: { fields: [...] } }

    server.use(
      http.get('/api/videos/1', () => HttpResponse.json(mockVideo)),
      http.get('/api/tags', () => HttpResponse.json([mockCategory])),
      http.put('/api/videos/1/category', () => HttpResponse.json({ success: true }))
    )

    // Act: Render video detail page
    render(<VideoDetailsPage videoId="1" />)
    await waitForElementToBeRemoved(() => screen.queryByText(/laden/i))

    // Open category selector
    await userEvent.click(screen.getByRole('button', { name: /kategorie/i }))

    // Select Keto
    await userEvent.click(screen.getByText('Keto'))

    // Should show warning dialog
    expect(screen.getByText(/kategorie ändern/i)).toBeInTheDocument()

    // Confirm
    await userEvent.click(screen.getByRole('button', { name: /kategorie ändern/i }))

    // Should show success toast
    await waitFor(() => {
      expect(screen.getByText(/kategorie geändert/i)).toBeInTheDocument()
    })

    // Should show category-specific fields
    expect(screen.getByLabelText(/kalorien/i)).toBeInTheDocument()
  })
})
```

---

## Test Data Fixtures

### Backend Fixtures

```python
# backend/tests/conftest.py

@pytest.fixture
async def test_category(db_session):
    """Category with schema and fields."""
    schema = FieldSchema(name="Keto Schema")
    field1 = CustomField(name="Kalorien", field_type="rating")
    field2 = CustomField(name="Lecker", field_type="boolean")

    tag = Tag(
        name="Keto Rezepte",
        color="#00FF00",
        is_video_type=True,
        schema=schema
    )

    db_session.add_all([schema, field1, field2, tag])
    await db_session.commit()

    return tag

@pytest.fixture
async def test_video_with_values(db_session, test_category):
    """Video with category and field values."""
    video = Video(youtube_id="test123", list_id=...)
    video.tags.append(test_category)

    # Add field values
    for field in test_category.schema.fields:
        value = VideoFieldValue(
            video=video,
            field=field,
            value_numeric=320 if field.name == "Kalorien" else None,
            value_boolean=True if field.name == "Lecker" else None
        )
        db_session.add(value)

    await db_session.commit()
    return video
```

---

### Frontend Fixtures

```typescript
// frontend/src/test/fixtures.ts

export const mockCategory = {
  id: '1',
  name: 'Keto Rezepte',
  color: '#00FF00',
  is_video_type: true,
  schema_id: 'schema-1'
}

export const mockWorkspaceFields = [
  { id: 'f1', name: 'Bewertung', field_type: 'rating' },
  { id: 'f2', name: 'Notizen', field_type: 'text' }
]

export const mockCategoryFields = [
  { id: 'f3', name: 'Kalorien', field_type: 'number' },
  { id: 'f4', name: 'Lecker', field_type: 'boolean' }
]

export const mockVideoWithCategory = {
  id: 'v1',
  title: 'Test Video',
  category_id: '1',
  field_values: [
    { field_id: 'f1', value_numeric: 5 },
    { field_id: 'f3', value_numeric: 320 }
  ]
}
```

---

## E2E Test Scenarios

### Scenario 1: First-Time User Setup (Story 001)

**Steps:**
1. Open app (no categories exist)
2. Go to Settings → Kategorien
3. Click "+ Neue Kategorie"
4. Enter "Keto Rezepte", pick color, save
5. Click "Bearbeiten" on category
6. Add field "Kalorien" (Zahl)
7. Add field "Lecker" (Ja/Nein)
8. Save
9. Go to video detail
10. Select "Keto Rezepte" from dropdown
11. Fill in fields
12. Save

**Expected:**
- Category created successfully
- Fields added to category
- Video assigned to category
- Fields visible and editable
- Values saved

**Duration:** ~5 minutes

---

### Scenario 2: Category Switch with Backup (Story 002)

**Steps:**
1. Video has category "Keto" with filled values
2. Open video detail
3. Change category to "Vegan"
4. See warning dialog with backed-up values
5. Confirm
6. Verify Keto fields hidden, Vegan fields shown
7. Verify workspace fields persisted
8. Change back to "Keto"
9. See restore prompt
10. Check "Restore values"
11. Confirm
12. Verify values restored

**Expected:**
- Warning shows correct fields
- Backup created
- Workspace fields persist
- Restore prompt appears
- Values restored correctly

**Duration:** ~3 minutes

---

### Scenario 3: Field Name Conflict (Edge Case)

**Steps:**
1. Create workspace field "Bewertung"
2. Try to create category field "Bewertung"
3. See conflict dialog
4. Choose "Use existing field"
5. Verify field shared

**Expected:**
- Conflict detected
- Clear error message
- Can choose to reuse field
- Field appears in both places

**Duration:** ~2 minutes

---

## Performance Testing

### Load Testing

**Tool:** k6 or Locust

**Scenarios:**

1. **Category Change Under Load**
   ```javascript
   export default function () {
     // 100 concurrent users changing categories
     http.put(`/api/videos/${randomVideo()}/category`, {
       category_id: randomCategory()
     })
   }
   ```

   **Expected:**
   - Response time < 500ms (p95)
   - No errors
   - Backups created successfully

2. **Field Aggregation Query Performance**
   ```sql
   -- Should run in < 50ms with 1000 videos, 100 fields
   SELECT * FROM get_available_fields(:video_id)
   ```

   **Expected:**
   - Query time < 50ms
   - Uses indexes efficiently

---

### Frontend Performance

**Tool:** Lighthouse, React DevTools Profiler

**Metrics:**

1. **Category Selector Render Time**
   - < 100ms to render
   - < 50ms to re-render on category change

2. **Settings Page Load**
   - < 1s to render 50 categories
   - Smooth scrolling

3. **Bundle Size**
   - New components add < 50KB to bundle

---

## Accessibility Testing

### Automated Tools

**Tool:** axe-core, jest-axe

**Coverage:**
- All new components
- All dialogs
- All forms

**Example:**
```typescript
it('has no accessibility violations', async () => {
  const { container } = render(<CategorySelector />)
  const results = await axe(container)
  expect(results).toHaveNoViolations()
})
```

---

### Manual Testing

**Keyboard Navigation:**
- [ ] Can tab through all interactive elements
- [ ] Can operate dropdown with keyboard
- [ ] Can submit forms with Enter
- [ ] Can close dialogs with Escape

**Screen Reader:**
- [ ] Category selector announces current selection
- [ ] Warning dialog reads all important info
- [ ] Field labels are announced
- [ ] Errors are announced

---

## Regression Testing

### Existing Features Must Still Work

**Checklist:**
- [ ] Creating tags (now categories)
- [ ] Creating schemas
- [ ] Creating custom fields
- [ ] Assigning tags to videos (with labels)
- [ ] Deleting tags
- [ ] Deleting schemas
- [ ] Deleting custom fields
- [ ] Video detail shows fields
- [ ] Filtering by tags

---

## Test Execution Plan

### During Development (Per Phase)

1. Write tests BEFORE implementation (TDD for critical paths)
2. Run unit tests on file save (watch mode)
3. Run integration tests before commit
4. Fix failing tests immediately

### Before Merge

1. Run full test suite
2. Check coverage (must be > 80%)
3. Run linter
4. Run type checker
5. Manual smoke test

### Before Deployment

1. Run full test suite on CI
2. Run E2E tests manually
3. Performance benchmarks
4. Accessibility audit
5. Cross-browser testing (Chrome, Firefox, Safari)

---

## Test Coverage Requirements

### Backend

| Module | Coverage Target |
|--------|-----------------|
| Services (backup, aggregation) | 95% |
| API endpoints | 85% |
| Models | 80% |
| Overall | 85% |

### Frontend

| Module | Coverage Target |
|--------|-----------------|
| Components | 80% |
| Hooks | 85% |
| Utils | 90% |
| Overall | 80% |

---

## Bug Tracking During Testing

### Bug Priority

**P0 (Blocker):**
- Data loss
- App crash
- Security issue

**P1 (Critical):**
- Feature doesn't work
- Wrong data displayed
- Performance regression

**P2 (Important):**
- UX issues
- Edge cases
- Minor bugs

**P3 (Nice to have):**
- UI polish
- Improvements

### Bug Template

```markdown
## Bug: [Title]

**Priority:** P1
**Component:** CategorySelector
**Browser:** Chrome 120

**Steps to Reproduce:**
1. Open video detail
2. Click category dropdown
3. Select "Keto"

**Expected:**
Warning dialog appears

**Actual:**
Nothing happens

**Screenshots:**
[Attach]

**Console Errors:**
TypeError: undefined...

**Additional Context:**
Only happens when video has no existing category
```

---

## Success Criteria

### All Tests Must Pass

- ✅ 100% unit tests passing
- ✅ 100% integration tests passing
- ✅ All E2E scenarios working
- ✅ No accessibility violations
- ✅ Performance benchmarks met
- ✅ No regression in existing features

### Coverage Thresholds Met

- ✅ Backend > 85%
- ✅ Frontend > 80%
- ✅ Critical paths 100% covered

### Manual QA Complete

- ✅ All user stories validated
- ✅ All edge cases tested
- ✅ Cross-browser tested
- ✅ Mobile responsive tested
- ✅ Keyboard navigation works
- ✅ Screen reader tested

---

## Next Phase

✅ Ready for Phase 10: Atomic Steps
- Break implementation plan into bite-sized tasks
- Each task 15-60 minutes
- Each task independently committable
- Clear acceptance criteria per task
