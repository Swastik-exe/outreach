#!/usr/bin/env bash
set -euo pipefail
BASE="${BASE:-http://localhost:8090/api/v1}"

echo "=== Security headers ==="
curl -s -I "$BASE/health" | tr -d '\r' | grep -iE 'strict-transport|content-security|x-frame|content-type-options' || true

echo "=== Register enumeration (same response shape) ==="
R1=$(curl -s -X POST "$BASE/auth/register" -H 'Content-Type: application/json' \
  -d '{"email":"t7test@example.com","password":"TestPass123!"}')
R2=$(curl -s -X POST "$BASE/auth/register" -H 'Content-Type: application/json' \
  -d "{\"email\":\"new-$(date +%s)@example.com\",\"password\":\"TestPass123!\"}")
echo "existing: $R1"
echo "new:      $R2"

echo "=== Dev endpoint (dev profile) ==="
CODE=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/dev/jobs/cohort-stats")
echo "POST /dev/jobs/cohort-stats without secret: HTTP $CODE (expect 403 or 500 if secret unset)"

echo "=== Login ==="
curl -s -X POST "$BASE/auth/login" -H 'Content-Type: application/json' \
  -d '{"email":"t7test@example.com","password":"TestPass123!"}' | head -c 150
echo

echo "=== Frontend ==="
LC=$(curl -s -o /dev/null -w '%{http_code}' http://localhost:3000/login 2>/dev/null || echo 000)
PC=$(curl -s -o /dev/null -w '%{http_code}' http://localhost:3000/pricing 2>/dev/null || echo 000)
echo "/login HTTP $LC /pricing HTTP $PC"
