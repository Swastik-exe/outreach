# Outreach — Launch Checklist

## Live URLs

| Service | URL |
|---|---|
| **App (share this one)** | https://outreach-iota-ruddy.vercel.app |
| Backend API | https://outreach-u35s.onrender.com |
| Backend health check | https://outreach-u35s.onrender.com/actuator/health |

**Before sharing with anyone, confirm both of these are done** (see brain.md → "Live URLs" section for current status):
- [ ] Backend health check returns `{"status":"UP"}`
- [ ] `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` (Test Mode) set on Render
- [ ] Render's `FRONTEND_URL` and `CORS_ALLOWED_ORIGINS` updated to `https://outreach-iota-ruddy.vercel.app`
- [ ] Full login loop tested end-to-end (register → verify email → login → dashboard) from the live Vercel URL, not localhost

---

## How to share the resume link

Just share the root URL: **https://outreach-iota-ruddy.vercel.app**

- New users land on `/login` (or `/register` if they click through) — no separate "resume tool" link needed, the whole app is one product.
- If you want a direct deep-link to resume upload specifically (e.g. in a tweet or DM), use: `https://outreach-iota-ruddy.vercel.app/resume` — unauthenticated visitors get redirected to `/login` first, then land back on `/resume` after logging in.
- Consider a short link (bit.ly / your own domain) if sharing in places where a long Vercel URL looks unpolished.

---

## Adding the first 10–20 test students

You don't need an admin panel to "add" users — anyone can self-register. To run a controlled first cohort:

1. **Send them the URL directly** (DM, WhatsApp group, email) rather than posting publicly — keeps the first batch small and known.
2. **Ask them to register with their real email** — email verification is required before login (`is_email_verified` gate), so a real inbox is mandatory.
3. **Watch signups land in Supabase** — Supabase dashboard → Table Editor → `users` table, sorted by `created_at` desc.
4. **Make yourself an admin** to see the admin dashboard (`/admin` — stats, feedback inbox):
   ```sql
   UPDATE users SET plan_tier = 'admin' WHERE email = 'YOUR_EMAIL_HERE';
   ```
   Run this in the Supabase SQL Editor (dashboard → SQL Editor → paste → Run). This is the only manual DB step needed — do this once, for yourself.
5. **Everyone else stays on the `free` plan_tier automatically** (3 resume analyses/month) — no action needed per user.

---

## What to watch in the first week

**Daily, in this order:**

1. **Render Logs tab** — any `STARTUP FAILED`, repeated restarts, or stack traces. A crash-looping service silently drops all traffic.
2. **`/admin` dashboard** (once you're admin) — `aiCostToday`, `activeUsersToday`, `failedJobs`, `systemStatus`. `failedJobs > 0` means a nightly scheduled job (score recalc, digest, follow-up reminders) threw — check Render logs for which one.
3. **`/admin` feedback inbox** — the in-app feedback widget (bottom-right FAB on every screen) is your first real bug-report channel. Check it daily.
4. **Gemini/Groq usage** — Google AI Studio / Groq console dashboards for API usage. `daily-token-budget` caps (100k Gemini / 50k Groq per day) exist specifically so one heavy user can't exhaust your quota — if users report "basic analysis" instead of full AI analysis, budgets may be exhausted for the day (resets at midnight IST).
5. **Resend dashboard** — verification/reset emails delivery rate. If `RESEND_FROM` domain isn't verified, emails may land in spam or fail silently.
6. **Supabase → Database → Usage** — free tier has connection/storage limits; watch it doesn't approach caps as signups grow.
7. **R2 storage usage** — Cloudflare dashboard → R2 → your bucket → check storage growing as expected (each resume upload = 1 PDF, old versions aren't auto-deleted on re-upload by design).

**Known non-blockers (don't panic about these):**
- Razorpay is in Test Mode — real payments won't process. That's intentional pre-KYC (see brain.md T12+13 notes).
- Render free tier cold-starts after 15 min idle if UptimeRobot isn't set up yet (see below).
- `analysisSource: rule_based` instead of `ai` on a resume just means AI fell back gracefully (budget exhausted, or all providers briefly down) — the app is designed to never fail hard here.

---

## How to update the app after launch

**Everything auto-deploys on push to `main`:**

- **Backend:** push touching `src/`, `pom.xml`, `mvnw`, or `Dockerfile` → GitHub Action (`deploy-backend.yml`) fires the Render deploy hook → Render rebuilds the Docker image and redeploys. Takes ~5-10 min.
- **Frontend:** push touching `frontend/**` → GitHub Action (`deploy-frontend.yml`) runs `vercel deploy --prod` → live in ~2 min.
- **No manual steps needed** for either, once the two GitHub Actions secrets are set (`RENDER_DEPLOY_HOOK_URL` for backend; `VERCEL_TOKEN` + `VERCEL_ORG_ID` + `VERCEL_PROJECT_ID` for frontend).
- **Database schema changes:** never edit `V1__initial_schema.sql`. Add a new `V{n}__description.sql` file under `src/main/resources/db/migration/` — Flyway applies it automatically on next backend boot.
- **Rollback:** Render dashboard → your service → "Deploys" tab → pick a previous successful deploy → "Redeploy". Vercel: dashboard → "Deployments" → previous deployment → "Promote to Production".

---

## UptimeRobot setup (do once backend is confirmed live)

1. Go to **uptimerobot.com** → sign up (free)
2. **Add New Monitor**
3. Monitor Type: **HTTP(s)**
4. Friendly Name: `Outreach Backend`
5. URL: `https://outreach-u35s.onrender.com/actuator/health`
6. Monitoring Interval: **5 minutes**
7. Save

This keeps Render's free instance warm around the clock — without it, the backend spins down after 15 minutes of no traffic and the next real user eats a 10-30 second cold-start delay.
