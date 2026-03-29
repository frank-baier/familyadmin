# FamilyAdmin — Feature Research & UX Patterns

**Target user:** Family of 5 tech-savvy adults/teens sharing a household.
**Research basis:** Analysis of leading family apps (Cozi, OurHome, Todoist, Paprika, TripIt, Google Family, Notion family setups) and UX patterns in multi-user consumer apps as of 2025.

---

## 1. Task Management

### Table Stakes (must-have on day one)

| Feature | Why it matters |
|---|---|
| Shared family task list | The core primitive — everyone sees household tasks |
| Personal task list | Private tasks separate from shared; each member needs their own space |
| Assignee field | "Who's doing this?" is the #1 question in a household |
| Due date + time | Scheduling is useless without deadlines |
| Recurring tasks | Chores repeat. Auto-regeneration on completion is essential |
| Done/complete state | Satisfying to check off; prevents re-doing work |
| Priority levels (3 is enough: High / Normal / Low) | Helps triage when the list gets long |
| Mobile-first creation | Tasks are added on the fly, not at a desk |

### Nice-to-Have (phase 2+)

- **Subtasks** — useful for projects ("prepare for holiday") but adds UI complexity; worth it once core is solid
- **Tags/labels** — cross-cutting categories (Errands, School, House); powerful once there are >50 tasks
- **Reminders & push notifications** — per-task alerts, not just due-date-based
- **Completion streaks / gamification** — motivating for teens; OurHome points model works well in practice
- **Drag-and-drop reordering** — quality-of-life; expected on desktop
- **"Quick add" from anywhere** — global shortcut or floating button across all app sections
- **Task comments/notes** — context that doesn't fit in the title ("key is under the mat")
- **Dependency blocking** — Task B can't start until Task A done; only worth building if travel/project workflows need it

### What to skip

- Kanban/board views — overkill for household use; adds cognitive overhead
- Time tracking — families don't track hours on chores
- Gantt charts — same reason

---

## 2. Recipe Management

### Table Stakes

| Feature | Why it matters |
|---|---|
| Recipe title, photo, description | Browsability depends on visuals |
| Ingredients list with amounts + units | Core data model; must support fractional quantities |
| Step-by-step instructions | Numbered steps; cook mode (large text, screen-on) is a common add |
| Serving size + auto-scaling | Scaling a recipe for 3 vs. 10 is the #1 power feature families use |
| Categories/tags (Breakfast, Dinner, Vegetarian, etc.) | Filtering the library — essential once you have >30 recipes |
| "Add to meal plan" action | The bridge between the recipe library and weekly planning |
| Shopping list generation from ingredients | Direct export from recipe → shopping list; families use this constantly |
| Favorites / bookmarks | Fast access to the 15 recipes a family actually rotates |

### Nice-to-Have

- **Import from URL** — paste a recipe URL, app parses ingredients and steps (Paprika's killer feature); very high leverage
- **Nutritional info** — useful for health-conscious families; can be auto-filled via ingredient lookup APIs
- **Prep time / cook time / total time** — filter by "under 30 min" is highly practical on busy nights
- **Cook mode** — full-screen, large text, step-by-step with screen-wake-lock
- **Rating and notes per recipe** — "needs more garlic" persistent note after cooking
- **Source attribution** — book, website, grandma; matters for trust and re-finding
- **Meal plan calendar (weekly view)** — assign recipes to days; auto-generate consolidated shopping list for the week
- **Pantry/inventory tracking** — mark what's in stock; reduces "we already have that" shopping errors. Complex to maintain but loved when it works

### What to skip

- Social sharing / public profiles — FamilyAdmin is a private family tool
- Video instructions — high infrastructure cost, rarely needed over text
- AI meal suggestions in v1 — interesting but requires solid recipe corpus first

---

## 3. Travel Planning

### Table Stakes

| Feature | Why it matters |
|---|---|
| Trip record (name, destination, dates) | Container for everything else |
| Itinerary with day-by-day events | Time-ordered list of activities, reservations, transport |
| Event details (time, location, confirmation #, notes) | Confirmation numbers are the #1 thing families look up mid-trip |
| Shared access for all family members | Everyone needs offline access to the same plan |
| Packing list (shared + personal) | Shared list for family gear; personal lists for each member's clothing |
| Document attachment per trip | Flight confirmations, hotel bookings, car rental — attached where they're used |
| Budget tracker (planned vs. actual) | Even rough tracking prevents surprise overruns |

### Nice-to-Have

- **Packing list templates** — "Beach trip," "Ski trip," "Weekend," etc.; huge time saver
- **Per-person packing status** — each member marks their own items packed; reduces last-minute chaos
- **Flight/hotel info cards** — structured fields (airline, flight #, terminal, check-in time) rather than free text
- **Map view of itinerary** — visualize stops geographically; useful for road trips
- **Expense splitting** — who paid for what; settles up at end of trip
- **Currency converter** — embedded, for international trips
- **Offline access** — critical; airports and foreign countries have unreliable connectivity
- **Weather widget per destination/day** — light integration, useful in planning phase
- **"Things to do" wishlist per destination** — brainstorming list before committing to itinerary

### What to skip

- Flight price alerts / booking integration — too complex and liability-adjacent for a family app
- Points/miles tracking — niche; dedicated apps do it better

---

## 4. Document Management

### Table Stakes

| Feature | Why it matters |
|---|---|
| File upload (PDF, images, common formats) | Core function — store the actual document |
| Categories (Medical, Finance, School, Legal, Insurance, Vehicle, Home) | The 7 categories cover ~90% of family documents |
| Per-member ownership / association | "Whose passport is this?" — documents belong to people |
| Search by name / filename | The primary way people find documents they haven't touched in months |
| Expiry date field | Passports, insurance policies, vehicle registration — expiry tracking prevents nasty surprises |
| Expiry reminders | Alert 30/60/90 days before a document expires |
| Secure access (auth-gated, not public links) | Families store sensitive documents; security is non-negotiable |

### Nice-to-Have

- **Tags** — cross-cutting labels beyond category (e.g., "2024-taxes", "child-1"); powerful search complement
- **Folder hierarchy** — optional sub-organization within categories; useful once the library grows
- **Full-text search (OCR)** — search inside scanned PDFs; high-value but technically heavier
- **Quick preview (in-app)** — view PDFs/images without downloading; reduces friction
- **Version history** — replace an outdated document while keeping the old one
- **Share link (time-limited)** — send a document to a doctor's office or bank without giving full app access
- **Bulk import** — drag-drop multiple files on desktop; essential for initial setup
- **Auto-categorization suggestions** — detect "passport", "insurance" from filename/content; nice QoL

### Organization model that works

The pattern that fits families best is a **two-axis model**:
- **Category** (horizontal axis: what type of document)
- **Person** (vertical axis: whose document)

A "Medical > Emma" view and a "All documents for Emma" view are both valuable — the data model should support both.

### What to skip

- Collaborative editing (Google Docs-style) — families store documents, not draft them together
- Complex permission tiers — shared family access with personal-only option is sufficient

---

## 5. UX Patterns for Multi-User Family Apps

### Navigation & Information Architecture

- **Bottom nav on mobile** with 5 or fewer items; the 5 FamilyAdmin modules map well to this
- **Home/dashboard** showing cross-module summary: upcoming tasks, today's meals, next trip, expiring docs — this is the "morning glance" screen that drives daily opens
- **Module switcher** that's always one tap away; users context-switch constantly between modules

### Shared vs. Personal Views

- **"Family" vs. "Mine" toggle** is the most-used pattern in successful family apps (Cozi, Todoist)
- Default to family view; personal view is opt-in
- Color-code members consistently across the app — if Emma is green in tasks, she's green everywhere (avatar, packing lists, documents)
- **"Assigned to me" smart filter** available in every list-based module

### Notifications

- **Opt-in, granular notification settings** per member — teens and adults have different tolerance levels
- Notify on: task assigned to me, task due today, document expiring, trip departure approaching
- Avoid: notifying everyone when anyone completes a task (noisy); only notify the assigner
- **Digest option** — daily summary at a chosen time rather than real-time pings; preferred by ~60% of family app users

### Multi-User Account Model

- **Family group** as the top-level entity; individuals are members
- **Roles: Admin (parents) / Member (teens)** — admins can assign tasks to anyone, members can only self-assign or claim
- **Invite by email or link** — link-based invite is faster for adding teens who resist email
- **Individual profiles** with avatar and color; shown throughout the app for ownership/assignment clarity

### Cross-Module Patterns

| Pattern | Example |
|---|---|
| "Attach to trip" from document | Passport → attached to upcoming trip |
| "Add to shopping list" from recipe | Ingredients automatically appended |
| "Create task from trip" | "Book airport parking" task linked to trip record |
| Global search across all modules | One search box that surfaces tasks, recipes, documents, trips |

### Mobile-First Conventions That Are Now Expected

- Pull-to-refresh on all lists
- Swipe actions (swipe left to delete/archive, swipe right to complete) — especially on tasks and documents
- Optimistic UI updates — mark done immediately, sync in background; failures show a subtle error toast
- Offline-first read access — at minimum, the last-synced state should be readable without connectivity

### What Consistently Fails in Family Apps

- **Too many notification types on by default** — families turn off all notifications and lose value
- **No quick-add** — if creating a task requires 4 taps, people stop adding tasks
- **One-size profile** — not distinguishing between a parent admin and a 14-year-old member creates friction for both
- **Complex onboarding** — family apps that require setting up categories, members, and preferences before showing value lose users; show value immediately, defer setup

---

## Summary: Priority Stack for FamilyAdmin v1

**Build first (table stakes across all modules):**
Tasks (assigned, recurring, due date) → Recipes (ingredients, scaling, meal plan) → Documents (upload, category, expiry) → Travel (trip record, itinerary, packing list) → Dashboard (cross-module summary)

**Build second (high-leverage additions):**
Recipe URL import, shopping list generation, document expiry reminders, packing list templates, per-member color coding, global search

**Build later (nice-to-have):**
Cook mode, recipe nutrition, travel budget splitting, document OCR search, task gamification
