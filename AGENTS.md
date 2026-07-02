# AGENTS.md — Outreach automation guide

This file tells Cursor agents how to work in this repo safely and automatically.

## Live URLs

| Service | URL |
|---|---|
| Frontend (share this) | https://outreach-iota-ruddy.vercel.app |
| Backend API | https://outreach-u35s.onrender.com/api/v1 |
| Backend health | https://outreach-u35s.onrender.com/actuator/health |

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
| `.github/workflows/ci.yml` | all pushes + PRs | `mvn package` + `npm run build` |
| `.github/workflows/deploy-backend.yml` | `src/**`, `Dockerfile`, `pom.xml`, … | Render deploy hook |
| `.github/workflows/deploy-frontend.yml` | `frontend/**` | Vercel CLI deploy |

**Deploy order for env changes:** Render env vars first → then Vercel `NEXT_PUBLIC_API_URL` if backend URL changed.

### Required GitHub secrets (Settings → Secrets → Actions)

| Secret | Used by |
|---|---|
| `RENDER_DEPLOY_HOOK_URL` | deploy-backend |
| `VERCEL_TOKEN` | deploy-frontend |
| `VERCEL_ORG_ID` | deploy-frontend |
| `VERCEL_PROJECT_ID` | deploy-frontend |

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
curl https://outreach-u35s.onrender.com/actuator/health
```

## UI/UX changes

**Stage 2 (visual redesign) is pending** — user will provide a Claude design brief. Until then:

- Do **not** start broad visual/token refactors unless explicitly asked
- P0 functional fixes (error handling, dead links, missing pages) are done on `main`
- When redesign lands: migrate hardcoded hex (`bg-[#111318]`) → semantic tokens (`bg-surface`), add `font-space` to all headings, unify button styles

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
