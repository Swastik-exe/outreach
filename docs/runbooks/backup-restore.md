# Backup and restore (PostgreSQL)

## Automated encrypted backups (preferred)

GitHub Actions workflow `.github/workflows/database-backup.yml` runs daily when these
repository secrets are configured:

| Secret | Purpose |
|---|---|
| `DATABASE_BACKUP_URL` | Supabase **direct** Postgres URL (not the transaction pooler) |
| `BACKUP_AGE_RECIPIENT` | `age` public key for encryption |
| `BACKUP_R2_ACCOUNT_ID` | Cloudflare account id for the backup bucket |
| `BACKUP_R2_ACCESS_KEY_ID` | R2 access key |
| `BACKUP_R2_SECRET_ACCESS_KEY` | R2 secret key |
| `BACKUP_R2_BUCKET` | Dedicated backup bucket |

Each run:

1. Creates a consistent `pg_dump` custom-format archive
2. Restores it into a throwaway Postgres service to prove the dump is valid
3. Encrypts with `age`
4. Uploads `.dump.age` + checksum to R2
5. Deletes backup objects older than 35 days

Generate an age keypair once:

```bash
age-keygen -o outreach-backup.key
# Put the public key (age1...) into BACKUP_AGE_RECIPIENT
# Store the private key offline / password manager — never in git
```

Decrypt a backup:

```bash
age --decrypt -i outreach-backup.key -o outreach.dump outreach-YYYY-MM-DD.dump.age
```

## Production database: Supabase

Production `DATABASE_URL` points at the **Supabase** transaction-mode pooler (not Render-managed Postgres).

1. Open [Supabase Dashboard](https://supabase.com/dashboard) → project → **Database** → **Backups**.
2. Confirm automatic backups / PITR are enabled for your plan (free tier has limited history — verify before relying on it).
3. Before risky Flyway migrations, take a manual snapshot or run a logical dump (below).
4. Connection strings: use the **transaction pooler** URL for the app (`DATABASE_URL`); use a **direct** connection for `pg_dump` / `pg_restore` when required.

## Manual logical backup

Prefer the direct (non-pooler) Postgres URL for dumps:

```bash
pg_dump "$DATABASE_DIRECT_URL" -Fc -f outreach-$(date +%Y%m%d).dump
```

Store dumps encrypted (password manager vault or encrypted object storage). **Never commit dumps to git.**

## Restore

```bash
pg_restore -d "$TARGET_DATABASE_URL" --clean --if-exists outreach-YYYYMMDD.dump
```

1. Put the app in maintenance mode or suspend the Render web service.
2. Restore to a **new** database / branch first when testing.
3. Run Flyway info against the target URL if available: `./mvnw flyway:info`.
4. Smoke test: `/actuator/health/readiness`, login, list resumes.
5. Point `DATABASE_URL` at the restored instance and redeploy.

## R2 object storage

Resume PDFs live in Cloudflare R2. Enable bucket versioning or periodic sync to a second bucket for disaster recovery.

## Rollback after a bad deploy or migration

There is **no container image registry**. Render rebuilds from source when the deploy hook fires.

1. **Preferred:** Render Dashboard → `outreach-backend` → **Rollback** to the previous successful deploy (uses Render's retained deploy artifacts).
2. **Alternative:** `git revert` the bad commit on `main`, wait for CI to pass, then allow the gated deploy workflow to fire (expect a full Docker rebuild — typically several minutes).
3. If a Flyway migration already applied and cannot be reversed safely: restore from a pre-migration dump (above) or add a compensating `V{n+1}__*.sql` migration. Never rewrite an already-applied migration.
