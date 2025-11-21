# User Story 001: First-Time Setup

**Feature ID:** category-fields-hybrid
**Persona:** Sarah - Recipe Collector
**Scenario:** First time using the app, setting up categories

---

## User Profile

**Name:** Sarah
**Age:** 32
**Tech Level:** Basic (comfortable with YouTube, not technical)
**Goal:** Organize YouTube cooking videos by recipe type
**Pain Point:** Can't remember which videos have which dietary info

---

## Story

**As a** recipe collector
**I want to** organize my cooking videos by type with custom information
**So that** I can quickly find keto recipes with specific calorie counts

---

## UX Flow

### Step 1: App Opening

**User Action:** Opens app for first time (already logged in)

**UI Shows:**
```
┌─────────────────────────────────────┐
│ Meine Videos                        │
├─────────────────────────────────────┤
│ Sidebar:                            │
│   🏠 Alle Videos (0)                │
│                                     │
│ Main:                               │
│   Keine Videos vorhanden            │
│   [+ Video hinzufügen]              │
└─────────────────────────────────────┘
```

**User Thought:** "Okay, I need to add videos"

---

### Step 2: Adding First Video

**User Action:** Clicks "+ Video hinzufügen"

**UI Shows:**
```
┌─────────────────────────────────────┐
│ Video hinzufügen                    │
│                                     │
│ YouTube URL:                        │
│ [https://youtube.com/watch?v=...]   │
│                                     │
│ [Abbrechen]  [Hinzufügen]           │
└─────────────────────────────────────┘
```

**User Action:** Pastes keto brownie recipe URL, clicks "Hinzufügen"

**Backend:** Fetches video metadata (title, channel, duration, thumbnail)

**UI Shows:** Video appears in "Alle Videos" with YouTube metadata

```
┌─────────────────────────────────────┐
│ Sidebar:                            │
│   🏠 Alle Videos (1)                │
│                                     │
│ Main:                               │
│   ┌───────────────────────────────┐ │
│   │ [Thumbnail]                   │ │
│   │ Keto Brownies Recipe          │ │
│   │ Healthy Kitchen • 12:34       │ │
│   └───────────────────────────────┘ │
└─────────────────────────────────────┘
```

**User Thought:** "Cool, it's there. But I want to save that it's keto and how many calories"

---

### Step 3: Discovering Settings

**User Action:** Looks for settings (top-right gear icon)

**UI Shows:**
```
┌─────────────────────────────────────┐
│ Einstellungen                       │
├─────────────────────────────────────┤
│ Tabs: [Kategorien] [Analytics]      │
│                                     │
│ Kategorien Tab:                     │
│   🏠 Alle Videos         [Bearbeiten]│
│      Diese Felder haben alle Videos │
│      (Keine Felder definiert)       │
│                                     │
│   [+ Neue Kategorie]                │
└─────────────────────────────────────┘
```

**User Thought:** "Hmm, 'Kategorien' and 'Alle Videos'... Let me try creating a category for keto recipes"

---

### Step 4: Creating First Category

**User Action:** Clicks "+ Neue Kategorie"

**UI Shows:**
```
┌─────────────────────────────────────┐
│ Neue Kategorie erstellen            │
│                                     │
│ Name:                               │
│ [Keto Rezepte                    ]  │
│                                     │
│ Farbe: [🔴][🟢][🔵][🟡][⚪]         │
│        [Selected: 🟢]               │
│                                     │
│ [Abbrechen]  [Erstellen]            │
└─────────────────────────────────────┘
```

**User Action:** Types "Keto Rezepte", picks green, clicks "Erstellen"

**Backend:** Creates Tag with `is_video_type=true`, no schema yet

**UI Shows:** Category appears in list

```
┌─────────────────────────────────────┐
│ Kategorien Tab:                     │
│   🏠 Alle Videos         [Bearbeiten]│
│                                     │
│   🟢 Keto Rezepte        [Bearbeiten]│
│      (Keine Felder definiert)       │
│                                     │
│   [+ Neue Kategorie]                │
└─────────────────────────────────────┘
```

**User Thought:** "Great! Now how do I add info like calories to this?"

---

### Step 5: Adding Fields to Category

**User Action:** Clicks "Bearbeiten" next to "Keto Rezepte"

**UI Shows:**
```
┌─────────────────────────────────────┐
│ Keto Rezepte bearbeiten             │
│                                     │
│ Name: [Keto Rezepte              ]  │
│ Farbe: [🟢]                         │
│                                     │
│ Informationen für diese Kategorie:  │
│   (Keine Felder vorhanden)          │
│   [+ Information hinzufügen]        │
│                                     │
│ [Löschen]  [Abbrechen]  [Speichern] │
└─────────────────────────────────────┘
```

**User Thought:** "Ah! 'Information hinzufügen' - that's what I need"

**User Action:** Clicks "+ Information hinzufügen"

**UI Shows:**
```
┌─────────────────────────────────────┐
│ Information hinzufügen              │
│                                     │
│ Name:                               │
│ [Kalorien                        ]  │
│                                     │
│ Typ:                                │
│ [Zahl ▼]                            │
│   Zahl                              │
│   Text                              │
│   Ja/Nein                           │
│   Auswahl                           │
│                                     │
│ [Abbrechen]  [Hinzufügen]           │
└─────────────────────────────────────┘
```

**User Action:** Types "Kalorien", selects "Zahl", clicks "Hinzufügen"

**Backend:**
1. Creates CustomField "Kalorien"
2. Creates/gets FieldSchema for "Keto Rezepte"
3. Links CustomField to FieldSchema via SchemaField

**UI Shows:** Field appears

```
┌─────────────────────────────────────┐
│ Keto Rezepte bearbeiten             │
│                                     │
│ Informationen für diese Kategorie:  │
│   • Kalorien (Zahl)       [×]       │
│   [+ Information hinzufügen]        │
│                                     │
│ [Löschen]  [Abbrechen]  [Speichern] │
└─────────────────────────────────────┘
```

**User Action:** Adds more fields:
- "Lecker" (Ja/Nein)
- "Zubereitungszeit" (Zahl)

**User Action:** Clicks "Speichern"

**UI Returns:** To settings overview

---

### Step 6: Adding Workspace-Wide Fields

**User Thought:** "Wait, I want to rate ALL my videos, not just keto ones"

**User Action:** Clicks "Bearbeiten" next to "🏠 Alle Videos"

**UI Shows:**
```
┌─────────────────────────────────────┐
│ Informationen für alle Videos       │
│                                     │
│ Diese Felder sind für ALLE Videos   │
│ in diesem Workspace verfügbar       │
│                                     │
│ Felder:                             │
│   (Keine Felder vorhanden)          │
│   [+ Information hinzufügen]        │
│                                     │
│ [Abbrechen]  [Speichern]            │
└─────────────────────────────────────┘
```

**User Action:** Adds fields:
- "Bewertung" (Auswahl: ⭐ to ⭐⭐⭐⭐⭐)
- "Notizen" (Text)

**Backend:**
1. Creates CustomFields
2. Creates FieldSchema for workspace
3. Sets `BookmarkList.default_schema_id = new_schema.id`

**UI Shows:** Confirmation

---

### Step 7: Assigning Video to Category

**User Action:** Goes back to main page, clicks on the keto brownie video

**UI Shows:**
```
┌─────────────────────────────────────┐
│ Video Details                       │
│                                     │
│ [Thumbnail]                         │
│ Keto Brownies Recipe                │
│ Healthy Kitchen • 12:34             │
│                                     │
│ Kategorie:                          │
│ [Keine Kategorie ▼]                 │
│                                     │
│ Bewertung: (leer)                   │
│ Notizen: (leer)                     │
│                                     │
│ [Speichern]                         │
└─────────────────────────────────────┘
```

**User Thought:** "Ah, I can assign a category here!"

**User Action:** Clicks dropdown

**UI Shows:**
```
┌─────────────────────────────────────┐
│ Kategorie:                          │
│ ┌─────────────────────────────────┐ │
│ │ Keine Kategorie                 │ │
│ │ ────────────────                │ │
│ │ 🟢 Keto Rezepte                 │ │
│ └─────────────────────────────────┘ │
└─────────────────────────────────────┘
```

**User Action:** Selects "Keto Rezepte"

**Backend:**
1. Validates (max 1 category)
2. Adds to video_tags with is_video_type=true tag
3. Fetches available fields (workspace + category)

**UI Shows:** Fields update!

```
┌─────────────────────────────────────┐
│ Video Details                       │
│                                     │
│ Kategorie:                          │
│ [🟢 Keto Rezepte ▼]          [×]   │
│                                     │
│ Bewertung: [⭐⭐⭐⭐⭐ ▼]             │
│ Notizen: [                       ]  │
│                                     │
│ Kalorien: [                      ]  │
│ Lecker: [ ] Ja                      │
│ Zubereitungszeit: [              ]  │
│                                     │
│ [Speichern]                         │
└─────────────────────────────────────┘
```

**User Thought:** "Perfect! Now I see both the workspace fields (Bewertung, Notizen) AND the Keto fields!"

**User Action:** Fills in:
- Bewertung: ⭐⭐⭐⭐⭐
- Notizen: "Super einfach, schmeckt wie echte Brownies"
- Kalorien: 180
- Lecker: Ja
- Zubereitungszeit: 25

**User Action:** Clicks "Speichern"

**Backend:** Creates VideoFieldValues for all 5 fields

---

### Step 8: Viewing in Sidebar

**User Action:** Returns to main page

**UI Shows:**
```
┌─────────────────────────────────────┐
│ Sidebar:                            │
│   🏠 Alle Videos (1)                │
│   🟢 Keto Rezepte (1)               │
│                                     │
│ Main (showing "Alle Videos"):       │
│   ┌───────────────────────────────┐ │
│   │ [Thumbnail]                   │ │
│   │ Keto Brownies Recipe          │ │
│   │ 🟢 Keto Rezepte               │ │
│   │ ⭐⭐⭐⭐⭐                       │ │
│   └───────────────────────────────┘ │
└─────────────────────────────────────┘
```

**User Action:** Clicks "🟢 Keto Rezepte" in sidebar

**UI Shows:** Filtered view with category-specific filter bar

```
┌─────────────────────────────────────┐
│ 🟢 Keto Rezepte (1)                 │
│                                     │
│ Filter:                             │
│   Kalorien: [Min] - [Max]           │
│   Lecker: [Alle ▼]                  │
│   Bewertung: [Alle ▼]               │
│                                     │
│ Videos:                             │
│   ┌───────────────────────────────┐ │
│   │ Keto Brownies Recipe          │ │
│   │ Kalorien: 180 • ⭐⭐⭐⭐⭐      │ │
│   └───────────────────────────────┘ │
└─────────────────────────────────────┘
```

**User Thought:** "Amazing! I can filter by keto-specific fields!"

---

## Success Criteria

- ✅ Sarah understood "Kategorien" without explanation
- ✅ She discovered how to add fields naturally
- ✅ She understood the difference between "Alle Videos" fields and category fields
- ✅ She successfully created category and assigned video
- ✅ She saw both workspace and category fields in video detail
- ✅ She could filter videos by category-specific fields

---

## User Quotes

**After setup:**
> "Oh wow, das war viel einfacher als ich dachte! Ich verstehe jetzt: 'Alle Videos' sind für Sachen wie Bewertungen, und die Kategorien sind für spezifische Infos wie Kalorien."

**After using for a week:**
> "Ich habe jetzt 'Keto Rezepte', 'Vegane Rezepte', und 'Desserts'. Jede hat ihre eigenen Felder, aber alle haben auch meine Standard-Bewertung. Perfekt!"

---

## Edge Cases Encountered

### Edge Case 1: Tried to add "Bewertung" to Keto category

**What happened:**
```
┌─────────────────────────────────────┐
│ ⚠️ Name bereits verwendet            │
│                                     │
│ Die Information "Bewertung" existiert│
│ bereits für alle Videos in diesem   │
│ Workspace.                          │
│                                     │
│ Bitte wähle einen anderen Namen oder│
│ nutze die existierende Information. │
│                                     │
│ [Zurück]  [Anderen Namen wählen]    │
└─────────────────────────────────────┘
```

**User Reaction:** "Ah okay, makes sense! I already have rating for everything."

**Outcome:** ✅ Clear error prevented confusion

---

### Edge Case 2: Tried to assign video to second category

**What happened:**

**User Action:** Video already has "Keto Rezepte", tries to also add "Desserts"

**UI Shows:**
```
┌─────────────────────────────────────┐
│ ⚠️ Nur eine Kategorie erlaubt        │
│                                     │
│ Dieses Video gehört bereits zur     │
│ Kategorie "Keto Rezepte".           │
│                                     │
│ Möchtest du die Kategorie wechseln? │
│                                     │
│ [Abbrechen]  [Kategorie wechseln]   │
└─────────────────────────────────────┘
```

**User Thought:** "Hmm, it's both keto AND a dessert... but okay, I'll keep it in Keto and use filters"

**Outcome:** ✅ User understood the limitation and found workaround

---

## Lessons Learned

**What worked well:**
1. ✅ "Kategorien" terminology was immediately clear
2. ✅ "Alle Videos" as special category made sense
3. ✅ Seeing fields appear immediately after category assignment felt magical
4. ✅ Clear error messages prevented mistakes

**What could be improved:**
1. ⚠️ User wanted multi-category (keto + dessert) but understood why not
2. 💡 Tooltip on "Alle Videos" explaining it's for workspace-wide fields might help
3. 💡 Example categories in empty state could inspire users

---

## Next Story

→ **Story 002:** Sarah switches a video from one category to another and encounters backup/restore
