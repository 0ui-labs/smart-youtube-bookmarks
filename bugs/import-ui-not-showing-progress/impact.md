# Impact Analysis: Import UI Not Showing Progress

## Severity: HIGH

### User Impact
- **100% of batch imports (>5 videos)** show broken UX
- Users see "white cards" for 2+ seconds - appears broken
- No visual feedback during enrichment - confusing
- Cards clickable before ready - may show incomplete data

### Business Impact
- Core feature (batch import) doesn't meet design spec
- First impression for new users importing content is poor
- Violates "instant feedback" design principle

### Technical Impact
- Three separate bugs compounding
- WebSocket infrastructure unused despite being built
- DB fields (`import_stage`, `import_progress`) unused

## Affected Users
- **All users** importing >5 videos at once
- Single video imports (≤5) work correctly (sync path)

## Workarounds
- Import videos in batches of ≤5 (not ideal)
- Wait 2 seconds after import (user must know this)

## Risk Assessment

| Factor | Rating | Notes |
|--------|--------|-------|
| Frequency | High | Every batch import |
| Severity | High | Core feature broken |
| Discoverability | High | Immediately visible |
| Workaround Available | Yes | Small batches work |

## Dependencies
- No data loss or corruption
- Videos eventually appear correctly
- Backend enrichment works (just no UI feedback)
