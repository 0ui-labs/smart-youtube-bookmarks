# Offene Prüfungsbefunde

Frontend-Snapshot: unveränderte Frontend-Dateien aus `7184630`, Backend-Schlussbasis `238f7df`.

Vollständiger Frontend-Lauf: 1195 bestanden, 104 fehlgeschlagen.

## Fehlgeschlagene Frontend-Tests

### App.test.tsx

-  App renders without crashing
-  App redirects root path to /videos

### components/CategoryChangeWarning.test.tsx

-  CategoryChangeWarning Fields To Backup Section (Step 5.5) shows fields that will be backed up
-  CategoryChangeWarning Fields To Backup Section (Step 5.5) shows fields that will persist (workspace fields)

### components/CategorySelector.test.tsx

-  CategorySelector Skeleton (Step 5.1) renders dropdown trigger with category label
-  CategorySelector Skeleton (Step 5.1) shows color indicator for selected category
-  CategorySelector Clear Button (Step 5.2) shows clear button when category is selected
-  CategorySelector Clear Button (Step 5.2) shows warning dialog when clear button is clicked (onCategoryChange called after confirm)
-  CategorySelector Loading and Disabled States (Step 5.3) shows loading spinner when categories are loading
-  CategorySelector Loading and Disabled States (Step 5.3) shows loading state during mutation
-  CategorySelector Loading and Disabled States (Step 5.3) disables clear button when disabled
-  CategorySelector Warning Dialog Integration (Step 5.7) shows warning dialog when changing from one category to another
-  CategorySelector Warning Dialog Integration (Step 5.7) shows warning dialog when removing category
-  CategorySelector Warning Dialog Integration (Step 5.7) does not show warning when assigning first category
-  CategorySelector Warning Dialog Integration (Step 5.7) calls onCategoryChange when warning is confirmed
-  CategorySelector Warning Dialog Integration (Step 5.7) does not call onCategoryChange when warning is cancelled

### components/ConfirmDeleteTagDialog.test.tsx

-  ConfirmDeleteTagDialog calls onConfirm after successful deletion

### components/CustomFieldsFlow.integration.test.tsx

-  Custom Fields Flow Integration (Task #134) Test 1: Create tag with new schema and custom field creates tag with schema containing rating field (outcome-based)
-  Custom Fields Flow Integration (Task #134) Test 2: Assign tag to video and set field value assigns tag to video and sets rating field value to 5 stars
-  Custom Fields Flow Integration (Task #134) Test 3: Error handling for API failures shows error toast when field creation fails

### components/RobustImport.integration.test.tsx

-  Robust Import Integration Flow Phase 4: Import Progress Display shows progress overlay when video import starts
-  Robust Import Integration Flow Import Progress Store tracks progress for multiple videos independently
-  Robust Import Integration Flow Import Progress Store clears progress for individual video
-  Robust Import Integration Flow Full Import Flow Simulation simulates complete WebSocket progress flow

### components/VideoCard.customfields.integration.test.tsx

-  VideoCard - Custom Fields Integration Inline Editing Integration allows inline editing of rating field with optimistic update
-  VideoCard - Custom Fields Integration Inline Editing Integration allows inline editing of select field
-  VideoCard - Custom Fields Integration Inline Editing Integration allows inline editing of boolean field
-  VideoCard - Custom Fields Integration Event Isolation does not trigger video onClick when editing field
-  VideoCard - Custom Fields Integration Event Isolation does not trigger video onClick when clicking rating star
-  VideoCard - Custom Fields Integration Error Handling rolls back optimistic update when API fails

### components/VideosPage.rowclick.test.tsx

-  VideosPage - Row Click & Menu Interaction Row Click Behavior should open video in new tab when clicking row
-  VideosPage - Row Click & Menu Interaction Row Click Behavior should open video when pressing Enter on row
-  VideosPage - Row Click & Menu Interaction Row Click Behavior should open video when pressing Space on row
-  VideosPage - Row Click & Menu Interaction Menu Click Isolation should NOT open video when clicking menu trigger
-  VideosPage - Row Click & Menu Interaction Menu Click Isolation should NOT open video when clicking delete menu item
-  VideosPage - Row Click & Menu Interaction Menu Click Isolation should close menu when pressing Escape
-  VideosPage - Row Click & Menu Interaction Title Column should render title as text, not link
-  VideosPage - Row Click & Menu Interaction Keyboard Navigation should allow tabbing through rows without stopping at menu buttons

### components/VideosPage.test.tsx

-  VideosPage - Sorting (Task #146 Section 7) Column Header Click Updates URL updates URL when clicking on Titel header for ascending sort
-  VideosPage - Sorting (Task #146 Section 7) Column Header Click Updates URL updates URL when clicking on Dauer header for ascending sort
-  VideosPage - Sorting (Task #146 Section 7) Sort Direction Toggle toggles sort direction on second click of same column

### pages/SettingsPage.integration.test.tsx

-  SettingsPage Integration renders complete settings page with schemas
-  SettingsPage Integration switches between tabs
-  SettingsPage Integration handles create schema button click
-  SettingsPage Integration handles schema action menu interactions
-  SettingsPage Integration handles network error gracefully
-  SettingsPage - Tags Tab renders Tags tab and displays TagsList
-  SettingsPage - Tags Tab shows tags in the list when data is available
-  SettingsPage - Tags Tab shows empty state when no tags

### pages/SettingsPage.test.tsx

-  SettingsPage renders page header
-  SettingsPage renders tabs navigation
-  SettingsPage renders schemas tab by default
-  SettingsPage renders create schema button
-  SettingsPage displays loading state when lists are loading
-  SettingsPage displays loading state when schemas are loading
-  SettingsPage displays error state
-  SettingsPage displays empty state when no schemas exist
-  SettingsPage renders SchemasList when schemas exist

### pages/VideoDetailsPage.test.tsx

-  VideoDetailsPage Video Header displays thumbnail with correct aspect ratio
-  VideoDetailsPage Video Header displays duration badge on thumbnail
-  VideoDetailsPage Field Grouping by Schema groups fields by schema_name
-  VideoDetailsPage Field Grouping by Schema shows field count in section header
-  VideoDetailsPage Field Grouping by Schema shows count for single field
-  VideoDetailsPage Field Grouping by Schema sorts schemas alphabetically
-  VideoDetailsPage Field Grouping by Schema initializes all schemas as expanded
-  VideoDetailsPage Field Grouping by Schema shows "Keine Informationen verfügbar" when no fields
-  VideoDetailsPage Field Grouping by Schema sorts fields by display_order within schema
-  VideoDetailsPage Field Rendering renders filled field values correctly
-  VideoDetailsPage Field Rendering renders empty fields with null values
-  VideoDetailsPage Integration: Full User Flows toggles schema section on click
-  VideoDetailsPage Integration: Full User Flows handles null available_fields gracefully
-  VideoDetailsPage Accessibility collapsible triggers are buttons
-  VideoDetailsPage Accessibility collapsible has aria-expanded attribute
-  VideoDetailsPage Accessibility field sections have proper structure

### __tests__/integration/websocket-import-progress.test.tsx

-  WebSocket Import Progress Integration VideoCard shows progress overlay when store has importing progress
-  WebSocket Import Progress Integration store correctly tracks multiple videos independently
-  WebSocket Import Progress Integration progress updates flow correctly from store to component

### components/__tests__/CustomFieldsSection.test.tsx

-  CustomFieldsSection renders schema sections with correct field counts
-  CustomFieldsSection renders "Allgemeine Felder" for fields without schema_name
-  CustomFieldsSection all schemas expanded by default (openSchemas empty = all open)
-  CustomFieldsSection collapsible toggle works (ChevronDown ↔ ChevronUp)
-  CustomFieldsSection alphabetically sorts schema sections
-  CustomFieldsSection renders empty state when no fields available
-  CustomFieldsSection sorts fields within schema by display_order

### components/__tests__/VideoDetailsModal.test.tsx

-  VideoDetailsModal renders thumbnail with correct src and alt
-  VideoDetailsModal handles video with null thumbnail_url gracefully

### components/fields/FieldDisplay.test.tsx

-  FieldDisplay Text Field renders TextSnippet as input when editable
-  FieldDisplay Text Field passes onChange callback to TextSnippet with string value
-  FieldDisplay Text Field passes onExpand callback to TextSnippet (readonly)
-  FieldDisplay Text Field handles null value for text field (editable)
-  FieldDisplay Text Field passes maxLength from config to TextSnippet

### components/settings/TagsList.test.tsx

-  TagsList renders table with proper structure (German headers)
-  TagsList shows type badge (Kategorie/Label)

### components/schemas/SchemaEditor.integration.test.tsx

-  SchemaEditor Integration Tests creates schema with new field end-to-end
-  SchemaEditor Integration Tests enforces max 3 show_on_card limit
-  SchemaEditor Integration Tests prevents duplicate field names via FieldSelector

### components/schemas/SchemaEditor.test.tsx

-  SchemaEditor shows new field form when "Neues Feld" clicked
-  SchemaEditor hides new field form when close button clicked
-  SchemaEditor renders field placeholders for initial data
-  SchemaEditor allows removing fields via remove button
-  SchemaEditor handles 409 conflict error from backend
-  SchemaEditor handles 422 validation error from backend
-  SchemaEditor handles generic network error

### components/fields/__tests__/CustomFieldsPreview.test.tsx

-  CustomFieldsPreview - Field Type Rendering renders text field with snippet badge

## Backend-Typprüfung

Strenge mypy-Konfiguration unverändert. Kein pauschales ignore und kein Ausschluss neuer Module.

| Datei | Fehler |
| --- | --- |
| `app/api/chat.py` | 3 |
| `app/api/custom_fields.py` | 7 |
| `app/api/deps.py` | 1 |
| `app/api/field_validation.py` | 1 |
| `app/api/helpers/field_union.py` | 4 |
| `app/api/lists.py` | 5 |
| `app/api/processing.py` | 4 |
| `app/api/schema_fields.py` | 7 |
| `app/api/schemas.py` | 7 |
| `app/api/subscriptions.py` | 8 |
| `app/api/tags.py` | 5 |
| `app/api/videos.py` | 35 |
| `app/api/webhooks.py` | 1 |
| `app/api/websocket.py` | 6 |
| `app/clients/gemini.py` | 5 |
| `app/clients/youtube.py` | 17 |
| `app/core/config.py` | 3 |
| `app/core/redis.py` | 1 |
| `app/core/test_database.py` | 2 |
| `app/main.py` | 1 |
| `app/models/custom_field.py` | 5 |
| `app/models/field_schema.py` | 1 |
| `app/models/job.py` | 2 |
| `app/models/job_progress.py` | 1 |
| `app/models/schema.py` | 1 |
| `app/models/subscription.py` | 1 |
| `app/models/user.py` | 4 |
| `app/models/video.py` | 6 |
| `app/models/video_enrichment.py` | 1 |
| `app/models/video_field_value.py` | 1 |
| `app/schemas/field_schema.py` | 2 |
| `app/schemas/subscription.py` | 1 |
| `app/schemas/video.py` | 3 |
| `app/schemas/video_field_value.py` | 2 |
| `app/services/category_validation.py` | 1 |
| `app/services/channel_resolver_service.py` | 2 |
| `app/services/duplicate_detection.py` | 5 |
| `app/services/enrichment/enrichment_service.py` | 2 |
| `app/services/enrichment/providers/audio_chunker.py` | 8 |
| `app/services/enrichment/providers/chapter_extractor.py` | 7 |
| `app/services/enrichment/providers/groq_transcriber.py` | 2 |
| `app/services/enrichment/providers/youtube_captions.py` | 1 |
| `app/services/enrichment/utils/vtt_parser.py` | 3 |
| `app/services/field_aggregation.py` | 2 |
| `app/services/field_value_backup.py` | 3 |
| `app/services/subscription_chat_service.py` | 5 |
| `app/services/video_pre_filter_service.py` | 1 |
| `app/workers/db_manager.py` | 4 |
| `app/workers/enrichment_worker.py` | 2 |
| `app/workers/settings.py` | 12 |
| `app/workers/subscription_worker.py` | 6 |
| `app/workers/video_processor.py` | 12 |

Fehlergruppen: `no-untyped-def`: 61, `type-arg`: 38, `arg-type`: 20, `import-untyped`: 17, `attr-defined`: 16, `assignment`: 16, `name-defined`: 13, `no-untyped-call`: 10, `no-any-return`: 7, `valid-type`: 6, `return-value`: 5, `var-annotated`: 5, `union-attr`: 5, `operator`: 3, `typeddict-item`: 3, `unused-ignore`: 3, `call-arg`: 2, `return`: 1, `misc`: 1.

## Frontend-Linting

Der vollständige Biome-Lauf meldet 76 Fehler und 162 Warnungen. Keine Regel wurde abgeschaltet.
Reproduktion: `cd frontend && npm run lint`.

- `src/components/CategorySelector.tsx`: `assist/source/useSortedAttributes`
- `src/components/CategorySelector.tsx`: `assist/source/useSortedAttributes`
- `src/components/CategorySelector.tsx`: `assist/source/useSortedAttributes`
- `src/components/CategorySelector.tsx`: `lint/nursery/useSortedClasses`
- `src/components/CategorySelector.tsx`: `assist/source/useSortedAttributes`
- `src/components/CategorySelector.tsx`: `assist/source/organizeImports`
- `src/components/CategorySelector.tsx`: `lint/nursery/useSortedClasses`
- `src/components/CategorySelector.tsx`: `lint/nursery/useSortedClasses`
- `src/components/CategorySelector.tsx`: `lint/nursery/useSortedClasses`
- `src/components/CategorySelector.tsx`: `format`
- `src/components/CreateTagDialog.tsx`: `assist/source/useSortedAttributes`
- `src/components/CreateTagDialog.tsx`: `assist/source/useSortedAttributes`
- `src/components/CreateTagDialog.tsx`: `lint/nursery/useSortedClasses`
- `src/components/CreateTagDialog.tsx`: `lint/nursery/useSortedClasses`
- `src/components/CreateTagDialog.tsx`: `format`
- `src/components/CreateTagDialog.tsx`: `assist/source/organizeImports`
- `src/components/CreateTagDialog.tsx`: `lint/complexity/noUselessCatch`
- `src/components/CreateTagDialog.tsx`: `assist/source/useSortedAttributes`
- `src/components/CreateTagDialog.tsx`: `assist/source/useSortedAttributes`
- `src/components/CreateTagDialog.tsx`: `assist/source/useSortedAttributes`
- `src/components/CreateTagDialog.tsx`: `assist/source/useSortedAttributes`
- `src/components/CreateTagDialog.tsx`: `lint/nursery/useSortedClasses`
- `src/components/CreateTagDialog.tsx`: `assist/source/useSortedAttributes`
- `src/components/CreateTagDialog.tsx`: `assist/source/useSortedAttributes`
- `src/components/CreateTagDialog.tsx`: `assist/source/useSortedAttributes`
- `src/components/CreateTagDialog.tsx`: `lint/nursery/useSortedClasses`
- `src/components/CreateTagDialog.tsx`: `lint/nursery/useSortedClasses`
- `src/components/CreateTagDialog.tsx`: `lint/nursery/useSortedClasses`
- `src/components/CreateTagDialog.tsx`: `assist/source/useSortedAttributes`
- `src/components/CreateTagDialog.tsx`: `lint/nursery/useSortedClasses`
- `src/components/CreateTagDialog.tsx`: `lint/nursery/useSortedClasses`
- `src/components/CreateTagDialog.tsx`: `lint/nursery/useSortedClasses`
- `src/components/CreateTagDialog.tsx`: `assist/source/useSortedAttributes`
- `src/components/CreateTagDialog.tsx`: `lint/nursery/useSortedClasses`
- `src/components/CreateTagDialog.tsx`: `lint/nursery/useSortedClasses`
- `src/components/CreateTagDialog.tsx`: `assist/source/useSortedAttributes`
- `src/components/CreateTagDialog.tsx`: `lint/nursery/useSortedClasses`
- `src/components/CreateTagDialog.tsx`: `assist/source/useSortedAttributes`
- `src/components/CreateTagDialog.tsx`: `lint/nursery/useSortedClasses`
- `src/components/CreateTagDialog.tsx`: `lint/nursery/useSortedClasses`
- `src/components/CreateTagDialog.tsx`: `lint/nursery/useSortedClasses`
- `src/components/CreateTagDialog.tsx`: `lint/nursery/useSortedClasses`
- `src/components/CreateTagDialog.tsx`: `assist/source/useSortedAttributes`
- `src/components/fields/FieldConfigEditor.tsx`: `lint/complexity/noBannedTypes`
- `src/components/schemas/NewFieldForm.tsx`: `lint/style/useDefaultSwitchClause`
- `src/components/settings/KategorienTab.tsx`: `assist/source/useSortedAttributes`
- `src/components/settings/KategorienTab.tsx`: `assist/source/useSortedAttributes`
- `src/components/settings/KategorienTab.tsx`: `assist/source/useSortedAttributes`
- `src/components/settings/KategorienTab.tsx`: `lint/nursery/useSortedClasses`
- `src/components/settings/KategorienTab.tsx`: `lint/nursery/useSortedClasses`
- `src/components/settings/KategorienTab.tsx`: `assist/source/useSortedAttributes`
- `src/components/settings/KategorienTab.tsx`: `lint/nursery/useSortedClasses`
- `src/components/settings/KategorienTab.tsx`: `lint/nursery/useSortedClasses`
- `src/components/settings/KategorienTab.tsx`: `lint/nursery/useSortedClasses`
- `src/components/settings/KategorienTab.tsx`: `assist/source/useSortedAttributes`
- `src/components/settings/KategorienTab.tsx`: `lint/nursery/useSortedClasses`
- `src/components/settings/KategorienTab.tsx`: `assist/source/useSortedAttributes`
- `src/components/settings/KategorienTab.tsx`: `lint/nursery/useSortedClasses`
- `src/components/settings/KategorienTab.tsx`: `lint/nursery/useSortedClasses`
- `src/components/settings/KategorienTab.tsx`: `assist/source/useSortedAttributes`
- `src/components/settings/KategorienTab.tsx`: `lint/nursery/useSortedClasses`
- `src/components/settings/KategorienTab.tsx`: `lint/nursery/useSortedClasses`
- `src/components/settings/KategorienTab.tsx`: `assist/source/useSortedAttributes`
- `src/components/settings/KategorienTab.tsx`: `lint/nursery/useSortedClasses`
- `src/components/settings/KategorienTab.tsx`: `lint/nursery/useSortedClasses`
- `src/components/settings/KategorienTab.tsx`: `assist/source/organizeImports`
- `src/components/settings/KategorienTab.tsx`: `lint/nursery/useSortedClasses`
- `src/components/settings/KategorienTab.tsx`: `lint/nursery/useSortedClasses`
- `src/components/settings/KategorienTab.tsx`: `format`
- `src/components/settings/KategorienTab.tsx`: `lint/nursery/useSortedClasses`
- `src/components/settings/KategorienTab.tsx`: `lint/nursery/useSortedClasses`
- `src/components/settings/KategorienTab.tsx`: `lint/nursery/useSortedClasses`
- `src/components/settings/KategorienTab.tsx`: `lint/nursery/useSortedClasses`
- `src/components/settings/KategorienTab.tsx`: `assist/source/useSortedAttributes`
- `src/hooks/useSchemas.ts`: `lint/nursery/useMaxParams`
- `src/hooks/useSchemas.ts`: `lint/nursery/useMaxParams`
