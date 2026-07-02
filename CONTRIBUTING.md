# Contributing to Outreach

## Setup

1. Fork/clone the repo.
2. Run `./scripts/setup-git.sh` to install the pre-commit hook (blocks `.env` and secret patterns).
3. Copy `.env.example` → `.env` and `frontend/.env.local.example` → `frontend/.env.local`.
4. Start Postgres + Redis, then `./mvnw spring-boot:run` and `cd frontend && npm run dev`.

## Workflow

1. Create a branch from `main`.
2. Make focused changes; match existing code style.
3. Run `./scripts/verify-build.sh` before opening a PR.
4. Open a PR against `main` — CI runs backend unit tests, frontend lint, and build.

## Code conventions

- **Backend:** Package by feature (`auth`, `resume`, `tracker`, …). Use `AppException` + `ApiErrorCode` for domain errors.
- **Frontend:** Use `api` from `@/lib/api`; branch on `errorCode`, not error message text.
- **Migrations:** Flyway `V{n}__description.sql`; must be reversible or documented in the PR.
- **Secrets:** Never commit `.env`, keys, or tokens. Pre-commit hook enforces this.

## Tests

```bash
# Backend unit tests (CI subset)
./mvnw test -Dtest='PdfValidationTest,ResumeParserTest,ScoreComponentsTest,CohortPercentileCalculatorTest,RateLimitServiceTest,AuthServiceRedisDownTest'

# Frontend
cd frontend && npm run lint && npm run build
```

## UI/UX changes

Visual redesign is tracked separately. Functional API wiring (pagination, error codes) is in scope; pixel polish is deferred.

## Questions

See `AGENTS.md` and `brain.md` for architecture context.
