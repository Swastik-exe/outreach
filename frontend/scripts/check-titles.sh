#!/usr/bin/env bash
set -u
BASE="${BASE:-http://localhost:3100}"
for r in / /login /register /forgot-password /reset-password /verify-email /tracker /resume /pricing /settings /admin /dashboard /nonexistent-xyz; do
  html=$(curl -s "$BASE$r")
  title=$(echo "$html" | grep -o '<title>[^<]*</title>' | head -1)
  theme=$(echo "$html" | grep -o '<meta name="theme-color"[^>]*>' | head -1)
  echo "$r  ->  $title"
done
echo "--- icon links on / ---"
curl -s "$BASE/" | grep -oE '<link rel="(icon|apple-touch-icon)"[^>]*>'
curl -s "$BASE/" | grep -o '<meta name="theme-color"[^>]*>'
