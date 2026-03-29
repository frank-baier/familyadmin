# AUTH.md — Authentication & Multi-User Data Patterns for FamilyAdmin

**Stack:** Spring Boot 3.5 (Java 21, Spring Security 6.x) + Next.js 16 (React 19) + PostgreSQL
**Context:** Private family app, 5 fixed user accounts, no self-registration, no public exposure.
**Date:** March 2025

---

## 1. JWT Auth Approach

### Library Choice (Backend)

Use **`jjwt`** (io.jsonwebtoken) 0.12.x — the most mature JWT library for Java, actively maintained, and well-aligned with Spring Security 6.

```xml
<!-- pom.xml additions -->
<dependency>
    <groupId>io.jsonwebtoken</groupId>
    <artifactId>jjwt-api</artifactId>
    <version>0.12.6</version>
</dependency>
<dependency>
    <groupId>io.jsonwebtoken</groupId>
    <artifactId>jjwt-impl</artifactId>
    <version>0.12.6</version>
    <scope>runtime</scope>
</dependency>
<dependency>
    <groupId>io.jsonwebtoken</groupId>
    <artifactId>jjwt-jackson</artifactId>
    <version>0.12.6</version>
    <scope>runtime</scope>
</dependency>
```

Sign tokens with **HS256** (HMAC-SHA256) using a 256-bit secret stored in environment variables or a `.env` file outside source control. For a private family app, HS256 is sufficient — RS256 asymmetric keys add complexity with no real benefit when there is only one backend.

### Token Claims

Minimal claims. Keep JWTs small.

```json
{
  "sub": "user_id_uuid",
  "username": "frank",
  "role": "ADMIN",
  "iat": 1700000000,
  "exp": 1700003600
}
```

### Token Lifetimes

| Token | Lifetime | Rationale |
|---|---|---|
| Access token | 15 minutes | Short-lived, minimizes damage if leaked |
| Refresh token | 7 days | Family members check in daily/weekly |
| Remember-me refresh | 30 days | Optional: "stay logged in" on personal devices |

### Token Storage (Frontend — Next.js)

**Do NOT store tokens in `localStorage` or `sessionStorage`.** XSS vulnerabilities would expose them directly.

**Recommended pattern: httpOnly cookies for the refresh token, memory for the access token.**

- **Refresh token**: Stored in a `httpOnly; Secure; SameSite=Strict` cookie set by the backend. The browser sends it automatically on requests to `/api/auth/refresh`. JavaScript cannot read it.
- **Access token**: Stored in React state (e.g., Zustand or React Context). Lost on page refresh — that is intentional and safe. On mount/refresh, the app calls `/api/auth/refresh` using the cookie to silently obtain a new access token.

This pattern is called the "silent refresh" or "token rotation via httpOnly cookie" approach. It is the current industry standard for SPAs in 2025.

**Next.js Server Actions / Route Handlers**: When using Next.js Server Components or Route Handlers to proxy API calls, the access token can also be stored in a server-side session (via `next-auth` or an encrypted cookie). This avoids exposing the token to client-side JS entirely — see Section 4.

### Frontend Auth Library

Use **`next-auth` v5 (Auth.js)** with a custom Credentials provider that calls the Spring Boot `/api/auth/login` endpoint.

- `next-auth` v5 is stable as of late 2024, supports Next.js App Router natively, and handles cookie management, CSRF, and session callbacks well.
- It stores its session in an encrypted httpOnly cookie automatically.
- The access/refresh token pair is kept server-side in the session, never exposed to client JS.

```bash
npm install next-auth@5
```

Alternatively, if you want to avoid `next-auth` complexity: roll a thin custom auth context + `js-cookie` for a CSRF token only, and keep everything in httpOnly cookies managed by the backend. For 5 users, both approaches work.

### Refresh Strategy

**Token rotation**: When the frontend uses the refresh token, the backend issues a new refresh token and invalidates the old one (store a `refresh_token_id` in the DB or Redis — for simplicity, a `users` table column `refresh_token_jti` works fine). This limits refresh token reuse attacks.

Flow:
1. User logs in → backend returns access token (body) + refresh token (httpOnly cookie).
2. Access token expires (15 min) → Next.js middleware or `AuthProvider` calls `POST /api/auth/refresh`.
3. Backend validates refresh cookie, issues new access token + rotated refresh cookie.
4. On logout → backend sets refresh cookie with `maxAge=0` and clears `refresh_token_jti` in DB.

---

## 2. Shared vs. Private Data in PostgreSQL

### Core Pattern: Owner Column + Nullable Family Reference

For a family app with 5 fixed users, keep the schema simple. All data lives in one schema. Distinguish ownership with an `owner_id` column and a `family_id` column on shared entities.

```sql
-- Every user belongs to one family (for this app, always family_id = 1)
CREATE TABLE families (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        TEXT NOT NULL
);

CREATE TABLE users (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username    TEXT UNIQUE NOT NULL,
    password    TEXT NOT NULL,      -- bcrypt
    display_name TEXT NOT NULL,
    role        TEXT NOT NULL,      -- 'ADMIN' or 'MEMBER'
    family_id   UUID REFERENCES families(id) NOT NULL,
    refresh_token_jti TEXT          -- for token rotation validation
);

-- SHARED data: belongs to the family, visible to all members
CREATE TABLE family_events (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    family_id   UUID REFERENCES families(id) NOT NULL,
    title       TEXT NOT NULL,
    event_date  DATE NOT NULL,
    created_by  UUID REFERENCES users(id) NOT NULL
);

-- PRIVATE data: belongs to one user only
CREATE TABLE private_notes (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id    UUID REFERENCES users(id) NOT NULL,
    title       TEXT NOT NULL,
    content     TEXT,
    created_at  TIMESTAMPTZ DEFAULT now()
);

-- MIXED: tasks can be shared (family_id set, owner_id null) or private (owner_id set, family_id null)
-- Use a CHECK constraint to enforce one or the other:
CREATE TABLE tasks (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    family_id   UUID REFERENCES families(id),
    owner_id    UUID REFERENCES users(id),
    title       TEXT NOT NULL,
    done        BOOLEAN DEFAULT FALSE,
    CONSTRAINT tasks_ownership CHECK (
        (family_id IS NOT NULL AND owner_id IS NULL) OR
        (owner_id IS NOT NULL AND family_id IS NULL)
    )
);
```

### Row-Level Security (RLS)

For a private family app with an authenticated backend, **application-level filtering is sufficient** — you do not need PostgreSQL RLS. The backend service always filters by the authenticated user's `id` or `family_id` from the JWT claim. This is simpler to debug and reason about.

Only consider RLS if you have multiple DB users or direct DB access patterns.

### JPA Repository Pattern

Enforce ownership in Spring Data repositories using derived queries:

```java
// Shared: anyone in the family can read
List<FamilyEvent> findByFamilyId(UUID familyId);

// Private: only the owner
List<PrivateNote> findByOwnerId(UUID ownerId);

// Mixed: check both paths
Optional<Task> findByIdAndFamilyId(UUID id, UUID familyId);    // shared task
Optional<Task> findByIdAndOwnerId(UUID id, UUID ownerId);      // private task
```

Never write `findById` alone for private data — always include the ownership predicate.

---

## 3. Role Model

### Two Roles: ADMIN and MEMBER

For a family app, two roles are sufficient and clear.

| Role | Who | Capabilities |
|---|---|---|
| `ADMIN` | Parent(s) | Full CRUD on all shared data, manage user display names/passwords, view any user's shared contributions, access admin dashboard |
| `MEMBER` | Children, other adults | CRUD on own private data, read + create shared family data, edit/delete own shared contributions only |

### Permission Matrix

| Action | ADMIN | MEMBER |
|---|---|---|
| View shared family data | Yes | Yes |
| Create shared family data | Yes | Yes |
| Edit/delete any shared data | Yes | No (own only) |
| View own private data | Yes | Yes |
| View other user's private data | Yes | No |
| Change own password | Yes | Yes |
| Change other user's password | Yes | No |
| Manage family settings | Yes | No |

### Spring Security Implementation

Use `@PreAuthorize` annotations with Spring Security's method security:

```java
@PreAuthorize("hasRole('ADMIN') or #ownerId == authentication.principal.id")
public void deletePrivateNote(UUID noteId, UUID ownerId) { ... }

@PreAuthorize("hasRole('ADMIN')")
public void updateUserProfile(UUID userId, UpdateProfileRequest req) { ... }
```

Enable method security in your config:

```java
@Configuration
@EnableMethodSecurity   // replaces @EnableGlobalMethodSecurity in Spring Security 6
public class SecurityConfig { ... }
```

### No Need for Fine-Grained ACLs

Spring Security ACL (Access Control Lists) would be overkill for 5 users. Simple role checks + owner ID comparisons are fully sufficient and much easier to maintain.

---

## 4. Session Management Best Practices

### Stateless Access Tokens, Stateful Refresh Tokens

The access token is fully stateless (no DB lookup per request). The refresh token is semi-stateful: the backend stores one `jti` (JWT ID) per user and validates it on refresh. This gives you revocation capability without a full session store.

```java
// On login: generate refresh token, store jti
String jti = UUID.randomUUID().toString();
String refreshToken = buildRefreshToken(user, jti);
user.setRefreshTokenJti(jti);
userRepository.save(user);

// On refresh: validate jti matches stored value
Claims claims = jwtService.parseToken(refreshToken);
if (!claims.getId().equals(user.getRefreshTokenJti())) {
    throw new SecurityException("Refresh token reuse detected");
}
```

### Logout

On logout:
1. Clear `refresh_token_jti` in DB (any subsequent use of the old refresh token fails).
2. Invalidate the refresh cookie: `Set-Cookie: refresh_token=; Max-Age=0; HttpOnly; Secure; Path=/api/auth/refresh`.
3. The short-lived access token will expire naturally within 15 minutes. For a private family app, this is acceptable. If you need immediate revocation, add a small in-memory blocklist (ConcurrentHashMap) for access tokens by JTI until their expiry.

### Concurrent Session Limit

With 5 fixed users, do not restrict concurrent sessions. A parent may be logged in on phone + laptop simultaneously — that is expected and fine.

### Inactivity Timeout

The 15-minute access token lifetime already provides session timeout. If the user is inactive for 15 minutes, the silent refresh will re-authenticate them only if the refresh cookie is still valid (7 days). This is a good balance for a family app where you want "stay logged in" behavior but not forever.

### Device Tracking (Optional)

Optionally, store a `device_id` in the refresh token and display active sessions to ADMIN users. For 5 family members, this is a nice-to-have, not a requirement.

---

## 5. Spring Security 6 Gotchas with Spring Boot 3.5

### 1. Lambda DSL Is Now the Only Way

Spring Security 6 removed the deprecated `and()` chaining style. The lambda DSL is mandatory:

```java
// WRONG (Spring Security 5 style — will not compile in 6)
http.csrf().disable().authorizeRequests().antMatchers("/api/auth/**").permitAll()...

// CORRECT (Spring Security 6)
http
    .csrf(csrf -> csrf.disable())   // see note below about CSRF
    .authorizeHttpRequests(auth -> auth
        .requestMatchers("/api/auth/**").permitAll()
        .anyRequest().authenticated()
    )
    .sessionManagement(session -> session
        .sessionCreationPolicy(SessionCreationPolicy.STATELESS)
    )
    .addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter.class);
```

### 2. CSRF Considerations with JWT

If you use JWT in Authorization headers only, disabling CSRF is fine (stateless API). However, if you use httpOnly cookies for the refresh token (recommended), **re-enable CSRF protection for the `/api/auth/refresh` endpoint** or use the `SameSite=Strict` cookie attribute as a CSRF defense (which is adequate for a same-origin family app). Do not blindly disable CSRF across the board.

Practical recommendation: disable CSRF on the stateless API, use `SameSite=Strict` on cookies.

### 3. `@EnableMethodSecurity` Replaces `@EnableGlobalMethodSecurity`

`@EnableGlobalMethodSecurity` is removed in Spring Security 6. Use `@EnableMethodSecurity`. The `prePostEnabled=true` behavior is now the default.

### 4. `UserDetailsService` vs. Custom `AuthenticationProvider`

In Spring Security 6, if you define a `UserDetailsService` bean and a `PasswordEncoder` bean, Spring will auto-configure a `DaoAuthenticationProvider`. You do NOT need to explicitly declare `AuthenticationManager` unless you need it injected somewhere (like a login controller). To expose it:

```java
@Bean
public AuthenticationManager authenticationManager(AuthenticationConfiguration config) throws Exception {
    return config.getAuthenticationManager();
}
```

### 5. JWT Filter Must Be Added Explicitly

Spring Security does not auto-detect your JWT filter. Add it explicitly in the filter chain. Extend `OncePerRequestFilter` and skip `/api/auth/**` endpoints inside the filter to avoid infinite loops:

```java
@Component
public class JwtAuthFilter extends OncePerRequestFilter {

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        return request.getServletPath().startsWith("/api/auth/");
    }

    @Override
    protected void doFilterInternal(HttpServletRequest req, HttpServletResponse res, FilterChain chain) {
        // Extract Bearer token from Authorization header
        // Validate with JwtService
        // Set SecurityContextHolder.getContext().setAuthentication(...)
        chain.doFilter(req, res);
    }
}
```

### 6. CORS Must Be Configured in Spring Security, Not Just Spring MVC

In Spring Boot 3.x, if you configure CORS via `@CrossOrigin` or a `WebMvcConfigurer`, it will be bypassed by Spring Security's filter chain unless you also configure it in the `SecurityFilterChain`:

```java
http.cors(cors -> cors.configurationSource(corsConfigurationSource()));

@Bean
CorsConfigurationSource corsConfigurationSource() {
    CorsConfiguration config = new CorsConfiguration();
    config.setAllowedOrigins(List.of("http://localhost:3000"));  // Next.js dev server
    config.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE", "OPTIONS"));
    config.setAllowedHeaders(List.of("*"));
    config.setAllowCredentials(true);  // Required for httpOnly cookie exchange
    UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
    source.registerCorsConfiguration("/api/**", config);
    return source;
}
```

`setAllowCredentials(true)` is required for cookies to be sent cross-origin (Next.js dev on `:3000` to Spring Boot on `:8080`). In production, when served from the same origin, this is less critical.

### 7. `SecurityContextHolder` Strategy in Virtual Threads (Java 21)

Spring Boot 3.5 with Java 21 may use virtual threads (Project Loom). The default `ThreadLocal` storage strategy for `SecurityContextHolder` does not propagate across virtual thread boundaries. Set the strategy explicitly if you enable virtual threads:

```java
SecurityContextHolder.setStrategyName(SecurityContextHolder.MODE_INHERITABLETHREADLOCAL);
```

Or, use `@Async` carefully — prefer structured concurrency or pass the `Authentication` object explicitly rather than relying on `SecurityContextHolder` in async code.

---

## Summary Recommendations

1. **Auth library**: `jjwt` 0.12.x for backend JWT, `next-auth` v5 for Next.js session management.
2. **Token storage**: Access token in memory (React state / next-auth session), refresh token in httpOnly cookie with `SameSite=Strict`.
3. **Token rotation**: Rotate refresh tokens on each use, store JTI in the users table.
4. **Data model**: Single `family_id` column on shared entities, `owner_id` on private entities. No RLS needed — enforce at the repository layer.
5. **Roles**: `ADMIN` (parent) + `MEMBER` (everyone else). Two roles, simple `@PreAuthorize` checks.
6. **Session**: Stateless access tokens (15 min), semi-stateful refresh tokens (7 days JTI validation), logout clears JTI in DB.
7. **Spring Security 6**: Use lambda DSL, `@EnableMethodSecurity`, configure CORS in the security filter chain, add JWT filter with `OncePerRequestFilter`, check virtual thread `SecurityContextHolder` strategy if using Java 21 virtual threads.
