# FamilyAdmin

Self-hosted family management app — tasks, recipes, meal planning, and travel. Deployed on Hetzner via Docker Compose + Caddy.

## Stack

| Layer | Tech |
|-------|------|
| Backend | Spring Boot 3.5, Java 21, PostgreSQL 16 |
| Frontend | Next.js 16, React 19, Tailwind CSS 4 |
| Infra | Docker Compose, Caddy (auto-HTTPS), Hetzner Cloud |

---

## Local Development

### Prerequisites

- Docker Desktop (for postgres + mailpit)
- Java 21 + Maven
- Node.js 20

### Start dev dependencies

```bash
docker compose up -d
```

Starts PostgreSQL on port 5432 and Mailpit on port 8025.

### Backend

```bash
cd backend
mvn spring-boot:run -Dspring-boot.run.profiles=dev
```

API available at `http://localhost:8080`.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

App available at `http://localhost:3000`.

---

## Production Deployment (Hetzner)

### Connect to server

```bash
ssh root@178.104.152.16
```

### First-time setup

```bash
# Copy and fill in environment variables
cp .env.example .env
nano .env

# Build and start all services
docker compose -f docker-compose.prod.yml up --build -d
```

### Deploy an update (after `git pull`)

```bash
git pull
docker compose -f docker-compose.prod.yml up --build -d
```

Only changed services (backend / frontend) are rebuilt. The database is not touched.

### Monitor running containers

```bash
# Status overview
docker compose -f docker-compose.prod.yml ps

# Live resource usage (CPU / RAM)
docker stats

# Logs — single service
docker compose -f docker-compose.prod.yml logs -f backend
docker compose -f docker-compose.prod.yml logs -f frontend

# Logs — all services combined
docker compose -f docker-compose.prod.yml logs -f
```

### Restart a single service

```bash
docker compose -f docker-compose.prod.yml restart backend
```

---

## Environment Variables

| Variable | Description |
|----------|-------------|
| `APP_DOMAIN` | Your domain (e.g. `familyadmin.example.com`) |
| `DATABASE_URL` | `jdbc:postgresql://postgres:5432/familyadmin` |
| `DATABASE_USERNAME` | Postgres user |
| `DATABASE_PASSWORD` | Postgres password |
| `JWT_SECRET` | Random string, min 64 characters |
| `APP_FRONTEND_URL` | `https://<your-domain>` (used in notification links) |
| `TWILIO_ACCOUNT_SID` | Twilio account SID |
| `TWILIO_AUTH_TOKEN` | Twilio auth token |
| `TWILIO_WHATSAPP_FROM` | `whatsapp:+14155238886` |
| `NEXT_PUBLIC_API_URL` | `https://<your-domain>` (build-time, baked into frontend image) |

---

## Architecture

```
Browser
  └── Caddy (80/443, auto-HTTPS)
        ├── /api/*  →  backend:8080  (Spring Boot)
        └── /*      →  frontend:3000 (Next.js)
                              │
                        PostgreSQL:5432
```

Single-domain path routing — no CORS issues between frontend and backend.

### Auth

- Login returns a short-lived JWT (15 min) in the response body
- A 7-day HttpOnly refresh cookie is set alongside it
- The frontend stores the access token in memory only (no localStorage)
- `apiFetch()` auto-refreshes on 401 responses
- Logout invalidates the refresh token JTI in the database

---

## Database Migrations

Managed by Flyway. Never edit existing migrations — always add a new file:

```
backend/src/main/resources/db/migration/V{N+1}__description.sql
```


Query the database
docker compose -f docker-compose.prod.yml exec postgres psql -U familyadmin -c "SELECT name, whatsapp_phone FROM users;"

See logs
docker compose -f docker-compose.prod.yml logs backend | grep -i "skip\|phone\|notification\|assigned" | tail -20                                                    

