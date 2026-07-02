#!/usr/bin/env bash
# Measure auth endpoint latency on production (cold vs warm).
set -uo pipefail
BASE="${BASE:-https://outreach-u35s.onrender.com/api/v1}"

measure() {
  local label="$1"; shift
  local start end ms
  start=$(date +%s%3N 2>/dev/null || python3 -c 'import time; print(int(time.time()*1000))' 2>/dev/null || echo 0)
  "$@" >/dev/null 2>&1 || true
  end=$(date +%s%3N 2>/dev/null || echo 0)
  ms=$((end - start))
  echo "$label: ${ms}ms"
}

echo "=== Auth latency audit ==="
EMAIL="lat-$(date +%s)@example.com"

measure "register (cold/warm)" curl -sf -X POST "$BASE/auth/register" \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"$EMAIL\",\"password\":\"TestPass123!\"}"

measure "resend-verification" curl -sf -X POST "$BASE/auth/resend-verification" \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"$EMAIL\"}"

measure "login (unverified)" curl -sf -X POST "$BASE/auth/login" \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"$EMAIL\",\"password\":\"TestPass123!\"}"

measure "forgot-password" curl -sf -X POST "$BASE/auth/forgot-password" \
  -H 'Content-Type: application/json' \
  -d '{"email":"nope@example.com"}'

echo "=== Health baseline ==="
measure "health" curl -sf "$BASE/../actuator/health" 2>/dev/null || measure "health" curl -sf "https://outreach-u35s.onrender.com/actuator/health"
