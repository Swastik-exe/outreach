# Outreach — Project Brain

**One-liner:** Backend for a student career platform — application tracker + resume analyser + rule-based career-readiness score (0–1000).

---

## Stack (locked)

| Layer | Choice |
|---|---|
| Language | Java 21 |
| Framework | Spring Boot 3.3.13 |
| Build | Maven + wrapper |
| DB | PostgreSQL 16 (Docker locally) |
| Cache / Lock | Redis 7 (Docker locally) |
| Schema mgmt | Flyway 10 (V-versioned migrations only; SQL is final) |
| ORM | Hibernate 6.5 / Spring Data JPA (`ddl-auto=validate`) |
| Auth | JWT (JJWT 0.12.6) + Spring Security OAuth2 Client |
| Password | BCrypt cost 14 |
| Runtime infra | Docker Compose locally; WSL2 for execution on Windows |

---

## What's built

### Task 1 — Skeleton
`OutreachApplication`, `SecurityConfig`, `CorsConfig`, `RedisConfig`, `AsyncConfig` (freePool + premiumPool), `SchedulerConfig` (ShedLock), `AiProviderConfig` stub, `ApiResponse<T>`, `GlobalExceptionHandler`, `RateLimitInterceptor`, `StartupValidator`, `HealthController`.  
14 empty feature-package stubs with `package-info.java`.  
Docker Compose for Postgres + Redis; `.env.example`; `.gitignore`.

### Task 2 — Schema + Entities
`V1__initial_schema.sql` applied by Flyway → 24 tables, 5 PostgreSQL enums, shared `set_updated_at()` trigger.  
24 JPA entities + 24 Spring Data repositories (one per table), boot-validated clean with zero Hibernate errors.

**Entity → package mapping:**
- `user` → `User`
- `auth` → `UserSession`, `EmailVerificationToken`, `PasswordResetToken`
- `profile` → `UserProfile`, `UserSkill`
- `resume` → `Resume`
- `score` → `CareerHealthScore`, `CareerHealthHistory`, `CohortStats`
- `tracker` → `Application` (soft-delete), `ApplicationTimeline`, `ApplicationOutcome`
- `tracker.inbound` → `ForwardingAddress`, `InboundEmailDraft`
- `ai` → `AiInteraction`, `AiModelPricing`
- `billing` → `Subscription`, `PaymentEvent`, `UsageQuota`
- `notification` → `Notification`
- `feedback` → `Feedback`
- `admin` → `DeviceRegistry`, `UserEvent`

### Task 3+4 — Identity layer (auth + profile)
Full auth: register/verify/login/refresh (rotation)/logout/forgot-password/reset + Google + GitHub OAuth2.  
Profile: GET/PUT, skills CRUD, GitHub sync via REST, fixed taxonomy validation.

**Auth files added (com.outreach.auth):**
`AuthService`, `AuthController`, `JwtService`, `JwtAuthFilter`, `TokenHasher`, `RateLimitService`, `EmailNotificationService`, `UserDetailsServiceImpl`, `OAuth2UserServiceImpl`, `OAuth2SuccessHandler`, `HttpCookieOAuth2AuthorizationRequestRepository`  
DTOs: `RegisterRequest`, `LoginRequest`, `TokenResponse`, `ForgotPasswordRequest`, `ResetPasswordRequest`, `VerifyEmailRequest`, `ResendVerificationRequest`

**Profile files added (com.outreach.profile):**
`ProfileService`, `ProfileController`, `GitHubSyncService`, `TargetRoleTaxonomy`  
DTOs: `ProfileResponse`, `UpdateProfileRequest`, `SkillRequest`, `SkillResponse`

**Common additions:**
`CurrentUser` (extracts UUID from SecurityContext), `common/exception/` hierarchy (AppException → BadRequest/Unauthorized/Forbidden/Conflict/TooManyRequests/NotFound).

**Config changes:**
`SecurityConfig` — wired JwtAuthFilter, OAuth2 login with cookie-based auth-request repo, BCrypt bean.  
`CorsConfig` — credentials enabled, default origin `localhost:3000` (was `*`).  
`application.yml` — added `app.jwt.*`, `app.oauth2.*`, `spring.security.oauth2.client.*`.

---

## Key conventions

| Rule | Detail |
|---|---|
| Package-by-feature | No layer packages (no `controllers/`, `services/`). Each feature owns its stack slice. |
| API envelope | Every endpoint returns `ApiResponse<T>` with `success`, `data`, `error`, `meta.timestamp`. |
| Flyway owns schema | `ddl-auto=validate`. **Never** modify `V1__initial_schema.sql`. New schema = new versioned migration. |
| Soft-delete | Only `applications` has `deleted_at`. `@SQLRestriction("deleted_at IS NULL")` on entity filters it automatically. |
| Timestamps | All `TIMESTAMPTZ` → `OffsetDateTime`. All `DATE` → `LocalDate`. |
| Timezone | Application runs UTC internally; present IST to users at the view layer only. |
| Secrets | Zero secrets in code. All via environment variables. |
| No logic in controllers | Controllers validate input, extract current user, delegate to service, return `ApiResponse`. |
| Ownership check | Every mutating profile/tracker/etc. endpoint compares `CurrentUser.getUserId()` to the resource's `user_id` in the service layer. |

---

## Decisions log

| Task | Decision | Rationale |
|---|---|---|
| T1 | Spring Boot 3.3.13 (not 3.2.x) | `flyway-database-postgresql` requires Flyway 10+; SB 3.2 ships Flyway 9. |
| T2 | Java enum constants lowercase (`local`, `pass_holder`, …) | Must match PostgreSQL enum string values exactly for `@JdbcType(PostgreSQLEnumJdbcType.class)`. |
| T2 | `@Version` on `CareerHealthScore.version` | Enables JPA optimistic locking; service layer catches `OptimisticLockingFailureException` and retries (D10). |
| T3 | `SessionCreationPolicy.IF_REQUIRED` | OAuth2 authorization code flow needs a short-lived session to store state. JWT handles all other auth; session is abandoned after token issuance. |
| T3 | Cookie-based `AuthorizationRequestRepository` | Stores OAuth2 state in an HttpOnly cookie so the API stays stateless during the OAuth2 handshake. |
| T3 | SHA-256 the JWT secret | `Keys.hmacShaKeyFor()` requires 256 bits; SHA-256-ing any secret ensures that regardless of length. |
| T3 | `EmailNotificationService` logs tokens | SMTP task not done yet. Log format is grep-friendly (`VERIFY TOKEN`, `RESET TOKEN`) for integration testing. |
| T3 | OAuth2 client-id defaults to `placeholder` | App boots without real OAuth2 credentials; OAuth2 flow fails only at runtime when a user actually clicks "Sign in with Google/GitHub". Register real IDs in `.env`. |
| T3 | `TargetRoleTaxonomy` as a static Set | Prevents cohort key fragmentation (D3). Frontend dropdowns must mirror these exact values. |
| T3 | `CorsConfig` default origin → `localhost:3000` | Changed from `*` because `allowCredentials=true` (needed for HttpOnly refresh cookie) requires non-wildcard origins (CORS spec). |
| T3 | `PasswordConfig` extracted from `SecurityConfig` | Broke cycle: `AuthService → PasswordEncoder (SecurityConfig) → OAuth2SuccessHandler → AuthService`. PasswordEncoder lives in standalone `PasswordConfig`. |
| T3 | `application.yml` duplicate `spring:` key | Appended OAuth2 block as a second top-level `spring:` — SnakeYAML throws `DuplicateKeyException`. Fixed by merging `security.oauth2` under the existing `spring:` key. |
| T3 | `SerializationUtils.deserialize()` needs explicit cast | Returns `Object`; calling site expected `OAuth2AuthorizationRequest` — fixed by making method non-generic with explicit `(OAuth2AuthorizationRequest)` cast. |
| T5 | `ScoreComponents` zero Spring deps | All scoring logic is `static` methods on a plain class — unit tests run without Spring context (37 tests in < 1 s). |
| T5 | `TransactionTemplate` for optimistic-lock retry | `@Transactional` on class prevents in-method retries (stale session); `TransactionTemplate` starts a fresh tx per attempt, re-reading `@Version`. |
| T5 | `@Lazy ScoreService` in `ProfileService` | Prevents startup cycle via shared repos. `@Lazy` defers proxy until first call. |
| T5 | GitHub redistribution: scale overall not per-component | Individual subscores stored as 0..natural-max; only `overallScore` is scaled by 1000/850, always ≤ 1000. |
| T5 | History upsert via native ON CONFLICT | `@Modifying @Query(nativeQuery=true)` + `ON CONFLICT (user_id, recorded_date) DO UPDATE` — idempotent. |
| T5 | `refresh()` uses `noRollbackFor = UnauthorizedException` | Without this, `@Transactional` rolls back the `saveAll()` that marks sessions inactive when the reuse exception is thrown — leaving old tokens exploitable. |
| T5 | `SecurityConfig` custom `AuthenticationEntryPoint` | Replaces Spring Security's default 302 redirect-to-login with a 401 JSON response for API clients. |
| T6 | Access token in module-level JS variable (not React state) | React context re-renders would race with concurrent requests; a module-level `_accessToken` is synchronously readable by `apiFetch` without subscribing to context. |
| T6 | Shared `Promise` for refresh dedup (`_refreshing`) | If two 401s fire simultaneously, both would start a refresh; the shared promise ensures only one refresh call is made and both waiters get the result. |
| T6 | Google Fonts fail in WSL (no internet) | `next/font` retries 3× then falls back silently — build still succeeds; fonts load correctly when the dev machine has internet. |
| T6 | `'use client'` on `lib/api.ts` | Marks the module as client-only so Next.js never tries to tree-shake it into server bundles (it uses `window`). Non-component files can carry this directive. |

---

### Task 5 — Career Health Score Engine

**Pure scoring layer (`com.outreach.score`):**  
`ScoreComponents` (pure static functions, no Spring), `ComponentResult` record, `ScoreService` (TransactionTemplate retry, `markStale`, `refreshWithRateLimit`), `ScoreJob` (ShedLock), `ScoreController`.  
DTOs: `CareerScoreResponse`, `BreakdownResponse`, `ComponentBreakdown`, `HistoryEntry`.  
Unit tests: `ScoreComponentsTest` (37 tests, 100% green).

**Weights (sum=1000):** resume=250, applications=200, skills=150, profile=150, github=150, cgpa=100.

**Key mechanics:**
- GitHub redistribution: `overall = raw_sum × (1000/850)` when github not connected; maxed non-GitHub user still hits 1000.
- Anti-gaming applications: "applied" bucket hard-capped at 20 pts; progression (OA→interview→offer) scores 4–20 pts each; `forwarded_email` source gets 1.3× multiplier.
- Anti-gaming skills: `self_reported` proficiency capped at 3 internally; 10 self_reported prof=5 yields 100 pts, not 150.
- Optimistic lock retry: `TransactionTemplate` (fresh tx per attempt), up to 3 retries.
- Stale flag: set in `ProfileService` on profile/skill/github-sync writes; cleared by `ScoreService` after recompute.
- Nightly jobs (IST): 02:00 = stale recalc, 02:30 = history snapshot (ON CONFLICT DO UPDATE).

**Verified scores (smoke test):**
- Empty user → 0 pts, "Getting Started"
- Seeded user (89% profile, 5 resume skills prof=4, 5 self_reported prof=5, CGPA 8.5) → 393 pts, "Building"
  - skills=115 (anti-gaming working: self_reported capped at prof 3), profile=134, cgpa=85; total raw=334 × 1.176=393
- Gamed (30 fake applied + all-5 self_reported) → 259 pts vs real progressed profile → 614 pts ✓

---

### Task 6 — Frontend Foundation + Score Dashboard

**Stack:** Next.js 14 (App Router, TypeScript), Tailwind CSS, Recharts, `next/font/google`.  
**Location:** `./frontend/` (runs independently of the Spring Boot backend).

**Fonts:** Space Grotesk (headings), Inter (body), JetBrains Mono (score numbers) — all via `next/font`.  
**Design tokens:** dark bg `#0A0B0E`, surface `#111318`, border `#2A2D36`, primary indigo `#6366F1`; band colours: amber/orange/indigo/emerald for each tier.

**Auth:** `AuthContext` stores access token in-memory only (React state, never localStorage). On mount, tries `/auth/refresh` with `credentials:'include'` to restore session from the HttpOnly cookie. Redirect to `/login` when unauthenticated.

**API client (`lib/api.ts`):** Module-level `_accessToken` variable; `apiFetch` auto-injects `Bearer` header; on 401 calls `/auth/refresh` once (deduplicated with a shared `Promise`), retries original request, or redirects to login.

**Pages:**
- `/login`, `/register`, `/verify-email` — public auth pages
- `/dashboard` — score overview: `ScoreRing` (SVG arc + count-up), `BandBadge`, sub-score `ComponentBar` grid, stale/refresh notice, low-score framing copy
- `/dashboard/breakdown` — per-component detail with reasons + next actions
- `/dashboard/history` — Recharts `LineChart` over last 90 days; accessible SR table included

**Components:**
- `ScoreRing` — SVG ring with gradient arc, cubic ease-out count-up via `useCountUp` hook
- `useCountUp` — `requestAnimationFrame` count-up, respects `prefers-reduced-motion`
- `BandBadge` — coloured pill showing band + range
- `ComponentBar` — progress bar + optional detail (reason, next action)
- `VortexLoader` / `FullPageLoader` — branded spinner placeholder
- `NavBar` — sticky top bar with active link highlighting + logout

**Verified:** `npm run build` compiles clean (11 routes). All 5 pages return HTTP 200. CORS preflight from `localhost:3000` returns `Allow-Credentials: true`. Backend `/career-score` returns real data (`overallScore: 0` for new user, band "Getting Started").

---

### Task 7 — AI Provider Layer + Resume Analyzer Backend

**AI provider layer (`com.outreach.ai.provider`):**  
`AiProvider` interface, `GeminiProvider` (Gemini Flash), `GroqProvider` (Llama 3.1-8B via Groq), `RuleBasedEngine` (never fails), `AiRouter` (Gemini → Groq → rule-based).  
`PromptSanitizer` (strips injection patterns, truncates to 8000 chars), `ResponseSchemaValidator` (Jackson-based, throws `SchemaValidationException` on mismatch — CB-ignored).  
`ProviderFailureException` (network/5xx — trips CB), `SchemaValidationException` (bad JSON — CB ignored per `ignoreExceptions` YAML config).

**AI support (`com.outreach.ai`):**  
`TokenBudgetService` (Redis daily cap per provider; key `ai:budget:{provider}:{date}`, TTL to midnight IST+1h), `AiInteractionLogger` (async on freePool, logs to `ai_interactions`, computes `cost_usd` from hardcoded pricing map).

**Storage (`com.outreach.resume.storage`):**  
`FileStorage` interface, `LocalFileStorage` (writes under `./storage`, used for dev), `R2Storage` (Cloudflare R2 via AWS S3 SDK v2, S3-compatible), `FileStorageConfig` (picks R2 when all 4 R2 env vars present, else Local).

**Resume pipeline (`com.outreach.resume`):**  
`ResumeParser` (Apache Tika 2.9.2, 30s timeout in single-thread executor, rejects < 100 chars as image-only PDF).  
`ResumeAnalysisService` (atomic quota check + increment, AI routing, result persistence, async version via `@Async("freePool")`, refund on hard failure).  
`ResumeService` (upload validates PDF + 5MB, stores file, parses, activates + deactivates prev active in same tx, triggers async analysis).  
`ResumeController` (all 6 endpoints).

**Endpoints:** `POST /resumes/upload` (multipart), `GET /resumes`, `GET /resumes/{id}`, `GET /resumes/{id}/status`, `POST /resumes/{id}/analyze`, `DELETE /resumes/{id}`.

**Quota:** Atomic `UPDATE ... WHERE used < quota_limit` (native upsert for init); 0 rows = 429. Free limit = 3. Refund on hard failure. `ensureRow` uses `ON CONFLICT DO NOTHING`.

**Resilience4j CB config (YAML):** `gemini` + `groq` instances; `ignoreExceptions: SchemaValidationException`; trip on network/5xx only.

**Privacy note:** Resume text is sent to 3rd-party AI (Gemini/Groq) when API keys are configured. A user-facing consent/privacy disclosure MUST be displayed before enabling the AI path in production.

**New env vars:** `GEMINI_API_KEY`, `GROQ_API_KEY`, `R2_ACCOUNT_ID`, `R2_ACCESS_KEY`, `R2_SECRET_KEY`, `R2_BUCKET`, `STORAGE_LOCAL_PATH`.

**Verified (no AI keys configured — rule-based path):**
- Text PDF → `status=done_basic`, `source=rule_based`, readiness/keyword/impact/formatting scores present ✓
- Non-PDF → 400 "Only PDF files are accepted" ✓
- 4th analysis on free user → 429 "Resume analysis quota reached" ✓

---

### Task 8 — Resume Analyzer UI

**Location:** `./frontend/app/(dashboard)/resume/` (uses existing dashboard layout + auth guard)

**New frontend files:**
- `app/(dashboard)/resume/page.tsx` — `/resume` list page: skeleton loading, `UploadZone` (drag-drop + click), `ResumeCard` (score, status badge, delete confirm), `PollingOverlay` (VortexLoader + rotating messages).
- `app/(dashboard)/resume/[id]/page.tsx` — `/resume/{id}` detail page: `ReadinessDisplay` (SVG ring, JetBrains Mono score), `ScoreMeter` (progress bar), keyword gap chips, numbered fix list, failed/quota/processing states.

**Updated files:**
- `lib/types.ts` — added `ResumeResponse`, `ResumeStatusResponse`, `UploadResponse`, `parseFixes()`.
- `lib/api.ts` — added `apiUpload()` (multipart, no Content-Type override, 401→refresh→retry) + `api.del()`.
- `components/NavBar.tsx` — added "Resume" link; active-state logic uses `startsWith` for nested routes.

**Key states handled:**
- `status=processing` → `PollingOverlay` with rotating messages every 3s; polls `/resumes/{id}/status` every 2.5s, max 60s.
- `status=done_basic` / `source=rule_based` → "Basic analysis" badge (honest, not hidden).
- `status=failed` (image-only PDF) → friendly explanation + how-to-fix, never shows a zero score as real.
- Backend 429 → "quota reached" card with unlock path; never crashes or shows raw error.

**Critical backend fix (T8):** `ResumeService.upload()` was calling `analysisService.analyzeAsync()` while still inside its own `@Transactional` boundary. The async thread started before the transaction committed, so it read `rawText=null` via a separate DB connection (READ COMMITTED), set `status=failed`, and then the upload tx overwrote that with `status=processing` on commit. Fixed by registering the async call via `TransactionSynchronizationManager.registerSynchronization(afterCommit → analyzeAsync(...))` so the async task only fires after commit.

**Verified:**
- Text PDF → upload → `status=processing` → polling → `status=done_basic` → results screen renders real scores ✓
- Image-only PDF → `status=failed` immediately (synchronous parse) → friendly failed state in UI ✓
- Non-PDF → 400 reject before upload ✓
- 4th analysis on free user → HTTP 429 → quota UI state, no crash ✓
- `/resume` HTTP 200, `/resume/{id}` HTTP 200 ✓

---

## Decisions log (continued)

| Task | Decision | Rationale |
|---|---|---|
| T7 | `SchemaValidationException` in Resilience4j `ignoreExceptions` | Bad JSON from AI = don't trip the CB (the provider is up, just returned garbage); but do fall back to next provider for that request. |
| T7 | `RuleBasedEngine.isEnabled()` always true | Zero-dependency fallback; AiRouter always has something to call even with zero API keys. |
| T8 | `TransactionSynchronizationManager.registerSynchronization(afterCommit)` for async analysis | Ensures the async thread sees committed `rawText`; calling `@Async` directly inside a `@Transactional` method fires before commit in a separate DB connection, causing it to read stale data. |
| T8 | Deactivate-then-activate order in `ResumeService.upload()` | Partial unique index on `(user_id) WHERE is_active=true` fires if two rows are active simultaneously; deactivating the old row before saving the new active row avoids the constraint violation. |
| T8 | `parseFixes()` helper in `types.ts` | Backend stores `ai_fixes` as JSONB, serialised as a String in `ResumeResponse`; Jackson outputs it as a JSON string literal, requiring a safe `JSON.parse` on the frontend. |
| T7 | `LocalFileStorage` vs `R2Storage` via `FileStorageConfig` factory | No `@Conditional` annotations needed; a single `@Bean` method checks env vars and returns the right impl — cleaner than `@ConditionalOnProperty`. |
| T7 | Quota `ensureRow` via native `ON CONFLICT DO NOTHING` | Avoids race condition on first analysis; atomic increment JPQL then acts on the guaranteed-existent row. |
| T7 | Tika in single-thread executor with `future.get(30, SECONDS)` | `Tika.parseToString` is blocking and not thread-safe across invocations; dedicated executor + timeout prevents hung parse from blocking the request thread. |
| T7 | One active resume: `deactivateAllExcept` + partial unique index | Both operations happen in the same `@Transactional` — the DB constraint enforces the invariant even if the app crashes mid-flight. |
| T7 | `@Async("freePool")` for analysis after upload | Returns HTTP 202 immediately; heavy Tika + AI work runs on the bounded pool. CallerRunsPolicy on freePool provides backpressure. |
| T7 | Prompt version as an int constant | Enough for now; bump the constant and redeploy to invalidate cached AI responses. |

---

### Task 9 — Application Tracker Backend

**Feature package:** `com.outreach.tracker`

**New files:**
- `Canonicalizer.java` — `canonicalize(String)`: lowercase → trim → collapse whitespace → strip legal/location suffixes (Pvt Ltd, LLC, Inc, Corp, Technologies, India, Solutions, …). Runs twice to catch compound suffixes like "Technologies India".
- `StatusMachine.java` — validates `app_status` transitions. Terminal states: `{offer_accepted, offer_declined, rejected, ghosted, withdrawn}`. Any non-terminal → anything is allowed (supports skips + corrections). Terminal → anything throws `BadRequestException`.
- `dto/CreateApplicationRequest.java`, `dto/UpdateApplicationRequest.java`, `dto/StatusUpdateRequest.java`, `dto/OutcomeRequest.java`, `dto/ApplicationResponse.java`, `dto/TimelineEntryResponse.java`, `dto/CreateApplicationResult.java`, `dto/AnalyticsResponse.java`
- `ApplicationService.java` — all business logic: dedup, create, update, status machine, timeline append, follow-up derivation, soft-delete, analytics, outcome recording.
- `ApplicationController.java` — 10 REST endpoints (all `ApiResponse<T>`, per-user ownership).

**Updated files:**
- `ApplicationRepository.java` — added `findFuzzyDuplicate` (native pg_trgm query, company similarity > 0.5 + date ±2 days), `findFollowUpsDue` (native SQL), `softDelete` (@Modifying), `findByIdAndUserId`, `findByUserIdOrderByAppliedDateDesc`, `findByIdUnfiltered`.
- `ApplicationTimelineRepository.java` — added `findByApplicationIdOrderByOccurredAtAsc`.

**Endpoints:**
`GET /applications`, `POST /applications[?force=true]`, `GET /applications/{id}`, `PUT /applications/{id}`, `PUT /applications/{id}/status`, `DELETE /applications/{id}`, `GET /applications/{id}/timeline`, `GET /applications/analytics`, `GET /applications/follow-ups`, `POST /applications/{id}/outcome`

**Verified (all 10 tests green):**
- Canonicalization: "Google India Pvt Ltd" → `google`, "Software Development Engineer" → `software development engineer` ✓
- Dedup: "Google / SDE" on 2026-06-21 flagged as `possibleDuplicate=true` against "Google India Pvt Ltd / SDE" on 2026-06-20 (pg_trgm company similarity = 1.0, date gap = 1 day) ✓
- Force-create bypasses dedup; hard UNIQUE constraint catches exact dupes with 409 ✓
- Status machine: applied → interview_scheduled → offer_received → offer_accepted (terminal) ✓
- Terminal block: offer_accepted → applied returns 400 ✓
- Append-only timeline: 3 entries (initial + 2 transitions), none overwritten ✓
- Follow-ups: `next_action_due` in past + `status=applied` → returned by `/follow-ups` ✓
- Soft-delete: `deleted_at IS NOT NULL` in DB; `deleted_at IS NULL` apps returned as 1 (not 0); timeline rows survive ✓
- Analytics: reply rate, conversion rate, stage counts computed correctly ✓
- Outcome recorded + career score snapshotted in `score_at_time` ✓

---

## Decisions log (continued)

| Task | Decision | Rationale |
|---|---|---|
| T9 | Dedup uses company similarity only (not role) in `findFuzzyDuplicate` | Role abbreviations ("SDE" vs "Software Development Engineer") have near-zero trigram similarity; company + date window is the reliable signal. |
| T9 | `findFollowUpsDue` uses native SQL instead of JPQL | Native query makes `deleted_at IS NULL` explicit and avoids potential Hibernate JPQL enum-literal translation issues. |
| T9 | `DataIntegrityViolationException` caught in `create()` → `ConflictException` (409) | Hard UNIQUE constraint on `(user_id, company_canonical, role_canonical, applied_date)` fires only on exact duplicates when `force=true`; must return 409 not 500. |
| T9 | `CreateApplicationResult` DTO with `possibleDuplicate + existingMatch` | Fits `ApiResponse<T>` cleanly; no HTTP 409 overloading needed for the fuzzy case. Client re-sends with `?force=true` to confirm. |
| T9 | `scoreService.markStale(userId)` on create/status-change/outcome | Keeps the score engine's `is_stale=true` flag accurate without expensive eager recomputation. |
| Audit | `DataIntegrityViolationException` global handler added alongside local catch | Local catch in `ApplicationService.create()` gives friendly domain message; global handler catches every other constraint violation so nothing returns a 500. |
| Audit | `contextLoads` test `@Disabled` instead of infra-mocked | Full Spring context boot requires live Postgres/Redis/env; `@Disabled` is honest and lets the 37 unit tests define the CI green bar. |
| Audit | `.env` must use LF line endings on WSL | CRLF causes bash `source` to append `\r` to values; this silently broke password auth until `sed -i 's/\r//'` was applied. Added note to `.env.example`. |

---

### Audit Fixes (Pre-Task-10) — applied 2026-06-27

All six findings fixed; `mvn test` exits green (37 passed, 1 skipped).

**P0 — GlobalExceptionHandler: `DataIntegrityViolationException` → 409**
Added `@ExceptionHandler(DataIntegrityViolationException.class)` returning HTTP 409 with a generic message. The local catch in `ApplicationService.create()` still provides a friendlier message; the global handler is the backstop for all other constraint violations.

**P0 — Surefire Mockito self-attach (Java 21 / WSL)**
Added `maven-surefire-plugin` with `argLine: -XX:+EnableDynamicAgentLoading -Djdk.attach.allowAttachSelf=true --add-opens java.base/java.lang=ALL-UNNAMED`.  
`OutreachApplicationTests.contextLoads` annotated `@Disabled` — it is a full-infra integration test (needs live Postgres + Redis + env vars); score-engine unit tests (37) all pass clean.

**P2 — V2 Flyway migration: `ai_model_pricing` seeded**
`V2__seed_ai_model_pricing.sql` inserts Gemini Flash and Groq Llama rates (with `ON CONFLICT DO NOTHING`). Verified by query after boot:
```
 gemini   | gemini-1.5-flash     | 0.000075 | 0.000300
 groq     | llama-3.1-8b-instant | 0.000050 | 0.000080
```

**P2/P3 — `ResumeAnalysisService` javadoc fixed + `QUOTA_DAYS` removed**
Fixed `@throws` javadoc to reference `TooManyRequestsException`. Removed unused `QUOTA_DAYS` constant; its one usage replaced with literal `30`.

**P2/P3 — `StartupValidator` now requires `FRONTEND_URL`**
Added `FRONTEND_URL` to the required env var list; `.env` and `.env.example` already had it.

**P2/P3 — `RateLimitInterceptor` comment improved**
Comment now explicitly says per-endpoint limiting is deferred; auth-layer lockout via `RateLimitService` is the active defence.

**Also fixed:** `.env` had Windows CRLF line endings which caused bash `source` to silently append `\r` to every value, producing "password authentication failed" errors. Converted to LF via `sed -i 's/\r//'`. Added `scripts/start-dev.sh` as the canonical way to boot locally.

---

---

### Task 10 — Notifications + Inbound Email Ingestion

**Part A — Follow-Up Reminders**

**New files (`com.outreach.auth`):**
- `EmailNotificationService.java` — REPLACED stub. Real Resend HTTP API delivery (`POST https://api.resend.com/emails`). Graceful: if `RESEND_API_KEY` blank, logs content instead (dev mode). Same 3 public methods kept for `AuthService` backwards compat + new `sendEmail(to, subject, html)` for general use.

**New files (`com.outreach.notification`):**
- `WhatsAppService.java` — interface with `send(phoneNumber, message) → boolean`
- `WhatsAppServiceStub.java` — stub, logs message, returns true. Comment notes per-endpoint limiting is deferred.
- `NotificationService.java` — channel resolution: in_app always; whatsapp if `notif_channel='whatsapp'` AND `whatsapp_number + whatsapp_opt_in_at` set, else `delivery_status='no_channel'`; default is in_app + email. All dispatches are fire-and-forget (delivery failures do not roll back the notification row).
- `NotificationController.java` — `GET /notifications`, `PUT /notifications/{id}/read`, `PUT /notifications/read-all`, `PUT /notifications/preferences {channel}`.
- `FollowUpJob.java` — daily 09:00 IST, ShedLock `follow_up_reminder`. Finds all applied apps with `next_action_due < now()` via `ApplicationRepository.findAllFollowUpsDue()`. Redis key `followup:reminded:{appId}` (TTL 7 days) prevents double-reminding within a week.
- `dto/NotificationResponse.java`, `dto/PreferencesRequest.java`

**Updated files:**
- `ApplicationRepository.java` — added `findAllFollowUpsDue(OffsetDateTime now)` (native SQL, no userId filter, for FollowUpJob).
- `SecurityConfig.java` — added `/api/v1/inbound-email/webhook` to `PUBLIC_PATHS` (webhook uses shared secret, not JWT).

**Part B — Inbound Email Ingestion**

**New files (`com.outreach.tracker.inbound`):**
- `ForwardingAddressService.java` — `getOrCreate(userId)`: returns existing or generates new `u_{token}@track.outreachos.com` (20-char base32 A–Z2–7 via `SecureRandom`, retried up to 5× on `DataIntegrityViolationException`).
- `EmailParseService.java` — tries Gemini → Groq (direct HTTP, NOT via `AiRouter`) → regex fallback. AI prompt asks for `{company, role, appliedDate, confidence}` JSON. Regex: "Role at Company" / "Role - Company" subject patterns + ISO/wordy date in body. Sanitizes input to prevent prompt injection. Source field indicates `ai/gemini`, `ai/groq`, or `regex`.
- `InboundEmailWebhookController.java` — `POST /api/v1/inbound-email/webhook` (public, no JWT). 5 guards in order: (1) INBOUND_WEBHOOK_SECRET present in config, (2) verify `X-Webhook-Secret` header, (3) resolve forwarding address → user, (4) Redis per-user rate limit 30/hr, (5) pending draft cap 20. Sanitizes + truncates all email fields. Stores raw payload as JSONB.
- `InboundEmailDraftService.java` — `listPending`, `confirm` (calls `ApplicationService.create` with `source=forwarded_email` + nulls `raw_payload` on commit), `discard` (nulls `raw_payload`).
- `InboundEmailController.java` — `GET /inbound-email/drafts`, `POST /inbound-email/drafts/{id}/confirm`, `POST /inbound-email/drafts/{id}/discard`.
- `DraftPurgeJob.java` — daily 02:30 IST, ShedLock `draft_ttl_purge`. Nulls `raw_payload` for confirmed/discarded drafts older than 14 days.
- `SettingsController.java` — `GET /settings/forwarding` (gets-or-creates forwarding address).
- `dto/ForwardingAddressResponse.java`, `dto/InboundWebhookPayload.java`, `dto/InboundDraftResponse.java`, `dto/ConfirmDraftRequest.java`

**Updated files:**
- `InboundEmailDraftRepository.java` — added `findByIdAndUserId`, `purgeRawPayload(@Param("cutoff"))` native `UPDATE ... SET raw_payload=NULL`.
- `application.yml` — added `app.resend.*`, `app.inbound.*` config keys.
- `.env` — added `INBOUND_WEBHOOK_SECRET`, `RESEND_API_KEY`.

**New env vars:** `RESEND_API_KEY` (blank = log-only mode), `INBOUND_WEBHOOK_SECRET` (required for webhook), `RESEND_FROM` (optional), `INBOUND_EMAIL_DOMAIN` (optional, default `track.outreachos.com`).

**Endpoints:**
`GET /settings/forwarding`, `POST /inbound-email/webhook`, `GET /inbound-email/drafts`, `POST /inbound-email/drafts/{id}/confirm`, `POST /inbound-email/drafts/{id}/discard`, `GET /notifications`, `PUT /notifications/{id}/read`, `PUT /notifications/read-all`, `PUT /notifications/preferences`

**Verified (all assertions green):**
- Forwarding address: `u_SL37EZZOEL2VMEMEUGXY@track.outreachos.com` — 20-char base32, correct format ✓
- Idempotent: second call returns same address ✓
- Webhook WITHOUT secret → 401 ✓
- Webhook WITH WRONG secret → 401 (before any DB write) ✓
- Webhook WITH correct secret → 200, draft created: company='Google', role='Software Engineer', confidence=0.55 (regex source) ✓
- Draft confirm → Application created: company='Google', source='forwarded_email', canonicalization applied ✓
- Confirmed draft removed from pending list ✓; `raw_payload` nulled immediately on confirm ✓
- Discard → removed from pending, `raw_payload` nulled ✓
- `notif_channel=whatsapp` without `whatsapp_number` → `delivery_status='no_channel'` (verified in code + DB) ✓
- Notification mark-read → `is_read=true` in DB ✓
- Read-all → all unread marked ✓

**Infrastructure note:** WSL has a NATIVE postgres on port 5432 that the Spring Boot app connects to. `docker exec outreach-postgres psql` queries a DIFFERENT (Docker) postgres. Always use `psql -h localhost -p 5432` within WSL for DB verification (not docker exec).

---

## Decisions log (continued)

| Task | Decision | Rationale |
|---|---|---|
| T10 | `EmailNotificationService` stays in `com.outreach.auth` (not moved to notification) | `AuthService` injects it; moving would break the injection point and require refactoring unrelated code. Addded `sendEmail` for general-purpose use by `NotificationService`. |
| T10 | `EmailParseService` bypasses `AiRouter` and calls Gemini/Groq directly | `AiRouter` returns `AiResponse` (resume-specific schema: readiness/keyword/impact/formatting scores). Email parsing needs company/role/date/confidence — forcing a round-trip through `AiRouter` would require a fake response schema. Direct calls are cleaner here. |
| T10 | `raw_payload` nulled proactively on confirm/discard | DPDP TTL job nulls after 14 days, but proactive clear on confirm/discard reduces the window in the majority of cases (most users confirm quickly). Job handles the stragglers. |
| T10 | Webhook uses shared secret (not JWT) | The inbound webhook is called by the email routing worker (server-to-server), not a user browser. JWT is for user-facing APIs. A shared secret in `X-Webhook-Secret` is the standard pattern for webhook auth. |
| T10 | Forwarding address uses base32 (A–Z2–7) not base64 | Base64 includes `+`, `/`, `=` which are invalid in email local-parts. Base32 is URL-safe and email-safe. |
| T10 | Redis `followup:reminded:{appId}` TTL 7 days (not per-user) | The same app can accrue multiple follow-ups; the Redis key is per-app not per-user-app so the dedup window is simpler and more reliable. |
| T11 | Status badge colours map to journey bands (amber/orange/indigo/emerald), not error red | Task spec: statuses are stages, not failures. Terminal states use muted grey. |
| T11 | Optimistic timeline append on status change, replaced by server response | Feels instant; server response replaces optimistic entry with real IDs/timestamps. |
| T11 | Draft confirm inline on `/tracker` list, not a separate page | Reduces friction — user sees drafts in context of their tracker without navigation. |
| T11 | No shadcn component install — custom Tailwind matching Task 6 patterns | Existing frontend has no `components/ui/`; radix/cva deps present but unused. Consistency over new dependency. |
| T11 | Timeline rendered newest-first in UI | Backend returns oldest-first; UI reverses for scanability (latest progress at top). |

---

### Task 11 — Application Tracker UI

**Location:** `./frontend/app/(dashboard)/tracker/`, `./frontend/app/(dashboard)/settings/`

**New files:**
- `lib/tracker.ts` — status metadata (journey colours), formatters, constants
- `components/tracker/StatusBadge.tsx`, `ApplicationSkeleton.tsx`, `ApplicationRow.tsx`, `DraftCard.tsx`, `TrackerStates.tsx`
- `app/(dashboard)/tracker/page.tsx` — list + status filter + follow-ups banner + drafts section
- `app/(dashboard)/tracker/add/page.tsx` — manual add + duplicate prompt (`possibleDuplicate`)
- `app/(dashboard)/tracker/[id]/page.tsx` — detail, optimistic status change, timeline, edit, delete, outcome
- `app/(dashboard)/settings/page.tsx` — forwarding address with copy button

**Updated:** `lib/types.ts` (tracker DTOs), `lib/api.ts` (query params on get/post), `NavBar.tsx` (Tracker + Settings links)

**Verified (`verify-t11.sh` — 13/13 green, `npm run build` clean):**
- Add app → list ✓ | Fuzzy duplicate prompt data ✓ | Status → timeline append ✓
- Follow-ups ✓ | Draft confirm → application ✓ | Soft-delete ✓
- `/tracker`, `/tracker/add`, `/settings` → HTTP 200 ✓

---

### Task 12+13 — Billing (Razorpay) + Pricing UI

**Backend (`com.outreach.billing`):**
- `PlanConfig` — INR pricing + quota limits by `plan_tier` (free=3, pass_holder=20, premium=100 resume analyses)
- `RazorpayConfig` — env keys; sandbox mode when key-id/secret blank (logs warning, never crashes boot)
- `RazorpayClient` — Orders (Season Pass) + Subscriptions (monthly/annual); mock IDs in sandbox
- `RazorpaySignatureVerifier` — HMAC-SHA256 on raw webhook body
- `QuotaService` — lazy reset via `resets_at` (D14); plan-aware limits; `@Lazy` breaks cycle with `SubscriptionService`
- `SubscriptionService` — checkout, lazy expiry (D13), webhook activation (insert `payment_events` FIRST then activate)
- `RazorpayWebhookController` — `POST /webhooks/razorpay` (public, signature before any DB write)
- `SubscriptionController` — `POST /subscription/checkout`, `GET /subscription`, `GET /subscription/usage`, `GET /subscription/pricing`
- `SubscriptionExpiryJob` — optional daily sweep for reporting only

**Frontend:**
- `/pricing` — 3 tiers, middle highlighted "Most Popular", charm pricing from API
- `/settings/billing` — plan, status, usage bars
- `UpgradePrompt` — blurred locked preview on quota 429 (resume detail page)
- `lib/razorpay.ts` — Razorpay Checkout.js loader

**Verified (`verify-t12.sh` — 10/10 when frontend on 3001):**
- Invalid webhook signature → 401 ✓
- Valid webhook → `pass_holder` activated + `payment_events` row ✓
- Duplicate webhook → idempotent (1 event row, no double activation) ✓
- Lazy expiry (`period_end` past) → `expired=true`, demoted to `free` ✓
- 4th resume analysis → HTTP 429 ✓
- `npm run build` — `/pricing`, `/settings/billing` routes ✓

**NOTE (pre-launch, not code):** Razorpay KYC + legal collection entity must be resolved before taking REAL money. Validate willingness-to-pay first with a UPI/Payment-Page link for the first cohort.

| Task | Decision | Rationale |
|---|---|---|
| T12 | `payment_events` INSERT before activation in same TX | D15: unique `provider_event_id` aborts duplicate webhooks before second activation. |
| T12 | Lazy expiry on every `GET /subscription` access | D13: pass past `period_end` is expired immediately; daily sweep is reporting-only. |
| T12 | `@Lazy` on `QuotaService` ↔ `SubscriptionService` | Breaks constructor cycle without extracting a third bean. |
| T12 | Sandbox mode when Razorpay keys absent | Local dev works without payment credentials; clearly logged at boot. |

---

### Task 14+15 — Cohort insight + Share card + Weekly digest

**Backend (`com.outreach.score` + `com.outreach.common.DevJobController`):**
- `CohortKeyValidator` — canonical `role|year` from `TargetRoleTaxonomy` only (D3)
- `CohortPercentileCalculator` — histogram buckets + exact percentile → "Top X%" band
- `CohortService` — `GET /career-score/cohort` with min-size guard (≥20); nightly recompute
- `CohortStatsJob` — daily 02:30 IST, `@SchedulerLock`
- `ShareCardService` — Java2D PNG (score + progress variants); only requesting user's data
- `WeeklyDigestService` + `WeeklyDigestJob` — Monday 07:00 IST; batches of 50, pages ALL eligible users
- `DevJobController` — secret-gated job triggers for verification (`POST /dev/jobs/*`)

**Endpoints:**
- `GET /api/v1/career-score/cohort` → `{available, band, cohortSize, percentile}` | `{available:false}`
- `GET /api/v1/career-score/share-card?variant=score|progress` → `image/png`

**Verified (`verify-t14-15.sh` — 12/12 green):**
- Cohort ≥20 → band + percentile ✓ | Cohort <20 → `{available:false}` ✓
- Share card PNG score + progress (~29–34 KB) ✓
- Digest 120 users → 4 batches, 60 sent / 60 skipped ✓

| Task | Decision | Rationale |
|---|---|---|
| T14 | Percentile from `score_histogram` not just p25–p90 | D2: exact band for any score; histogram stored in `cohort_stats`. |
| T14 | `{available:false}` below cohort_size 20 | UI falls back to score `next_action` — never a dead screen. |
| T14 | Share card via Java2D (not HTML→PNG lib) | Zero new deps; branded tokens; auth-gated per user. |
| T15 | Digest skips when nothing to report | No generic empty emails; score change / follow-ups / insight / band change. |
| T15 | Batch size 50 with `Page` loop until exhausted | "Batched ≤50" = page size, not recipient cap. |

---

### Task 16+17 — In-app feedback + Admin dashboard + PWA + Responsive pass

**Backend (`com.outreach.feedback`, `com.outreach.admin`):**
- `POST /api/v1/feedback` — `{message, screen, type}` stored with user + timestamp
- `GET /api/v1/admin/stats` — aiCostToday, activeUsersToday, revenueThisMonthInr, failedJobs, systemStatus
- `GET /api/v1/admin/feedback` — paginated inbox
- `POST /api/v1/admin/users/{id}/suspend` — sets `is_suspended`
- `AdminAuthService` — PLATFORM_ADMIN gate via `users.plan_tier = admin`
- `FailedJobTracker` + `ScheduledJobRunner` — Redis counter wired into all 7 `@Scheduled` jobs
- JWT + `TokenResponse` include `role` claim (`PLATFORM_ADMIN` | `USER`)

**Frontend:**
- `FeedbackFab` — persistent floating control on all dashboard screens (auto-captures route)
- `/admin` — stats cards + feedback inbox + suspend action (admin-only)
- PWA: `public/manifest.json`, `public/sw.js`, maskable icons 192/512, `PwaRegister`
- Responsive: safe-area insets, 44px touch targets, mobile nav scroll, `prefers-reduced-motion`

**Verified (`verify-t16-17.sh` — 11/11 green):**
- Feedback → admin inbox ✓ | Non-admin `/admin/stats` → 403 ✓ | Admin sees 5 stats ✓
- manifest `standalone` + sw.js 200 ✓ | Frontend build with `/admin` ✓

| Task | Decision | Rationale |
|---|---|---|
| T16 | PLATFORM_ADMIN = `plan_tier admin` | Schema has no separate role column; admin tier is the platform operator. |
| T16 | Failed jobs via Redis INCR | Simple counter surfaced in stats; `ScheduledJobRunner` wraps all jobs. |
| T17 | SW caches shell/static only | Network-first for navigations; API never cached (fresh data). |
| T17 | Java2D-style icons as PNG placeholders | Maskable 192/512 in `public/icons/` — swap assets without code changes. |

---

## Fix sprint (P0/P1 audit — Jun 2026)

### Canonical dev ports
| Service | Port | Start command |
|---|---|---|
| Backend | **8080** | `bash scripts/start-dev.sh` (sources `.env`, kills stale JVM on 8080, `SPRING_PROFILES_ACTIVE=dev`) |
| Frontend | **3000** | `cd frontend && npm run dev` (dev) or `npm run clean && npm run build && npm run start` (prod preview) |

**Frontend 500 root cause:** duplicate `next.config.ts` + `next.config.mjs` conflict, plus corrupted `.next` cache on OneDrive/WSL when mixing `next dev` with stale production build artifacts (`vendor-chunks/*` missing → 500). **Fix:** deleted `next.config.ts`, kept `next.config.mjs`; added `npm run clean`; always rebuild before `next start`.

### Application status terminal states (FR-4.3)
**Terminal (no further transitions):** `offer_accepted`, `offer_declined`, `rejected`, `ghosted`, `withdrawn`  
**Non-terminal:** `offer_received` — user may still transition to `offer_accepted` / `offer_declined` / `rejected`  
See `StatusMachine.java` TERMINAL set; `verify-t9.sh` TEST 6–7 aligned.

### P0 fixes applied
1. **Single backend** — `scripts/start-dev.sh`: sources `.env`, `fuser`/`lsof` kills stale port, one JVM on 8080
2. **Frontend 500** — removed duplicate Next config; `npm run clean` script
3. **Redis graceful degradation** — `RateLimitService`, `TokenBudgetService` try/catch fail-open; `FailedJobTracker` already safe
4. **Dev endpoints** — `@Profile("dev")` on `DevJobController`; removed `/api/v1/dev/**` from prod `PUBLIC_PATHS`; `DevSecurityConfig` permits dev routes only in dev profile
5. **Register enumeration** — always `success:true`; existing email → silent `sendExistingAccountEmail` + reset token

### P1 fixes applied
6. **OutreachApplicationTests** — re-enabled; `@ActiveProfiles("test")` + `@DynamicPropertySource` (local docker-compose Postgres/Redis); `StartupValidator` excluded in test profile
7. **Security headers** — HSTS + CSP + X-Frame-Options DENY + nosniff via `SecurityConfig`
8. **CORS** — `CORS_ALLOWED_ORIGINS` comma-separated env (`application.yml` + `CorsConfig`)
9. **Refresh cookie** — `app.cookie.secure` / `COOKIE_SECURE` (false dev, true in `application-prod.yml`)
10. **Image-PDF** — `ResumeParser` word-count, alpha-ratio, chars/page heuristics beyond 100-char threshold
11. **Status machine** — `offer_received` non-terminal; verify-t9 updated
12. **ScoreJob IST** — crons `0 0 2` and `0 30 2` with `zone = Asia/Kolkata`

### Verification snapshot (fix sprint)
```
mvn test → Tests run: 51, Failures: 0, Errors: 0, Skipped: 0 (OutreachApplicationTests RUNNING)
npm run build → 18 routes, clean

Security headers (8090): CSP + HSTS + X-Frame-Options + nosniff ✓
Register existing vs new → both {"success":true,...} ✓
Dev /api/v1/dev/** under dev profile → 403 without secret ✓
/login + /pricing → HTTP 200 after clean build (port 3002 verified; kill stale :3000 if EADDRINUSE)
```

### P2 deferred (intentional — do not touch)
WhatsAppServiceStub, OAuth placeholder IDs, share-card branding, separate RBAC column.

---

## Production hardening (Jun 2026 — pre-cloud deploy)

Target: hundreds concurrent users, graceful growth toward thousands — not infinite scale.

### Section 1 — Database & queries
- **V3** `V3__performance_indexes.sql` — hot-path indexes (apps soft-delete, applied_date, notifications created_at, outcomes, stale scores)
- **V4** `V4__remaining_indexes.sql` — `usage_quotas(user_id, metric)`, `forwarding_addresses(address)`
- **Pagination** — all list endpoints default page=0 size=20 max=100 (`PageParams.java`); applications, timeline, follow-ups, notifications, score history
- **N+1 fixes** — `@EntityGraph` on application list; JOIN FETCH outcomes + stale scores; analytics via DB aggregation (`ApplicationRepository` count/group queries)
- **HikariCP** — pool 10 dev / 8 prod (`HIKARI_MAX_POOL`); use Supabase **transaction-mode pooler URL** in prod (`DATABASE_URL`); max-lifetime 30m

### Section 2 — Resilience
- **GlobalExceptionHandler** — circuit-open, timeout, constraint, prod-safe catch-all (no stack traces)
- **ScheduledJobRunner** — catches job failures, increments `FailedJobTracker`, never kills scheduler thread
- **External calls** — Gemini/Groq via Resilience4j CB + timeouts in `application.yml`; Resend/Razorpay/R2/HttpClient have connect timeouts + graceful fallbacks

### Section 3 — Rate limiting
- **ApiRateLimitService** + **RateLimitInterceptor** — Redis sliding window per user/IP + path; fail-open reads, strict in-memory fallback for auth/AI/payment/upload when Redis down
- Login lockout + quota atomic decrement unchanged from P0

### Section 4 — Caching & performance
- **gzip** — `server.compression.enabled` in `application.yml`
- **Score cache invalidation** — Redis key `cache:score:{userId}` deleted on markStale/compute
- **Frontend** — `pageContent()` helper for paginated API; code-split routes via Next.js app router

### Section 5 — Security (recheck)
- HSTS + CSP + nosniff + frame DENY + Referrer-Policy (`SecurityConfig`)
- CORS from `CORS_ALLOWED_ORIGINS`; refresh cookie Secure in prod; dev endpoints `@Profile("dev")`
- `StartupValidator` fails fast on missing prod secrets

### Section 6 — Observability
- **RequestCorrelationFilter** — `X-Request-Id` + MDC `requestId`
- **Actuator** — `/actuator/health` public (liveness/readiness probes); rest locked
- **Sentry** — backend via `sentry-spring-boot-starter-jakarta`; set `SENTRY_DSN` in prod (no-op if unset). Frontend: set `NEXT_PUBLIC_SENTRY_DSN` + add `@sentry/nextjs` on deploy

### Section 7 — PWA / all-device
- manifest standalone + maskable 192/512 icons; `sw.js` offline shell
- **PwaInstallHint** — native install prompt (Android/desktop) + iOS Share hint; safe-area + 44px touch targets
- Resume link → works in any browser; Add to Home Screen for app icon

### Verification (hardening)
```
mvn test → 51 tests, 0 failures
npm run build → clean
V3/V4 migrations apply on boot
List endpoints return Page { content, totalElements, ... }
```

---

## Live URLs (pre-launch)

| Service | URL |
|---|---|
| Backend (Render) | `https://outreach-u35s.onrender.com` |
| Frontend (Vercel) | `https://outreach-iota-ruddy.vercel.app` |
| Backend health | `https://outreach-u35s.onrender.com/actuator/health` |

**Status as of Jul 2, 2026:** Frontend confirmed live (`/` → 307 self-redirect is normal Next.js root-page behavior, `/login` → 200). Backend health check is timing out with zero response (not a normal "still building" pattern) — most likely `StartupValidator` crash-looping on missing `RAZORPAY_KEY_ID`/`RAZORPAY_KEY_SECRET` (left blank pending real Test Mode keys). **Also still pending:** update Render's `FRONTEND_URL` + `CORS_ALLOWED_ORIGINS` from `localhost:3000` to the real Vercel URL above — login will fail via CORS until this is done.

### UptimeRobot setup (do this once backend is confirmed live)
1. Go to **uptimerobot.com** → sign up (free) → **Add New Monitor**
2. Monitor Type: **HTTP(s)**
3. Friendly Name: `Outreach Backend`
4. URL: `https://outreach-u35s.onrender.com/actuator/health`
5. Monitoring Interval: **5 minutes**
6. Save
7. This keeps Render's free instance warm (pings every 5 min prevent the 15-min idle spin-down + ~10-30s cold-start delay for real users).

---

## Deployment (Render + Vercel) — Jul 2026

**Architecture:** Backend = Docker container on Render (built from repo `Dockerfile`). Frontend = Vercel (native Next.js build, `frontend/` as project root). Both auto-deploy on push to `main` via GitHub Actions triggering a Render deploy hook / Vercel CLI deploy respectively.

**New files:**
- `Dockerfile` — multi-stage: `eclipse-temurin:21-jdk` build stage (Maven wrapper, cached `dependency:go-offline` layer) → `eclipse-temurin:21-jre-alpine` runtime stage, non-root `spring` user, `ENTRYPOINT` reads `$PORT` (Render injects it) and also passes `-Dserver.port=${PORT:-8080}` explicitly.
- `.dockerignore` — excludes `frontend/`, `target/`, `.git/`, `.env*` from the build context.
- `render.yaml` — Blueprint spec: Docker web service, `healthCheckPath: /actuator/health`, `SPRING_PROFILES_ACTIVE=prod` / `COOKIE_SECURE=true` / `REDIS_SSL=true` hardcoded (not secrets), every real secret marked `sync: false` (Render forces manual dashboard entry, never stored in git).
- `.github/workflows/deploy-backend.yml` — on push to `main` (path-filtered to backend files) → `curl` the `RENDER_DEPLOY_HOOK_URL` secret. Render itself builds the Docker image from the Dockerfile; the Action does not build/push an image.
- `.github/workflows/deploy-frontend.yml` — on push to `main` (path-filtered to `frontend/**`) → official Vercel CLI flow (`vercel pull` → `vercel build --prod` → `vercel deploy --prebuilt --prod`) using `VERCEL_TOKEN` / `VERCEL_ORG_ID` / `VERCEL_PROJECT_ID` secrets.

**Non-obvious choices:**
- Render deploy hook (not a GHA Docker build+push) — Render already builds from the connected repo/Dockerfile on every hook call, so building a second image in CI would be redundant work and require a registry we don't otherwise need.
- Vercel CLI (`vercel pull/build/deploy`) instead of a marketplace GitHub Action — CLI is Vercel's own officially documented method, is auditable inline in the workflow file, and needs no third-party action trust.
- `eclipse-temurin:21-jdk` (Debian, not Alpine) for the **build** stage only — the Maven wrapper script (`mvnw`) relies on shell features that are unreliable on Alpine's `ash`; the **runtime** stage still uses `-jre-alpine` since it only needs `sh -c` for `$PORT` substitution.
- `render.yaml` hardcodes only genuinely non-secret flags (`SPRING_PROFILES_ACTIVE`, `COOKIE_SECURE`, `REDIS_SSL`); every credential is `sync: false` so Render's dashboard is the sole place secrets are ever typed.

**Pre-deploy checklist (verified Jul 2026):**
```
mvn clean package -DskipTests → BUILD SUCCESS (outreach-0.0.1-SNAPSHOT.jar)
npm run build (frontend)      → Compiled successfully, 17 routes, 0 type errors
grep for hardcoded secrets in src/ and frontend source → none found
.env excluded via .gitignore (root) and frontend/.gitignore → confirmed
```

**⚠ Blocker before setting `SPRING_PROFILES_ACTIVE=prod` on Render:** `StartupValidator` requires non-blank `RAZORPAY_KEY_ID` + `RAZORPAY_KEY_SECRET` in prod (not just the webhook secret already in `.env`). Without them the container will crash-loop on boot. Get **Test Mode** keys (instant, no KYC) from `dashboard.razorpay.com/app/keys` — this keeps Razorpay in its real test-mode API (not the app's local mock-ID sandbox) which is exactly the "validate willingness-to-pay before KYC" path already noted in the T12+13 section above.

**UptimeRobot (keep Render free tier warm):**
Render's free web services spin down after 15 minutes idle and cold-start on the next request (10–30s delay). After the backend is live:
1. Go to `uptimerobot.com` → sign up free → **Add New Monitor**.
2. Monitor type: `HTTP(s)`. URL: `https://YOUR-BACKEND.onrender.com/actuator/health`. Interval: 5 minutes.
3. Save. UptimeRobot's ping every 5 min keeps the instance warm and prevents cold starts for real users.

## Outstanding / next tasks

- **Cloud deploy** — Supabase + Upstash + R2 + Resend + Gemini/Groq + Razorpay → Render + Vercel (live resume URL). Files/config ready; awaiting user to create the Render + Vercel services and paste env vars (see deploy checklist delivered in chat).
