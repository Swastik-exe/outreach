#!/usr/bin/env bash
# Quick local build verification — same checks CI runs.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

echo "=== Backend unit tests ==="
./mvnw -B test -Dtest='PdfValidationTest,ResumeParserTest,ScoreComponentsTest,CohortPercentileCalculatorTest,RateLimitServiceTest,AuthServiceRedisDownTest'

echo ""
echo "=== Backend package ==="
./mvnw -B clean package -DskipTests

echo ""
echo "=== Frontend (Next.js) ==="
cd frontend
npm run build

echo ""
echo "All builds passed."
