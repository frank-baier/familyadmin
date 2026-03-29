# FamilyAdmin — Stack & Architecture Reference

**Project:** Private family management platform, 5 users
**Backend:** Spring Boot 3.5 / Java 21 / PostgreSQL / REST
**Frontend:** Next.js 16.2 / React 19.2 / Tailwind CSS 4 / TypeScript 5
**Cloud:** Railway

---

## 1. Spring Boot 3.5 — Recommended Libraries

### JWT Authentication

**Use: `spring-boot-starter-oauth2-resource-server` (bundled) + `nimbus-jose-jwt` (transitive)**

Spring Security's OAuth2 resource server starter ships with `nimbus-jose-jwt` as its JWT engine. This is the officially maintained path — no extra dependency needed.

```xml
<dependency>
  <groupId>org.springframework.boot</groupId>
  <artifactId>spring-boot-starter-oauth2-resource-server</artifactId>
</dependency>
```

Configure a symmetric HS256 key in `application.yml`:

```yaml
spring:
  security:
    oauth2:
      resourceserver:
        jwt:
          secret-key: ${JWT_SECRET}   # base64-encoded 256-bit key
```

Or wire a `JwtDecoder` bean manually for asymmetric RS256.

**Avoid:** `io.jsonwebtoken:jjwt-api` — still functional but adds a third dependency when the platform already ships Nimbus. Only choose JJWT if you need its fluent builder API and are comfortable with the extra jar.

For a private family app, stateless JWT with a 1-hour access token + 7-day HttpOnly cookie refresh token is the right pattern. Issue tokens from a `/auth/login` endpoint, validate in a `JwtAuthenticationFilter`.

### Email Notifications

**Use: `spring-boot-starter-mail` (bundled) + Resend or Brevo (SMTP relay)**

```xml
<dependency>
  <groupId>org.springframework.boot</groupId>
  <artifactId>spring-boot-starter-mail</artifactId>
</dependency>
```

Configure Railway environment variables:

```yaml
spring:
  mail:
    host: smtp.resend.com        # or smtp-relay.brevo.com
    port: 587
    username: resend             # Resend uses literal "resend"
    password: ${RESEND_API_KEY}
    properties:
      mail.smtp.starttls.enable: true
```

**Why Resend over SendGrid for a small private app:** Resend's free tier (3,000 emails/month) is sufficient for 5 users; it has zero configuration overhead and a modern API if you later want HTTP delivery. Brevo is the second choice — 300 free emails/day with a generous free tier.

For rich HTML emails, use **Thymeleaf** (already available via `spring-boot-starter-thymeleaf`) as the template engine:

```xml
<dependency>
  <groupId>org.springframework.boot</groupId>
  <artifactId>spring-boot-starter-thymeleaf</artifactId>
</dependency>
<dependency>
  <groupId>org.thymeleaf.extras</groupId>
  <artifactId>thymeleaf-extras-springsecurity6</artifactId>
</dependency>
```

### File Upload / Storage

**Use: AWS SDK for Java v2 (`software.amazon.awssdk:s3`) targeting Cloudflare R2**

Railway has no persistent disk for production. Use an S3-compatible object store. Cloudflare R2 is recommended: S3-compatible API, zero egress fees, generous free tier (10 GB).

```xml
<dependency>
  <groupId>software.amazon.awssdk</groupId>
  <artifactId>s3</artifactId>
  <version>2.26.x</version>   <!-- check Maven Central for latest 2.x -->
</dependency>
```

Configure for R2:

```yaml
cloud:
  aws:
    r2:
      endpoint: https://<ACCOUNT_ID>.r2.cloudflarestorage.com
      access-key: ${R2_ACCESS_KEY}
      secret-key: ${R2_SECRET_KEY}
      bucket: familyadmin-files
```

Wire an `S3Client` bean pointing at the R2 endpoint. Generate pre-signed URLs (15-minute TTL) for downloads instead of proxying bytes through the API.

**Alternative if cost is not a concern:** AWS S3 with `spring-cloud-aws-starter-s3` from the Spring Cloud AWS 3.x BOM — slightly simpler autoconfiguration, but adds the full Spring Cloud AWS dependency chain.

For local development, run **MinIO** in Docker as a drop-in replacement.

---

## 2. Next.js 16 — Recommended Libraries

> **Critical:** The installed version is **Next.js 16.2.1** (not 15). APIs from Next.js 15 docs may be stale. Key differences are called out below.

### Forms

**Use: React built-ins (`useActionState`, `useFormStatus`) + Zod for validation**

Next.js 16 (via React 19.2) natively supports Server Actions as form targets. No form library is needed for most cases.

```tsx
// app/actions/task.ts
'use server'
import { z } from 'zod'

const schema = z.object({ title: z.string().min(1), dueDate: z.string() })

export async function createTask(state: unknown, formData: FormData) {
  const result = schema.safeParse(Object.fromEntries(formData))
  if (!result.success) return { errors: result.error.flatten().fieldErrors }
  // ... persist
}
```

```tsx
// app/tasks/new/page.tsx
'use client'
import { useActionState } from 'react'
import { createTask } from '../actions/task'

export default function NewTaskForm() {
  const [state, action, pending] = useActionState(createTask, undefined)
  return (
    <form action={action}>
      <input name="title" required />
      {state?.errors?.title && <p>{state.errors.title}</p>}
      <button disabled={pending}>Save</button>
    </form>
  )
}
```

Install Zod:

```bash
npm install zod
```

**When to add React Hook Form:** Only if you need complex client-side field orchestration (e.g., dynamic field arrays, watched cross-field validation). RHF 7.x integrates with Server Actions via `handleSubmit`. Avoid it for simple forms — the native pattern is leaner.

### State Management

**Use: React built-ins (Server Components + `useState`/`useContext`) — no library needed**

For a 5-user private app, global state needs are minimal:

- **Server state (data from the API):** Fetch in Server Components or Route Handlers, pass down as props. Use `use cache` + `updateTag`/`revalidateTag` for cache invalidation after mutations.
- **Client UI state:** `useState` and `useContext` are sufficient.
- **Optimistic updates:** Use React 19's `useOptimistic` hook.

```tsx
import { updateTag } from 'next/cache'

export async function completeTask(taskId: string) {
  'use server'
  await fetch(`${API}/tasks/${taskId}/complete`, { method: 'PATCH' })
  updateTag(`tasks`)  // Next.js 16 API — immediate cache refresh
}
```

**If you later need cross-component client state** (e.g., a shopping-cart-style shared basket or real-time presence): use **Zustand** (`zustand@5`). It is tiny (1 KB), works inside Client Components, and has no provider boilerplate.

Avoid Redux/RTK for this scale.

### Notifications UI (Toast / Alerts)

**Use: Sonner (`sonner@1`)**

```bash
npm install sonner
```

Sonner is the de-facto standard in the Next.js / Tailwind ecosystem — framework-agnostic, accessible, animated, and zero config. Mount the `<Toaster>` once in your root layout:

```tsx
// app/layout.tsx
import { Toaster } from 'sonner'

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        {children}
        <Toaster richColors position="top-right" />
      </body>
    </html>
  )
}
```

Trigger from anywhere in Client Components:

```tsx
import { toast } from 'sonner'
toast.success('Task saved')
toast.error('Something went wrong')
```

### Data Fetching

**Pattern: Server Components for reads, Server Actions for mutations, SWR for client-side polling**

```
                ┌─────────────────────────────────┐
  reads         │  Server Component  →  Spring API │  (fetch with use cache)
  mutations     │  Server Action     →  Spring API │  (POST/PATCH/DELETE)
  client polls  │  SWR / Route Handler              │  (notifications, presence)
                └─────────────────────────────────┘
```

Explicitly recommended by Next.js 16 docs for client-side data that depends on browser APIs or frequently-polled data:

```bash
npm install swr
```

```tsx
// app/components/NotificationBell.tsx
'use client'
import useSWR from 'swr'

const fetcher = (url: string) => fetch(url).then(r => r.json())

export function NotificationBell() {
  const { data } = useSWR('/api/notifications/unread', fetcher, {
    refreshInterval: 30_000,  // poll every 30s
  })
  return <span>{data?.count ?? 0}</span>
}
```

For server-to-server fetch inside Server Components, pass JWT from cookies into the `Authorization` header:

```tsx
import { cookies } from 'next/headers'

export default async function TaskList() {
  const token = (await cookies()).get('access_token')?.value
  const res = await fetch(`${process.env.API_URL}/tasks`, {
    headers: { Authorization: `Bearer ${token}` },
    next: { tags: ['tasks'] },
  })
  const tasks = await res.json()
  // ...
}
```

---

## 3. Database Schema Patterns — Multi-User Family App

### Core Principles

1. **Single-schema with `family_id` scoping** — all tables include a `family_id` FK. This keeps queries simple and enables future multi-family extension.
2. **Row-Level Security (RLS) in PostgreSQL** — enforce access at the DB layer as a safety net, even if application code is already authorised.
3. **Shared vs private data via `visibility` enum** — avoid separate tables per user; instead use a `visibility` column.

### Schema Sketch

```sql
-- Members
CREATE TABLE family_members (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id  UUID NOT NULL REFERENCES families(id),
  name       VARCHAR(100) NOT NULL,
  email      VARCHAR(255) UNIQUE NOT NULL,
  role       VARCHAR(20) NOT NULL DEFAULT 'member',  -- admin | member
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Example: Tasks (shared model, applies to other resources)
CREATE TABLE tasks (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id   UUID NOT NULL REFERENCES families(id),
  created_by  UUID NOT NULL REFERENCES family_members(id),
  assigned_to UUID REFERENCES family_members(id),    -- null = unassigned
  title       VARCHAR(255) NOT NULL,
  visibility  VARCHAR(10) NOT NULL DEFAULT 'family',  -- 'family' | 'private'
  completed   BOOLEAN NOT NULL DEFAULT false,
  due_date    DATE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Files
CREATE TABLE files (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id   UUID NOT NULL REFERENCES families(id),
  uploaded_by UUID NOT NULL REFERENCES family_members(id),
  r2_key      TEXT NOT NULL,            -- Cloudflare R2 object key
  filename    TEXT NOT NULL,
  mime_type   VARCHAR(100),
  visibility  VARCHAR(10) NOT NULL DEFAULT 'family',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### Rules

- **`visibility = 'private'`**: Only the `created_by` member can read/write. Spring Security checks `task.createdBy.equals(currentUser)`.
- **`visibility = 'family'`**: Any member with a valid JWT whose `family_id` matches the row.
- **Admin role**: Can read all private records within the family. Enforce in service layer, not just at the controller.
- **Never filter by user/family in the frontend** — always filter in the Spring service/repository layer using `SecurityContextHolder`.
- **Soft delete:** Add `deleted_at TIMESTAMPTZ` to all content tables instead of hard deletes. Enables audit trail.

### JPA / Spring Data Pattern

```java
// Repository always scopes by family
@Repository
public interface TaskRepository extends JpaRepository<Task, UUID> {
    List<Task> findByFamilyIdAndVisibilityOrCreatedById(
        UUID familyId, Visibility visibility, UUID userId);
}
```

---

## 4. Email / Push Notifications on Railway

### Email

**Recommended: Resend (SMTP or HTTP API)**

Railway allows outbound SMTP but blocks port 25. Use port 587 (STARTTLS) or 465 (TLS).

- **Resend** (`smtp.resend.com:587`): Free tier 3,000 emails/month. Requires a verified domain. Modern dashboard, delivery analytics. Best DX in 2025.
- **Brevo** (formerly Sendinblue): Free tier 300/day, 9,000/month. More generous for burst. Good EU data residency option.
- **Amazon SES**: Cheapest at scale ($0.10/1,000), requires more AWS setup. Overkill for 5 users.

Trigger emails from Spring Boot `@EventListener` or `ApplicationEventPublisher` to keep notification logic decoupled:

```java
@Service
public class TaskNotificationListener {
    @Async
    @EventListener
    public void onTaskAssigned(TaskAssignedEvent event) {
        mailService.sendTaskAssigned(event.getAssignee(), event.getTask());
    }
}
```

Enable `@Async` in a `@Configuration` class to avoid blocking request threads.

### Push Notifications (In-App)

**Recommended: Server-Sent Events (SSE) via Spring WebFlux or a Spring MVC SseEmitter**

For a private family app with 5 users, SSE is simpler than WebSockets and sufficient for real-time notifications (new task, grocery update, calendar event).

```java
// Spring MVC approach
@GetMapping(value = "/notifications/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
public SseEmitter stream(Authentication auth) {
    SseEmitter emitter = new SseEmitter(Long.MAX_VALUE);
    sseRegistry.register(auth.getName(), emitter);
    return emitter;
}
```

On the frontend, connect from a Client Component using the native `EventSource` API (no library needed):

```tsx
'use client'
import { useEffect } from 'react'
import { toast } from 'sonner'

export function NotificationListener() {
  useEffect(() => {
    const es = new EventSource('/api/notifications/stream', { withCredentials: true })
    es.onmessage = (e) => {
      const msg = JSON.parse(e.data)
      toast.info(msg.text)
    }
    return () => es.close()
  }, [])
  return null
}
```

**Avoid Web Push (browser notifications)** for a private intranet-style app — it requires a service worker, VAPID keys, and user permission prompts. Overkill for 5 users who will be actively using the app.

---

## 5. Version-Specific Gotchas

### Next.js 16 (not 15)

The installed version is **16.2.1**. These are breaking changes from 15:

| Area | Change |
|------|--------|
| `middleware.ts` | **Renamed to `proxy.ts`**. The function export is `proxy`, not `middleware`. Old name still works but is deprecated and will warn. |
| `cookies()`, `headers()`, `params` | **Fully async only**. Synchronous access removed (was a compatibility shim in 15). Always `await cookies()`, `await headers()`, `const { slug } = await params`. |
| Turbopack | **Default for both `next dev` and `next build`**. If you add a custom `webpack` config, the build will fail unless you use `--webpack` flag or remove it. |
| `experimental.ppr` | **Removed**. PPR now enabled via `cacheComponents: true` in `next.config.ts`. |
| `unstable_cacheLife` / `unstable_cacheTag` | **Stabilised** — use `cacheLife` / `cacheTag` from `next/cache` without the prefix. |
| `revalidateTag` | New second argument: `revalidateTag('key', 'max')` — pass a `cacheLife` profile. |
| `updateTag` | **New API** in Next.js 16. Read-your-writes semantics — expires and immediately refreshes in the same request. Use instead of `revalidateTag` for user-facing mutations. |
| React | Uses **React 19.2**. Includes `ViewTransition`, `useEffectEvent`, `Activity`. `useFormStatus` now includes `data`, `method`, `action` fields. |
| Node.js | Minimum **20.9.0**. Node 18 no longer supported. |
| `next/image` | `minimumCacheTTL` default changed from 60s to 14400s (4h). Local images with query strings now require `images.localPatterns.search` config. |
| React Compiler | Stable (opt-in via `reactCompiler: true`). Not enabled by default. Expect longer build times when enabled. |

### Spring Boot 3.5 / Java 21

| Area | Gotcha |
|------|--------|
| Virtual Threads | Spring Boot 3.5 enables virtual threads by default when `spring.threads.virtual.enabled=true`. Set this in Railway — it eliminates thread-pool sizing for REST and email sending. |
| Jakarta EE | All `javax.*` imports are `jakarta.*`. Any library using old `javax.servlet` will fail to compile. |
| Hibernate 6 | Lazy loading proxies now use `ByteBuddy` instead of `Javassist`. If you see `HibernateProxyHelper` errors, ensure you're not persisting proxy objects directly. |
| Spring Security 6.x | `WebSecurityConfigurerAdapter` is removed. Use `SecurityFilterChain` beans. `authorizeRequests()` is replaced by `authorizeHttpRequests()`. |
| Flyway | Use Flyway 10.x. Migration scripts must be in `db/migration/`. Spring Boot 3.5 no longer autoconfigures Flyway 9.x. |
| Lombok with Java 21 | Works fine, but use Lombok 1.18.32+ to avoid annotation processing issues with record classes and sealed interfaces. |
| `spring-boot-starter-oauth2-resource-server` | Spring Security 6 JWT filter is now `BearerTokenAuthenticationFilter`. The old `OncePerRequestFilter` manual JWT pattern still works but is redundant. |

### Railway-Specific

| Area | Note |
|------|--------|
| Persistent storage | Railway volumes are available but restart on redeploy. Do **not** use the Railway filesystem for user-uploaded files. Use R2/S3. |
| Port binding | Railway injects `$PORT`. Spring Boot must bind to it: `server.port=${PORT:8080}`. Next.js `next start` automatically reads `$PORT`. |
| CORS | Spring Backend is on a different Railway service (different domain). Set `allowedOrigins` in your `CorsConfigurationSource` bean to the Next.js public URL. |
| Environment variables | Prefix frontend-public vars with `NEXT_PUBLIC_`. The API URL that Server Components use should **not** be prefixed (it's server-only). |
| Health checks | Railway uses HTTP health checks. Add Spring Boot Actuator: `spring-boot-starter-actuator`. Expose `/actuator/health` only. |

---

## Quick-Reference Install Commands

### Backend (add to pom.xml)

```xml
<!-- Already present: web, security, jpa, validation, postgresql, lombok -->

<!-- Add these: -->
<dependency>
  <groupId>org.springframework.boot</groupId>
  <artifactId>spring-boot-starter-oauth2-resource-server</artifactId>
</dependency>
<dependency>
  <groupId>org.springframework.boot</groupId>
  <artifactId>spring-boot-starter-mail</artifactId>
</dependency>
<dependency>
  <groupId>org.springframework.boot</groupId>
  <artifactId>spring-boot-starter-actuator</artifactId>
</dependency>
<dependency>
  <groupId>org.flywaydb</groupId>
  <artifactId>flyway-core</artifactId>
</dependency>
<dependency>
  <groupId>org.flywaydb</groupId>
  <artifactId>flyway-database-postgresql</artifactId>
</dependency>
<dependency>
  <groupId>software.amazon.awssdk</groupId>
  <artifactId>s3</artifactId>
  <version>2.26.31</version>
</dependency>
```

### Frontend (npm install)

```bash
npm install zod sonner swr
# Optional, only if complex forms needed:
npm install react-hook-form @hookform/resolvers
# Optional, only if cross-component client state needed:
npm install zustand
```
