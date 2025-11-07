# Task #75: Add Database Indexes for Performance (Additional Custom Fields Indexes)

**Plan Task:** #75
**Wave/Phase:** Wave 2 - Custom Fields System (Backend Performance Optimization)
**Dependencies:** Task #62 (VideoFieldValue model complete), Migration 1a6e18578c31 (existing indexes in place)

---

## 🎯 Ziel

Analyze existing database indexes from migration 1a6e18578c31 and determine if additional indexes are needed for common query patterns in the Custom Fields System. Use EXPLAIN ANALYZE to validate index usage and identify performance bottlenecks. Document findings and create migration only if new indexes are justified by measurable performance gains.

**Current State Analysis:** Migration 1a6e18578c31 already created 3 indexes for video_field_values:
- `idx_video_field_values_field_numeric` (field_id, value_numeric) - Lines 93
- `idx_video_field_values_field_text` (field_id, value_text) - Lines 96
- `idx_video_field_values_video_field` (video_id, field_id) - Lines 99

**Research Goal:** Determine if additional indexes (e.g., reverse order, boolean value, or covering indexes) provide measurable benefits for anticipated query patterns.

## 📋 Acceptance Criteria

- [ ] EXPLAIN ANALYZE results documented for all common query patterns (filter by rating, filter by text, fetch all field values for video)
- [ ] Current indexes (3) confirmed to be used correctly by query planner
- [ ] Gap analysis completed: identify any query patterns NOT covered by existing indexes
- [ ] Performance benchmarks with 1000+ rows (before optimization baseline)
- [ ] New migration created ONLY if new indexes provide >20% performance improvement
- [ ] Index maintenance costs documented (write overhead, storage size)
- [ ] EXPLAIN ANALYZE evidence included in implementation report showing "Index Scan" vs "Seq Scan"

---

## 🛠️ Implementation Steps

### 1. Analyze Existing Indexes and Query Patterns

**Files:** `backend/alembic/versions/1a6e18578c31_add_custom_fields_system.py` (lines 92-99)

**Action:** Document existing indexes and map them to anticipated query patterns:

**Existing Indexes:**
```python
# Index 1: Filter by field + numeric value (e.g., "Rating >= 4")
op.create_index('idx_video_field_values_field_numeric', 'video_field_values', ['field_id', 'value_numeric'])

# Index 2: Filter by field + text value (e.g., "Presentation = 'great'")
op.create_index('idx_video_field_values_field_text', 'video_field_values', ['field_id', 'value_text'])

# Index 3: Lookup all field values for a video (most common query)
op.create_index('idx_video_field_values_video_field', 'video_field_values', ['video_id', 'field_id'])
```

**Query Pattern Mapping:**
1. **Filter videos by rating field** (e.g., "Show videos where Rating >= 4")
   - Expected Index: `idx_video_field_values_field_numeric` ✓
   - Query: `WHERE field_id = 'rating-uuid' AND value_numeric >= 4`

2. **Filter videos by text field** (e.g., "Show videos where Presentation = 'great'")
   - Expected Index: `idx_video_field_values_field_text` ✓
   - Query: `WHERE field_id = 'presentation-uuid' AND value_text = 'great'`

3. **Fetch all field values for a video** (video detail page)
   - Expected Index: `idx_video_field_values_video_field` ✓
   - Query: `WHERE video_id = 'video-uuid'`

4. **Filter videos by boolean field** (e.g., "Show videos where Recommended = true")
   - Expected Index: **MISSING** - No index on (field_id, value_boolean)
   - Query: `WHERE field_id = 'recommended-uuid' AND value_boolean = true`

5. **Fetch all videos with values for a specific field** (field usage analytics)
   - Expected Index: `idx_video_field_values_field_numeric` (partial match) ⚠️
   - Query: `WHERE field_id = 'field-uuid'` (only uses first column of composite)

6. **Reverse lookup: Find field by video and value** (rare, likely not needed)
   - Expected Index: **NONE** - Not a common pattern
   - Query: `WHERE video_id = 'uuid' AND value_numeric = 4`

**Gap Identified:** No index for boolean field filtering (Query Pattern #4)

---

### 2. Create Test Dataset for EXPLAIN ANALYZE

**Files:** `backend/tests/performance/test_video_field_value_indexes.py` (new file)

**Action:** Create pytest test to populate database with realistic test data (1000+ rows) and run EXPLAIN ANALYZE queries:

```python
import pytest
from sqlalchemy import text
from uuid import uuid4

@pytest.fixture
async def test_data(db_session):
    """Create test data: 1000 videos, 3 fields (rating, text, boolean)."""
    # Create test list
    list_id = uuid4()
    # ... insert list

    # Create 3 custom fields
    rating_field_id = uuid4()  # field_type='rating'
    text_field_id = uuid4()    # field_type='select'
    bool_field_id = uuid4()    # field_type='boolean'
    # ... insert fields

    # Create 1000 videos with field values
    for i in range(1000):
        video_id = uuid4()
        # ... insert video

        # Insert field values
        await db_session.execute(text("""
            INSERT INTO video_field_values (id, video_id, field_id, value_numeric)
            VALUES (:id, :video_id, :field_id, :value)
        """), {"id": uuid4(), "video_id": video_id, "field_id": rating_field_id, "value": i % 5 + 1})

        await db_session.execute(text("""
            INSERT INTO video_field_values (id, video_id, field_id, value_text)
            VALUES (:id, :video_id, :field_id, :value)
        """), {"id": uuid4(), "video_id": video_id, "field_id": text_field_id, "value": f"option_{i % 10}"})

        await db_session.execute(text("""
            INSERT INTO video_field_values (id, video_id, field_id, value_boolean)
            VALUES (:id, :video_id, :field_id, :value)
        """), {"id": uuid4(), "video_id": video_id, "field_id": bool_field_id, "value": i % 2 == 0})

    await db_session.commit()
    return {"rating_field_id": rating_field_id, "text_field_id": text_field_id, "bool_field_id": bool_field_id}


async def test_explain_analyze_queries(db_session, test_data):
    """Run EXPLAIN ANALYZE on all query patterns."""

    # Query 1: Filter by rating (SHOULD use idx_video_field_values_field_numeric)
    result = await db_session.execute(text("""
        EXPLAIN ANALYZE
        SELECT video_id FROM video_field_values
        WHERE field_id = :field_id AND value_numeric >= 4
    """), {"field_id": test_data["rating_field_id"]})

    explain_output = "\n".join([row[0] for row in result.fetchall()])
    print("\n=== Query 1: Filter by Rating >=4 ===")
    print(explain_output)
    assert "Index Scan using idx_video_field_values_field_numeric" in explain_output

    # Query 2: Filter by text (SHOULD use idx_video_field_values_field_text)
    result = await db_session.execute(text("""
        EXPLAIN ANALYZE
        SELECT video_id FROM video_field_values
        WHERE field_id = :field_id AND value_text = 'option_5'
    """), {"field_id": test_data["text_field_id"]})

    explain_output = "\n".join([row[0] for row in result.fetchall()])
    print("\n=== Query 2: Filter by Text Value ===")
    print(explain_output)
    assert "Index Scan using idx_video_field_values_field_text" in explain_output

    # Query 3: Fetch all values for video (SHOULD use idx_video_field_values_video_field)
    result = await db_session.execute(text("""
        EXPLAIN ANALYZE
        SELECT field_id, value_numeric, value_text, value_boolean
        FROM video_field_values
        WHERE video_id = (SELECT video_id FROM video_field_values LIMIT 1)
    """))

    explain_output = "\n".join([row[0] for row in result.fetchall()])
    print("\n=== Query 3: Fetch All Field Values for Video ===")
    print(explain_output)
    assert "Index Scan using idx_video_field_values_video_field" in explain_output

    # Query 4: Filter by boolean (POTENTIALLY MISSING INDEX)
    result = await db_session.execute(text("""
        EXPLAIN ANALYZE
        SELECT video_id FROM video_field_values
        WHERE field_id = :field_id AND value_boolean = true
    """), {"field_id": test_data["bool_field_id"]})

    explain_output = "\n".join([row[0] for row in result.fetchall()])
    print("\n=== Query 4: Filter by Boolean Value ===")
    print(explain_output)
    # Check if using seq scan (missing index) or index scan
    if "Seq Scan" in explain_output:
        print("⚠️ WARNING: No index for boolean filtering! Creating index may improve performance.")
    else:
        print("✓ Index found for boolean filtering")
```

**Expected Output Examples:**

**Good (Index Used):**
```
Index Scan using idx_video_field_values_field_numeric on video_field_values  (cost=0.42..8.44 rows=1 width=16) (actual time=0.023..0.024 rows=200 loops=1)
  Index Cond: ((field_id = '...') AND (value_numeric >= 4))
Planning Time: 0.145 ms
Execution Time: 0.056 ms
```

**Bad (Seq Scan):**
```
Seq Scan on video_field_values  (cost=0.00..35.50 rows=500 width=16) (actual time=0.012..2.456 rows=500 loops=1)
  Filter: ((field_id = '...') AND (value_boolean = true))
  Rows Removed by Filter: 2500
Planning Time: 0.089 ms
Execution Time: 2.678 ms
```

---

### 3. Benchmark Performance (Baseline)

**Files:** `backend/tests/performance/test_video_field_value_indexes.py`

**Action:** Add benchmark tests using `pytest-benchmark` to measure query execution time:

```python
import pytest

@pytest.mark.benchmark
def test_benchmark_rating_filter(db_session, test_data, benchmark):
    """Benchmark: Filter videos by rating >=4"""

    def query():
        return db_session.execute(text("""
            SELECT video_id FROM video_field_values
            WHERE field_id = :field_id AND value_numeric >= 4
        """), {"field_id": test_data["rating_field_id"]}).fetchall()

    result = benchmark(query)
    print(f"\n✓ Rating filter returned {len(result)} rows")


@pytest.mark.benchmark
def test_benchmark_boolean_filter(db_session, test_data, benchmark):
    """Benchmark: Filter videos by boolean field"""

    def query():
        return db_session.execute(text("""
            SELECT video_id FROM video_field_values
            WHERE field_id = :field_id AND value_boolean = true
        """), {"field_id": test_data["bool_field_id"]}).fetchall()

    result = benchmark(query)
    print(f"\n✓ Boolean filter returned {len(result)} rows")
```

**Run benchmarks:**
```bash
cd backend
pytest tests/performance/test_video_field_value_indexes.py -v --benchmark-only
```

**Document Results:**
- Create `docs/performance/2025-11-07-task-075-baseline-benchmarks.md`
- Include EXPLAIN ANALYZE output for all query patterns
- Record execution times (median, min, max)

---

### 4. Decision: Create New Index or Keep Existing?

**Files:** `docs/plans/tasks/task-075-decision-log.md` (new file)

**Action:** Analyze EXPLAIN ANALYZE results and decide if new indexes are warranted:

**Decision Criteria:**
1. **Is Seq Scan occurring?** If yes → index may help
2. **How many rows filtered?** If >100 rows → index beneficial
3. **Query frequency?** If <1% of queries → index not worth write overhead
4. **Index size cost?** Boolean index may be small, worth adding

**Potential New Index (if justified):**
```python
# Index 4: Filter by field + boolean value (e.g., "Recommended = true")
op.create_index('idx_video_field_values_field_boolean', 'video_field_values', ['field_id', 'value_boolean'])
```

**Trade-offs:**
- **PRO:** Faster boolean field filtering (if EXPLAIN shows Seq Scan)
- **CON:** Write overhead (INSERT/UPDATE/DELETE slower by ~5-10%)
- **CON:** Storage overhead (~50KB per 1000 rows for boolean index)

**PostgreSQL Composite Index Best Practices (from REF MCP research):**
1. **Column Order Matters:** Most selective column first (field_id has high cardinality, value_boolean low)
2. **Partial Indexes:** Consider `WHERE value_boolean IS NOT NULL` to reduce index size
3. **Index Maintenance:** VACUUM ANALYZE needed after bulk inserts to update statistics
4. **Write Cost:** Each additional index adds ~10% overhead to INSERT/UPDATE operations

**Partial Index Alternative (if boolean queries are rare):**
```python
# Only index TRUE values (common filter pattern: "Show recommended videos")
op.create_index(
    'idx_video_field_values_field_boolean_true',
    'video_field_values',
    ['field_id', 'value_boolean'],
    postgresql_where=text("value_boolean = true")  # Partial index
)
```

**Benefits of Partial Index:**
- 50% smaller than full boolean index
- Faster to scan (fewer rows)
- Still helps most common query: "WHERE ... AND value_boolean = true"

---

### 5. Create Alembic Migration (If New Index Justified)

**Files:** `backend/alembic/versions/XXXXXXXX_add_boolean_field_index.py` (new file)

**Action:** Run alembic command to create migration:

```bash
cd backend
alembic revision -m "add boolean field index to video_field_values"
```

**Edit migration file:**
```python
"""add boolean field index to video_field_values

Revision ID: XXXXXXXX
Revises: 1a6e18578c31
Create Date: 2025-11-07 XX:XX:XX
"""
from alembic import op
from sqlalchemy import text

# revision identifiers, used by Alembic.
revision = 'XXXXXXXX'
down_revision = '1a6e18578c31'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add index for boolean field filtering
    # Pattern: "Show videos where Recommended = true"
    # DECISION: Using partial index to reduce size (only TRUE values indexed)
    op.create_index(
        'idx_video_field_values_field_boolean',
        'video_field_values',
        ['field_id', 'value_boolean'],
        postgresql_where=text("value_boolean IS NOT NULL")  # Exclude NULL rows
    )
    # NOTE: If partial index not beneficial, use full index:
    # op.create_index('idx_video_field_values_field_boolean', 'video_field_values', ['field_id', 'value_boolean'])


def downgrade() -> None:
    op.drop_index('idx_video_field_values_field_boolean', table_name='video_field_values')
```

**Apply migration:**
```bash
alembic upgrade head
```

---

### 6. Verify Index Usage After Migration

**Files:** `backend/tests/performance/test_video_field_value_indexes.py`

**Action:** Re-run EXPLAIN ANALYZE tests to confirm new index is used:

```bash
pytest tests/performance/test_video_field_value_indexes.py::test_explain_analyze_queries -v -s
```

**Expected Output (After Index):**
```
=== Query 4: Filter by Boolean Value ===
Index Scan using idx_video_field_values_field_boolean on video_field_values  (cost=0.42..8.44 rows=500 width=16) (actual time=0.018..0.095 rows=500 loops=1)
  Index Cond: ((field_id = '...') AND (value_boolean = true))
Planning Time: 0.112 ms
Execution Time: 0.124 ms  ← Should be <50% of baseline (Seq Scan)
```

**Compare to Baseline:**
- Document improvement: "Seq Scan took 2.678ms → Index Scan takes 0.124ms (95% faster)"
- If improvement <20% → Consider removing index (not worth write overhead)

---

### 7. Benchmark Performance (After Optimization)

**Files:** `backend/tests/performance/test_video_field_value_indexes.py`

**Action:** Re-run benchmarks and compare to baseline:

```bash
pytest tests/performance/test_video_field_value_indexes.py -v --benchmark-only --benchmark-compare=baseline
```

**Document Results:**
- Create `docs/performance/2025-11-07-task-075-optimization-results.md`
- Include before/after comparison table
- Recommendation: Keep or remove new index based on results

---

### 8. Document Index Maintenance Strategy

**Files:** `docs/plans/2025-11-05-custom-fields-system-design.md`

**Action:** Add new section "Index Maintenance" with guidance:

```markdown
### Index Maintenance (video_field_values)

**Existing Indexes (Migration 1a6e18578c31):**
1. `idx_video_field_values_field_numeric` (field_id, value_numeric) - For rating filters
2. `idx_video_field_values_field_text` (field_id, value_text) - For text/select filters
3. `idx_video_field_values_video_field` (video_id, field_id) - For fetching all field values per video

**New Indexes (Migration XXXXXXXX - Task #75):**
4. `idx_video_field_values_field_boolean` (field_id, value_boolean WHERE value_boolean IS NOT NULL) - For boolean filters

**Maintenance Tasks:**
- Run `VACUUM ANALYZE video_field_values;` after bulk inserts (CSV upload)
- Monitor index bloat: `SELECT * FROM pg_stat_user_indexes WHERE relname = 'video_field_values';`
- Autovacuum threshold: 1000 rows (default PostgreSQL setting)

**Write Overhead:**
- Each INSERT/UPDATE to video_field_values updates 4-5 indexes
- Estimated overhead: 40-50% slower writes vs no indexes
- Trade-off justified for 10x-100x faster reads

**Storage Overhead:**
- Indexes consume ~50-100KB per 1000 rows
- Full table scan: ~500KB per 1000 rows
- Index size acceptable for performance gains
```

---

## 🧪 Testing Strategy

**Performance Tests:**
- Create test dataset: 1000 videos, 3 custom fields (rating, text, boolean)
- Run EXPLAIN ANALYZE on 6 query patterns (see Step 1)
- Verify existing indexes (3) are used correctly by query planner
- Benchmark query execution times (baseline vs optimized)
- Target: >20% improvement for new indexes (otherwise not worth write overhead)

**Integration Tests:**
- Verify migration applies cleanly (`alembic upgrade head`)
- Verify migration rollback works (`alembic downgrade -1`)
- Verify UNIQUE constraint still enforced after adding indexes
- Verify CASCADE DELETE still works with new indexes

**Manual Testing:**
1. Apply migration: `alembic upgrade head`
2. Check indexes exist: `\d video_field_values` in psql
3. Run EXPLAIN ANALYZE queries manually in psql
4. Insert 1000 rows, measure write time (should be <10% slower)
5. Query by boolean filter, measure read time (should be >50% faster if index used)
6. Rollback migration: `alembic downgrade -1`
7. Verify indexes dropped: `\d video_field_values`

**Load Testing (Optional):**
- Use `pgbench` or `locust` to simulate concurrent queries
- Measure throughput: queries per second (QPS)
- Target: >500 QPS for filtered queries with indexes

---

## 📚 Reference

**Related Docs:**
- `docs/plans/2025-11-05-custom-fields-system-design.md` - Lines 127-131 (existing indexes)
- `backend/alembic/versions/1a6e18578c31_add_custom_fields_system.py` - Lines 92-99 (migration with existing indexes)
- `backend/app/models/video_field_value.py` - Lines 68-71 (performance notes)
- PostgreSQL EXPLAIN: https://www.postgresql.org/docs/current/sql-explain.html
- REF MCP: Partial Indexes - https://learn.microsoft.com/en-us/azure/postgresql/flexible-server/how-to-optimize-performance-pgvector#partial-indexes

**Related Code:**
- VideoFieldValue model: `backend/app/models/video_field_value.py`
- Existing migration: `backend/alembic/versions/1a6e18578c31_add_custom_fields_system.py`

**Design Decisions:**

1. **Why analyze existing indexes FIRST before creating new ones?**
   - Migration 1a6e18578c31 already created 3 indexes based on anticipated query patterns
   - Adding indexes blindly increases write overhead without proven benefit
   - EXPLAIN ANALYZE provides empirical evidence of query planner behavior
   - Industry best practice: "Measure first, optimize second"

2. **Why composite index order (field_id, value_X) instead of (value_X, field_id)?**
   - `field_id` has HIGH cardinality (many unique fields per list)
   - `value_numeric`/`value_text`/`value_boolean` have LOW-MEDIUM cardinality
   - PostgreSQL B-tree indexes work left-to-right: high selectivity first
   - Query pattern always filters by field_id FIRST, then value
   - REF: "Put most selective column first in composite index"

3. **Why partial index for boolean values?**
   - Boolean columns have VERY low cardinality (only 3 distinct values: true, false, NULL)
   - Full index on low-cardinality columns may not be used by query planner
   - Partial index `WHERE value_boolean = true` is 50% smaller and more selective
   - Common query pattern: "Show recommended videos" (filters for TRUE, not FALSE)
   - REF MCP: https://learn.microsoft.com/en-us/azure/postgresql/flexible-server/how-to-optimize-performance-pgvector#partial-indexes

4. **Why NOT create indexes for every possible query pattern?**
   - Each index adds 10-15% overhead to INSERT/UPDATE/DELETE operations
   - Indexes consume storage (50-100KB per 1000 rows per index)
   - Autovacuum overhead increases with more indexes
   - Only add indexes with >20% performance improvement for common queries
   - Rare queries (<1% frequency) can tolerate Seq Scan

5. **Why use EXPLAIN ANALYZE instead of just EXPLAIN?**
   - `EXPLAIN` shows query planner's ESTIMATED costs (may be wrong)
   - `EXPLAIN ANALYZE` runs query and shows ACTUAL execution time
   - Validates that index is actually used (not just available)
   - Reveals row count mismatches (statistics out of date → need ANALYZE)

6. **When to run VACUUM ANALYZE on video_field_values?**
   - After bulk inserts (CSV upload of 100+ videos)
   - After deleting >10% of rows
   - If EXPLAIN shows wrong row estimates (stale statistics)
   - Autovacuum runs automatically, but manual ANALYZE ensures fresh stats for EXPLAIN ANALYZE tests

7. **Why document index maintenance strategy?**
   - Future developers need to understand write overhead trade-offs
   - Index bloat can degrade performance over time (needs monitoring)
   - VACUUM ANALYZE required for query planner to use indexes optimally
   - Production systems need monitoring queries for index usage (pg_stat_user_indexes)

---

## 🚨 Important Notes

**CRITICAL: Check Existing Indexes First!**
- Migration 1a6e18578c31 already created 3 indexes (lines 92-99)
- Do NOT blindly add indexes without EXPLAIN ANALYZE evidence
- Only create new migration if gap analysis reveals missing index with measurable impact

**EXPLAIN ANALYZE Output Interpretation:**
- "Index Scan using idx_name" = Index is used ✓
- "Seq Scan" = No index used (full table scan) ⚠️
- "Bitmap Index Scan" = Multiple indexes combined (acceptable)
- "cost=X..Y" = Estimated cost (lower is better)
- "actual time=X..Y" = Real execution time in milliseconds
- "rows=N" = Actual rows returned (compare to estimate for statistics accuracy)

**Index Ordering Best Practices (PostgreSQL B-tree):**
1. **High Cardinality First:** field_id (many unique values) before value_X (fewer unique values)
2. **Filter Column First:** field_id is ALWAYS in WHERE clause, value_X is optional
3. **Left-to-Right Matching:** Index (A, B, C) can satisfy queries filtering on A, (A,B), or (A,B,C), but NOT (B,C)

**Partial Index Trade-offs:**
- **PRO:** Smaller size (50% reduction for boolean), faster scans
- **PRO:** More selective (better statistics for query planner)
- **CON:** Only helps queries matching WHERE clause exactly
- **CON:** Requires developer awareness (query must match partial index condition)

**Write Overhead Reality Check:**
- 3 existing indexes = ~30% write overhead
- Adding 1 boolean index = ~10% additional overhead (40% total)
- For read-heavy workload (videos fetched 100x more than updated), this is acceptable
- For write-heavy workload (frequent field value updates), consider partial indexes only

---

## ✅ Completion Checklist

Before marking this task complete:

- [ ] EXPLAIN ANALYZE tests run for all 6 query patterns
- [ ] Existing indexes (3) verified to work correctly
- [ ] Gap analysis documented in decision log
- [ ] Performance benchmarks recorded (baseline)
- [ ] Decision made: Create new index OR keep existing (with justification)
- [ ] If new index: Migration created and applied
- [ ] If new index: EXPLAIN ANALYZE shows index is used
- [ ] If new index: Performance benchmarks show >20% improvement
- [ ] Index maintenance strategy documented
- [ ] Implementation report created with EXPLAIN ANALYZE evidence
- [ ] Code reviewed and merged
