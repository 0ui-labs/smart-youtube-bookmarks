# User Story 001: Alle Kanäle auf Übersichtsseite sehen

**Als** Nutzer der App
**möchte ich** auf der Kanäle-Übersichtsseite alle meine Kanäle sehen (auch ausgeblendete)
**damit** ich einen vollständigen Überblick habe und ausgeblendete Kanäle wieder einblenden kann

## Akzeptanzkriterien

- [x] `/channels` zeigt ALLE Kanäle, nicht nur sichtbare
- [x] Ausgeblendete Kanäle haben visuellen Indikator (EyeOff Icon)
- [x] Anzahl der Kanäle in Header entspricht Gesamtzahl

## UX Flow

```
1. User navigiert zu /channels

2. Alle Kanäle werden angezeigt:
   ┌─────────────────────────────────────────────────┐
   │ Alle Kanäle                                     │
   │ 5 Kanäle                                        │
   ├─────────────────────────────────────────────────┤
   │ [Avatar] MrBeast                          [⋮]  │
   │          125 Videos                             │
   ├─────────────────────────────────────────────────┤
   │ [Avatar] LinusTechTips   [👁‍🗨]            [⋮]  │ ← Ausgeblendet
   │          47 Videos                              │
   └─────────────────────────────────────────────────┘

3. User sieht auf einen Blick welche Kanäle ausgeblendet sind
```

## Technische Details

```tsx
// Änderung in ChannelsPage.tsx
const { data: channels = [] } = useChannels(true) // true = include hidden
```
