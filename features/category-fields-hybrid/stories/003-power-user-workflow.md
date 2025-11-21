# User Story 003: Power User Advanced Workflow

**Feature ID:** category-fields-hybrid
**Persona:** Mike - Tutorial Learner
**Scenario:** Complex learning video organization with heavy filtering

---

## User Profile

**Name:** Mike
**Age:** 28
**Tech Level:** Advanced (software developer)
**Goal:** Track learning progress across multiple programming topics
**Pain Point:** Needs fine-grained filtering and progress tracking

---

## Story

**As a** developer learning from YouTube tutorials
**I want to** organize videos by technology with detailed metadata
**So that** I can track what I've learned and find specific tutorial types quickly

---

## Setup: Mike's System

Mike has created a sophisticated organization:

**Workspace fields (all videos):**
- Completed: Ja/Nein
- Progress: Auswahl (Not Started, In Progress, Completed, Reviewed)
- My Rating: 1-5 Stars
- Notes: Text

**Categories:**

1. **🐍 Python Tutorials** (45 videos)
   - Level: Auswahl (Beginner, Intermediate, Advanced)
   - Duration: Zahl
   - Covers Testing: Ja/Nein
   - Framework: Auswahl (None, Django, Flask, FastAPI)

2. **🐳 Docker Tutorials** (23 videos)
   - Level: Auswahl (Beginner, Intermediate, Advanced)
   - Practical Example: Ja/Nein
   - Covers Kubernetes: Ja/Nein

3. **⚛️ React Tutorials** (38 videos)
   - Level: Auswahl (Beginner, Intermediate, Advanced)
   - React Version: Auswahl (16, 17, 18, 19)
   - Covers Hooks: Ja/Nein
   - TypeScript: Ja/Nein

---

## UX Flow: Complex Filtering

### Step 1: Finding Specific Tutorials

**Mike's Goal:** "I want to find advanced Python tutorials about FastAPI that I haven't started yet"

**User Action:** Clicks "🐍 Python Tutorials" in sidebar

**UI Shows:**
```
┌─────────────────────────────────────┐
│ 🐍 Python Tutorials (45)            │
│                                     │
│ Filter:                             │
│   Level: [Alle ▼]                   │
│   Framework: [Alle ▼]               │
│   Progress: [Alle ▼]                │
│   Covers Testing: [Alle ▼]          │
│   My Rating: [Alle ▼]               │
│   [Filter zurücksetzen]             │
│                                     │
│ Sortieren: [Neueste zuerst ▼]       │
│                                     │
│ Videos: ...                         │
└─────────────────────────────────────┘
```

**User Action:** Sets filters:
- Level → "Advanced"
- Framework → "FastAPI"
- Progress → "Not Started"

**Backend Query:**
```sql
SELECT v.* FROM videos v
JOIN video_tags vt ON v.id = vt.video_id
JOIN tags t ON vt.tag_id = t.id
LEFT JOIN video_field_values vfv_level ON ...
LEFT JOIN video_field_values vfv_framework ON ...
LEFT JOIN video_field_values vfv_progress ON ...
WHERE t.id = 'python-tutorials-uuid'
  AND vfv_level.value_text = 'Advanced'
  AND vfv_framework.value_text = 'FastAPI'
  AND vfv_progress.value_text = 'Not Started'
```

**UI Shows:** 3 videos match

```
┌─────────────────────────────────────┐
│ 🐍 Python Tutorials (3 von 45)      │
│                                     │
│ Active filters:                     │
│   [Advanced ×] [FastAPI ×]          │
│   [Not Started ×]                   │
│                                     │
│ Videos:                             │
│   ┌───────────────────────────────┐ │
│   │ FastAPI Complete Guide        │ │
│   │ Advanced • FastAPI            │ │
│   │ Progress: Not Started         │ │
│   └───────────────────────────────┘ │
│   ┌───────────────────────────────┐ │
│   │ FastAPI + SQLAlchemy 2.0      │ │
│   │ Advanced • FastAPI            │ │
│   └───────────────────────────────┘ │
│   ┌───────────────────────────────┐ │
│   │ Building REST APIs - FastAPI  │ │
│   │ Advanced • FastAPI            │ │
│   └───────────────────────────────┘ │
└─────────────────────────────────────┘
```

**User Thought:** "Perfect! Exactly what I was looking for."

---

### Step 2: Bulk Progress Update

**Mike's Goal:** "Mark all these as 'In Progress' since I'm starting them this week"

**User Action:** Selects all 3 videos (checkboxes)

**UI Shows:**
```
┌─────────────────────────────────────┐
│ 3 Videos ausgewählt                 │
│                                     │
│ Bulk Actions:                       │
│   [Progress ändern ▼]               │
│     Not Started                     │
│     In Progress          ←          │
│     Completed                       │
│     Reviewed                        │
│                                     │
│   [Kategorie ändern]                │
│   [Löschen]                         │
└─────────────────────────────────────┘
```

**User Action:** Selects "In Progress"

**Backend:** Updates VideoFieldValue for "Progress" field for all 3 videos

**UI Shows:** Progress badges update immediately

---

### Step 3: Cross-Category Search

**Mike's Goal:** "Find all beginner tutorials across ALL categories that I've completed"

**User Action:** Clicks "🏠 Alle Videos"

**UI Shows:** All videos with workspace filters

```
┌─────────────────────────────────────┐
│ Alle Videos (106)                   │
│                                     │
│ Filter:                             │
│   Kategorie: [Alle ▼]               │
│   Progress: [Alle ▼]                │
│   My Rating: [Alle ▼]               │
│   Completed: [Alle ▼]               │
│                                     │
│ Search: [                        ]  │
└─────────────────────────────────────┘
```

**Problem:** "I can't filter by Level here because different categories have different fields!"

**Mike's Thought:** "Okay, I'll filter by Progress: Completed, then manually look"

**User Action:** Sets Progress → "Completed"

**UI Shows:** 34 completed videos across all categories

---

### Step 4: Discovering Field Reuse

**Mike's Realization:** "Wait, 'Level' is in Python, Docker, AND React. Can I reuse fields?"

**User Action:** Goes to Settings → Kategorien

**UI Shows:**
```
┌─────────────────────────────────────┐
│ Kategorien                          │
│                                     │
│ 🐍 Python Tutorials      [Bearbeiten]│
│    • Level (Auswahl)                │
│    • Duration (Zahl)                │
│    • Covers Testing (Ja/Nein)       │
│    • Framework (Auswahl)            │
│                                     │
│ 🐳 Docker Tutorials      [Bearbeiten]│
│    • Level (Auswahl)                │
│    • Practical Example (Ja/Nein)    │
│    • Covers Kubernetes (Ja/Nein)    │
│                                     │
│ ⚛️ React Tutorials       [Bearbeiten]│
│    • Level (Auswahl)                │
│    • React Version (Auswahl)        │
│    • Covers Hooks (Ja/Nein)         │
│    • TypeScript (Ja/Nein)           │
└─────────────────────────────────────┘
```

**Mike's Thought:** "They all have 'Level' but are they the same field or different?"

**User Action:** Clicks "Bearbeiten" on Python Tutorials

**UI Shows:**
```
┌─────────────────────────────────────┐
│ Python Tutorials bearbeiten         │
│                                     │
│ Informationen:                      │
│   • Level (Auswahl)                 │
│     Wird auch verwendet in:         │
│     - Docker Tutorials              │
│     - React Tutorials               │
│                                     │
│   • Duration (Zahl)                 │
│     Nur in dieser Kategorie         │
│                                     │
│   • Framework (Auswahl)             │
│     Nur in dieser Kategorie         │
└─────────────────────────────────────┘
```

**Mike's Realization:** "Ah! It's the SAME field reused! That's smart."

**Benefit discovered:** Filter consistency across categories

---

### Step 5: Moving "Level" to Workspace

**Mike's Thought:** "Actually, I want 'Level' for ALL videos, not just tech tutorials. Let me move it to workspace fields."

**User Action:** Goes to "🏠 Alle Videos" → Bearbeiten

**UI Shows:**
```
┌─────────────────────────────────────┐
│ Informationen für alle Videos       │
│                                     │
│ Felder:                             │
│   • Completed (Ja/Nein)             │
│   • Progress (Auswahl)              │
│   • My Rating (1-5 Stars)           │
│   • Notes (Text)                    │
│                                     │
│   [+ Information hinzufügen]        │
└─────────────────────────────────────┘
```

**User Action:** Clicks "+ Information hinzufügen"

**User Action:** Types "Level", selects "Auswahl"

**Backend Checks:** "Level" already exists!

**UI Shows:**
```
┌─────────────────────────────────────┐
│ Information hinzufügen              │
│                                     │
│ ✨ Feld existiert bereits!           │
│                                     │
│ Das Feld "Level" wird bereits in    │
│ folgenden Kategorien verwendet:     │
│   • Python Tutorials                │
│   • Docker Tutorials                │
│   • React Tutorials                 │
│                                     │
│ Möchtest du es zu "Alle Videos"     │
│ hinzufügen? Es bleibt auch in den   │
│ Kategorien erhalten.                │
│                                     │
│ [Abbrechen]  [Hinzufügen]           │
└─────────────────────────────────────┘
```

**Mike's Thought:** "Perfect! So it'll be in workspace AND the categories."

**User Action:** Clicks "Hinzufügen"

**Backend:**
1. Gets existing CustomField "Level"
2. Adds to workspace default_schema via SchemaField
3. Field now in workspace + 3 categories

**Result:**
- "Alle Videos" filter now has Level dropdown!
- Videos in categories show Level once (not duplicated)
- Mike can filter all videos by Level

---

### Step 6: Analytics View

**Mike's Goal:** "I want to see my learning progress stats"

**User Action:** Settings → Analytics Tab

**UI Shows:**
```
┌─────────────────────────────────────┐
│ Analytics                           │
│                                     │
│ Workspace Overview:                 │
│   Total Videos: 106                 │
│   Completed: 34 (32%)               │
│   In Progress: 28 (26%)             │
│   Not Started: 44 (42%)             │
│                                     │
│ By Category:                        │
│   🐍 Python: 45 videos              │
│      Completed: 18 (40%)            │
│      Avg Rating: ⭐⭐⭐⭐            │
│                                     │
│   🐳 Docker: 23 videos              │
│      Completed: 8 (35%)             │
│      Avg Rating: ⭐⭐⭐⭐⭐          │
│                                     │
│   ⚛️ React: 38 videos               │
│      Completed: 8 (21%)             │
│      Avg Rating: ⭐⭐⭐              │
│                                     │
│ Field Usage:                        │
│   Level: 106/106 (100%)             │
│   Framework: 45/45 (100%)           │
│   TypeScript: 32/38 (84%)           │
└─────────────────────────────────────┘
```

**Mike's Reaction:** "This is amazing! I can see exactly where I'm at."

---

## Advanced Workflows Discovered

### Workflow 1: Saved Filter Combinations (Future Feature Idea)

**Mike's Pain:** "I keep setting the same filters: Advanced + Not Started"

**Suggestion:** Save filter presets

```
┌─────────────────────────────────────┐
│ Saved Filters:                      │
│   📌 To Learn Next                  │
│      (Advanced + Not Started)       │
│   📌 Quick Wins                     │
│      (Beginner + Not Started)       │
│   📌 Review Needed                  │
│      (Completed + Rating < 3)       │
│                                     │
│   [+ Neuen Filter speichern]        │
└─────────────────────────────────────┘
```

---

### Workflow 2: Field Dependencies (Future)

**Mike's Idea:** "If Framework = FastAPI, automatically check 'Covers Testing' since FastAPI tutorials always cover testing"

**Current:** Manual entry for each video

**Future:** Field dependencies/auto-fill

---

### Workflow 3: Progress Tracking Over Time

**Mike's Question:** "How many videos did I complete this month?"

**Current:** Can't see historical data

**Future:** Timeline view

---

## Edge Cases Mike Encountered

### Edge Case 1: Removing Field from Category but It's in Workspace

**Situation:** Mike tries to remove "Level" from Python Tutorials

**UI Shows:**
```
┌─────────────────────────────────────┐
│ ⚠️ Feld wird auch im Workspace verwendet│
│                                     │
│ Das Feld "Level" ist in "Alle Videos"│
│ vorhanden.                          │
│                                     │
│ Wenn du es hier entfernst, bleibt es│
│ für alle Videos sichtbar.           │
│                                     │
│ Möchtest du fortfahren?             │
│                                     │
│ [Abbrechen]  [Aus Kategorie entfernen]│
└─────────────────────────────────────┘
```

**Mike's Decision:** "Ah okay, I'll leave it in both. Makes sense."

---

### Edge Case 2: Field Name Conflict

**Situation:** Mike creates "Duration" in React category (already exists in Python)

**UI Shows:**
```
┌─────────────────────────────────────┐
│ ✨ Feld existiert bereits!           │
│                                     │
│ "Duration" wird bereits verwendet:  │
│   • Python Tutorials (Zahl)         │
│                                     │
│ Möchtest du:                        │
│   [Bestehendes Feld verwenden]      │
│   [Anderen Namen wählen]            │
└─────────────────────────────────────┘
```

**Mike:** Clicks "Bestehendes Feld verwenden" → Both categories share Duration

**Result:** Consistent duration tracking across categories

---

## Success Criteria

- ✅ Mike created complex multi-category system
- ✅ He discovered field reuse naturally
- ✅ He successfully moved shared field to workspace
- ✅ Filtering worked across categories
- ✅ No confusion about shared vs. category-specific fields

---

## User Quotes

**On field reuse:**
> "Das System ist viel smarter als ich dachte. Ich kann Felder wiederverwenden ODER kategoriespezifische erstellen. Genau was ich brauche."

**On workspace fields:**
> "Dass ich 'Level' nachträglich zu 'Alle Videos' hinzufügen konnte ohne es aus den Kategorien zu entfernen - brilliant!"

**On filtering:**
> "Ich kann jetzt 'Zeig mir alle Advanced tutorials die ich noch nicht angefangen habe' über ALLE Technologien. Das spart mir Stunden."

**Feature request:**
> "Kann ich irgendwann gespeicherte Filter haben? Ich verwende immer die gleichen Kombinationen."

---

## Performance Notes

**With 106 videos:**
- Filter response time: < 200ms
- Field aggregation: Instant (cached)
- No slowdowns reported

**Mike's concern:** "What if I have 1000 videos?"

**Answer:** Indexes on video_field_values (field_id, value_text) handle it

---

## Next Steps

Mike's workflow exposed potential future features:
1. Saved filter presets
2. Field dependencies/auto-fill
3. Progress timeline view
4. Export filtered results

All can be built on top of current system without changes!

---

## Summary

This story demonstrates that the hybrid system:
- ✅ Scales to power users
- ✅ Supports complex filtering
- ✅ Handles field reuse elegantly
- ✅ Allows progressive enhancement (workspace fields)
- ✅ Doesn't sacrifice simplicity for power
