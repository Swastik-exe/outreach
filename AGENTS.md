# AGENTS.md — Outreach automation guide

This file tells Cursor agents how to work in this repo safely and automatically.

## Live URLs

| Service | URL |
|---|---|
| Frontend (share this) | https://outreach-iota-ruddy.vercel.app |
| Backend API | https://outreach-u35s.onrender.com/api/v1 |
| Backend health | https://outreach-u35s.onrender.com/actuator/health/readiness |

## Repo layout

- **Backend:** Spring Boot (Java 21), Maven, root `Dockerfile`, `render.yaml`
- **Frontend:** Next.js 14 in `frontend/`
- **Secrets:** root `.env` (backend), `frontend/.env.local` (frontend) — **never commit**
- **Docs:** `brain.md` (architecture), `LAUNCH-CHECKLIST.md`, `DEPLOY-CHECKLIST.md`

## Git workflow

```bash
# One-time local setup (hooks + sanity checks)
bash scripts/setup-git.sh

# Before pushing substantive changes
bash scripts/verify-build.sh
```

**Remote:** `git@github.com:Swastik-exe/outreach.git` — branch `main`

**Committing from Cursor on Windows:** PowerShell may break `git commit` with trailer injection. Use a wrapper script:

```bash
bash -c 'cd /mnt/c/Users/swast/OneDrive/Desktop/OUTREACH && git add <files> && git commit -F .commit-msg.tmp'
```

**Never commit:** `.env`, `frontend/.env.local`, `/storage/` uploads, temp helper files (`.commit-msg*.txt`, `.do-commit*.sh`)

**Pre-commit hook** blocks `.env` files and common secret patterns automatically.

## CI/CD (automatic on push to `main`)

| Workflow | Triggers on | Action |
|---|---|---|
| `.github/workflows/ci.yml` | all pushes + PRs | full Maven tests + frontend lint/build + production npm audit |
| `.github/workflows/deploy-backend.yml` | CI success + backend paths | Render deploy hook + live revision/readiness verification |
| `.github/workflows/deploy-frontend.yml` | CI success + frontend paths | Vercel CLI deploy + production route verification |
| `.github/workflows/production-watch.yml` | hourly | deep smoke tests; opens/closes incident issue |
| `.github/workflows/security.yml` | push/PR + weekly | CodeQL, dependency review, container scan |
| `.github/workflows/database-backup.yml` | daily when secrets set | encrypted restore-tested Postgres dump to R2 |
| `.github/workflows/dependabot-automerge.yml` | Dependabot PRs | auto-merge patch updates after required checks |

See `docs/runbooks/unattended-operations.md` for the long-running operations model.

**Deploy order for env changes:** Render env vars first → then Vercel `NEXT_PUBLIC_API_URL` if backend URL changed.

### Required GitHub secrets (Settings → Secrets → Actions)

| Secret | Used by |
|---|---|
| `RENDER_DEPLOY_HOOK_URL` | deploy-backend |
| `VERCEL_TOKEN` | deploy-frontend |
| `VERCEL_ORG_ID` | deploy-frontend |
| `VERCEL_PROJECT_ID` | deploy-frontend |
| `DATABASE_BACKUP_URL` | encrypted nightly backups (optional until set) |
| `BACKUP_AGE_RECIPIENT` | encrypted nightly backups |
| `BACKUP_R2_ACCOUNT_ID` | encrypted nightly backups |
| `BACKUP_R2_ACCESS_KEY_ID` | encrypted nightly backups |
| `BACKUP_R2_SECRET_ACCESS_KEY` | encrypted nightly backups |
| `BACKUP_R2_BUCKET` | encrypted nightly backups |

## Environment variables

- **Local dev:** `SPRING_PROFILES_ACTIVE=dev`, `COOKIE_SECURE=false`, `FRONTEND_URL=http://localhost:3000`, `CORS_ALLOWED_ORIGINS=http://localhost:3000`
- **Render dashboard:** all prod secrets + `FRONTEND_URL=https://outreach-iota-ruddy.vercel.app`
- **Vercel dashboard:** `NEXT_PUBLIC_API_URL=https://outreach-u35s.onrender.com/api/v1`

See `.env.example` and `frontend/.env.example` for full lists.

## Testing

```bash
# Full build check
bash scripts/verify-build.sh

# Live backend smoke (requires curl + bash)
BASE=https://outreach-u35s.onrender.com/api/v1 bash scripts/verify-t9.sh

# Health
curl https://outreach-u35s.onrender.com/actuator/health/readiness
```

## UI/UX changes

**Stage 2 (Claude design restyle) is live on `main`** — tokens, SideNav/TabBar shell, and screen visuals match `design-reference/`.

- Keep visual changes aligned with design-reference hex/spacing; do not reintroduce indigo/`#0A0B0E`
- Prefer semantic tokens (`bg-bg`, `bg-card`, `border-border`, `text-primary`, `font-space`)
- Avoid `backdrop-blur` on sticky/fixed chrome (scroll jank on mobile)
- When redesigning further: match design HTML inline styles exactly; visual layer only unless asked

## Agent defaults

1. Read `brain.md` before large changes
2. Minimize scope — smallest correct diff
3. Match existing patterns in the file you're editing
4. Run `bash scripts/verify-build.sh` before commit when touching backend or frontend
5. Only commit when user asks (or when they explicitly request automation setup/deploy)
6. Push to `main` only when user confirms deploy intent
7. Use `bash -c '...'` for git/shell on Windows (PowerShell lacks `grep`, `npm` may not be on PATH)

## Common pitfalls

- **`.gitignore` `storage/`** must stay **`/storage/`** (leading slash) — unanchored pattern excludes Java package `src/main/java/com/outreach/resume/storage/`
- **Render cold starts:** free tier spins down ~15 min idle; API may return HTML/gateway errors → `lib/api.ts` catches these and shows friendly errors
- **Razorpay:** prod requires `RAZORPAY_KEY_ID` + `RAZORPAY_KEY_SECRET` or backend crash-loops on boot
