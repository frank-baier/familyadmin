# Roadmap: FamilyAdmin

## Overview

FamilyAdmin is built in 5 coarse phases: first the foundation (auth + accounts), then modules are added one by one in order of daily value — Tasks, Recipes, Travel, and Documents. Each phase ships something the Baier family can immediately use.

## Phases

- [ ] **Phase 1: Foundation** — Auth, 5 family accounts, shared + private data model
- [ ] **Phase 2: Tasks** — Full task management with assignments, checklists, due dates, and reminders
- [ ] **Phase 3: Recipes** — Family recipe book with ingredients, steps, and meal planning
- [ ] **Phase 4: Travel** — Trip planning with packing lists and itineraries
- [ ] **Phase 5: Documents** — Central family document storage

---

## Phase Details

### Phase 1: Foundation
**Goal**: Every family member can register, log in, and access their own account. The shared + private data model is in place. The app shell (navigation, layout) is live and deployable to Railway.

**Depends on**: Nothing

**Requirements**:
- 5 individual family member accounts
- Shared family data visible to all
- Private per-person data foundation
- Admin role (Frank) can manage accounts

**Success Criteria** (what must be TRUE):
1. Each of the 5 Baiers can log in with their own credentials
2. Admin (Frank) can create and manage family accounts
3. App is live on Railway and accessible from any browser
4. Navigation shell shows all planned modules (Tasks, Recipes, Travel, Documents)
5. Private data scope is enforced — user A cannot see user B's private data

**Plans**: 3 plans
- [ ] 01-01: Backend — JWT auth, user model (shared/private), Spring Security config
- [ ] 01-02: Frontend — Login page, auth flow, protected routes, app shell + navigation
- [ ] 01-03: DevOps — Railway deployment, PostgreSQL setup, CI/CD from GitHub

---

### Phase 2: Tasks
**Goal**: The full Tasks module is live. Family members can create tasks with descriptions, checklists, assignees, and due dates. The assigned person gets reminded by email.

**Depends on**: Phase 1

**Requirements**:
- Create tasks with rich description
- Checklist items (bullet points) within a task
- Assign task to a specific family member
- Due date on each task
- Email reminders when tasks are due
- View my tasks vs. all family tasks

**Success Criteria** (what must be TRUE):
1. Any family member can create a task, add checklist items, set a due date, and assign it to someone
2. The assigned person receives an email reminder before the due date
3. Each member has a "My Tasks" view (assigned to me) and a "Family Tasks" view (all)
4. Checklist items can be checked off individually
5. Tasks can be marked complete

**Plans**: 3 plans
- [ ] 02-01: Backend — Task entity, checklist items, assignee, due date, REST API
- [ ] 02-02: Frontend — Task list, task detail, create/edit form with checklist builder
- [ ] 02-03: Notifications — Email reminder scheduler (Spring @Scheduled + JavaMailSender)

---

### Phase 3: Recipes
**Goal**: The family has a shared recipe book. Each recipe has ingredients, step-by-step instructions, and an optional photo. Basic meal planning (assign recipe to a day) is included.

**Depends on**: Phase 2

**Requirements**:
- Add, edit, view family recipes
- Ingredients list + step-by-step instructions
- Recipe photo (optional)
- Assign recipes to meal plan (weekly planner)

**Success Criteria** (what must be TRUE):
1. Any family member can add a recipe with ingredients and steps
2. Recipe list is browsable and searchable by name
3. A weekly meal planner shows which recipe is planned for which day
4. Recipes display cleanly on mobile browser

**Plans**: 3 plans
- [ ] 03-01: Backend — Recipe entity, ingredients, steps, meal plan, file upload for photos
- [ ] 03-02: Frontend — Recipe list, recipe detail, create/edit form
- [ ] 03-03: Frontend — Weekly meal planner view

---

### Phase 4: Travel
**Goal**: The family can plan trips together. Each trip has a packing list, an itinerary, and key info (hotel, flights, etc.). Packing lists can be per-person.

**Depends on**: Phase 3

**Requirements**:
- Create and manage family trips
- Packing lists per trip (shared + per-person)
- Itinerary with dates and activities
- Key trip info (accommodation, transport)

**Success Criteria** (what must be TRUE):
1. A trip can be created with dates, destination, and description
2. Each trip has a shared packing list and per-person packing lists
3. Itinerary shows activities ordered by date
4. Key info (hotel name, booking references) is stored and visible to all

**Plans**: 3 plans
- [ ] 04-01: Backend — Trip entity, packing list (shared + per-person), itinerary, REST API
- [ ] 04-02: Frontend — Trip overview, packing lists with checkboxes
- [ ] 04-03: Frontend — Itinerary view + key info panel

---

### Phase 5: Documents
**Goal**: The family has a central place to store and find important documents — organized by category, uploadable, downloadable.

**Depends on**: Phase 4

**Requirements**:
- Upload and download files
- Organize documents by category
- Search/filter documents by name or category

**Success Criteria** (what must be TRUE):
1. Any family member can upload a document and assign it a category
2. Documents are listed by category and filterable by name
3. Documents can be downloaded by any family member
4. Files are stored reliably (cloud storage, not Railway disk)

**Plans**: 2 plans
- [ ] 05-01: Backend — Document entity, file storage (S3-compatible), categories, REST API
- [ ] 05-02: Frontend — Document list, upload form, category filter, download

---

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation | 0/3 | Not started | - |
| 2. Tasks | 0/3 | Not started | - |
| 3. Recipes | 0/3 | Not started | - |
| 4. Travel | 0/3 | Not started | - |
| 5. Documents | 0/2 | Not started | - |
