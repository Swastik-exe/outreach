#!/usr/bin/env bash
# Task 14+15 verification — cohort insight, share card, weekly digest
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
set -a; source "$ROOT/.env" 2>/dev/null || true; set +a
BASE="${BASE:-http://localhost:8080/api/v1}"
SECRET="${INBOUND_WEBHOOK_SECRET:-test-webhook-secret-for-dev}"
COHORT_BIG="backend_engineer|2026"
COHORT_SMALL="frontend_engineer|2027"
EMAIL_BIG="t14big@outreach.dev"
EMAIL_SMALL="t14small@outreach.dev"
PASS="T14Pass1!"

pass=0; fail=0
ok() { echo "  PASS: $1"; pass=$((pass+1)); }
bad() { echo "  FAIL: $1"; fail=$((fail+1)); }

echo "=== SETUP users ==="
for EM in "$EMAIL_BIG" "$EMAIL_SMALL"; do
  curl -s -X POST "$BASE/auth/register" -H "Content-Type: application/json" \
    -d "{\"email\":\"$EM\",\"password\":\"$PASS\"}" > /dev/null 2>&1 || true
  PGPASSWORD=outreach psql -h localhost -p 5432 -U outreach -d outreach \
    -c "UPDATE users SET is_email_verified=true WHERE email='$EM'" > /dev/null
done

login() {
  local em=$1
  curl -s -X POST "$BASE/auth/login" -H "Content-Type: application/json" \
    -d "{\"email\":\"$em\",\"password\":\"$PASS\"}"
}

TOKEN_BIG=$(login "$EMAIL_BIG" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['accessToken'])" 2>/dev/null)
TOKEN_SMALL=$(login "$EMAIL_SMALL" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['accessToken'])" 2>/dev/null)
[ -n "$TOKEN_BIG" ] && ok "Logged in big-cohort user" || { bad "Login big failed"; exit 1; }

echo ""
echo "=== SEED cohort >=20 ($COHORT_BIG) and cohort <20 ($COHORT_SMALL) ==="
PGPASSWORD=outreach psql -h localhost -p 5432 -U outreach -d outreach -v ON_ERROR_STOP=1 <<'EOSQL'
-- Clean prior t14 seeds
DELETE FROM career_health_scores WHERE user_id IN (
  SELECT id FROM users WHERE email LIKE 't14seed%' OR email IN ('t14big@outreach.dev','t14small@outreach.dev')
);
DELETE FROM user_profiles WHERE user_id IN (
  SELECT id FROM users WHERE email LIKE 't14seed%' OR email IN ('t14big@outreach.dev','t14small@outreach.dev')
);
DELETE FROM users WHERE email LIKE 't14seed%';

-- Big cohort: 25 users
DO $$
DECLARE i int;
BEGIN
  FOR i IN 1..25 LOOP
    INSERT INTO users (id, email, password_hash, auth_provider, plan_tier, is_email_verified, is_suspended, created_at, updated_at)
    VALUES (gen_random_uuid(), 't14seed_big_' || i || '@outreach.dev',
            '$2a$14$dummyhashdummyhashdummyhashdummyhashdummyhashdummyhashdummy',
            'local', 'free', true, false, now(), now());
  END LOOP;
END $$;

INSERT INTO user_profiles (id, user_id, target_role, graduation_year, cohort_key, profile_completeness_pct, created_at, updated_at)
SELECT gen_random_uuid(), u.id, 'backend_engineer', 2026, 'backend_engineer|2026', 80, now(), now()
FROM users u WHERE u.email LIKE 't14seed_big_%';

INSERT INTO career_health_scores (id, user_id, overall_score, band, is_stale, version, last_computed_at)
SELECT gen_random_uuid(), u.id, 200 + (random()*600)::int, 'Developing', false, 0, now()
FROM users u WHERE u.email LIKE 't14seed_big_%';

-- Assign big user to big cohort with high score
INSERT INTO user_profiles (id, user_id, target_role, graduation_year, cohort_key, profile_completeness_pct, created_at, updated_at)
SELECT gen_random_uuid(), id, 'backend_engineer', 2026, 'backend_engineer|2026', 90, now(), now()
FROM users WHERE email='t14big@outreach.dev'
ON CONFLICT (user_id) DO UPDATE SET cohort_key='backend_engineer|2026', target_role='backend_engineer', graduation_year=2026;
INSERT INTO career_health_scores (id, user_id, overall_score, band, is_stale, version, last_computed_at)
SELECT gen_random_uuid(), id, 720, 'Strong', false, 0, now()
FROM users WHERE email='t14big@outreach.dev'
ON CONFLICT (user_id) DO UPDATE SET overall_score=720, band='Strong';

-- Small cohort: 5 users
DO $$
DECLARE i int;
BEGIN
  FOR i IN 1..5 LOOP
    INSERT INTO users (id, email, password_hash, auth_provider, plan_tier, is_email_verified, is_suspended, created_at, updated_at)
    VALUES (gen_random_uuid(), 't14seed_small_' || i || '@outreach.dev',
            '$2a$14$dummyhashdummyhashdummyhashdummyhashdummyhashdummyhashdummy',
            'local', 'free', true, false, now(), now());
  END LOOP;
END $$;

INSERT INTO user_profiles (id, user_id, target_role, graduation_year, cohort_key, profile_completeness_pct, created_at, updated_at)
SELECT gen_random_uuid(), u.id, 'frontend_engineer', 2027, 'frontend_engineer|2027', 80, now(), now()
FROM users u WHERE u.email LIKE 't14seed_small_%';

INSERT INTO career_health_scores (id, user_id, overall_score, band, is_stale, version, last_computed_at)
SELECT gen_random_uuid(), u.id, 400, 'Developing', false, 0, now()
FROM users u WHERE u.email LIKE 't14seed_small_%';

INSERT INTO user_profiles (id, user_id, target_role, graduation_year, cohort_key, profile_completeness_pct, created_at, updated_at)
SELECT gen_random_uuid(), id, 'frontend_engineer', 2027, 'frontend_engineer|2027', 90, now(), now()
FROM users WHERE email='t14small@outreach.dev'
ON CONFLICT (user_id) DO UPDATE SET cohort_key='frontend_engineer|2027', target_role='frontend_engineer', graduation_year=2027;
INSERT INTO career_health_scores (id, user_id, overall_score, band, is_stale, version, last_computed_at)
SELECT gen_random_uuid(), id, 450, 'Developing', false, 0, now()
FROM users WHERE email='t14small@outreach.dev'
ON CONFLICT (user_id) DO UPDATE SET overall_score=450, band='Developing';
EOSQL
ok "Seeded cohorts via psql"

echo ""
echo "=== RUN cohort stats job ==="
COHORT_RUN=$(curl -s -X POST "$BASE/dev/jobs/cohort-stats" -H "X-Webhook-Secret: $SECRET")
UPDATED=$(echo "$COHORT_RUN" | python3 -c "import sys,json; print(json.load(sys.stdin)['data'])" 2>/dev/null)
[ "${UPDATED:-0}" -ge 1 ] && ok "Cohort stats recomputed ($UPDATED cohorts)" || bad "Cohort job: $COHORT_RUN"

echo ""
echo "=== TEST 1: GET /cohort >=20 returns band ==="
COHORT_BIG=$(curl -s "$BASE/career-score/cohort" -H "Authorization: Bearer $TOKEN_BIG")
AVAIL=$(echo "$COHORT_BIG" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['available'])" 2>/dev/null)
BAND=$(echo "$COHORT_BIG" | python3 -c "import sys,json; print(json.load(sys.stdin)['data'].get('band',''))" 2>/dev/null)
PCT=$(echo "$COHORT_BIG" | python3 -c "import sys,json; print(json.load(sys.stdin)['data'].get('percentile',''))" 2>/dev/null)
SIZE=$(echo "$COHORT_BIG" | python3 -c "import sys,json; print(json.load(sys.stdin)['data'].get('cohortSize',0))" 2>/dev/null)
if [ "$AVAIL" = "True" ] && [ -n "$BAND" ] && [ "$SIZE" -ge 20 ]; then
  ok "Big cohort: band=$BAND percentile=$PCT size=$SIZE"
  echo "       Response: $COHORT_BIG"
else
  bad "Big cohort expected available=true: $COHORT_BIG"
fi

echo ""
echo "=== TEST 2: GET /cohort <20 returns available:false ==="
COHORT_SM=$(curl -s "$BASE/career-score/cohort" -H "Authorization: Bearer $TOKEN_SMALL")
AVAIL_SM=$(echo "$COHORT_SM" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['available'])" 2>/dev/null)
if [ "$AVAIL_SM" = "False" ]; then
  ok "Small cohort returns available=false"
  echo "       Response: $COHORT_SM"
else
  bad "Small cohort should be unavailable: $COHORT_SM"
fi

echo ""
echo "=== TEST 3: Share card PNG (score + progress) ==="
curl -s "$BASE/career-score/share-card?variant=score" -H "Authorization: Bearer $TOKEN_BIG" -o /tmp/t14_score.png
curl -s "$BASE/career-score/share-card?variant=progress" -H "Authorization: Bearer $TOKEN_BIG" -o /tmp/t14_progress.png
SCORE_TYPE=$(file /tmp/t14_score.png 2>/dev/null || echo "")
PROG_TYPE=$(file /tmp/t14_progress.png 2>/dev/null || echo "")
SCORE_SZ=$(wc -c < /tmp/t14_score.png | tr -d ' ')
PROG_SZ=$(wc -c < /tmp/t14_progress.png | tr -d ' ')
echo "$SCORE_TYPE" | grep -qi PNG && [ "$SCORE_SZ" -gt 1000 ] && ok "Score share card PNG (${SCORE_SZ} bytes)" || bad "Score card invalid"
echo "$PROG_TYPE" | grep -qi PNG && [ "$PROG_SZ" -gt 1000 ] && ok "Progress share card PNG (${PROG_SZ} bytes)" || bad "Progress card invalid"

echo ""
echo "=== SEED 120 digest-eligible users ==="
PGPASSWORD=outreach psql -h localhost -p 5432 -U outreach -d outreach -v ON_ERROR_STOP=1 <<'EOSQL'
DELETE FROM notifications WHERE user_id IN (SELECT id FROM users WHERE email LIKE 't14digest_%');
DELETE FROM career_health_history WHERE user_id IN (SELECT id FROM users WHERE email LIKE 't14digest_%');
DELETE FROM career_health_scores WHERE user_id IN (SELECT id FROM users WHERE email LIKE 't14digest_%');
DELETE FROM user_profiles WHERE user_id IN (SELECT id FROM users WHERE email LIKE 't14digest_%');
DELETE FROM users WHERE email LIKE 't14digest_%';

DO $$
DECLARE i int;
BEGIN
  FOR i IN 1..120 LOOP
    INSERT INTO users (id, email, password_hash, auth_provider, plan_tier, is_email_verified, is_suspended, created_at, updated_at)
    VALUES (gen_random_uuid(), 't14digest_' || i || '@outreach.dev',
            '$2a$14$dummyhashdummyhashdummyhashdummyhashdummyhashdummyhashdummy',
            'local', 'free', true, false, now(), now());
  END LOOP;
END $$;

-- Half with score change (history 7d ago), half empty (should skip)
INSERT INTO career_health_scores (id, user_id, overall_score, band, next_action, is_stale, version, last_computed_at)
SELECT gen_random_uuid(), u.id,
       CASE WHEN (substring(u.email from 't14digest_([0-9]+)')::int % 2 = 0)
            THEN 500 ELSE 400 END,
       'Developing',
       CASE WHEN (substring(u.email from 't14digest_([0-9]+)')::int % 2 = 0)
            THEN 'Add 2 more applications this week' ELSE NULL END,
       false, 0, now()
FROM users u WHERE u.email LIKE 't14digest_%';

INSERT INTO career_health_history (id, user_id, overall_score, recorded_date)
SELECT gen_random_uuid(), u.id, 400, (CURRENT_DATE - INTERVAL '7 days')::date
FROM users u
JOIN career_health_scores chs ON chs.user_id = u.id
WHERE u.email LIKE 't14digest_%' AND chs.overall_score = 500;
EOSQL
ok "Seeded 120 digest users (60 with content, 60 empty)"

echo ""
echo "=== TEST 4: Weekly digest batches >50 ==="
DIGEST=$(curl -s -X POST "$BASE/dev/jobs/weekly-digest" -H "X-Webhook-Secret: $SECRET")
BATCHES=$(echo "$DIGEST" | python3 -c "import sys,json; d=json.load(sys.stdin)['data']; print(d['batches'])" 2>/dev/null)
PROCESSED=$(echo "$DIGEST" | python3 -c "import sys,json; d=json.load(sys.stdin)['data']; print(d['processed'])" 2>/dev/null)
SENT=$(echo "$DIGEST" | python3 -c "import sys,json; d=json.load(sys.stdin)['data']; print(d['sent'])" 2>/dev/null)
SKIPPED=$(echo "$DIGEST" | python3 -c "import sys,json; d=json.load(sys.stdin)['data']; print(d['skipped'])" 2>/dev/null)
echo "       Digest result: batches=$BATCHES processed=$PROCESSED sent=$SENT skipped=$SKIPPED"
[ "${BATCHES:-0}" -ge 3 ] && ok "Digest ran >=3 batches (120 users @ 50/page)" || bad "Expected >=3 batches got $BATCHES"
[ "${PROCESSED:-0}" -ge 120 ] && ok "Processed all eligible users ($PROCESSED total in DB)" || bad "Expected processed>=120 got $PROCESSED"

NOTIF_SENT=$(PGPASSWORD=outreach psql -h localhost -p 5432 -U outreach -d outreach -t -A \
  -c "SELECT count(*) FROM notifications n JOIN users u ON u.id=n.user_id WHERE u.email LIKE 't14digest_%' AND n.type='weekly_digest'" | tr -d ' ')
NOTIF_SKIP=$((120 - NOTIF_SENT))
[ "${NOTIF_SENT:-0}" -ge 55 ] && ok "t14digest users received digests ($NOTIF_SENT ~60 with content)" || bad "Expected ~60 t14digest notifications got $NOTIF_SENT"
[ "$NOTIF_SKIP" -ge 55 ] && ok "t14digest empty users skipped (~$NOTIF_SKIP)" || bad "Expected ~60 skipped in t14digest cohort"

echo ""
echo "=== SUMMARY: $pass passed, $fail failed ==="
[ "$fail" -eq 0 ] && exit 0 || exit 1
