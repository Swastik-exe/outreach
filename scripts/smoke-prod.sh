#!/usr/bin/env bash
# Quick production smoke test after deploy.
set -euo pipefail

BASE_API="https://outreach-u35s.onrender.com/api/v1"
BASE="https://outreach-u35s.onrender.com"
FRONT="https://outreach-iota-ruddy.vercel.app"
PASS=0
FAIL=0

pass() { echo "PASS: $1"; PASS=$((PASS + 1)); }
fail() { echo "FAIL: $1"; echo "  $2"; FAIL=$((FAIL + 1)); }

echo "=== 1. Backend readiness ==="
health=$(curl -sf "$BASE/actuator/health/readiness" || echo "curl failed")
if echo "$health" | grep -q '"status":"UP"'; then
  pass "readiness UP"
else
  fail "readiness UP" "$health"
fi

echo "=== 2. Security headers ==="
hdrs=$(curl -sI "$BASE_API/auth/login" | tr -d '\r')
if echo "$hdrs" | grep -qi 'x-content-type-options'; then
  pass "security headers"
else
  fail "security headers" "$hdrs"
fi

echo "=== 3. CORS preflight ==="
cors=$(curl -sI -X OPTIONS "$BASE_API/auth/login" \
  -H "Origin: $FRONT" \
  -H "Access-Control-Request-Method: POST" | tr -d '\r')
if echo "$cors" | grep -qi 'access-control-allow-origin'; then
  pass "CORS preflight"
else
  fail "CORS preflight" "$cors"
fi

echo "=== 4. Frontend home ==="
code=$(curl -s -o /dev/null -w "%{http_code}" "$FRONT/")
if [ "$code" = "200" ]; then
  pass "frontend home ($code)"
else
  fail "frontend home" "HTTP $code"
fi

echo "=== 5. API JSON error (unauth resumes) ==="
body=$(curl -s "$BASE_API/resumes" || true)
if echo "$body" | grep -qE 'errorCode|Unauthorized|success'; then
  pass "API JSON error shape"
else
  fail "API JSON error" "$body"
fi

echo "=== 6. Swagger blocked in prod ==="
sw=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/swagger-ui/index.html")
if [ "$sw" = "401" ] || [ "$sw" = "403" ] || [ "$sw" = "404" ]; then
  pass "swagger blocked ($sw)"
else
  fail "swagger blocked" "HTTP $sw"
fi

echo ""
echo "RESULT: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ]
