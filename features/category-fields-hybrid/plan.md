# Implementation Plan: Category-Fields Hybrid System

**Feature ID:** category-fields-hybrid
**Date:** 2025-11-20
**Phase:** 8 - Implementation Plan

---

## Overview

**Total Estimated Time:** 35-40 hours (5-6 days)

**Implementation Strategy:** 6 sequential phases
- Each phase is independently testable
- Each phase can be deployed to staging
- Rollback possible at any phase boundary

---

## Implementation Phases

### Phase 1: Backend Foundation (Database + Models)

**Duration:** 3-4 hours

**Goal:** Add database columns and update SQLAlchemy models

**Tasks:**

1. **Create Migration** (1 hour)
   - File: `backend/alembic/versions/{hash}_add_category_system.py`
   - Add `is_video_type` to `tags` table
   - Add `default_schema_id` to `bookmarks_lists` table
   - Add indexes
   - Test migration up/down

2. **Update BookmarkList Model** (30 min)
   - File: `backend/app/models/list.py`
   - Add `default_schema_id` column
   - Add `default_schema` relationship
   - Update `__repr__`

3. **Update Tag Model** (30 min)
   - File: `backend/app/models/tag.py`
   - Add `is_video_type` column
   - Update `__repr__`

4. **Update Pydantic Schemas** (1 hour)
   - File: `backend/app/schemas/tag.py`
   - Add `is_video_type` to `TagCreate` (default=True)
   - Add `is_video_type` to `TagResponse`
   - Add `is_video_type` to `TagUpdate`
   - File: `backend/app/schemas/list.py` (if exists)
   - Add `default_schema_id` to schemas

5. **Test Models** (30 min)
   - Create/read tags with `is_video_type`
   - Create/read lists with `default_schema_id`
   - Verify defaults work

**Acceptance Criteria:**
- ✅ Migration runs successfully (up and down)
- ✅ Can create Tag with `is_video_type=True/False`
- ✅ Can set `default_schema_id` on BookmarkList
- ✅ Existing tags get `is_video_type=True` default
- ✅ All existing tests still pass

**Dependencies:** None

**Deliverables:**
- Migration file
- Updated models
- Updated Pydantic schemas

---

### Phase 2: Backend Services & API

**Duration:** 8-10 hours

**Goal:** Implement business logic and API endpoints

**Tasks:**

1. **Create Backup Service** (3 hours)
   - File: `backend/app/services/field_value_backup.py` (NEW)
   - Implement `backup_field_values(video_id, category_id, db)`
   - Implement `restore_field_values(video_id, category_id, db)`
   - Implement `list_backups(video_id)`
   - Implement `get_backup_info(video_id, category_id)`
   - Implement `delete_backup(video_id, category_id)`
   - Use file system (`backups/field_values/{video_id}/`)
   - Handle errors gracefully (corrupted files, etc.)

2. **Create Field Aggregation Service** (2 hours)
   - File: `backend/app/services/field_aggregation.py` (NEW)
   - Implement `get_available_fields(video, db)`
   - Combine default_schema + category schema fields
   - Deduplicate by field_id
   - Return ordered list

3. **Update Tags API** (1 hour)
   - File: `backend/app/api/tags.py`
   - POST /tags: Accept `is_video_type` in body
   - GET /tags: Include `is_video_type` in response
   - PUT /tags/{id}: Accept `is_video_type` in body
   - No validation changes (yet)

4. **Update Videos API - Validation** (2 hours)
   - File: `backend/app/api/videos.py`
   - POST /videos/{id}/tags: Add category validation
     - Check if assigning multiple video types → 400 error
     - Check if video already has category → 409 error
   - Clear error messages with next steps

5. **Create Category Change Endpoint** (2 hours)
   - File: `backend/app/api/videos.py`
   - PUT /videos/{video_id}/category
   - Request: `{ category_id: UUID | null }`
   - Logic:
     - Get current category
     - Create backup if has category
     - Remove old category from video_tags
     - Add new category to video_tags
     - Check for existing backup
   - Response: `{ backup_created: bool, backup_available: bool }`

6. **Test Services & API** (1 hour)
   - Unit test backup service
   - Unit test field aggregation
   - Integration test category validation
   - Integration test category change endpoint

**Acceptance Criteria:**
- ✅ Backup service creates/restores/lists backups
- ✅ Field aggregation combines schemas correctly
- ✅ Cannot assign multiple categories to video
- ✅ Category change creates backup
- ✅ Category change endpoint works end-to-end
- ✅ All tests pass

**Dependencies:** Phase 1

**Deliverables:**
- Backup service
- Field aggregation service
- Updated tags API
- Updated videos API with validation
- New category endpoint
- Service tests
- API tests

---

### Phase 3: Frontend Types & Hooks

**Duration:** 4-5 hours

**Goal:** Update TypeScript types and React Query hooks

**Tasks:**

1. **Update TypeScript Types** (1 hour)
   - File: `frontend/src/types/tag.ts`
   - Add `is_video_type: boolean` to `Tag`
   - Add to `TagCreate` with default
   - Update Zod schema `TagSchema`
   - File: `frontend/src/types/list.ts` (if exists)
   - Add `default_schema_id: string | null`

2. **Update Tag Hooks** (1 hour)
   - File: `frontend/src/hooks/useTags.ts`
   - Update `useCreateTag` (include is_video_type)
   - Update `useUpdateTag` (include is_video_type)
   - Add `useCategories()` - filter hook
   - Add `useLabels()` - filter hook

3. **Create Video Category Hooks** (2 hours)
   - File: `frontend/src/hooks/useVideos.ts`
   - Add `useSetVideoCategory()`
     - Mutation: PUT /videos/{id}/category
     - Optimistic update
     - Invalidation
   - Add `useRemoveTagFromVideo()`
     - Mutation: DELETE /videos/{id}/tags/{tag_id}
     - Invalidation

4. **Update Test Mocks** (1 hour)
   - Find all Tag mocks in tests
   - Add `is_video_type: true` to mocks
   - Update type assertions

**Acceptance Criteria:**
- ✅ TypeScript compiles without errors
- ✅ Tag type includes `is_video_type`
- ✅ useCategories() returns only video types
- ✅ useSetVideoCategory() hook works
- ✅ All frontend tests pass

**Dependencies:** Phase 2

**Deliverables:**
- Updated TypeScript types
- Updated Zod schemas
- New hooks (useCategories, useLabels, useSetVideoCategory)
- Updated test mocks

---

### Phase 4: Settings UI Redesign

**Duration:** 8-10 hours

**Goal:** Transform Settings page to show categories instead of tags/schemas/fields

**Tasks:**

1. **Create WorkspaceFieldsCard Component** (2 hours)
   - File: `frontend/src/components/settings/WorkspaceFieldsCard.tsx` (NEW)
   - Display "Alle Videos" with special styling
   - Show workspace fields list
   - "Bearbeiten" button → opens editor
   - Gradient background (blue)

2. **Create WorkspaceFieldsEditor Component** (2 hours)
   - File: `frontend/src/components/settings/WorkspaceFieldsEditor.tsx` (NEW)
   - Dialog to edit workspace fields
   - Add/remove fields
   - Field name conflict detection
   - Can't delete workspace (only edit fields)

3. **Modify CategoryCard (TagsList)** (2 hours)
   - File: `frontend/src/components/settings/TagsList.tsx`
   - Filter to only show `is_video_type=true` tags
   - Show fields instead of "Schema: X"
   - Show video count
   - "Bearbeiten" → CategoryFieldsEditor

4. **Modify CategoryFieldsEditor (EditTagDialog)** (3 hours)
   - File: `frontend/src/components/EditTagDialog.tsx`
   - Change terminology: "Informationen" not "Schema"
   - Show field reuse info ("Wird auch verwendet in:")
   - Add field inline
   - Remove field with warning if used

5. **Update SettingsPage** (1 hour)
   - File: `frontend/src/pages/SettingsPage.tsx`
   - Rename "Tags" tab → "Kategorien"
   - Remove "Schemas" and "Fields" tabs (consolidated)
   - Add WorkspaceFieldsCard at top
   - Use CategoryCard for video types
   - Update layout

**Acceptance Criteria:**
- ✅ Settings shows "Kategorien" tab
- ✅ "Alle Videos" workspace card appears first
- ✅ Categories show fields (not schema names)
- ✅ Can edit workspace fields
- ✅ Can edit category fields
- ✅ Field reuse is visible
- ✅ No references to "Tags", "Schemas", "Fields" in UI

**Dependencies:** Phase 3

**Deliverables:**
- WorkspaceFieldsCard component
- WorkspaceFieldsEditor component
- Updated TagsList component
- Updated EditTagDialog component
- Updated SettingsPage

---

### Phase 5: Video Detail UI

**Duration:** 8-10 hours

**Goal:** Add category selector and warning dialogs to video detail pages

**Tasks:**

1. **Create CategorySelector Component** (3 hours)
   - File: `frontend/src/components/CategorySelector.tsx` (NEW)
   - Dropdown with categories
   - Show current category with color
   - Clear button (×) on hover
   - Disabled state
   - Loading state
   - Keyboard navigation
   - Screen reader support

2. **Create CategoryChangeWarning Component** (3 hours)
   - File: `frontend/src/components/CategoryChangeWarning.tsx` (NEW)
   - Dialog with two variants:
     - No backup: Show what will be backed up
     - Has backup: Show restore checkbox
   - Show workspace fields that persist
   - Color-coded sections (backup, persist)
   - Confirm/Cancel actions
   - Accessibility

3. **Update VideoDetailsPage** (2 hours)
   - File: `frontend/src/pages/VideoDetailsPage.tsx`
   - Add CategorySelector at top
   - Remove tag badges (or filter to labels only)
   - Show all fields without separation
   - Hook up category change logic
   - Show toast on success

4. **Update VideoDetailsModal** (1 hour)
   - File: `frontend/src/components/VideoDetailsModal.tsx`
   - Same changes as VideoDetailsPage
   - Ensure modal width accommodates new UI

5. **Add Toast Notifications** (1 hour)
   - Success: "Kategorie geändert zu 'X'"
   - Error: "Kategorie konnte nicht geändert werden"
   - With backup: "3 Werte wiederhergestellt"

**Acceptance Criteria:**
- ✅ Category selector appears in video detail
- ✅ Changing category shows warning dialog
- ✅ Warning shows correct field lists
- ✅ Restore checkbox appears when backup exists
- ✅ Category change works end-to-end
- ✅ Toast notifications appear
- ✅ Fields update after category change
- ✅ Workspace fields persist

**Dependencies:** Phase 4

**Deliverables:**
- CategorySelector component
- CategoryChangeWarning component
- Updated VideoDetailsPage
- Updated VideoDetailsModal
- Toast notifications

---

### Phase 6: Testing & Polish

**Duration:** 6-8 hours

**Goal:** Comprehensive testing, bug fixes, polish

**Tasks:**

1. **Backend Tests** (3 hours)
   - File: `backend/tests/unit/test_field_value_backup.py` (NEW)
     - Test backup creation
     - Test restoration
     - Test corrupted file handling
   - File: `backend/tests/unit/test_field_aggregation.py` (NEW)
     - Test field combination
     - Test deduplication
   - File: `backend/tests/integration/test_category_validation.py` (NEW)
     - Test max 1 category validation
     - Test category change with backup
   - Update existing tests for new fields

2. **Frontend Tests** (2 hours)
   - File: `frontend/src/components/CategorySelector.test.tsx` (NEW)
   - File: `frontend/src/components/CategoryChangeWarning.test.tsx` (NEW)
   - File: `frontend/src/components/WorkspaceFieldsCard.test.tsx` (NEW)
   - Update existing component tests

3. **E2E Testing** (2 hours)
   - Manual testing of complete user flows
   - Story 001: First-time setup
   - Story 002: Category switch
   - Story 003: Power user workflow
   - Test on different browsers
   - Test responsive (mobile/tablet/desktop)

4. **Bug Fixes & Polish** (1 hour)
   - Fix any issues found in testing
   - Improve loading states
   - Polish animations
   - Improve error messages

5. **Documentation** (1 hour)
   - Update README if needed
   - Add migration notes
   - Document new API endpoints
   - Update CHANGELOG

**Acceptance Criteria:**
- ✅ All backend unit tests pass
- ✅ All backend integration tests pass
- ✅ All frontend component tests pass
- ✅ All E2E user stories work
- ✅ No console errors
- ✅ Responsive on all screen sizes
- ✅ Accessible (keyboard + screen reader)
- ✅ Performance acceptable (< 200ms interactions)

**Dependencies:** Phase 5

**Deliverables:**
- Backend test suite
- Frontend test suite
- Bug fixes
- Documentation updates

---

## Task Dependencies Graph

```
Phase 1: Backend Foundation
    ↓
Phase 2: Backend Services & API
    ↓
Phase 3: Frontend Types & Hooks
    ↓
Phase 4: Settings UI Redesign
    ↓
Phase 5: Video Detail UI
    ↓
Phase 6: Testing & Polish
```

**No parallel work possible** - each phase depends on previous

---

## Milestones

### Milestone 1: Backend Complete (End of Phase 2)

**Target:** After 12-14 hours

**Deliverables:**
- ✅ Database migrated
- ✅ Models updated
- ✅ Services implemented
- ✅ API endpoints working
- ✅ Backend tests passing

**Verification:**
- Can create categories via API
- Can change video category via API
- Backup system works
- Validation prevents multiple categories

---

### Milestone 2: Frontend Foundation (End of Phase 3)

**Target:** After 16-19 hours

**Deliverables:**
- ✅ TypeScript types updated
- ✅ Hooks implemented
- ✅ Frontend compiles
- ✅ Frontend tests pass

**Verification:**
- No TypeScript errors
- Hooks fetch and mutate correctly
- Type safety maintained

---

### Milestone 3: Settings UI Complete (End of Phase 4)

**Target:** After 24-29 hours

**Deliverables:**
- ✅ Settings page redesigned
- ✅ Workspace fields editable
- ✅ Categories editable
- ✅ No more "Tags/Schemas/Fields" terminology

**Verification:**
- User can create categories
- User can add fields to categories
- User can edit workspace fields
- Field reuse works

---

### Milestone 4: Full Feature Complete (End of Phase 5)

**Target:** After 32-39 hours

**Deliverables:**
- ✅ Category selector in video detail
- ✅ Warning dialogs working
- ✅ Backup/restore working
- ✅ End-to-end flow complete

**Verification:**
- Can assign category to video
- Can change category with backup
- Can restore backed-up values
- Workspace fields persist

---

### Milestone 5: Production Ready (End of Phase 6)

**Target:** After 38-47 hours

**Deliverables:**
- ✅ All tests passing
- ✅ Bugs fixed
- ✅ Documentation updated
- ✅ Ready for production

**Verification:**
- All user stories work
- Performance acceptable
- Accessible
- No known bugs

---

## Risk Management

### Risk 1: Backup System Failures

**Probability:** Medium
**Impact:** High

**Mitigation:**
- Comprehensive error handling
- Graceful degradation (feature works without backup)
- Extensive testing of edge cases
- File system permissions testing

**Contingency:**
- If backup system fails, category change still works
- User can manually re-enter values
- Log errors for debugging

---

### Risk 2: Performance Issues with Large Datasets

**Probability:** Low
**Impact:** Medium

**Mitigation:**
- Database indexes on video_field_values
- Query optimization (selectinload)
- Pagination for large lists
- Test with 1000+ videos

**Contingency:**
- Add caching layer
- Implement virtualization for long lists
- Optimize queries

---

### Risk 3: TypeScript Migration Breaks

**Probability:** Low
**Impact:** High

**Mitigation:**
- Incremental type updates
- Run type check after each change
- Update test mocks immediately
- Keep backward compatibility

**Contingency:**
- Rollback to previous phase
- Fix types before proceeding
- Use `any` temporarily (only as last resort)

---

### Risk 4: User Confusion with New UI

**Probability:** Medium
**Impact:** Medium

**Mitigation:**
- Follow user stories exactly
- Clear terminology ("Kategorien", "Informationen")
- Tooltips and hints
- Warning dialogs explain changes

**Contingency:**
- Add onboarding tooltips
- Create quick-start guide
- Collect user feedback
- Iterate on UX

---

## Deployment Strategy

### Staging Deployment

**After each phase:**
1. Merge to `develop` branch
2. Deploy to staging environment
3. Run smoke tests
4. Manual QA
5. Fix critical bugs before next phase

### Production Deployment

**After Phase 6 complete:**

**Pre-deployment:**
1. Full regression test suite
2. Performance benchmarks
3. Accessibility audit
4. Code review

**Deployment:**
1. Database migration (no downtime)
2. Backend deployment
3. Frontend deployment
4. Verify migration success

**Post-deployment:**
1. Monitor error logs
2. Check performance metrics
3. Collect user feedback
4. Hotfix if needed

**Rollback Plan:**
- Revert frontend deployment
- Revert backend deployment
- Rollback database migration
- All data safe (columns nullable/defaulted)

---

## Success Metrics

### Technical Metrics

- **Test Coverage:** > 80%
- **TypeScript Errors:** 0
- **Build Time:** < 2 minutes
- **Bundle Size Increase:** < 50KB
- **API Response Time:** < 200ms p95

### User Metrics

- **Time to First Category:** < 5 minutes
- **Category Change Time:** < 30 seconds
- **Error Rate:** < 1%
- **User Satisfaction:** > 4/5

---

## Team Assignment (Single Developer)

**Recommended Schedule:**

**Day 1 (8 hours):**
- Phase 1: Backend Foundation (3-4 hours)
- Phase 2: Backend Services & API (start, 4-5 hours)

**Day 2 (8 hours):**
- Phase 2: Backend Services & API (finish, 3-5 hours)
- Phase 3: Frontend Types & Hooks (4-5 hours)

**Day 3 (8 hours):**
- Phase 4: Settings UI Redesign (8 hours)

**Day 4 (8 hours):**
- Phase 5: Video Detail UI (8 hours)

**Day 5 (8 hours):**
- Phase 6: Testing & Polish (6-8 hours)
- Buffer for issues

**Total:** 5 days (40 hours)

---

## Definition of Done

### For Each Task:

- [ ] Code written and reviewed
- [ ] Unit tests written and passing
- [ ] Integration tests passing (if applicable)
- [ ] TypeScript compiles without errors
- [ ] Linter passes
- [ ] Manually tested
- [ ] Documentation updated
- [ ] Committed to version control

### For Each Phase:

- [ ] All tasks in phase complete
- [ ] All tests passing
- [ ] Deployed to staging
- [ ] Smoke tested
- [ ] Acceptance criteria met
- [ ] No known critical bugs
- [ ] Ready for next phase

### For Full Feature:

- [ ] All 6 phases complete
- [ ] All user stories work
- [ ] All tests passing
- [ ] Performance acceptable
- [ ] Accessible (WCAG 2.1 AA)
- [ ] Responsive (mobile/tablet/desktop)
- [ ] Documentation complete
- [ ] Deployed to production
- [ ] Users can use feature

---

## Next Phase

✅ Ready for Phase 9: Testing Strategy
- Detailed test plan
- Test cases for each component
- E2E scenarios
- Performance tests
