# Phase 1: Feature Understanding

## Feature Summary

**Rich-Text-Editor für Text-Felder mit Tiptap**

Integration eines Rich-Text-Editors (Tiptap) für alle Text-Felder in der App, um formatierte Notizen und Texte zu ermöglichen. Der Editor verwendet ein Bubble-Menu, das nur bei Text-Selektion erscheint.

## Warum dieses Feature?

- Benutzer können Notizen strukturieren (Überschriften, Listen)
- Wichtige Stellen hervorheben (Bold, Italic)
- Links zu externen Ressourcen einbetten
- Code-Snippets formatiert darstellen
- Bessere Lesbarkeit und Organisation von längeren Texten

## Funktionsumfang

### Formatierungen (Erweitert)

| Kategorie | Formatierung | Beschreibung |
|-----------|--------------|--------------|
| **Text** | Bold | Fettschrift |
| **Text** | Italic | Kursivschrift |
| **Text** | Strikethrough | Durchgestrichen (optional) |
| **Struktur** | Heading 1-3 | Überschriften |
| **Struktur** | Bullet List | Aufzählungsliste |
| **Struktur** | Ordered List | Nummerierte Liste |
| **Struktur** | Blockquote | Zitate |
| **Code** | Inline Code | Code im Fließtext |
| **Code** | Code Block | Mehrzeiliger Code |
| **Links** | Link | URLs einfügen/bearbeiten |

### Toolbar: Bubble Menu

- Erscheint nur bei Text-Selektion
- Schwebt über dem selektierten Text
- Enthält Formatierungs-Buttons
- Verschwindet bei Klick außerhalb

### Anwendungsbereich

- **Alle Text-Felder** in der App (nicht nur Notizen)
- Betrifft: CustomFieldsSection, VideoDetailsModal, VideoDetailsPage
- Komponente: TextSnippet (aktuell Textarea)

## Nicht im Scope

- Bilder/Medien einbetten
- Tabellen
- Kollaboratives Editieren
- Autosave-Indikator
- Markdown-Import/Export

## Bestehende Daten

- Existierende Text-Daten sind Test-Daten
- Keine Migration erforderlich
- Plain-Text wird als HTML-Paragraph behandelt (`<p>text</p>`)

## Erwartetes Verhalten

1. User klickt in ein Text-Feld → Editor wird aktiv
2. User tippt Text → Plain-Text wird eingegeben
3. User selektiert Text → Bubble-Menu erscheint
4. User klickt Formatierung → Text wird formatiert
5. User klickt außerhalb → Bubble-Menu verschwindet
6. Beim Speichern → HTML-String wird an Backend gesendet
7. Beim Laden → HTML-String wird im Editor angezeigt

## Exit Condition

✅ Feature kann in 2-3 Sätzen erklärt werden:

> "Wir integrieren Tiptap als Rich-Text-Editor für alle Text-Felder. Der Editor bietet erweiterte Formatierungen (Bold, Italic, Überschriften, Listen, Code, Links) über ein Bubble-Menu, das bei Text-Selektion erscheint. Die Daten werden als HTML gespeichert."
