#!/usr/bin/env bash
# Quick local build verification — same checks CI runs.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

echo "=== Backend (Maven) ==="
./mvnw -B clean package -DskipTests

echo ""
echo "=== Frontend (Next.js) ==="
cd frontend
npm run build

echo ""
echo "All builds passed."
