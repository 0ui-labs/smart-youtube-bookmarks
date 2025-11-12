# Task #184: UNIQUE Constraint Planning Index

## Quick Navigation

**Main Plan:** [task-184-unique-user-youtube-constraint.md](./task-184-unique-user-youtube-constraint.md)

---

## Context in Security Hardening

**Master Plan:** `docs/plans/2025-11-02-security-hardening-implementation.md`  
**Phase:** Task 9: Database Constraints (Step 2)  
**Priority:** P2 - Operational Excellence  
**Related:** Task #183 (youtube_id length check), Task #1 (User model)

---

## Plan Sections Quick Reference

| Section | Purpose | Location | Key Content |
|---------|---------|----------|-------------|
| **Goal** | Problem statement | Top | Prevent duplicate saves per user |
| **Acceptance Criteria** | Success definition | Top | 8 criteria, all actionable |
| **Implementation Steps** | Execution guide | Pages 3-7 | 10 detailed steps with code |
| **Testing Strategy** | Quality assurance | Pages 8-9 | 4 unit tests, integration tests |
| **Design Decisions** | Technical justification | Pages 11-14 | 4 decisions with rationales |
| **Reference** | Documentation & links | Pages 10-11 | PostgreSQL docs, Alembic API |
| **Deployment** | Production guidance | Pages 15-16 | Pre/post checks, rollback |

---

## Key Code Artifacts

### 1. Migration Template
**File:** Will be created at `backend/alembic/versions/XXXX_add_unique_user_youtube_constraint.py`  
**Key function:** `op.create_unique_constraint()`  
**Constraint name:** `videos_user_youtube_unique`  

### 2. Test Suite
**File:** `backend/tests/models/test_video_constraints.py`  
**Test count:** 4 functions  
**Coverage:** Duplicate prevention, cross-user sharing, NULL handling

### 3. Git Commit Message
Provided with exact syntax for semantic commit

---

## Implementation Checklist

```
BEFORE STARTING:
  [ ] Read full plan (task-184-unique-user-youtube-constraint.md)
  [ ] Verify Task #1 (User model) implemented
  [ ] Verify Task #183 (length check) scheduled/done

DURING IMPLEMENTATION:
  [ ] Create test file
  [ ] Run tests (expect FAIL)
  [ ] Create Alembic migration
  [ ] Apply migration
  [ ] Run tests (expect PASS)
  [ ] Full test suite (expect no regressions)

BEFORE COMMIT:
  [ ] All tests passing
  [ ] Migration up/down working
  [ ] Code review
  [ ] Constraint visible in schema

DEPLOYMENT:
  [ ] Pre-deployment check for duplicates
  [ ] Run migration
  [ ] Post-deployment verify constraint
  [ ] Monitor logs for IntegrityError
```

---

## Quick Stats

- **Total Lines:** 683
- **Code Examples:** 3 (migration, test suite, commit message)
- **Test Functions:** 4
- **Design Decisions Documented:** 4
- **Estimated Implementation Time:** 45 minutes
- **Git Status:** Ready to commit

---

## Integration with Broader Context

**Part of:** Security Hardening Phase 1 (Task #9)  
**Runs Alongside:** Task #183 (youtube_id length check)  
**Depends On:** Task #1 (User model implementation)  
**Informs Future:** Task #72 (API error handling for constraint violations)

---

## Success Criteria

Plan is complete when implementer confirms:

1. Constraint created: `videos_user_youtube_unique` on (user_id, youtube_id)
2. All 4 unit tests passing
3. No regression in existing tests
4. Migration applies cleanly (up and down)
5. Code review completed
6. Commit pushed

---

## Follow-Up Tasks

After Task #184 completes:

1. **Task #72 (if not done):** Implement API error handling for constraint violations
   - Return 409 Conflict when duplicate detected
   - Provide helpful error message to user

2. **Task #9 Complete:** All database constraints deployed
   - CHECK: youtube_id length (Task #183)
   - UNIQUE: (user_id, youtube_id) (Task #184)
   - CHECK: List/tag names non-empty
   - Other constraints from Task #9

3. **Production Deployment:** Full database constraint suite to production
   - Verify no existing duplicates
   - Apply all migrations
   - Monitor constraint violations

---

## Need Help?

If during implementation you encounter:

- **PostgreSQL syntax questions:** See "Reference" section (pages 10-11)
- **Alembic migration issues:** Check migration code example (page 5)
- **Test failures:** Review test suite explanation (page 6-7)
- **Design ambiguity:** See "Design Decisions" section (pages 11-14)
- **Deployment issues:** See "Deployment Notes" section (pages 15-16)

All sections include rationales and alternatives considered.
