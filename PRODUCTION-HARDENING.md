# Production Hardening (Priorities 1–10, excluding UI/UX)

This document tracks engineering hardening applied to Outreach beyond the initial launch.

## Priority 1 — Production-grade features

| Area | Status | Notes |
|------|--------|-------|
| Machine-readable error codes | Done | `ApiErrorCode` enum; `errorCode` on all API errors |
| Input validation | Partial | Jakarta validation on DTOs; PDF magic-byte check |
| Idempotency | Partial | Razorpay webhooks; resume upload dedup by hash |
| Pagination | Done | `GET /resumes`, `GET /inbound-email/drafts` |
| External timeouts | Done | R2 (30s/15s), GitHub API (10s/15s), Redis (5s) |
| Audit logging | Done | `AuditEventService` → `user_events` (login, suspend, upload) |
| Metrics | Done | Micrometer + `/actuator/prometheus` (auth required) |

## Priority 2 — Security

| Area | Status | Notes |
|------|--------|-------|
| Suspended users blocked on JWT | Done | `JwtAuthFilter` returns 403 `ACCOUNT_SUSPENDED` |
| Swagger blocked in prod | Done | `SecurityConfig` |
| Security headers | Done | CSP, HSTS, Permissions-Policy |
| PDF upload validation | Done | `%PDF` magic bytes |
| Secrets in logs | Review | Pre-commit hook blocks `.env`; avoid logging tokens |
| Rate limiting | Existing | Redis-backed on auth endpoints |
| Dependabot | Done | `.github/dependabot.yml` |

## Priority 3 — Database

| Area | Status | Notes |
|------|--------|-------|
| Subscription expiry index | Done | `V5__subscription_expiry_index.sql` |
| N+1 review | Pending | Manual EXPLAIN pass per hot query |
| Backup/restore runbook | See | `docs/runbooks/backup-restore.md` |

## Priority 4 — Observability

| Area | Status | Notes |
|------|--------|-------|
| Structured JSON logs | Done | `logback-spring.xml` with MDC `requestId`, `userId` |
| Request correlation | Done | `RequestIdFilter` → MDC |
| Prometheus metrics | Done | `micrometer-registry-prometheus` |
| Distributed tracing | Not started | Consider OpenTelemetry later |
| Dashboards/alerts | Not started | Wire Render + external Grafana/Datadog |

## Priority 5 — Testing

| Area | Status | Notes |
|------|--------|-------|
| Unit tests in CI | Done | Named test suite in `ci.yml` |
| Integration tests | Partial | Full context test excluded (needs full env) |
| E2E / load / security tests | Not started | Roadmap |

## Priority 7 — AI quality

| Area | Status | Notes |
|------|--------|-------|
| Prompt versioning | Not started | Store prompts in repo with version tags |
| Structured output validation | Partial | Resume parser JSON schema |
| Cost/latency tracking | Not started | |

## Priority 8 — Documentation

| Doc | Path |
|-----|------|
| Architecture / ops | `README.md`, `AGENTS.md`, `brain.md` |
| Contributor guide | `CONTRIBUTING.md` |
| Runbooks | `docs/runbooks/` |
| ADRs | `docs/adr/` |

## Priority 9 — CI/CD

| Gate | Status |
|------|--------|
| Backend build | Done |
| Backend unit tests | Done |
| Frontend lint + build | Done |
| npm audit (high+) | Done (non-blocking) |
| Dependabot | Done |
| JaCoCo coverage gate | Not started |
| Migration verify on PR | Not started |

## Priority 10 — Final audit

Run before declaring "finished":

```bash
./scripts/verify-build.sh
grep -r TODO src/ frontend/ --include='*.java' --include='*.ts' --include='*.tsx'
```

## Deferred

- **Priority 6 (UI/UX polish)** — user will redesign with Claude separately.

## Production audit (Jul 2, 2026)

| Check | Status |
|-------|--------|
| `smoke-prod.sh` (6 checks) | PASS |
| `EMAIL_NOT_VERIFIED` on login | PASS (live) |
| Register latency | ~2.5–3s warm (was 9–15s) |
| One-click email verify (`GET /auth/verify-email`) | Deployed in `email-fix-v3` |
| Debug instrumentation | Removed in final cleanup |
| `RESEND_API_KEY` on Render | **You must confirm** — emails fail silently without it |

**Honest score: ~9/10 engineering** for free-tier MVP. Not claiming 10/10 until: Render paid tier or accept cold starts, full E2E suite, Resend verified domain, UI/UX redesign.
