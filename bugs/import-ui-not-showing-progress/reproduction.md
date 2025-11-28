# Bug Reproduction: Import UI Not Showing Progress

## Bug ID
`import-ui-not-showing-progress`

## Summary
When importing 9 videos via drag & drop, video cards appear instantly but are **white** (no thumbnail, title, channel, or duration). After ~2 seconds, the data appears. The expected behavior is that thumbnails and basic info appear **immediately**, with a progress overlay during enrichment.

## Steps to Reproduce

1. Go to Home page (All listing)
2. Drag 9 webloc files (YouTube URLs) onto the grid
3. Observe video cards

## Current Behavior (Bug)

1. Video cards appear instantly - **WHITE** (no content)
2. After ~2 seconds: Thumbnails, title, channel, duration appear
3. No progress overlay visible
4. Cards are clickable immediately

## Expected Behavior (from spec)

From `docs/plans/2025-11-27-robust-import-design.md`:

```
Sekunde 0 - Instant Visibility:
├── YouTube-IDs aus Links extrahieren (regex, lokal)
├── Video-Records in DB erstellen (status: "importing")
├── Thumbnail-URL generieren (YouTube CDN, immer verfügbar)
└── → Video erscheint ausgegraut im Grid (0%)

Sekunde 1-5 - Background Enrichment:
├── Metadata holen (Titel, Channel, Dauer)      → 25%
├── Captions holen (Untertitel)                 → 60%
├── Chapters extrahieren (Kapitel)              → 90%
├── Finalisieren                                → 100%
└── → Video wird farbig + klickbar
```

**Expected:**
- Thumbnail INSTANTLY (derived from YouTube ID: `https://img.youtube.com/vi/{id}/mqdefault.jpg`)
- Card greyed out with progress overlay (0% → 100%)
- Card NOT clickable until enrichment complete
- Smooth "pie" progress animation

## Environment

- Platform: macOS Darwin 25.2.0
- Branch: `feature/robust-video-import`
- Batch size: 9 videos (> 5, uses async path)

## Verified

- [x] Can reliably reproduce with 9 webloc files
- [x] Bug does NOT occur with ≤5 videos (sync path works)
