#!/usr/bin/env bash
# Quick local build verification — mirrors CI as closely as possible.
# Excludes OutreachApplicationTests (needs live Postgres+Redis); CI runs the full suite.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

echo "=== Backend unit tests ==="
./mvnw -B test -Dtest='!*OutreachApplicationTests'

echo ""
echo "=== Backend package ==="
./mvnw -B clean package -DskipTests

echo ""
echo "=== Frontend lint ==="
cd frontend
npm run lint

echo ""
echo "=== Frontend build ==="
npm run build

echo ""
echo "All builds passed."
