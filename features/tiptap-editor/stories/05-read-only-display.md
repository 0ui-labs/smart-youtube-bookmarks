# User Story 05 - Read-Only Display

**As a** User
**I want to** formatierten Text in der Übersicht sehen
**So that** ich meine Notizen auch ohne Bearbeitung lesen kann

## UX Flow

1. User sieht Video-Card mit Text-Feld
2. Text wird formatiert angezeigt (Bold, Italic, etc.)
3. Links sind klickbar
4. Langer Text wird abgeschnitten mit "..."
5. Expand-Button zeigt vollen Text

## Akzeptanzkriterien

- [ ] HTML wird korrekt gerendert
- [ ] Bold Text erscheint fett
- [ ] Italic Text erscheint kursiv
- [ ] Listen werden mit Bullets/Nummern angezeigt
- [ ] Überschriften haben größere Schrift
- [ ] Code hat Monospace Font
- [ ] Links sind blau und unterstrichen
- [ ] Links öffnen in neuem Tab
- [ ] Truncation bei langem Text
- [ ] Kein Bubble Menu in Read-Only

## Edge Cases

| Szenario | Erwartetes Verhalten |
|----------|---------------------|
| Leerer Text | Em-Dash (—) anzeigen |
| Nur Whitespace | Em-Dash (—) anzeigen |
| Plain Text (Legacy) | Als normaler Paragraph |
| Malformed HTML | Graceful fallback |
| XSS Attempt | Sanitized, kein Script |

## Truncation Regeln

| Länge | Verhalten |
|-------|-----------|
| < truncateAt | Vollständig anzeigen |
| ≥ truncateAt | Abschneiden + "..." + Expand |

## Styling

```css
/* Read-only prose styling */
.prose h1 { @apply text-xl font-bold; }
.prose h2 { @apply text-lg font-semibold; }
.prose h3 { @apply text-base font-medium; }
.prose ul { @apply list-disc ml-4; }
.prose ol { @apply list-decimal ml-4; }
.prose code { @apply bg-muted px-1 rounded text-sm; }
.prose a { @apply text-primary underline; }
.prose blockquote { @apply border-l-2 pl-4 italic; }
```
