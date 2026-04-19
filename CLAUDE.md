# FamilyAdmin — Claude Code Context

## Project Overview

FamilyAdmin is a self-hosted family management app. It covers tasks, recipes, meal planning, and travel planning for a single family. Deployed on Hetzner via Docker Compose + Caddy.

## Repository Structure

```
familyadmin/
├── backend/          # Spring Boot 3 + Java 21 REST API
├── frontend/         # Next.js 16 + React 19 (App Router)
├── docker-compose.yml          # Dev (postgres + mailpit)
├── docker-compose.prod.yml     # Prod (postgres, backend, frontend, caddy)
└── Caddyfile                   # Reverse proxy routing
```

---

## Backend (Spring Boot 3, Java 21, Maven)

### Tech Stack
- **Java 21** with virtual threads enabled
- **Spring Boot 3.5** — Web, Security, Data JPA, Actuator
- **PostgreSQL 16** via Flyway migrations
- **JWT** (Nimbus JOSE) — 15-min access tokens + 7-day HttpOnly refresh cookies
- **Twilio** — WhatsApp notifications for task reminders
- **Lombok** — code generation

### Package Structure

| Package | Role |
|---------|------|
| `controller/` | REST endpoints — Auth, Tasks, Recipes, Travel, MealPlan, Itinerary, PackingItems, Photos, Profile, TaskTemplates, Admin |
| `service/` | Business logic — UserService, TaskService, RecipeService, TripService, JwtService, NotificationService, PaprikaImportService, PhotoService |
| `repository/` | Spring Data JPA repositories |
| `model/` | JPA entities (UUID PKs, TIMESTAMPTZ audit fields) |
| `dto/` | Request/response DTOs |
| `filter/` | JwtAuthFilter (runs before UsernamePasswordAuthenticationFilter) |
| `scheduler/` | TaskReminderScheduler (daily 8am UTC via @Scheduled) |
| `config/` | SecurityConfig, CORS, password encoder |
| `exception/` | GlobalExceptionHandler |

### Auth Architecture

- **Access token**: Bearer JWT in Authorization header, 15-min TTL, contains email/role/name/userId
- **Refresh token**: UUID stored as `refresh_jti` in DB, sent via HttpOnly cookie (7-day TTL)
- **Stateless sessions**: SecurityContextHolder populated per-request by JwtAuthFilter
- **Roles**: ADMIN (full access + admin endpoints) / MEMBER (standard access)
- **Public endpoints**: `/api/auth/**`, `/actuator/health`
- **Admin endpoints**: @PreAuthorize("hasRole('ADMIN')") on AdminController

### Key API Endpoints

```
POST   /api/auth/login          # Returns JWT + sets refresh cookie
POST   /api/auth/refresh        # Rotates refresh token, returns new JWT
POST   /api/auth/logout         # Invalidates refresh_jti
GET    /api/auth/me             # Current user info

GET/POST       /api/tasks/              # All tasks
GET            /api/tasks/mine          # Assigned to current user
PUT/DELETE     /api/tasks/{id}
PATCH          /api/tasks/{id}/complete
PATCH          /api/tasks/{id}/checklist/{itemId}

GET/POST       /api/recipes/
GET            /api/recipes/search?q=
PUT/DELETE     /api/recipes/{id}
POST           /api/recipes/import/paprika    # ZIP file import

GET/POST       /api/trips/
PUT/DELETE     /api/trips/{id}
POST           /api/trips/{id}/photo
POST/DELETE    /api/trips/{tripId}/key-info/{infoId}

GET/POST/DELETE /api/meal-plans/
GET/POST/DELETE /api/itinerary/
GET/POST/DELETE /api/packing-items/

POST    /api/admin/users        # Admin only
GET     /api/admin/users        # Admin only
PUT     /api/admin/users/{id}   # Admin only
DELETE  /api/admin/users/{id}   # Admin only
```

### Database Schema

All tables: UUID PKs (`gen_random_uuid()`), `created_at`/`updated_at` TIMESTAMPTZ.

| Table | Key Columns |
|-------|-------------|
| users | email (UNIQUE), name, password (bcrypt), role (ADMIN/MEMBER), refresh_jti, whatsapp_phone |
| tasks | title, description, status (OPEN/IN_PROGRESS/DONE), assignee_id FK, due_date, completed_at |
| checklist_items | task_id FK cascade, text, done, position |
| recipes | title, servings, prep_minutes, cook_minutes, photo_url, rating, difficulty, created_by FK |
| recipe_ingredients | recipe_id FK, text, position |
| recipe_steps | recipe_id FK, text, position |
| meal_plan | plan_date, slot (BREAKFAST/LUNCH/DINNER), recipe_id FK |
| trips | title, destination, start_date, end_date, cover_photo_url, created_by FK |
| itinerary_entries | trip_id FK, entry_date, entry_time, text, position |
| packing_items | trip_id FK, text, done, position |
| trip_key_info | trip_id FK, title, value, position |
| task_templates | title, description, created_by FK |
| template_subtasks | template_id FK, text, position |

**Flyway migrations**: `src/main/resources/db/migration/V1–V10__*.sql`
V8 seeds the initial admin user.

### Configuration

Environment variables required:
- `DATABASE_URL`, `DATABASE_USERNAME`, `DATABASE_PASSWORD`
- `JWT_SECRET` (min 64 chars)
- `APP_FRONTEND_URL` (for notification links)
- `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_WHATSAPP_FROM`

Dev profile (`application-dev.properties`): local postgres on port 5432, test Twilio creds.
HikariCP max pool = 5 (sized for Railway free tier constraints).

---

## Frontend (Next.js 16, React 19, TypeScript, Tailwind CSS 4)

### Tech Stack
- **Next.js 16.2** App Router, standalone output (Docker-optimized)
- **React 19** with `useActionState` for forms (no react-hook-form)
- **Tailwind CSS 4** — utility-first, no component library
- **TypeScript 5**

### Route Structure

```
app/
├── (auth)/login/          # Login page (centered layout)
└── (app)/                 # Protected shell (Sidebar + SessionRestorer)
    ├── dashboard/         # Module overview cards
    ├── tasks/             # List, create, detail, edit
    │   └── templates/     # Task templates (list, create, edit, use)
    ├── recipes/           # Gallery, create, detail, edit
    │   └── meal-plan/     # Weekly meal planner
    ├── travel/            # Trips (list, create, detail with itinerary/packing/key-info)
    ├── admin/users/       # User management (admin only)
    └── profile/           # User profile/settings
```

### Auth Flow

1. **Login**: POST `/api/auth/login` → JWT returned in body, refresh token set as HttpOnly cookie
2. **Token storage**: Access token in **module-level memory variable** (not localStorage — prevents XSS)
3. **Session restore**: `SessionRestorer` component silently calls `/api/auth/refresh` on app shell mount using the HttpOnly cookie
4. **Auto-refresh**: `apiFetch()` intercepts 401s, refreshes token, retries original request (singleton promise prevents concurrent refreshes)
5. **Logout**: POST `/api/auth/logout`, clear memory token, browser clears cookie

### Key Lib Files

| File | Purpose |
|------|---------|
| `lib/api.ts` | `apiFetch()` + `apiFetchMultipart()` — adds auth header, auto-refresh on 401, JSON error handling |
| `lib/auth.ts` | `login()`, `logout()`, `refreshToken()`, `getCurrentUser()` |
| `lib/user-context.tsx` | React Context for current user + `sessionReady` flag |
| `lib/tasks.ts` | Task CRUD API calls |
| `lib/recipes.ts` | Recipe CRUD API calls |
| `lib/recipes-mealplan.ts` | Meal plan API calls |
| `lib/travel.ts` | Trip CRUD + photo upload |
| `lib/travel-itinerary.ts` | Itinerary entry API calls |
| `lib/templates.ts` | Task template API calls |

### API Communication

All API calls use `apiFetch<T>('/api/...', options)` from `lib/api.ts`.
- Injects `Authorization: Bearer <token>` automatically
- Sends cookies (`credentials: 'include'`) for HttpOnly refresh token
- Base URL from `NEXT_PUBLIC_API_URL` env var

### Components

No external component library. All custom with Tailwind CSS.

| Directory | Components |
|-----------|-----------|
| `components/tasks/` | TaskCard, TaskForm, ChecklistEditor, ChecklistItem, TemplateForm |
| `components/recipes/` | RecipeCard, RecipeForm, IngredientEditor, StepEditor, RecipePicker, WeeklyPlanner, MealSlotCell |
| `components/travel/` | TripCard, TripForm, PackingList |
| `components/nav/` | Sidebar (role-based links), UserMenu |
| `components/` | SessionRestorer |

**Tailwind color conventions**: slate (neutral), indigo (primary/tasks), emerald (success/recipes), orange (travel), sky/violet (accents).

---

## Infrastructure & Deployment

### Routing (Caddy)

```
/api/*  →  backend:8080
/*      →  frontend:3000
```

Single domain, path-based routing. No cross-origin issues — backend and frontend share the same origin.

### Docker Compose (Production)

- `postgres:16-alpine` — internal only, healthcheck on backend startup
- `backend` — port 8080 internal, built from `./backend`
- `frontend` — port 3000 internal, built from `./frontend` (NEXT_PUBLIC_API_URL as build arg)
- `caddy` — ports 80/443 external, auto-HTTPS, routes via Caddyfile

### Multi-Stage Dockerfiles

**Backend**: maven:3.9 build → eclipse-temurin:21-jre-alpine runtime
**Frontend**: node:20-alpine build (`npm ci` + `npm run build`) → node:20-alpine runtime (standalone output)

### Environment Variables (Production)

```
APP_DOMAIN=<your-domain>
DATABASE_URL=jdbc:postgresql://postgres:5432/familyadmin
DATABASE_USERNAME=...
DATABASE_PASSWORD=...
JWT_SECRET=<64+ char secret>
APP_FRONTEND_URL=https://<your-domain>
TWILIO_ACCOUNT_SID=...
TWILIO_AUTH_TOKEN=...
TWILIO_WHATSAPP_FROM=whatsapp:+14155238886
NEXT_PUBLIC_API_URL=https://<your-domain>
```

---

## Development Conventions

- **Backend**: Layered arch (Controller → Service → Repository). No business logic in controllers.
- **Frontend**: Server components for layout, client components (`'use client'`) for interactivity. Use `useActionState` for forms.
- **New API endpoint**: Add Controller method → Service method → Repository if needed → DTO if needed.
- **New DB column**: Add Flyway migration `V{N+1}__description.sql`. Never edit existing migrations.
- **New frontend route**: Create `app/(app)/<route>/page.tsx`. Add to Sidebar if user-facing.
- **Auth in frontend**: Always use `apiFetch` from `lib/api.ts`, never raw `fetch`.
- **Admin features**: Guard with `@PreAuthorize("hasRole('ADMIN')")` on backend; check `user?.role === 'ADMIN'` on frontend.

---

## Deferred / Known Backlog

- Daily `pg_dump` backup from Hetzner to Synology NAS (implement after app features done)