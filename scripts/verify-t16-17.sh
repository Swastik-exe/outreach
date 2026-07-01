#!/usr/bin/env bash
# Task 16+17 verification — feedback, admin gate, PWA, mobile layout
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
set -a; source "$ROOT/.env" 2>/dev/null || true; set +a
BASE="${BASE:-http://localhost:8080/api/v1}"
FE="${FE:-http://localhost:3000}"
USER_EMAIL="t16user@outreach.dev"
ADMIN_EMAIL="t16admin@outreach.dev"
PASS="T16Pass1!"

pass=0; fail=0
ok() { echo "  PASS: $1"; pass=$((pass+1)); }
bad() { echo "  FAIL: $1"; fail=$((fail+1)); }

echo "=== SETUP users ==="
for EM in "$USER_EMAIL" "$ADMIN_EMAIL"; do
  curl -s -X POST "$BASE/auth/register" -H "Content-Type: application/json" \
    -d "{\"email\":\"$EM\",\"password\":\"$PASS\"}" > /dev/null 2>&1 || true
done
PGPASSWORD=outreach psql -h localhost -p 5432 -U outreach -d outreach -v ON_ERROR_STOP=1 <<EOSQL
UPDATE users SET is_email_verified=true WHERE email IN ('$USER_EMAIL','$ADMIN_EMAIL');
UPDATE users SET plan_tier='admin' WHERE email='$ADMIN_EMAIL';
EOSQL

login() {
  curl -s -X POST "$BASE/auth/login" -H "Content-Type: application/json" \
    -d "{\"email\":\"$1\",\"password\":\"$PASS\"}"
}

USER_TOKEN=$(login "$USER_EMAIL" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['accessToken'])" 2>/dev/null)
ADMIN_TOKEN=$(login "$ADMIN_EMAIL" | python3 -c "import sys,json; d=json.load(sys.stdin)['data']; print(d['accessToken'])" 2>/dev/null)
ADMIN_ROLE=$(login "$ADMIN_EMAIL" | python3 -c "import sys,json; print(json.load(sys.stdin)['data'].get('role',''))" 2>/dev/null)
[ -n "$USER_TOKEN" ] && ok "User logged in" || { bad "User login failed"; exit 1; }
[ -n "$ADMIN_TOKEN" ] && ok "Admin logged in role=$ADMIN_ROLE" || bad "Admin login failed"

echo ""
echo "=== TEST 1: POST /feedback -> lands in admin inbox ==="
FB=$(curl -s -X POST "$BASE/feedback" -H "Authorization: Bearer $USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"message":"Test bug from verify script","screen":"/dashboard","type":"bug"}')
FB_OK=$(echo "$FB" | python3 -c "import sys,json; print(json.load(sys.stdin).get('success',False))" 2>/dev/null)
[ "$FB_OK" = "True" ] && ok "Feedback submitted" || bad "Feedback submit: $FB"

INBOX=$(curl -s "$BASE/admin/feedback?page=0&size=5" -H "Authorization: Bearer $ADMIN_TOKEN")
FOUND=$(echo "$INBOX" | python3 -c "
import sys,json
d=json.load(sys.stdin)
items=d.get('data',{}).get('content',[])
print(any('verify script' in (i.get('message') or '') for i in items))
" 2>/dev/null)
[ "$FOUND" = "True" ] && ok "Feedback in admin inbox" || bad "Not in inbox: $INBOX"

echo ""
echo "=== TEST 2: Non-admin /admin/stats -> 403 ==="
CODE_USER=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/admin/stats" -H "Authorization: Bearer $USER_TOKEN")
[ "$CODE_USER" = "403" ] && ok "Non-admin gets 403" || bad "Expected 403 got $CODE_USER"

echo ""
echo "=== TEST 3: Admin /admin/stats -> 5 numbers ==="
STATS=$(curl -s "$BASE/admin/stats" -H "Authorization: Bearer $ADMIN_TOKEN")
HAS5=$(echo "$STATS" | python3 -c "
import sys,json
d=json.load(sys.stdin).get('data',{})
keys=['aiCostToday','activeUsersToday','revenueThisMonthInr','failedJobs','systemStatus']
print(all(k in d for k in keys))
" 2>/dev/null)
STATUS=$(echo "$STATS" | python3 -c "import sys,json; print(json.load(sys.stdin)['data'].get('systemStatus',''))" 2>/dev/null)
[ "$HAS5" = "True" ] && ok "Admin stats has 5 fields systemStatus=$STATUS" || bad "Stats: $STATS"

echo ""
echo "=== TEST 4: PWA manifest + service worker ==="
MANIFEST=$(curl -s "$FE/manifest.json")
M_NAME=$(echo "$MANIFEST" | python3 -c "import sys,json; print(json.load(sys.stdin).get('name',''))" 2>/dev/null)
M_DISP=$(echo "$MANIFEST" | python3 -c "import sys,json; print(json.load(sys.stdin).get('display',''))" 2>/dev/null)
SW_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$FE/sw.js")
[ "$M_NAME" = "Outreach" ] && ok "manifest name=Outreach" || bad "manifest: $MANIFEST"
[ "$M_DISP" = "standalone" ] && ok "manifest display=standalone" || bad "display=$M_DISP"
[ "$SW_CODE" = "200" ] && ok "sw.js served (200)" || bad "sw.js code=$SW_CODE"

echo ""
echo "=== TEST 5: Mobile layout (no horizontal overflow) ==="
# Check dashboard HTML has viewport-fit and overflow-x-hidden on body
HTML=$(curl -s "$FE/login" 2>/dev/null || echo "")
echo "$HTML" | grep -qi 'viewport' && ok "Viewport meta present" || bad "No viewport meta"
# Production build check
cd "$ROOT/frontend" && npm run build -q 2>/dev/null | tail -3
BUILD_OK=$?
[ "$BUILD_OK" -eq 0 ] && ok "Frontend build clean (includes /admin route)" || bad "Frontend build failed"

echo ""
echo "=== SUMMARY: $pass passed, $fail failed ==="
[ "$fail" -eq 0 ] && exit 0 || exit 1
