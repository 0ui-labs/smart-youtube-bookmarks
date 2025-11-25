# Research & Validation: Video Player

## Library-Vergleich

### Option 1: Plyr (Gewählt ✅)

| Aspekt | Bewertung |
|--------|-----------|
| **YouTube Support** | ✅ Native via data-plyr-provider |
| **Bundle Size** | ~25KB minified |
| **TypeScript** | ✅ Types included (@types/plyr) |
| **Customization** | ✅ CSS Variables |
| **Accessibility** | ✅ ARIA, Keyboard built-in |
| **React Integration** | ⚠️ Manual (useRef + useEffect) |
| **Maintenance** | ✅ Aktiv (3.8k+ GitHub Stars) |

**Vorteile:**
- Leichtgewichtig
- Vollständige Kontrolle über Player-Instanz
- CSS Variables passen zu Tailwind-System
- YouTube-embed als native Option

**Nachteile:**
- Kein React-Wrapper, manuelle Integration nötig
- Cleanup bei Unmount muss selbst gehandhabt werden

### Option 2: react-player

| Aspekt | Bewertung |
|--------|-----------|
| **YouTube Support** | ✅ Native |
| **Bundle Size** | ~40KB (mit lazy loading kleiner) |
| **TypeScript** | ✅ Types included |
| **Customization** | ⚠️ Limited (CSS override nötig) |
| **Accessibility** | ⚠️ Abhängig vom Provider |
| **React Integration** | ✅ Native React Component |
| **Maintenance** | ✅ Aktiv (8k+ GitHub Stars) |

**Vorteile:**
- React-native, kein useEffect-Boilerplate
- Multi-Provider (YouTube, Vimeo, etc.)

**Nachteile:**
- Weniger Kontrolle über UI
- CSS-Anpassung schwieriger
- Größerer Bundle

### Option 3: YouTube IFrame API (Native)

| Aspekt | Bewertung |
|--------|-----------|
| **YouTube Support** | ✅ Official |
| **Bundle Size** | 0KB (extern geladen) |
| **TypeScript** | ⚠️ @types/youtube separat |
| **Customization** | ❌ Sehr limitiert |
| **Accessibility** | ✅ YouTube handled |
| **React Integration** | ⚠️ Manual |
| **Maintenance** | ✅ Google maintained |

**Vorteile:**
- Offizielle Lösung, keine Third-Party
- Kein Bundle-Impact

**Nachteile:**
- Kaum UI-Customization möglich
- Branding (YouTube Logo) nicht entfernbar
- Weniger moderne Controls

---

## Entscheidung: Plyr

**Begründung:**
1. **CSS Variables** passen perfekt zum bestehenden Tailwind + CSS Variable System
2. **Lightweight** - wichtig für Performance
3. **Full Control** - Keyboard Shortcuts, PiP, Speed alle konfigurierbar
4. **Clean UI** - modernes Design ohne Branding-Einschränkungen

**Risiko-Mitigation:**
- React-Integration Pattern ist dokumentiert (useRef + useEffect)
- Cleanup-Pattern ist Standard in der Codebase (siehe andere Libraries)
- Fallback auf Thumbnail bei Fehler geplant

---

## Best Practices Validierung

### YouTube Embed Best Practices

✅ **Lazy Loading:** Player nur initialisieren wenn sichtbar
✅ **Privacy:** origin Parameter setzen
✅ **Autoplay:** Nur mit muted (Browser Policy)
✅ **Mobile:** Touch-optimierte Controls

### React Integration Pattern

```typescript
// Validiertes Pattern aus React-Ökosystem
useEffect(() => {
  const player = new Plyr(ref.current, config)

  // Event Handlers
  player.on('ready', handleReady)
  player.on('timeupdate', handleTimeUpdate)

  // Cleanup
  return () => {
    player.destroy()
  }
}, [dependencies])
```

### Performance Best Practices

✅ **Debounced Progress Updates:** Alle 10 Sekunden statt bei jedem Frame
✅ **Lazy CSS Loading:** Plyr CSS nur in VideoPlayer importieren
✅ **Optimistic UI:** Lokaler State für sofortige Feedback

---

## Alternative Evaluation

### Warum nicht Vidstack?

- Neuer (weniger Battle-tested)
- Größerer Bundle
- Overkill für YouTube-only Use Case

### Warum nicht Video.js?

- Sehr groß (~200KB)
- Primär für self-hosted Video
- YouTube-Plugin zusätzlich nötig

---

## Known Issues & Workarounds

### Issue 1: Plyr + React Strict Mode

**Problem:** Doppelte Initialisierung in Strict Mode
**Lösung:** Ref-Check vor Initialisierung

```typescript
const playerRef = useRef<Plyr | null>(null)

useEffect(() => {
  if (playerRef.current) return // Already initialized

  playerRef.current = new Plyr(...)

  return () => {
    playerRef.current?.destroy()
    playerRef.current = null
  }
}, [])
```

### Issue 2: YouTube Embed CORS

**Problem:** Keine CORS-Issues erwartet
**Grund:** YouTube IFrame ist same-origin-policy exempt

### Issue 3: Mobile Autoplay

**Problem:** Browser blockiert Autoplay mit Sound
**Lösung:** Kein Autoplay implementieren (User muss Play klicken)

---

## Performance Benchmarks

| Metrik | Erwartung |
|--------|-----------|
| Time to Interactive | < 500ms (Player ready) |
| Bundle Size Impact | +25KB |
| Memory Usage | ~20MB pro Player |
| CPU (idle) | < 1% |

---

## Security Considerations

✅ **XSS:** YouTube IFrame ist sandboxed
✅ **CSP:** `frame-src: youtube.com` nötig
✅ **Data Privacy:** Keine zusätzlichen Tracker (Plyr sendet keine Daten)

---

## Empfehlungen

### Sofort umsetzen:
1. Plyr als Library verwenden
2. CSS Variables für Theme
3. Debounced Progress Updates

### Später evaluieren:
1. Chapter Support (falls YouTube-native Chapters)
2. Timestamp-Marker Feature (komplexer, eigenes Schema)
3. Watch History View (Liste aller angefangenen Videos)

---

## Validation Checklist

- [x] Library-Wahl validiert (Plyr vs. Alternativen)
- [x] React-Integration Pattern validiert
- [x] YouTube Embed Best Practices berücksichtigt
- [x] Performance-Impact akzeptabel
- [x] Security Considerations geprüft
- [x] Known Issues dokumentiert mit Workarounds

---

## Exit Condition

✅ Technischer Ansatz validiert:
- Plyr ist die beste Wahl für diesen Use Case
- Integration Pattern ist Standard und sicher
- Keine Blocker oder kritische Risiken identifiziert
