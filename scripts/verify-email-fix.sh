#!/usr/bin/env bash
set -uo pipefail
BASE="${BASE:-https://outreach-u35s.onrender.com/api/v1}"
EMAIL="postfix-$(date +%s)@example.com"

echo "=== 1. Register new user ==="
curl -s -w "time_total=%{time_total}s\n" -X POST "$BASE/auth/register" \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"$EMAIL\",\"password\":\"TestPass123!\"}" | head -c 200
echo ""

echo "=== 2. Login unverified ==="
curl -s -w "time_total=%{time_total}s\n" -X POST "$BASE/auth/login" \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"$EMAIL\",\"password\":\"TestPass123!\"}"

echo ""
echo "=== 3. Second register (warm server) ==="
EMAIL2="postfix2-$(date +%s)@example.com"
curl -s -w "time_total=%{time_total}s\n" -X POST "$BASE/auth/register" \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"$EMAIL2\",\"password\":\"TestPass123!\"}" | head -c 100
echo ""

echo "=== 4. Frontend register copy ==="
curl -s https://outreach-iota-ruddy.vercel.app/register | grep -oE 'server logs|check spam|Open the link' | head -5
