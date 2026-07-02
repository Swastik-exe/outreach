#!/usr/bin/env bash
# Deep production audit — finds functional gaps beyond smoke-prod.sh
set -uo pipefail

BASE="${BASE:-https://outreach-u35s.onrender.com/api/v1}"
ROOT="${ROOT:-https://outreach-u35s.onrender.com}"
FRONT="${FRONT:-https://outreach-iota-ruddy.vercel.app}"
PASS=0
FAIL=0

pass() { echo "PASS: $1"; PASS=$((PASS + 1)); }
fail() { echo "FAIL: $1"; echo "       $2"; FAIL=$((FAIL + 1)); }

echo "========== DEEP PRODUCTION AUDIT =========="

# --- Auth ---
REG=$(curl -sf -X POST "$BASE/auth/register" -H 'Content-Type: application/json' \
  -d "{\"email\":\"audit-$(date +%s)@example.com\",\"password\":\"TestPass123!\"}" 2>&1) || REG="curl_error"
echo "$REG" | grep -q '"success":true' && pass "register" || fail "register" "$REG"

LOGIN_BAD=$(curl -sf -X POST "$BASE/auth/login" -H 'Content-Type: application/json' \
  -d '{"email":"nope@example.com","password":"wrong"}' 2>&1) || LOGIN_BAD=$(curl -s -X POST "$BASE/auth/login" -H 'Content-Type: application/json' -d '{"email":"nope@example.com","password":"wrong"}')
echo "$LOGIN_BAD" | grep -q 'errorCode' && pass "login errorCode present" || fail "login errorCode" "$LOGIN_BAD"

FP=$(curl -sf -X POST "$BASE/auth/forgot-password" -H 'Content-Type: application/json' \
  -d '{"email":"nope@example.com"}' 2>&1) || FP="curl_error"
echo "$FP" | grep -q '"success":true' && pass "forgot-password" || fail "forgot-password" "$FP"

# --- Pagination shape (unauth should still be JSON) ---
RES=$(curl -s "$BASE/resumes?page=0&size=10")
echo "$RES" | grep -qE 'errorCode|Unauthorized|success' && pass "resumes JSON" || fail "resumes JSON" "$RES"

DR=$(curl -s "$BASE/inbound-email/drafts?page=0&size=10")
echo "$DR" | grep -qE 'errorCode|Unauthorized|success' && fail "drafts should require auth" "$DR" || true
echo "$DR" | grep -qE 'errorCode|Unauthorized' && pass "drafts requires auth" || fail "drafts auth" "$DR"

# --- Frontend routes ---
for path in / /login /register /dashboard /resume /tracker /pricing /forgot-password /reset-password; do
  code=$(curl -s -o /dev/null -w '%{http_code}' "$FRONT$path")
  if [ "$code" = "200" ] || [ "$code" = "307" ] || [ "$code" = "308" ]; then
    pass "frontend $path ($code)"
  else
    fail "frontend $path" "HTTP $code"
  fi
done

# --- Security ---
PROM=$(curl -s -o /dev/null -w '%{http_code}' "$ROOT/actuator/prometheus")
[ "$PROM" = "401" ] || [ "$PROM" = "403" ] && pass "prometheus locked ($PROM)" || fail "prometheus exposed" "HTTP $PROM"

SW=$(curl -s -o /dev/null -w '%{http_code}' "$ROOT/swagger-ui/index.html")
[ "$SW" = "401" ] || [ "$SW" = "403" ] || [ "$SW" = "404" ] && pass "swagger blocked ($SW)" || fail "swagger exposed" "HTTP $SW"

# --- Authenticated flow with test user ---
echo ""
echo "=== Authenticated flow (t7test@example.com) ==="
LOGIN=$(curl -s -X POST "$BASE/auth/login" -H 'Content-Type: application/json' \
  -d '{"email":"t7test@example.com","password":"TestPass123!"}')
if echo "$LOGIN" | grep -q 'accessToken'; then
  pass "test user login"
  TOKEN=$(echo "$LOGIN" | sed -n 's/.*"accessToken":"\([^"]*\)".*/\1/p')
  H="Authorization: Bearer $TOKEN"

  RLIST=$(curl -s "$BASE/resumes?page=0&size=100" -H "$H")
  if echo "$RLIST" | grep -q '"content"'; then
    pass "resumes paginated (content field)"
  elif echo "$RLIST" | grep -q '\['; then
    fail "resumes still array not page" "${RLIST:0:200}"
  else
    fail "resumes authed shape" "${RLIST:0:200}"
  fi

  DRAFTS=$(curl -s "$BASE/inbound-email/drafts?page=0&size=50" -H "$H")
  if echo "$DRAFTS" | grep -q '"content"'; then
    pass "drafts paginated (content field)"
  else
    fail "drafts authed shape" "${DRAFTS:0:200}"
  fi

  APPS=$(curl -s "$BASE/applications?page=0&size=20" -H "$H")
  echo "$APPS" | grep -qE '"content"|"success"' && pass "applications list" || fail "applications" "${APPS:0:200}"

  BILL=$(curl -s "$BASE/billing/subscription" -H "$H")
  echo "$BILL" | grep -q '"success"' && pass "billing subscription" || fail "billing" "${BILL:0:200}"

  USAGE=$(curl -s "$BASE/billing/usage" -H "$H")
  echo "$USAGE" | grep -q '"success"' && pass "billing usage" || fail "usage" "${USAGE:0:200}"
else
  fail "test user login" "${LOGIN:0:200}"
fi

echo ""
echo "========== RESULT: $PASS passed, $FAIL failed =========="
[ "$FAIL" -eq 0 ]
