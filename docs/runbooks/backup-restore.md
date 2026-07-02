# Backup and restore (PostgreSQL)

## Render managed Postgres

1. Open Render dashboard → Postgres instance → **Backups**.
2. Enable automatic daily backups (paid plans) or use manual snapshots before migrations.
3. Record connection string from **Connections** (internal URL for same-region services).

## Manual logical backup

```bash
pg_dump "$DATABASE_URL" -Fc -f outreach-$(date +%Y%m%d).dump
```

Store dumps encrypted (e.g. password manager vault or encrypted object storage). **Never commit dumps to git.**

## Restore

```bash
pg_restore -d "$TARGET_DATABASE_URL" --clean --if-exists outreach-YYYYMMDD.dump
```

1. Put app in maintenance mode or scale web service to 0.
2. Restore to a **new** database first when testing.
3. Run Flyway info: `./mvnw flyway:info` against target URL.
4. Smoke test: health, login, list resumes.
5. Point `DATABASE_URL` at restored instance and redeploy.

## R2 object storage

Resume PDFs live in Cloudflare R2. Enable bucket versioning or periodic sync to a second bucket for disaster recovery.

## Rollback after bad migration

1. Revert the migration commit and deploy previous Docker image tag on Render.
2. If migration already applied, add a compensating `V{n+1}__rollback_*.sql` or restore from pre-migration dump.
