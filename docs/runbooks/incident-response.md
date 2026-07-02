# Incident response

## Severity levels

| Level | Example | Response |
|-------|---------|----------|
| S1 | Backend down, payments broken | Immediate; page stakeholders |
| S2 | Degraded (cold starts, slow AI) | Investigate within 1h |
| S3 | Non-critical bug | Fix in next deploy |

## First steps

1. **Check health:** https://outreach-u35s.onrender.com/actuator/health
2. **Check Render logs** for stack traces or OOM.
3. **Check Vercel** deployment status for frontend.
4. **UptimeRobot** — confirm external perspective.

## Common issues

### Backend crash loop on deploy

- Often missing env var (`RAZORPAY_KEY_ID`, `JWT_SECRET`, `DATABASE_URL`).
- Fix env in Render → Manual Deploy.

### 502 / non-JSON from API (cold start)

- Render free tier spins down; first request may timeout.
- Frontend shows "Network error" — expected; retry or upgrade Render plan.

### Redis unavailable

- Auth rate limits and sessions may fail; login returns generic error.
- Verify `REDIS_HOST`, `REDIS_PASSWORD`, SSL settings.

### Database migration failure

- Render deploy logs show Flyway error.
- Do **not** force deploy again without fixing SQL or restoring backup.
- See [backup-restore.md](./backup-restore.md).

## Communication template

```
[Outreach incident] <title>
Status: Investigating | Mitigated | Resolved
Impact: <who/what>
Started: <UTC time>
Next update: <time>
```

## Post-incident

1. Root cause in GitHub issue or ADR.
2. Add test or alert if preventable.
3. Update this runbook if steps were wrong.
