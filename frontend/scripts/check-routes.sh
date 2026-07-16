#!/usr/bin/env bash
# Route smoke check against the local dev server.
# Usage: BASE=http://localhost:3100 bash scripts/check-routes.sh
set -u
BASE="${BASE:-http://localhost:3100}"
ROUTES=(
  /
  /login
  /register
  /forgot-password
  /reset-password
  /verify-email
  /dashboard
  /dashboard/breakdown
  /dashboard/history
  /dashboard/cohort
  /tracker
  /tracker/add
  /resume
  /pricing
  /settings
  /settings/billing
  /admin
  /manifest.json
  /favicon.ico
  /icon.svg
  /icons/icon-192.png
  /icons/icon-512.png
  /icons/maskable-192.png
  /icons/maskable-512.png
  /icons/apple-touch-icon.png
  /assets/logo-purple.svg
  /assets/logo-white.svg
  /this-route-should-404
)
for r in "${ROUTES[@]}"; do
  code=$(curl -s -o /dev/null -w '%{http_code}' "$BASE$r")
  echo "$code  $r"
done
