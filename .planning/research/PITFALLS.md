# FamilyAdmin — Tech Stack Pitfalls & Risk Register

*Reviewed: 2026-03-29 | Stack: Spring Boot 3.5 / Java 21 / PostgreSQL + Next.js 16 / React 19 / Tailwind CSS v4 / Railway*

---

## TOP 5 PROJECT-DERAILING RISKS

These are the things most likely to kill momentum or cause a painful rewrite if ignored at the start.

1. **No persistent file storage on Railway** — the Documents module is planned but Railway has no persistent disk. Fix the architecture before building it (see Section 5).
2. **Authentication not designed yet** — Spring Security is in the pom but completely unconfigured. The choice between session cookies and JWT has cascading effects on CORS, Next.js middleware, and the entire API design. Decide this first.
3. **CORS will block you on day one** — two separate Railway services (backend + frontend) means different origins. Without explicit CORS + Security config, every API call from the browser will fail with a CORS error.
4. **Railway's free/starter tier DB has a 1 GB storage cap and no PgBouncer** — Spring Boot's default HikariCP pool (10 connections) eats into Railway's soft connection limits. Tune this early.
5. **Next.js 16 + React 19 + Tailwind v4 are all cutting-edge** — the installed versions (`next@16.2.1`, `react@19.2.4`, `tailwindcss@4`) have breaking changes vs. your training data and most tutorials. The `AGENTS.md` in the frontend explicitly warns about this. Don't assume Next.js 13/14 patterns apply.

---

## 1. Spring Boot + Next.js Integration — CORS, Auth, API Design

### CORS

**The problem:** Spring Boot and Next.js run as two separate Railway services on different subdomains (`api.*.railway.app` vs `app.*.railway.app`). The browser enforces same-origin policy. Without a CORS configuration in Spring Boot, every fetch from the frontend will fail.

**What to do:**
- Configure `@CrossOrigin` globally via `WebMvcConfigurer#addCorsMappings` or a `CorsFilter` bean. Hardcode allowed origins from environment variables (`FRONTEND_URL`), not `*`.
- If using Spring Security (you are), note that Spring Security has its own CORS filter that runs before MVC's — configure CORS in the `SecurityFilterChain` via `.cors(cors -> cors.configurationSource(...))`. Configuring only MVC while Security is active will result in Security blocking preflight requests before MVC's CORS config is ever checked.
- Never allow `*` with `allowCredentials(true)` — this combination is illegal per spec and Spring will throw at startup.

**Credentials (cookies vs. bearer tokens):**
- **Session cookies** across different Railway subdomains require `SameSite=None; Secure` and explicit `Access-Control-Allow-Credentials: true`. Cookie-based auth is simple server-side but tricky cross-origin.
- **JWT in Authorization header** sidesteps cookie cross-origin issues but requires careful token storage on the frontend (avoid `localStorage` for a family app accessible on shared devices — prefer `httpOnly` cookies or short-lived memory tokens with a refresh cookie).
- **Recommendation for this project:** HttpOnly cookie containing a short-lived JWT. Simpler than a full OAuth flow, avoids XSS token theft, and works well with Next.js Server Actions/Route Handlers acting as a proxy.

### Auth Architecture

**The pom has `spring-boot-starter-security` but zero configuration.** Spring Boot's auto-configuration will lock down every endpoint with HTTP Basic by default. The first thing you must do is write a `SecurityFilterChain` bean that disables CSRF (REST API), configures CORS, sets session policy, and defines which endpoints are public (`/api/auth/**`) vs. protected.

**Missing dependency:** There is no JWT library in `pom.xml`. Add `io.jsonwebtoken:jjwt-api` + `jjwt-impl` + `jjwt-jackson` before writing any auth code.

**CSRF:** Disable CSRF for stateless REST APIs (`csrf().disable()`). If you use cookie-based sessions, re-enable it or use the `CookieCsrfTokenRepository`.

### API Design

- **Version your API from day one:** Use `/api/v1/` prefix. It costs nothing now and saves a painful migration when a mobile app appears.
- **Consistent error responses:** Define a single `ProblemDetail` (RFC 7807) error format early. Spring Boot 3 supports this natively. A family app with 5 users doesn't need elaborate error handling, but consistent error shapes make frontend error handling trivial.
- **N+1 queries with JPA:** Spring Data JPA's `findAll()` on entities with `@OneToMany` will fire N+1 queries unless you use `JOIN FETCH` or `@EntityGraph`. For a tasks list with assignees and checklist items, this will be visible immediately.
- **Avoid `@Transactional` on every controller method** — it's a common reflex but it holds DB connections for the entire HTTP request duration, wasting the connection pool.

---

## 2. Railway Deployment Gotchas — Spring Boot

### Health Checks

Railway uses an HTTP health check to determine if a service is alive. Spring Boot Actuator provides `/actuator/health` out of the box, but **Actuator is not in the pom**. Without it:
- You can configure a custom health endpoint or use `GET /` returning 200.
- Add `spring-boot-starter-actuator` and set `management.endpoints.web.exposure.include=health` and `management.endpoint.health.show-details=never` (don't expose internals publicly).
- Railway's health check timeout is configurable but defaults to a short window. A Spring Boot app with JPA + Security cold-starts in 15–25 seconds on a shared CPU instance. Set `HEALTHCHECK_TIMEOUT` in Railway to at least 60s.

### Cold Starts

Railway's Starter plan does not guarantee dedicated CPU. A JVM app on a cold start competes with other workloads and may take 20–40 seconds to become responsive. For a family app used ad-hoc (not continuously):
- Consider enabling Spring Boot's CDS (Class Data Sharing) with Java 21 — it's built in and can cut startup time by 30–50% without GraalVM native image complexity.
- Add `spring.jpa.open-in-view=false` — this is default false in Spring Boot 3 but worth confirming; it prevents JPA sessions staying open during view rendering.
- The JVM memory on Railway Starter is limited (~512 MB). Set `-Xmx400m -Xss512k` in the Railway start command or `JAVA_OPTS` env var to avoid OOM kills.

### Environment Variables

- Never hardcode DB credentials. Railway auto-injects `DATABASE_URL` as a PostgreSQL connection string. Spring Boot expects `spring.datasource.url` in JDBC format, not the `postgres://` URL format Railway provides. **You must convert it.**
  - Option A: Use `SPRING_DATASOURCE_URL`, `SPRING_DATASOURCE_USERNAME`, `SPRING_DATASOURCE_PASSWORD` individually (Railway's "Variables" tab lets you reference service variables).
  - Option B: Use a Railway variable reference: `${{Postgres.DATABASE_URL}}` and write a startup script that converts the URL format.
- Use Railway's "Variable References" feature to share the DB URL between services rather than copy-pasting credentials.
- `application.properties` should only contain defaults; all secrets come from env vars. Use `spring.datasource.url=${DATABASE_URL}` pattern.

### Service Networking

- Both Spring Boot and Next.js are separate Railway services. Internal Railway networking (private networking) uses `.railway.internal` hostnames — use this for backend calls from Next.js Server Components/Route Handlers to avoid going over the public internet and to reduce latency.
- Set `BACKEND_URL=http://backend.railway.internal:8080` in the Next.js service environment for server-side calls.

---

## 3. Next.js 16 App Router Pitfalls

**Critical note:** The installed `next` version is `16.2.1` with `react@19.2.4`. This is **not** Next.js 15 as planned — it is one major version ahead. The `AGENTS.md` in the frontend explicitly warns that "APIs, conventions, and file structure may all differ from your training data." Treat any tutorial or LLM suggestion with suspicion and verify against `node_modules/next/dist/` source or the official changelog.

### Server vs. Client Components

- **Default in App Router:** every component is a Server Component unless it has `"use client"` at the top. This is correct and desirable — keep as much as possible server-side.
- **Common mistake:** Adding `"use client"` to a component that fetches data, making it a Client Component, and then trying to pass a non-serializable value (a class instance, a Date object, a function) from a Server Component into it. This causes a cryptic "Objects with Methods" error.
- **The cascade trap:** When you add `"use client"` to a component, all of its imports also become client-side. This means a large component tree can accidentally become fully client-rendered. Extract the interactive parts into small leaf `"use client"` components and keep the data-fetching shell as a Server Component.
- **Context providers must be client components.** Any auth context, theme provider, or toast manager needs `"use client"`. Put these in a `providers.tsx` file and wrap the layout children — don't put `"use client"` on the layout itself.

### Data Fetching

- **`fetch()` with `cache` control:** Next.js 16 extends `fetch()` with `cache` and `next.revalidate` options. For a family app with near-real-time data (tasks, assignments), use `cache: 'no-store'` or ISR with short revalidation. Do not assume data is fresh without explicit configuration.
- **Server Actions for mutations:** Instead of API route handlers for form submissions, use Server Actions (`"use server"` functions). They are the idiomatic Next.js 16 pattern and simplify auth-aware mutations. However, be aware that Server Actions are POST requests and require CSRF-like considerations if combined with external APIs.
- **Avoid fetching from the Spring Boot backend inside `getServerSideProps`** — that pattern is Pages Router only. In App Router, fetch directly in async Server Components.
- **Error boundaries:** Server Component errors propagate to the nearest `error.tsx` file. Create one per route segment. Without them, a single failing API call brings down the whole page with a generic 500.

### Tailwind CSS v4

- **Breaking change:** Tailwind v4 (`@tailwindcss/postcss@4`) uses a new CSS-first configuration model. The `tailwind.config.js` file is gone — configuration is done in CSS using `@theme` directives. Any tutorial referencing `tailwind.config.js` is outdated.
- **PostCSS plugin changed:** Tailwind v4 uses `@tailwindcss/postcss` instead of the old `tailwindcss` PostCSS plugin. This is already correct in `postcss.config.mjs` (check this is configured before assuming it works).
- **Utility class changes:** Several utility names changed in v4. If copying classes from v3 docs/examples, verify they exist in v4.

---

## 4. PostgreSQL on Railway — Limitations

### Connection Limits

Railway's managed PostgreSQL (Starter tier) runs a single PostgreSQL instance — no PgBouncer, no connection pooling proxy. PostgreSQL itself limits concurrent connections (typically 100 on shared instances, often lower on free/starter tiers).

Spring Boot's HikariCP default pool size is **10 connections per app instance**. For a small family app this is fine, but if you ever run multiple backend replicas or add background jobs, you will hit the limit.

**Configure HikariCP explicitly:**
```properties
spring.datasource.hikari.maximum-pool-size=5
spring.datasource.hikari.minimum-idle=2
spring.datasource.hikari.connection-timeout=20000
spring.datasource.hikari.idle-timeout=300000
```

For this app (5 users, single backend instance), a pool of 3–5 is more than enough and leaves headroom.

### Storage Limits

- Railway Starter plan: **1 GB PostgreSQL storage** included. Pro plan: 100 GB.
- 1 GB is ample for tasks, recipes, travel data, and document *metadata* — but **not** for storing file binaries in the database (see Section 5). Never store file content as a `BYTEA` column.
- Monitor storage via Railway dashboard. Set an alert if you approach 800 MB.

### Backups

- Railway does NOT provide automatic backups on the free/Starter tier. On Pro, daily backups are included.
- **For a family admin app with irreplaceable data (documents, records), this is a risk.** Options:
  - Upgrade to Pro for automatic backups (~$20/month).
  - Script a `pg_dump` to an S3 bucket on a cron schedule (Railway supports cron services).
  - Accept the risk for the initial MVP since data is not yet critical.

### Schema Migrations

- Do not use `spring.jpa.hibernate.ddl-auto=create` or `update` in production. These are destructive or unpredictable.
- Use **Flyway** (or Liquibase) for schema migrations. Add `spring-boot-starter-flyway` and put migration scripts in `src/main/resources/db/migration/`. This gives you repeatable, reviewable, version-controlled schema changes.
- Set `spring.jpa.hibernate.ddl-auto=validate` in production so JPA verifies your entities match the DB schema but makes no changes.

---

## 5. File Storage — The Railway Ephemeral Disk Problem

**Railway has no persistent disk.** Any file written to the container filesystem is lost on the next deploy or restart. This is the single most important architectural decision for the Documents module.

### What NOT to Do

- Do not write uploaded files to `./uploads/` or any local path in the Spring Boot container.
- Do not store file binaries as `BYTEA` in PostgreSQL — this bloats the DB, bypasses the 1 GB limit quickly, and makes streaming large files through JPA extremely inefficient.

### Recommended Approach: S3-Compatible Object Storage

Use an external object storage service. The Spring Boot backend handles upload orchestration; the actual bytes go directly to object storage.

**Option A: Cloudflare R2 (recommended for this budget)**
- Free tier: 10 GB storage, 1M Class A operations/month, no egress fees.
- S3-compatible API — works with the AWS SDK for Java (`software.amazon.awssdk:s3`).
- No egress cost means downloads are free.
- Setup: Create a Cloudflare account, create an R2 bucket, generate an API token with S3 compatibility enabled.

**Option B: AWS S3**
- Well-documented, reliable. First 5 GB storage free for 12 months, then ~$0.023/GB/month.
- Egress charges apply (first 100 GB/month free to internet).
- Overkill for a family app but familiar to most Java developers.

**Option C: Backblaze B2**
- $0.006/GB/month (much cheaper than S3). Free egress via Cloudflare partnership.
- S3-compatible API.

### Upload Architecture

Two valid patterns:

**Pattern 1: Backend proxy (simpler, right for this app)**
```
Browser → POST /api/v1/documents/upload → Spring Boot → S3/R2
```
Backend validates auth, scans/validates the file, uploads to object storage, stores metadata (filename, S3 key, size, MIME type, uploader) in PostgreSQL. Browser downloads via a signed URL or a backend proxy endpoint.

**Pattern 2: Presigned URL (more scalable, not needed here)**
```
Browser → GET /api/v1/documents/upload-url → Spring Boot returns presigned S3 URL
Browser → PUT directly to S3 (bypasses backend)
```
This offloads bandwidth from Railway but adds complexity. Not needed for 5 users.

**For FamilyAdmin:** Use Pattern 1. It keeps auth enforcement in Spring Boot, avoids browser-side S3 credentials, and the bandwidth overhead is negligible for 5 users uploading family documents.

### Implementation Checklist for Documents Module

- [ ] Add `software.amazon.awssdk:s3` to `pom.xml`
- [ ] Store `S3_ENDPOINT`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_BUCKET_NAME` as Railway env vars
- [ ] Create a `Document` entity with `fileName`, `s3Key`, `contentType`, `sizeBytes`, `uploadedBy`, `uploadedAt`
- [ ] Set max upload size in Spring Boot: `spring.servlet.multipart.max-file-size=50MB`
- [ ] Validate MIME types server-side — don't trust the browser's `Content-Type`
- [ ] Generate download URLs as signed S3 URLs with a short TTL (e.g., 15 minutes) to avoid direct public bucket exposure

---

## Quick Reference — Decisions to Make Before Writing Code

| Decision | Options | Recommendation |
|---|---|---|
| Auth mechanism | JWT bearer / HttpOnly cookie JWT / Session cookie | HttpOnly cookie + JWT |
| JWT library | jjwt / nimbus-jose-jwt / spring-security-oauth2 | `io.jsonwebtoken:jjwt-api` |
| Schema migrations | Flyway / Liquibase / ddl-auto=update | Flyway |
| File storage | R2 / S3 / B2 / DB blob | Cloudflare R2 (free tier) |
| Next.js data fetching | Server Components / Route Handlers / Client fetch | Server Components + Route Handlers for mutations |
| Backend URL (server-side) | Public URL / Railway internal network | Railway internal (`.railway.internal`) |
| HikariCP pool size | Default 10 / tuned | Set to 5 |
| DB backups | None / pg_dump cron / Railway Pro | pg_dump cron to R2 for MVP |

---

*Generated by senior engineering review — 2026-03-29*
