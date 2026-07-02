#!/usr/bin/env bash
# Quick probe: is the email-fix backend live on Render?
set -uo pipefail
BASE="${BASE:-https://outreach-u35s.onrender.com/api/v1}"
EMAIL="probe-$(date +%s)@example.com"
EXPECTED_TAG="${EXPECTED_TAG:-email-fix-v3}"

echo "=== One-click verify redirect (expect 302) ==="
REDIR=$(curl -sI "$BASE/auth/verify-email?token=invalid-test-token" | head -1)
echo "$REDIR"
echo "$REDIR" | grep -qE '302|301' && echo "PASS: verify redirect" || echo "FAIL: no redirect (deploy pending?)"

echo "=== Build tag (expect: $EXPECTED_TAG) ==="
TAG_RESP=$(curl -sf "$BASE/meta/build" 2>/dev/null || echo "MISSING")
echo "$TAG_RESP"
if echo "$TAG_RESP" | grep -q "$EXPECTED_TAG"; then
  echo "PASS: new backend is live"
else
  echo "FAIL: old backend still running — Manual Deploy required on Render"
fi

echo ""
echo "=== Register ==="
curl -s -w "\ntime_total=%{time_total}s http=%{http_code}\n" -X POST "$BASE/auth/register" \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"$EMAIL\",\"password\":\"TestPass123!\"}" | head -c 300

echo ""
echo "=== Login unverified (expect EMAIL_NOT_VERIFIED) ==="
curl -s -w "\ntime_total=%{time_total}s\n" -X POST "$BASE/auth/login" \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"$EMAIL\",\"password\":\"TestPass123!\"}" | head -c 400
