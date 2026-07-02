#!/usr/bin/env bash
# One-time (or re-run) local git setup for Outreach.
# Safe to run repeatedly — does not touch global git config.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

echo "→ Installing pre-commit hook (secret scanner)…"
mkdir -p .git/hooks
cp scripts/hooks/pre-commit .git/hooks/pre-commit
chmod +x .git/hooks/pre-commit scripts/hooks/pre-commit

echo "→ Verifying git remote…"
if git remote get-url origin >/dev/null 2>&1; then
  echo "   origin: $(git remote get-url origin)"
else
  echo "   WARNING: no origin remote — run: git remote add origin git@github.com:Swastik-exe/outreach.git"
fi

echo "→ Current branch: $(git branch --show-current)"
echo ""
echo "Done. Git hooks active for this repo."
echo ""
echo "Automation summary:"
echo "  push main + backend paths  → GitHub Action → Render deploy hook"
echo "  push main + frontend paths → GitHub Action → Vercel deploy"
echo "  push/PR                    → GitHub Action → CI build (mvn + npm)"
echo ""
echo "Live URLs:"
echo "  Frontend: https://outreach-iota-ruddy.vercel.app"
echo "  Backend:  https://outreach-u35s.onrender.com"
