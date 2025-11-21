# User Story 002: Category Switch with Backup/Restore

**Feature ID:** category-fields-hybrid
**Persona:** Sarah - Recipe Collector (continued)
**Scenario:** Realizes she mis-categorized a video, switches category

---

## Context

Sarah has been using the app for 2 weeks. She has:
- 🟢 Keto Rezepte (15 videos)
  - Fields: Kalorien, Lecker (Ja/Nein), Zubereitungszeit
- 🔵 Vegane Rezepte (8 videos)
  - Fields: Protein, Ist glutenfrei (Ja/Nein)
- 🟡 Desserts (5 videos)
  - Fields: Zuckergehalt, Servings

All videos also have workspace fields: Bewertung, Notizen

---

## Story

**As a** user who sometimes mis-categorizes videos
**I want to** change a video's category without losing my data
**So that** I can correct mistakes without re-entering information

---

## UX Flow

### Step 1: Discovering the Mistake

**Situation:** Sarah added a vegan chocolate cake video to "Keto Rezepte" by accident

**Current state:**
```
Video: "Vegan Chocolate Cake"
Category: 🟢 Keto Rezepte
Fields filled:
  - Bewertung: ⭐⭐⭐⭐⭐
  - Notizen: "Sehr saftig, Familie liebt es"
  - Kalorien: 320
  - Lecker: Ja
  - Zubereitungszeit: 45
```

**User Thought:** "Wait, this is vegan, not keto! I should move it to 'Vegane Rezepte'"

---

### Step 2: Opening Video Detail

**User Action:** Clicks on video

**UI Shows:**
```
┌─────────────────────────────────────┐
│ Video Details                       │
│                                     │
│ [Thumbnail]                         │
│ Vegan Chocolate Cake                │
│                                     │
│ Kategorie:                          │
│ [🟢 Keto Rezepte ▼]          [×]   │
│                                     │
│ Bewertung: ⭐⭐⭐⭐⭐                 │
│ Notizen: "Sehr saftig..."           │
│ Kalorien: 320                       │
│ Lecker: ☑ Ja                        │
│ Zubereitungszeit: 45                │
│                                     │
│ [Speichern]                         │
└─────────────────────────────────────┘
```

---

### Step 3: Changing Category

**User Action:** Clicks category dropdown

**UI Shows:**
```
┌─────────────────────────────────────┐
│ Kategorie:                          │
│ ┌─────────────────────────────────┐ │
│ │ Keine Kategorie                 │ │
│ │ ────────────────                │ │
│ │ 🟢 Keto Rezepte        ✓        │ │  ← Currently selected
│ │ 🔵 Vegane Rezepte               │ │
│ │ 🟡 Desserts                     │ │
│ └─────────────────────────────────┘ │
└─────────────────────────────────────┘
```

**User Action:** Clicks "🔵 Vegane Rezepte"

**Backend Triggers:** Category change validation

---

### Step 4: Warning Dialog Appears

**UI Shows:**
```
┌─────────────────────────────────────┐
│ ⚠️ Kategorie ändern                  │
│                                     │
│ Die Informationen von "Keto Rezepte"│
│ werden ausgeblendet (nicht gelöscht)│
│                                     │
│ Folgende Werte werden gesichert:    │
│   • Kalorien: 320                   │
│   • Lecker: Ja                      │
│   • Zubereitungszeit: 45            │
│                                     │
│ Die folgenden Felder bleiben:       │
│   • Bewertung: ⭐⭐⭐⭐⭐             │
│   • Notizen: "Sehr saftig..."       │
│                                     │
│ Diese Werte sind wieder verfügbar   │
│ wenn du zurück zu "Keto Rezepte"    │
│ wechselst.                          │
│                                     │
│ [Abbrechen]  [Kategorie ändern]     │
└─────────────────────────────────────┘
```

**User Thought:** "Oh! It's going to save my keto values. That's smart! And my rating/notes will stay. Perfect!"

**User Action:** Clicks "Kategorie ändern"

---

### Step 5: Category Changed, New Fields Appear

**Backend:**
1. Creates backup file: `backups/field_values/{video_id}/keto-rezepte.json`
2. Removes video from "Keto Rezepte" tag
3. Adds video to "Vegane Rezepte" tag
4. Fetches new available fields (workspace + vegan category)

**UI Updates:**
```
┌─────────────────────────────────────┐
│ Video Details                       │
│                                     │
│ [Thumbnail]                         │
│ Vegan Chocolate Cake                │
│                                     │
│ Kategorie:                          │
│ [🔵 Vegane Rezepte ▼]        [×]   │
│                                     │
│ Bewertung: ⭐⭐⭐⭐⭐                 │  ← Stayed!
│ Notizen: "Sehr saftig..."           │  ← Stayed!
│                                     │
│ Protein: [                       ]  │  ← New field (empty)
│ Ist glutenfrei: [ ] Ja              │  ← New field (empty)
│                                     │
│ [Speichern]                         │
└─────────────────────────────────────┘
```

**User Thought:** "Great! My rating and notes are still there, and now I have the vegan-specific fields!"

**User Action:** Fills in new fields:
- Protein: 8
- Ist glutenfrei: Nein

**User Action:** Clicks "Speichern"

---

### Step 6: Realizing Another Mistake (2 days later)

**Situation:** Sarah realizes the video should have been in "Desserts" all along

**User Thought:** "Actually, this is more of a dessert than a vegan recipe category. Let me move it again."

**User Action:** Opens video, changes category to "🟡 Desserts"

**UI Shows:** Same warning dialog, but for "Vegane Rezepte" → "Desserts"

```
┌─────────────────────────────────────┐
│ ⚠️ Kategorie ändern                  │
│                                     │
│ Folgende Werte werden gesichert:    │
│   • Protein: 8                      │
│   • Ist glutenfrei: Nein            │
│                                     │
│ Die folgenden Felder bleiben:       │
│   • Bewertung: ⭐⭐⭐⭐⭐             │
│   • Notizen: "Sehr saftig..."       │
│                                     │
│ [Abbrechen]  [Kategorie ändern]     │
└─────────────────────────────────────┘
```

**User Action:** Confirms

**Backend:** Creates second backup: `backups/field_values/{video_id}/vegane-rezepte.json`

**UI Shows:** Desserts fields appear

```
│ Kategorie: [🟡 Desserts ▼]          │
│                                     │
│ Bewertung: ⭐⭐⭐⭐⭐                 │
│ Notizen: "Sehr saftig..."           │
│ Zuckergehalt: [                  ]  │
│ Servings: [                      ]  │
```

**User Action:** Fills in dessert fields, saves

---

### Step 7: Switching Back (Testing Restore)

**Situation:** 1 week later, Sarah wonders "What were those keto values I entered?"

**User Action:** Opens video, changes category back to "🟢 Keto Rezepte"

**Backend Detects:** Backup exists for this video + category!

**UI Shows:** Different dialog with restore option

```
┌─────────────────────────────────────┐
│ ⚠️ Kategorie ändern                  │
│                                     │
│ ✨ Gesicherte Werte gefunden!        │
│                                     │
│ Du hattest dieses Video schon mal   │
│ als "Keto Rezepte" kategorisiert.   │
│                                     │
│ Gesicherte Werte (von vor 1 Woche): │
│   • Kalorien: 320                   │
│   • Lecker: Ja                      │
│   • Zubereitungszeit: 45            │
│                                     │
│ Möchtest du diese Werte             │
│ wiederherstellen?                   │
│                                     │
│ [ ] Gesicherte Werte wiederherstellen│
│                                     │
│ [Abbrechen]  [Kategorie ändern]     │
└─────────────────────────────────────┘
```

**User Thought:** "Wow! It remembers! Let me restore them."

**User Action:** Checks box, clicks "Kategorie ändern"

**Backend:**
1. Restores VideoFieldValues from backup
2. Switches category
3. Keeps backup file (for future switches)

**UI Shows:**
```
│ Kategorie: [🟢 Keto Rezepte ▼]      │
│                                     │
│ Bewertung: ⭐⭐⭐⭐⭐                 │
│ Notizen: "Sehr saftig..."           │
│ Kalorien: 320                       │  ← Restored!
│ Lecker: ☑ Ja                        │  ← Restored!
│ Zubereitungszeit: 45                │  ← Restored!
```

**User Reaction:** "This is amazing! It's like an undo history for categories!"

---

## Backup File Structure

**Location:** `backups/field_values/{video_id}/`

**Example file:** `keto-rezepte.json`

```json
{
  "video_id": "uuid-123",
  "category_id": "keto-rezepte-uuid",
  "category_name": "Keto Rezepte",
  "timestamp": "2025-11-15T14:32:00Z",
  "values": [
    {
      "field_id": "field-kalorien-uuid",
      "field_name": "Kalorien",
      "value_numeric": 320
    },
    {
      "field_id": "field-lecker-uuid",
      "field_name": "Lecker",
      "value_boolean": true
    },
    {
      "field_id": "field-zeit-uuid",
      "field_name": "Zubereitungszeit",
      "value_numeric": 45
    }
  ]
}
```

**Files for this video after multiple switches:**
```
backups/field_values/uuid-123/
  ├── keto-rezepte.json          (2025-11-15)
  ├── vegane-rezepte.json        (2025-11-17)
  └── desserts.json              (2025-11-20)
```

---

## Edge Cases

### Edge Case 1: Switching without filling fields

**Situation:** Video in "Keto Rezepte" but no keto fields filled

**Behavior:**
- Warning dialog still shows (but says "Keine Werte vorhanden")
- No backup created (nothing to backup)
- Switch completes normally

**UI:**
```
┌─────────────────────────────────────┐
│ ⚠️ Kategorie ändern                  │
│                                     │
│ Die Felder von "Keto Rezepte" werden│
│ ausgeblendet.                       │
│                                     │
│ Keine Werte zu sichern.             │
│                                     │
│ [Abbrechen]  [Kategorie ändern]     │
└─────────────────────────────────────┘
```

---

### Edge Case 2: Removing category (going to "Keine Kategorie")

**User Action:** Selects "Keine Kategorie" from dropdown

**UI Shows:**
```
┌─────────────────────────────────────┐
│ ⚠️ Kategorie entfernen               │
│                                     │
│ Die Informationen von "Keto Rezepte"│
│ werden ausgeblendet (nicht gelöscht)│
│                                     │
│ Folgende Werte werden gesichert:    │
│   • Kalorien: 320                   │
│   • Lecker: Ja                      │
│                                     │
│ Nur Workspace-Felder bleiben:       │
│   • Bewertung                       │
│   • Notizen                         │
│                                     │
│ [Abbrechen]  [Kategorie entfernen]  │
└─────────────────────────────────────┘
```

**After confirming:**
```
│ Kategorie: [Keine Kategorie ▼]      │
│                                     │
│ Bewertung: ⭐⭐⭐⭐⭐                 │
│ Notizen: "Sehr saftig..."           │
│                                     │
│ (Keine kategoriespezifischen Felder)│
```

---

### Edge Case 3: Restore prompt but user wants fresh start

**User wants:** Fresh values, not old ones

**Solution:** Unchecked checkbox by default

```
│ [ ] Gesicherte Werte wiederherstellen│
│                                     │
│ [Abbrechen]  [Kategorie ändern]     │
```

**If unchecked:** Fields appear empty, user fills fresh

**Old backup:** Stays in file system (can be cleaned up later via settings)

---

### Edge Case 4: Backup file corrupted/missing

**Situation:** File system error, backup can't be read

**Behavior:**
- No restore prompt shown
- Category switch proceeds normally
- Error logged to console (not shown to user)
- Fields appear empty

**User experience:** Same as "no backup exists"

---

## Success Criteria

- ✅ Sarah understood that values would be backed up
- ✅ She felt safe changing categories (no data loss fear)
- ✅ Workspace fields (Bewertung, Notizen) persisted correctly
- ✅ Restore prompt was discoverable and clear
- ✅ Multiple backups coexist without issues

---

## User Quotes

**After first category change:**
> "Ich war kurz nervös, aber die Warnung hat genau erklärt was passiert. Und meine Bewertung ist geblieben!"

**After discovering restore:**
> "Das ist wie eine Zeitmaschine! Ich kann hin und her wechseln ohne Angst vor Datenverlust."

**When asked about backup limit:**
> "Ich habe nicht viele Switches pro Video. Vielleicht 2-3 mal maximum. Die Backups stören mich überhaupt nicht."

---

## Technical Notes

### Backup Cleanup Strategy (Future)

**Options discussed:**
1. Keep forever (current approach)
2. Keep last N backups per video
3. Delete backups older than X days
4. Manual cleanup in settings

**Recommendation:** Start with "keep forever"
- Videos don't switch categories often
- Backups are tiny (JSON text)
- Add cleanup later if needed

---

## Next Story

→ **Story 003:** Power user Mike creates deeply nested category organization
