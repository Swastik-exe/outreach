# Outreach

Full-stack job application tracker with resume scoring, inbound email parsing, and Razorpay billing.

| Environment | URL |
|-------------|-----|
| Frontend | https://outreach-iota-ruddy.vercel.app |
| Backend API | https://outreach-u35s.onrender.com/api/v1 |
| Health | https://outreach-u35s.onrender.com/actuator/health |

## Stack

- **Backend:** Java 21, Spring Boot 3, PostgreSQL, Redis, Flyway
- **Frontend:** Next.js 15, TypeScript, Tailwind
- **Storage:** Cloudflare R2 (S3-compatible)
- **Payments:** Razorpay

## Local development

### Prerequisites

- JDK 21, Maven (or use `./mvnw`)
- Node.js 20+
- PostgreSQL 16 and Redis 7 (or Docker)

### Backend

```bash
cp .env.example .env   # fill in secrets
./mvnw spring-boot:run
```

API base: `http://localhost:8080/api/v1`

### Frontend

```bash
cd frontend
cp .env.local.example .env.local
npm install
npm run dev
```

App: `http://localhost:3000`

### Verify builds

```bash
./scripts/verify-build.sh
```

## Project layout

```
src/main/java/com/outreach/   # Spring Boot modules
frontend/                     # Next.js app
src/main/resources/db/migration/  # Flyway SQL
docs/                         # Runbooks and ADRs
```

## Documentation

- [AGENTS.md](AGENTS.md) — agent/developer playbook (deploy URLs, git workflow)
- [PRODUCTION-HARDENING.md](PRODUCTION-HARDENING.md) — hardening checklist status
- [CONTRIBUTING.md](CONTRIBUTING.md) — how to contribute
- [brain.md](brain.md) — product and architecture notes

## Deployment

- **Backend:** Render (Docker) — push to `main` triggers deploy via GitHub Actions
- **Frontend:** Vercel — push to `main` triggers deploy

See `LAUNCH-CHECKLIST.md` for production env vars and smoke tests.

## License

Proprietary — all rights reserved.
