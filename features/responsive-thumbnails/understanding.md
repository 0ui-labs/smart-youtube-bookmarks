# Feature Understanding: Responsive Thumbnail Loading

## Feature Summary

**In 2-3 Sätzen:** Thumbnails sollen in der optimalen Größe und im optimalen Format (WebP) geladen werden, basierend auf der tatsächlich benötigten Darstellungsgröße. Statt immer das größte verfügbare Bild zu laden und per CSS zu skalieren, wird dynamisch die passende YouTube-Thumbnail-Variante ausgewählt.

## Problem Statement

### Aktueller Zustand
- `VideoThumbnail` lädt immer die gleiche `thumbnail_url` (höchste Auflösung)
- CSS-Klassen skalieren das Bild visuell herunter
- Beispiel: Ein 640x360px Bild wird geladen, nur um es auf 128px darzustellen
- Format ist immer JPEG (keine WebP-Nutzung)

### Auswirkungen
- **Bandbreitenverschwendung:** 4-5x mehr Daten als nötig
- **Langsamere Ladezeiten:** Besonders auf mobilen Geräten
- **Höhere CDN-Kosten:** Bei YouTube gehostet, aber dennoch Traffic

## Feature Requirements

### Must Have
1. **Dynamische Größenauswahl:** Passende YouTube-Thumbnail-Größe basierend auf:
   - `thumbnailSize` Einstellung (small/medium/large/xlarge)
   - `viewMode` (list vs grid)
   - `gridColumns` (bei Grid: 2-5 Spalten)

2. **WebP-Format:** Nutze `vi_webp/` statt `vi/` für ~30% kleinere Dateien

3. **Fallback:** JPEG-Fallback wenn WebP nicht verfügbar

### Nice to Have
- `srcset` für automatische Browser-Auswahl
- Retina/HiDPI-Support (2x Größe für hochauflösende Displays)

### Out of Scope
- Eigenes Thumbnail-Caching/CDN
- Thumbnail-Generierung für Non-YouTube-Videos
- Blur-Up/Progressive Loading Placeholder

## Expected Behavior

### List View
| thumbnailSize | Pixel-Breite | YouTube Thumbnail |
|---------------|--------------|-------------------|
| small | 128px | mqdefault (320px) |
| medium | 160px | mqdefault (320px) |
| large | 192px | mqdefault (320px) |
| xlarge | 500px | sddefault (640px) |

### Grid View
| gridColumns | ~Card Width | YouTube Thumbnail |
|-------------|-------------|-------------------|
| 5 cols | ~200px | mqdefault (320px) |
| 4 cols | ~280px | mqdefault (320px) |
| 3 cols | ~380px | hqdefault (480px) |
| 2 cols | ~580px | sddefault (640px) |

## YouTube Thumbnail URLs

### Verfügbare Größen
| Suffix | Größe | Pfad |
|--------|-------|------|
| default.jpg | 120x90 | /vi/{id}/ |
| mqdefault.jpg | 320x180 | /vi/{id}/ |
| hqdefault.jpg | 480x360 | /vi/{id}/ |
| sddefault.jpg | 640x480 | /vi/{id}/ |
| maxresdefault.jpg | 1280x720 | /vi/{id}/ |

### WebP-Varianten
Gleiche Suffixe, aber mit `/vi_webp/{id}/` Pfad und `.webp` Extension.

## User Flow

1. User öffnet Videos-Seite
2. System prüft aktuelle Einstellungen (viewMode, thumbnailSize, gridColumns)
3. System berechnet benötigte Pixel-Breite
4. System generiert optimale YouTube-Thumbnail-URL (WebP + passende Größe)
5. Browser lädt nur das benötigte Thumbnail
6. Bei Einstellungsänderung: Neue URLs werden generiert (kein Reload nötig)

## Success Metrics

- **Bandbreite:** 50-70% Reduktion bei kleinen Thumbnail-Einstellungen
- **Ladezeit:** Spürbar schnellerer initialer Load (besonders Grid mit vielen Videos)
- **Keine Regression:** Visuelle Qualität bleibt gut (keine pixeligen Thumbnails)

## Decisions (Finalized)

### 1. Retina/HiDPI Support
**Decision:** Ja, mit pragmatischem 1.5x-Ansatz

- Statt echtem 2x (doppelte Auflösung) nutzen wir 1.5x
- Spart 50% Bandbreite vs. 2x, sieht aber deutlich besser aus als 1x
- Implementation: `targetWidth = displayWidth * (devicePixelRatio > 1 ? 1.5 : 1)`

### 2. WebP Fallback
**Decision:** `<picture>` Element mit automatischem JPEG-Fallback

```html
<picture>
  <source srcset="...webp" type="image/webp">
  <img src="...jpg" alt="...">
</picture>
```

Browser wählt automatisch das beste Format.

### 3. DB Fallback
**Decision:** Ja, als letzte Rettungsleine

**Fallback-Kette:**
1. WebP + optimale Größe (Normalfall)
2. JPEG + optimale Größe (WebP nicht verfügbar via `<picture>`)
3. DB `thumbnail_url` (youtube_id fehlt/ungültig)
4. Placeholder SVG (alles fehlgeschlagen)

---

**Status:** ✅ Complete
**Created:** 2024-11-28
