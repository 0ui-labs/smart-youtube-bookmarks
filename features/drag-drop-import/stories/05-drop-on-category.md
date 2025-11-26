# User Story 05: Video auf Kategorie droppen

**Als** Nutzer der Video-Bookmark App
**möchte ich** ein Video direkt auf eine Kategorie in der Sidebar ziehen
**damit** das Video automatisch dieser Kategorie zugewiesen wird

## Akzeptanzkriterien

- [ ] Jede Kategorie in der Sidebar ist ein Drop Target
- [ ] Visuelles Feedback beim Hover über Kategorie
- [ ] Video wird importiert UND Kategorie zugewiesen
- [ ] Funktioniert mit allen Input-Formaten (URL, Datei, Text)

## UX Flow (Einzelnes Video)

```
1. User zieht YouTube URL
2. User bewegt Maus über Sidebar
   → Kategorien werden als Drop Targets erkennbar
3. User hovert über "Tutorial" Kategorie
   → Kategorie bekommt Highlight (Ring/Border)
   → Tooltip: "Als Tutorial hinzufügen"
4. User lässt los (Drop)
   → Video wird importiert
   → Kategorie "Tutorial" wird automatisch zugewiesen
5. Toast: "Video als Tutorial hinzugefügt"
```

## UX Flow (Mehrere Videos)

```
1. User zieht mehrere URLs/Dateien
2. User droppt auf "Review" Kategorie
3. ImportPreviewModal öffnet sich
   → Kategorie "Review" ist vorausgewählt
   → User kann Kategorie ändern oder bestätigen
4. User klickt "5 Videos als Review importieren"
5. Alle Videos werden mit Kategorie importiert
```

## Visuelles Design

### Normal State (Tag)
```
┌─────────────────────┐
│  Tutorial           │
└─────────────────────┘
```

### Drag Over State
```
┌─────────────────────┐
│ ┌─ ─ ─ ─ ─ ─ ─ ─ ┐ │
│ │  Tutorial    ⬇️  │ │  ← Ring + Icon
│ └─ ─ ─ ─ ─ ─ ─ ─ ┘ │
└─────────────────────┘
```

## Edge Cases

| Szenario | Erwartetes Verhalten |
|----------|---------------------|
| Drop auf "Alle Videos" | Import ohne Kategorie |
| Kategorie hat Schema mit Pflichtfeldern | Hinweis anzeigen, trotzdem importieren |
| Schnelles Wechseln zwischen Kategorien | Debounced Highlight |

## Interaktion mit bestehendem Klick-Verhalten

| Aktion | Ergebnis |
|--------|----------|
| Klick auf Tag | Filter aktivieren (bestehend) |
| Drag Over Tag | Highlight anzeigen (neu) |
| Drop auf Tag | Video importieren + Kategorie (neu) |

**Wichtig:** Drag Events dürfen Click Events nicht blockieren.

## Technische Details

```typescript
// TagNavigation.tsx erweitern

const handleDragOver = (e: DragEvent, tagId: string) => {
  e.preventDefault()
  setDragOverTagId(tagId)
}

const handleDrop = async (e: DragEvent, tagId: string) => {
  e.preventDefault()
  setDragOverTagId(null)

  const urls = parseDropData(e.dataTransfer)

  if (urls.length === 1) {
    // Direkt importieren mit Kategorie
    const video = await createVideo.mutateAsync({ url: urls[0] })
    await setCategory.mutateAsync({ videoId: video.id, categoryId: tagId })
  } else {
    // Modal öffnen mit vorausgewählter Kategorie
    openImportModal({ urls, preselectedCategoryId: tagId })
  }
}
```

## Zusammenspiel mit anderen Stories

- Story 01-04 definieren WAS gedroppt werden kann
- Story 05 definiert WO gedroppt werden kann (Kategorien)
- Alle Input-Formate funktionieren mit Kategorie-Drop
