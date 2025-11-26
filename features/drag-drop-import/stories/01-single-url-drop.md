# User Story 01: Einzelne URL per Drag & Drop hinzufügen

**Als** Nutzer der Video-Bookmark App
**möchte ich** eine YouTube URL aus dem Browser direkt in die Video-Liste ziehen
**damit** ich Videos schneller hinzufügen kann ohne die URL kopieren zu müssen

## Akzeptanzkriterien

- [ ] URL aus Browser-Adresszeile kann auf Video-Liste gezogen werden
- [ ] Visuelles Feedback während des Ziehens (Drop Zone Highlight)
- [ ] Video wird direkt importiert (kein Vorschau-Dialog)
- [ ] Erfolgsmeldung nach Import
- [ ] Video erscheint in der Liste

## UX Flow

```
1. User hat YouTube Video im Browser geöffnet
2. User markiert/zieht URL aus Adresszeile
3. User zieht über die Video-Liste
   → UI zeigt Drop Zone Highlight
   → Text: "Video hier ablegen"
4. User lässt los (Drop)
   → Drop Zone verschwindet
   → Kurzer Ladeindikator
5. Video erscheint in Liste (Status: "pending")
   → Toast: "Video hinzugefügt"
6. Nach 1-2 Sekunden: Metadaten geladen
   → Thumbnail, Titel, Kanal werden angezeigt
```

## Edge Cases

| Szenario | Erwartetes Verhalten |
|----------|---------------------|
| URL ist kein YouTube Link | Fehlermeldung: "Nur YouTube URLs werden unterstützt" |
| Video existiert bereits | Hinweis: "Video bereits in der Liste" |
| Netzwerkfehler | Fehlermeldung + Retry Option |
| Ungültiges YouTube URL Format | Fehlermeldung: "Ungültige YouTube URL" |

## Technische Details

- Nutzt `text/plain` oder `text/uri-list` aus DataTransfer
- Validierung via `extractYouTubeId()` Utility
- API Call: `POST /lists/{id}/videos`
- React Query Mutation: `useCreateVideo`

## Verknüpfung mit bestehendem Feature

Verhält sich identisch zum bestehenden URL-Input, nur mit Drag & Drop als Input-Methode.
