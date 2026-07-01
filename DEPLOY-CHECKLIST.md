# Cloud deploy checklist — Outreach

**Security rule:** paste real keys into your local `.env` file or into Render/Vercel env-var boxes only. **Never paste keys into Cursor chat.**

Estimated time: ~30 minutes for all free-tier accounts.

---

## Before you start

1. Copy the template: `cp .env.example .env` (from the repo root).
2. Generate two secrets locally (safe to run on your machine):

   ```bash
   openssl rand -base64 48    # → paste into JWT_SECRET
   openssl rand -hex 32       # → paste into INBOUND_WEBHOOK_SECRET
   ```

3. Keep this checklist open beside your `.env` file. Fill one variable at a time.

---

## 1. Supabase (Postgres database) — FREE

**Why first:** everything else depends on the database.

| Step | Action |
|------|--------|
| 1 | Go to [https://supabase.com](https://supabase.com) → Sign up (GitHub login is fine). |
| 2 | **New project** → pick a name, strong DB password (save it!), region closest to India if available. |
| 3 | Wait ~2 min for provisioning. |
| 4 | Dashboard → **Connect** (top) → **ORMs** or **Connection string**. |
| 5 | Select **Transaction pooler** (port **6543**). Copy the URI parts. |
| 6 | Paste into `.env`: |

| Copy this from Supabase | Paste into `.env` variable |
|-------------------------|----------------------------|
| Host + port 6543 + `/postgres?sslmode=require` | `DATABASE_URL=jdbc:postgresql://HOST:6543/postgres?sslmode=require` |
| User (looks like `postgres.xxxxx`) | `DATABASE_USERNAME` |
| Database password you chose | `DATABASE_PASSWORD` |

**Credit card:** not required on free tier.

---

## 2. Upstash (Redis) — FREE

**Why second:** rate limits, sessions, caches — app starts without it but prod needs it.

| Step | Action |
|------|--------|
| 1 | Go to [https://console.upstash.com](https://console.upstash.com) → Sign up. |
| 2 | **Create database** → name it `outreach`, region near your Supabase region. |
| 3 | Open the database → **Details** tab. |

| Copy this from Upstash | Paste into `.env` variable |
|------------------------|----------------------------|
| Endpoint host (without port) | `REDIS_HOST` |
| Port (usually 6379) | `REDIS_PORT` |
| Password | `REDIS_PASSWORD` |

**Credit card:** not required on free tier.

---

## 3. Cloudflare R2 (file storage) — FREE tier

**Why:** resume PDFs in production (local `./storage` is dev-only).

| Step | Action |
|------|--------|
| 1 | Go to [https://dash.cloudflare.com](https://dash.cloudflare.com) → Sign up. |
| 2 | Left menu → **R2 Object Storage** → enable (may ask for payment method on file — free tier covers MVP usage). |
| 3 | **Create bucket** → name e.g. `outreach-resumes`. |
| 4 | **Manage R2 API Tokens** → Create token → Object Read & Write → scope to your bucket. |
| 5 | Account ID is on the R2 overview page (right column). |

| Copy this from Cloudflare | Paste into `.env` variable |
|---------------------------|----------------------------|
| Account ID | `R2_ACCOUNT_ID` |
| Access Key ID | `R2_ACCESS_KEY` |
| Secret Access Key | `R2_SECRET_KEY` |
| Bucket name | `R2_BUCKET` |

**Credit card:** may be required to activate R2; usage within free tier is $0.

---

## 4. Resend (transactional email) — FREE tier

| Step | Action |
|------|--------|
| 1 | Go to [https://resend.com](https://resend.com) → Sign up. |
| 2 | **API Keys** → Create API Key → copy immediately. |
| 3 | For testing, use sender `onboarding@resend.dev` (no domain setup). For production, add your domain under **Domains**. |

| Copy this from Resend | Paste into `.env` variable |
|-----------------------|----------------------------|
| API key (`re_…`) | `RESEND_API_KEY` |
| Verified sender email | `RESEND_FROM` |

**Credit card:** not required on free tier (100 emails/day).

---

## 5. Google AI Studio (Gemini) — FREE tier

| Step | Action |
|------|--------|
| 1 | Go to [https://aistudio.google.com/apikey](https://aistudio.google.com/apikey) → Sign in with Google. |
| 2 | **Create API key** → copy. |

| Copy this | Paste into `.env` variable |
|-----------|----------------------------|
| API key | `GEMINI_API_KEY` |

**Credit card:** not required.

---

## 6. Groq (fallback AI) — FREE tier

| Step | Action |
|------|--------|
| 1 | Go to [https://console.groq.com](https://console.groq.com) → Sign up. |
| 2 | **API Keys** → Create API Key. |

| Copy this | Paste into `.env` variable |
|-----------|----------------------------|
| API key (`gsk_…`) | `GROQ_API_KEY` |

**Credit card:** not required. *(At least one of Gemini or Groq is required in prod.)*

---

## 7. Google OAuth — FREE

| Step | Action |
|------|--------|
| 1 | Go to [https://console.cloud.google.com/apis/credentials](https://console.cloud.google.com/apis/credentials). |
| 2 | Create project (if prompted) → **Create credentials** → **OAuth client ID**. |
| 3 | Application type: **Web application**. |
| 4 | Authorized redirect URI (use your future Render URL): `https://YOUR-BACKEND.onrender.com/login/oauth2/code/google` |
| 5 | Copy Client ID and Client Secret. |

| Copy this | Paste into `.env` variable |
|-----------|----------------------------|
| Client ID | `GOOGLE_CLIENT_ID` |
| Client Secret | `GOOGLE_CLIENT_SECRET` |

**Credit card:** not required.

---

## 8. GitHub OAuth — FREE

| Step | Action |
|------|--------|
| 1 | Go to [https://github.com/settings/developers](https://github.com/settings/developers) → **OAuth Apps** → **New OAuth App**. |
| 2 | Homepage URL: your Vercel frontend URL. |
| 3 | Authorization callback URL: `https://YOUR-BACKEND.onrender.com/login/oauth2/code/github` |
| 4 | Copy Client ID; generate Client Secret. |

| Copy this | Paste into `.env` variable |
|-----------|----------------------------|
| Client ID | `GITHUB_CLIENT_ID` |
| Client Secret | `GITHUB_CLIENT_SECRET` |

**Credit card:** not required.

---

## 9. Razorpay (payments — TEST mode) — FREE to test

| Step | Action |
|------|--------|
| 1 | Go to [https://dashboard.razorpay.com](https://dashboard.razorpay.com) → Sign up. |
| 2 | Stay in **Test Mode** (toggle top-left). |
| 3 | **Settings → API Keys → Generate Test Key**. |
| 4 | **Settings → Webhooks** → Add endpoint: `https://YOUR-BACKEND.onrender.com/api/v1/webhooks/razorpay` → copy webhook secret. |
| 5 | **Subscriptions → Plans** → create Monthly and Annual plans → copy Plan IDs. |

| Copy this | Paste into `.env` variable |
|-----------|----------------------------|
| Key ID (`rzp_test_…`) | `RAZORPAY_KEY_ID` |
| Key Secret | `RAZORPAY_KEY_SECRET` |
| Webhook secret | `RAZORPAY_WEBHOOK_SECRET` |
| Monthly plan ID | `RAZORPAY_PLAN_ID_MONTHLY` |
| Annual plan ID | `RAZORPAY_PLAN_ID_ANNUAL` |

**Credit card:** not required for test mode.

---

## 10. Sentry (optional — error tracking) — FREE tier

| Step | Action |
|------|--------|
| 1 | Go to [https://sentry.io](https://sentry.io) → Sign up. |
| 2 | Create project → **Spring Boot** (backend) → copy DSN. |
| 3 | Create project → **Next.js** (frontend) → copy DSN for Vercel. |

| Copy this | Paste into |
|-----------|------------|
| Backend DSN | `.env` → `SENTRY_DSN` |
| Frontend DSN | Vercel → `NEXT_PUBLIC_SENTRY_DSN` |

**Credit card:** not required on free tier. Leave blank to skip — app works without it.

---

## 11. Fill production URLs (after you know them)

You can use placeholders until deploy, then update:

| Variable | Example value |
|----------|---------------|
| `FRONTEND_URL` | `https://your-app.vercel.app` |
| `CORS_ALLOWED_ORIGINS` | `https://your-app.vercel.app` |
| `NEXT_PUBLIC_API_URL` | `https://your-api.onrender.com/api/v1` |
| `COOKIE_SECURE` | `true` |
| `SPRING_PROFILES_ACTIVE` | `prod` (on Render only; keep `dev` locally) |

---

## 12. Verify locally before deploy

From repo root (WSL):

```bash
# All vars filled in .env
bash scripts/start-dev.sh
```

Backend should log: `StartupValidator: all required environment variables are present.`

For a prod dry-run locally (validates stricter checks):

```bash
SPRING_PROFILES_ACTIVE=prod COOKIE_SECURE=true bash scripts/start-dev.sh
```

If anything is missing, the log lists exact variable names.

---

## When `.env` is complete

Come back and say **"deploy"** — the next prompt wires Render + Vercel and gets you a live resume URL.

**Do not paste your `.env` contents into chat.**
