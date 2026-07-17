# Unattended operations

This is the closest practical automation for a public Outreach deployment on the
current stack (GitHub Actions + Render + Vercel + Supabase + Upstash + R2).

It is **not** zero-intervention forever. Hosting accounts, payment methods,
provider outages, and major platform changes still require a human owner.

## What runs automatically

| Automation | Cadence | What it does |
|---|---|---|
| CI (`ci.yml`) | every push/PR | Backend tests against Postgres/Redis, frontend lint/build, production npm audit gate |
| Deploy backend/frontend | after green CI on `main` | Path-filtered deploy, then post-deploy verification |
| Production Watch | hourly | Deep smoke test; opens/closes a GitHub issue on failure/recovery |
| Security | push/PR + weekly | Dependency review, CodeQL, production npm audit, container scan |
| Dependabot | weekly | Opens dependency PRs; patch updates auto-merge after required checks |
| Encrypted DB backup | daily (when secrets set) | `pg_dump`, restore proof, age encryption, R2 upload, 35-day retention |
| App jobs | nightly/daily | Score refresh, cohort stats, follow-ups, digest, draft purge, subscription expiry |
| Runtime resilience | continuous | AI circuit breakers, Redis fail-open, graceful shutdown, readiness probes |

## Required GitHub secrets (beyond deploy secrets)

### Already required for deploy
- `RENDER_DEPLOY_HOOK_URL`
- `VERCEL_TOKEN`
- `VERCEL_ORG_ID`
- `VERCEL_PROJECT_ID`

### Required to enable encrypted backups
- `DATABASE_BACKUP_URL` — Supabase **direct** Postgres URL (not the transaction pooler)
- `BACKUP_AGE_RECIPIENT` — `age` public key used to encrypt dumps
- `BACKUP_R2_ACCOUNT_ID`
- `BACKUP_R2_ACCESS_KEY_ID`
- `BACKUP_R2_SECRET_ACCESS_KEY`
- `BACKUP_R2_BUCKET` — dedicated backup bucket (prefer separate from resume PDFs)

Until those backup secrets exist, the backup workflow exits with a warning and
does not fail the repository. Production still depends on Supabase dashboard
backups as the baseline.

## Required branch protection on `main`

In GitHub → Settings → Branches → Protect `main`:

1. Require a pull request before merging (or keep Dependabot-only auto-merge).
2. Require status checks to pass:
   - `backend`
   - `frontend`
   - `Security / production-dependencies`
3. Restrict force pushes and deletions.
4. Prefer “Do not allow bypassing the above settings”.

Without these, Dependabot auto-merge and CI-gated deploys are weaker than intended.

## External monitors the owner should keep alive

These cannot be fully replaced by in-repo automation:

1. **UptimeRobot** (or equivalent) every 5 minutes on
   `https://outreach-u35s.onrender.com/actuator/health/readiness`
2. Provider billing alerts for Render, Vercel, Supabase, Upstash, Cloudflare R2,
   Resend, Gemini/Groq, Razorpay, GitHub
3. Optional Sentry DSNs (`SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN`) for crash triage

## Owner-only responsibilities (cannot be automated away)

- Keep payment methods valid on every paid/free-tier vendor account
- Rotate leaked or expired credentials
- Approve Dependabot minor/major upgrades when CI alone is not enough
- Perform Razorpay KYC before taking real money
- Upgrade hosting plans when free-tier limits become the bottleneck
- Respond to Security/CodeQL findings that need product decisions
- Restore from backup after a destructive data incident
- Re-verify DNS/domain/email sender configuration after domain changes

## Safe recovery model

The system is designed to:

- refuse bad deploys (CI gate)
- verify the intended revision is live after deploy
- degrade instead of hard-fail when Redis/AI providers blip
- open an incident issue when production smoke fails
- close that issue when smoke recovers
- keep encrypted restore-tested database dumps when backup secrets are configured

It is **not** designed to rewrite production code by itself. Unrestricted
self-modifying production code is more dangerous than helpful.
