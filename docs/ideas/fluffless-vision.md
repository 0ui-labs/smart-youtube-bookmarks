# Fluffless - Product Vision

**Date:** 2025-10-30
**Status:** Vision Document (Future Implementation)
**Purpose:** Long-term product vision and UX design direction

---

## 🎯 Core Concept

**"YouTube without the fluff - AI-curated, personally filtered, distraction-free"**

### The Problem
- YouTube is filled with clickbait, hype, and distractions
- Users waste hours in rabbit holes watching irrelevant content
- No control over what actually gets recommended
- Algorithm optimized for engagement (watch time), not user value
- Ads and algorithmic recommendations interrupt focus

### The Solution: Fluffless
An AI-curated YouTube augmentation layer that:
- **Filters out subjective "fluff"** - each user defines what's fluff for them
- **Focuses on intent** - only show what the user actually wants to see
- **AI-powered curation** - smart filtering based on user-defined criteria
- **YouTube as source** - videos stay on YouTube, we just filter/organize them
- **No ads on platform** - clean interface (YouTube Premium users see no ads in videos either)

---

## 🎨 Brand Identity

### Name: Fluffless
**Rationale:**
- **Polarizing = Good:** Strong brands polarize (Uber, Airbnb, Signal)
- **Subjective by design:** What's "fluff" is personal - YOU decide
- **Internationally understood:** Like "YouTube", works worldwide
- **Creator-agnostic:** We don't host videos, so creator opinion is irrelevant

### Tagline Options
- "Fluffless - Your YouTube, minus the fluff"
- "You decide what's fluff. We help you filter it out."
- "Watch what matters."

### Brand Tone
- **Rebellious** - Anti-mainstream, anti-algorithm
- **Focused** - Clear, minimal, intentional
- **Empowering** - User controls everything
- **Smart** - AI-powered but not AI-dominated

---

## 👥 User Personas & Use Cases

### Persona 1: Maria (Lifestyle Enthusiast)
**Her Fluffless Feed:**
```
✅ High-quality makeup tutorials (no clickbait)
✅ Arte/BBC documentaries (shared with partner)
❌ Tech videos (= fluff for her)
❌ Gaming content
❌ Hype/viral videos

AI Filters:
- Quality Score > 8/10
- No clickbait titles
- Tutorial-style content
- European production (Arte, BBC)
```

### Persona 2: Philipp (Tech Professional)
**His Fluffless Feed:**
```
✅ React/Next.js tutorials (high quality)
✅ Keto cooking recipes and nutrition tips
✅ Arte/BBC documentaries (shared with partner)
❌ Makeup/beauty content (= fluff for him)
❌ Gaming content
❌ Clickbait tech news

AI Filters:
- Technical depth required
- No surface-level "Top 10" lists
- Educational value
- Keto-verified recipes
```

### Persona 3: Student Learning CSS
**Their Fluffless Feed:**
```
✅ CSS fundamentals (beginner-friendly)
✅ Flexbox/Grid tutorials
✅ Real-world examples
❌ Advanced JavaScript (too early)
❌ Design theory (not the goal)

AI Learning Path:
1. CSS Basics → 2. Layout → 3. Responsive → 4. Animations
Progress tracked, next videos suggested automatically
```

---

## 🏗️ Architecture Overview

### Content Flow
```
┌─────────────────────────────────────────────────────────────┐
│                     CONTENT INPUT                            │
│  • Drag & Drop (single videos)                              │
│  • CSV Upload (batch import)                                │
│  • YouTube API Connection                                    │
│  • YouTube Scraper                                           │
│  • Browser Extension (future)                                │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                  AI ANALYSIS ENGINE                          │
│                                                              │
│  Modular Analysis Tasks (user-configurable):                │
│  ┌────────────────────────────────────────────────────┐    │
│  │ • Hype Detector        (clickbait score)           │    │
│  │ • Quality Scorer       (production value)          │    │
│  │ • Topic Extractor      (what's it about?)          │    │
│  │ • Learning Value       (educational content?)      │    │
│  │ • Transcript Analysis  (key takeaways)             │    │
│  │ • Custom Workflows     (user-defined chains)       │    │
│  └────────────────────────────────────────────────────┘    │
│                                                              │
│  Task Configuration:                                         │
│  • Form-based Builder (dropdowns, checkboxes)               │
│  • Chat-based ("Hey, filter React tutorials > 15 min")      │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                  STORAGE & ORGANIZATION                      │
│  • Videos stored with metadata                               │
│  • Tags/Lists (interchangeable concept)                      │
│  • AI scores and analysis results                            │
│  • User ratings and feedback                                 │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                   USER INTERFACE                             │
│  • YouTube-inspired layout (familiar)                        │
│  • Sidebar navigation (tags/lists)                           │
│  • Grid View (thumbnails) or List View (detailed)           │
│  • Filters & Sorting (AI scores, tags, duration, etc.)      │
│  • Inline progress (no separate admin dashboard)            │
└─────────────────────────────────────────────────────────────┘
```

---

## 🎨 UX Design Vision

### Layout: YouTube-Inspired (Familiar & Functional)

```
┌────────────────────────────────────────────────────────────────┐
│ [🎬 Fluffless Logo]              [Search]      [@Profile ▼]   │
├───────────┬────────────────────────────────────────────────────┤
│           │                                                     │
│ 📚 TAGS   │  🎬 VIDEO GRID / LIST VIEW                         │
│           │  ┌──────┬──────┬──────┬──────┐                    │
│ All       │  │[IMG] │[IMG] │[IMG] │[IMG] │  Filters: ▼        │
│           │  │Title │Title │Title │Title │  ☑️ Quality > 8    │
│ 💻 Coding │  │⭐ 9.2│⭐ 8.5│⭐ 9.0│⭐ 7.8│  ☑️ No Hype        │
│  • React  │  │15min │22min │8min  │45min │  ☐ Tutorial       │
│  • CSS    │  └──────┴──────┴──────┴──────┘  ☐ Beginner       │
│  • Next   │  ┌──────┬──────┬──────┬──────┐                    │
│           │  │[IMG] │[IMG] │[IMG] │[IMG] │  Sort: ▼           │
│ 🍳 Keto   │  │Title │Title │Title │Title │  • Quality (high)  │
│  • Recipe │  │⭐ 8.9│⭐ 9.5│⭐ 8.2│⭐ 8.7│  • Duration        │
│  • Meal   │  └──────┴──────┴──────┴──────┘  • Recent          │
│           │                                                     │
│ 📺 Docs   │  Currently analyzing: "React Hooks Deep Dive"     │
│  • Arte   │  ▓▓▓▓▓░░░░░ 45% ⚙️ Running AI workflow...        │
│  • BBC    │                                                     │
│           │  [View: Grid | List]  [Add Videos +]              │
│ 📖 Learn  │                                                     │
│  • CSS    │                                                     │
│  • React  │                                                     │
│           │                                                     │
└───────────┴────────────────────────────────────────────────────┘
```

### Key UI Elements

**1. Sidebar Navigation (Left)**
- Always visible
- Tag/List hierarchy
- Click to filter main view
- Collapsible sections
- Add/Edit/Delete tags
- **Inspiration:** YouTube sidebar, but cleaner

**2. Main Content Area**
- **Grid View:** Thumbnail + Title + AI Score + Duration
- **List View:** Detailed info (description, tags, AI analysis)
- Sortable & Filterable
- Responsive (1-4 columns depending on screen size)
- **Inspiration:** YouTube grid, but smarter

**3. Inline Progress Display**
- Small banner at top of main content
- Shows current AI analysis jobs
- Progress bar + job name
- NOT a separate page - stays where user is
- **Design:** Subtle, non-intrusive (like GitHub Actions status)

**4. Video Cards**
```
┌─────────────────────┐
│   [Thumbnail]       │
│                     │
├─────────────────────┤
│ Video Title         │
│ ⭐ 9.2  🕐 15:32    │
│ 💻 React • Tutorial │
│                     │
│ AI: High Quality    │
│     No Hype         │
└─────────────────────┘
```

**Elements:**
- Thumbnail (YouTube embed)
- Title
- AI Quality Score (⭐ 1-10)
- Duration
- Tags
- AI Analysis Summary (badges/chips)
- Hover: Show more details

---

## 🤖 AI Workflow System

### Concept: Modular Analysis Tasks

**Task = Single-purpose analysis unit**
- **Input:** Video (URL, metadata, transcript)
- **Process:** AI analysis (Gemini API)
- **Output:** Score, tags, or extracted data

### Built-in Tasks (Examples)

**1. Hype Detector**
```yaml
Name: Hype Detector
Description: Detects clickbait and hype in video
Input: Title, thumbnail, transcript
AI Prompt: "Is this video clickbait? Rate 1-10. Analyze title, thumbnail, and transcript."
Output: Hype Score (1-10), Reasoning
```

**2. Quality Scorer**
```yaml
Name: Quality Scorer
Description: Assesses production quality and content depth
Input: Video metadata, transcript, duration
AI Prompt: "Rate video quality (1-10): production value, audio, editing, content depth"
Output: Quality Score (1-10), Breakdown
```

**3. Topic Extractor**
```yaml
Name: Topic Extractor
Description: Identifies main topics and tags
Input: Title, description, transcript
AI Prompt: "Extract 3-5 main topics from this video. Return as tags."
Output: Tags array
```

**4. Learning Path Analyzer**
```yaml
Name: Learning Path Analyzer
Description: Determines skill level and prerequisites
Input: Transcript, title, description
AI Prompt: "Is this beginner/intermediate/advanced? What prerequisites?"
Output: Level, Prerequisites, Next Steps
```

**5. Tutorial Classifier**
```yaml
Name: Tutorial Classifier
Description: Is this a tutorial or entertainment?
Input: Transcript, title
AI Prompt: "Is this educational/tutorial (hands-on) or entertainment/opinion?"
Output: Type, Confidence
```

### Custom Workflows

**Workflow = Chain of tasks**
```yaml
Workflow: "High-Quality React Tutorials"
Steps:
  1. Topic Extractor → Filter: Contains "React"
  2. Tutorial Classifier → Filter: Type = "Tutorial"
  3. Quality Scorer → Filter: Score >= 8
  4. Hype Detector → Filter: Score <= 3
  5. Learning Path Analyzer → Tag with skill level
```

### User Configuration Methods

**Method A: Form-Based Builder**
```
┌─────────────────────────────────────────┐
│ Create Analysis Workflow                │
├─────────────────────────────────────────┤
│                                          │
│ Name: [High-Quality React Tutorials]    │
│                                          │
│ Tasks:                                   │
│ ┌──────────────────────────────────┐   │
│ │ 1. Topic Extractor               │   │
│ │    Filter: Contains "React"      │   │
│ │    [Edit] [Remove] [↑] [↓]       │   │
│ └──────────────────────────────────┘   │
│                                          │
│ ┌──────────────────────────────────┐   │
│ │ 2. Quality Scorer                │   │
│ │    Filter: Score >= 8            │   │
│ │    [Edit] [Remove] [↑] [↓]       │   │
│ └──────────────────────────────────┘   │
│                                          │
│ [+ Add Task]                             │
│                                          │
│ [Save Workflow]  [Cancel]               │
└─────────────────────────────────────────┘
```

**Method B: Chat-Based Configuration**
```
User: "Hey, I want to filter React tutorials that are high quality and not clickbait"

AI: "I'll create a workflow for you:
     1. Find videos about React (Topic Extractor)
     2. Check if they're tutorials (Tutorial Classifier)
     3. Filter for high quality (Quality Scorer >= 8)
     4. Remove clickbait (Hype Detector <= 3)

     Should I save this as 'High-Quality React Tutorials'?"

User: "Yes, and also filter for videos longer than 15 minutes"

AI: "Updated! Added duration filter >= 15min. Saved as 'High-Quality React Tutorials'."
```

---

## 📥 Content Input Methods

### 1. Single Video - Drag & Drop
```
User drags YouTube URL from browser → Drop zone on Fluffless
→ Video added to library
→ AI workflow triggered automatically
→ Inline progress shown
```

### 2. Batch Import - CSV Upload
```
CSV Format:
video_id,tags,priority
dQw4w9WgXcQ,"react,tutorial",high
jNQXAC9IVRw,"keto,recipe",medium

Upload → Parse CSV → Add all videos → Batch AI analysis
Progress: "Analyzing 50 videos (12/50 complete)..."
```

### 3. YouTube API Connection
```
User: Connect YouTube account
→ OAuth flow
→ Import: Liked Videos, Watch Later, Subscriptions
→ Auto-sync new videos from subscribed channels
```

### 4. YouTube Scraper
```
User: "Import all videos from channel @Fireship"
→ Scraper fetches video list
→ Add to library
→ AI analysis runs
```

### 5. Browser Extension (Future)
```
User watches video on YouTube
→ Click "Add to Fluffless" extension button
→ Video added + tagged with current context
```

---

## 🏷️ Tag/List System

### Concept: Unified Tag System
- **No distinction between "Lists" and "Tags"**
- Everything is a tag
- Tags can be hierarchical (nested)
- Tags can have color/icon

### Tag Structure
```
📚 Coding
  ├─ 💻 React
  ├─ 🎨 CSS
  └─ ⚡ Next.js

🍳 Keto
  ├─ 🥗 Recipes
  ├─ 🍖 Meal Prep
  └─ 📊 Nutrition

📺 Documentaries
  ├─ 🎭 Arte
  └─ 🌍 BBC

📖 Learning Paths
  ├─ CSS Beginner → Intermediate → Advanced
  └─ React Fundamentals → Hooks → Advanced Patterns
```

### Tag Features
- **Filter:** Click tag → show only videos with that tag
- **Multi-select:** Shift+Click → AND/OR logic
- **Auto-tagging:** AI suggests tags based on content
- **Manual tagging:** User can add/remove tags
- **Smart tags:** "Unfinished", "Favorites", "Watch Later"

---

## 📊 Video Views

### Grid View (Default)
```
┌────────┬────────┬────────┬────────┐
│ [IMG]  │ [IMG]  │ [IMG]  │ [IMG]  │
│ Title  │ Title  │ Title  │ Title  │
│ ⭐ 9.2 │ ⭐ 8.5 │ ⭐ 9.0 │ ⭐ 7.8 │
│ 15min  │ 22min  │ 8min   │ 45min  │
└────────┴────────┴────────┴────────┘
```

**Features:**
- Thumbnail-focused
- Quick scan
- Like YouTube
- Responsive columns (1-4 depending on screen)

---

### List View (Detailed)
```
┌──────────────────────────────────────────────────────────┐
│ [IMG] │ React Hooks Deep Dive                            │
│       │ ⭐ 9.2  🕐 15:32  📅 2024-10-15                  │
│       │ 💻 React • Tutorial • Advanced                   │
│       │                                                   │
│       │ AI Analysis:                                      │
│       │ • Quality: High (9.2/10)                         │
│       │ • Hype: Low (2/10)                               │
│       │ • Level: Advanced                                │
│       │ • Prerequisites: React Basics, JavaScript ES6    │
│       │                                                   │
│       │ Description: Comprehensive guide to React Hooks  │
│       │ covering useState, useEffect, custom hooks...    │
│       │                                                   │
│       │ [Watch on YouTube] [Add to Learning Path]        │
├──────────────────────────────────────────────────────────┤
│ [IMG] │ Next.js 14 Crash Course                          │
│       │ ⭐ 8.5  🕐 22:14  📅 2024-10-10                  │
│       │ ...                                               │
└──────────────────────────────────────────────────────────┘
```

**Features:**
- Full metadata visible
- AI analysis breakdown
- Description preview
- Actions (Watch, Add to Path, Tag, etc.)

---

### Configurable Columns (List View)
```
User can show/hide:
☑️ Thumbnail
☑️ Title
☑️ AI Quality Score
☑️ AI Hype Score
☑️ Duration
☑️ Upload Date
☑️ Tags
☐ Channel Name
☐ View Count
☐ AI Analysis Summary
☐ Learning Level
```

---

## 🎓 Learning Paths (Advanced Feature)

### Concept
AI creates structured learning paths from videos

### Example: "Learn CSS"
```
┌─────────────────────────────────────────┐
│ 📖 Learning Path: CSS Mastery           │
├─────────────────────────────────────────┤
│                                          │
│ ✅ Stage 1: Fundamentals (3/3 videos)   │
│    • CSS Basics                          │
│    • Selectors & Specificity            │
│    • Box Model Explained                │
│                                          │
│ 🎯 Stage 2: Layout (2/4 videos)         │
│    ✅ Flexbox Tutorial                  │
│    ✅ Grid Fundamentals                 │
│    ⏳ Positioning Deep Dive             │
│    ⏳ Responsive Design Basics          │
│                                          │
│ ⏸️ Stage 3: Advanced (0/3 videos)       │
│    • Animations & Transitions           │
│    • CSS Variables & Custom Properties  │
│    • Modern CSS Features                │
│                                          │
│ Progress: 5/10 videos (50%)             │
│ Estimated time remaining: 2.5 hours     │
└─────────────────────────────────────────┘
```

### Features
- **AI-generated progression:** Beginner → Intermediate → Advanced
- **Prerequisites tracked:** Can't skip to advanced without basics
- **Progress tracking:** Check off completed videos
- **Time estimates:** Total learning time
- **Flexible:** User can modify/reorder

---

## 🔍 Filters & Sorting

### Filter Options
```
Quality:     [Slider: 1-10]
Hype:        [Slider: 1-10 (inverse)]
Duration:    [Min: __] [Max: __] minutes
Upload Date: [Last day/week/month/year/all]
Tags:        [Multi-select: React, CSS, Tutorial, ...]
Level:       [Beginner / Intermediate / Advanced / All]
Type:        [Tutorial / Opinion / Review / Documentary]
Channel:     [Multi-select or search]
```

### Sort Options
```
• Quality (highest first)
• Hype (lowest first)
• Duration (shortest/longest)
• Upload Date (newest/oldest)
• Title (A-Z)
• My Rating (if user rated videos)
```

### Preset Filters (Quick Access)
```
🌟 High Quality (>= 9)
🎯 No Hype (<= 3)
🎓 Tutorials
🆕 Recent (last 7 days)
⭐ My Favorites
🕐 Quick Watch (<10 min)
📚 Long Form (>30 min)
```

---

## ⚙️ Settings & Configuration

### User Settings
```
┌─────────────────────────────────────────┐
│ ⚙️ Settings                             │
├─────────────────────────────────────────┤
│                                          │
│ AI Analysis                              │
│ ☑️ Auto-analyze on upload               │
│ ☑️ Run hype detector                    │
│ ☑️ Run quality scorer                   │
│ ☐ Run transcript analysis (costs more) │
│                                          │
│ Default Workflow: [High Quality ▼]      │
│                                          │
│ Display                                  │
│ Default View: [Grid ▼]                  │
│ Videos per page: [20 ▼]                 │
│ Thumbnail size: [Medium ▼]              │
│                                          │
│ YouTube Integration                      │
│ ☐ Connected to YouTube account          │
│ [Connect YouTube]                        │
│                                          │
│ Gemini API                               │
│ API Key: [••••••••••••••]               │
│ Model: [gemini-1.5-pro-002 ▼]          │
│                                          │
│ Danger Zone                              │
│ [Delete All Videos]                      │
│ [Export Data]                            │
└─────────────────────────────────────────┘
```

---

## 🚀 Future Features (Ideas)

### Phase 2: Social & Sharing
- **Shared Tags:** Friends can share curated lists
- **Public Profiles:** "Check out my React learning path"
- **Collaborative Filtering:** "Users like you also watched..."

### Phase 3: Advanced AI
- **Video Summarization:** AI generates TL;DW summaries
- **Timestamp Extraction:** AI finds key moments in video
- **Question Answering:** "What does this video say about hooks?"
- **Multi-video Analysis:** Compare multiple videos on same topic

### Phase 4: Content Creation
- **Learning Notes:** Take notes while watching, AI organizes them
- **Flashcards:** AI generates flashcards from tutorial videos
- **Practice Problems:** AI suggests coding challenges based on watched tutorials

### Phase 5: Integrations
- **Notion/Obsidian:** Export learning notes
- **Calendar:** Schedule learning sessions
- **Browser Extension:** Add videos from anywhere
- **Mobile App:** Watch on the go

---

## 🎯 MVP (Minimum Viable Product) Scope

**What we're building FIRST (current track):**
1. ✅ Backend API (FastAPI, PostgreSQL, ARQ)
2. ✅ Video/List CRUD operations
3. ✅ Gemini AI integration (basic analysis)
4. ✅ WebSocket for real-time updates
5. 🔄 CSV Upload functionality
6. ⏳ Basic frontend (Lists → Videos)
7. ⏳ Simple job progress display

**What comes LATER (after MVP):**
- YouTube-inspired UI (Grid/List views)
- Sidebar navigation
- Advanced AI workflows
- Tag system refactoring
- Learning paths
- YouTube API integration
- Browser extension

---

## 📝 Notes & Decisions

### Why "YouTube as source"?
- Don't need to host videos (expensive, legal issues)
- Don't need to manage creators
- Just filter and organize existing content
- Users watch on YouTube (or embedded)

### Why "Subjective filtering"?
- One person's fluff is another's treasure
- No universal "quality" metric
- User defines their own criteria
- Makes the product deeply personal

### Why "AI-powered"?
- Manual tagging doesn't scale
- Humans are biased
- AI can analyze transcript, tone, production value
- AI can suggest, user can override

### Why "No separate dashboard"?
- Dashboard is admin-centric, not user-centric
- Users want to **discover videos**, not **monitor jobs**
- Progress should be inline (like GitHub Actions)
- Main focus: Content, not system status

---

## 🎨 Design Principles

1. **Familiar but Better**
   - Use YouTube's UI patterns (users know them)
   - But remove clutter and add control

2. **User in Control**
   - AI suggests, user decides
   - Every filter is user-configurable
   - No black-box algorithms

3. **Progressive Disclosure**
   - Simple by default (Grid view, basic filters)
   - Advanced when needed (AI workflows, learning paths)

4. **Performance Matters**
   - Fast load times
   - Instant filtering/sorting
   - Async AI analysis (don't block user)

5. **No Dark Patterns**
   - No ads on platform
   - No engagement hacks
   - No infinite scroll (unless user wants it)
   - Respect user's time and attention

---

## 🔗 References & Inspiration

**UI/UX:**
- YouTube (familiar layout)
- Notion (flexible organization)
- Spotify (discovery + curation)
- Readwise (highlighting + learning)

**Products:**
- Pocket (save for later)
- Instapaper (distraction-free reading)
- Feedly (RSS curation)
- Raindrop.io (bookmark organization)

**Philosophy:**
- Cal Newport - "Digital Minimalism"
- James Clear - "Atomic Habits" (learning paths)
- "Don't Make Me Think" - Steve Krug (UX simplicity)

---

**Document Version:** 1.0
**Last Updated:** 2025-10-30
**Status:** Vision document - for future implementation after MVP complete
**Next Review:** After MVP is production-ready
