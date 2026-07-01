#!/usr/bin/env bash
# Canonical local backend: ONE instance on port 8080 (see brain.md).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PORT="${PORT:-8080}"

# Load env (strip CRLF from Windows-edited .env)
if [ -f "$ROOT/.env" ]; then
  set -a
  # shellcheck disable=SC1091
  source <(sed 's/\r$//' "$ROOT/.env")
  set +a
fi

export PORT

export SPRING_PROFILES_ACTIVE="${SPRING_PROFILES_ACTIVE:-dev}"

# Kill stale JVM on the canonical port so old code cannot keep serving.
# Some stale processes are root-owned (from a prior `sudo`/root shell) and
# invisible to a non-root fuser/lsof — retry with sudo if the port is still busy.
kill_port() {
  if command -v fuser >/dev/null 2>&1; then
    fuser -k "${PORT}/tcp" 2>/dev/null || true
  elif command -v lsof >/dev/null 2>&1; then
    stale_pids=$(lsof -ti:"$PORT" 2>/dev/null || true)
    if [ -n "$stale_pids" ]; then
      kill $stale_pids 2>/dev/null || true
    fi
  fi
  sleep 1

  if command -v ss >/dev/null 2>&1 && ss -tln 2>/dev/null | grep -q ":${PORT} "; then
    echo "Port ${PORT} still busy — retrying kill as root (stale process may be root-owned)..."
    sudo -n fuser -k "${PORT}/tcp" 2>/dev/null || true
    sleep 1
  fi
}
kill_port

echo "Starting Outreach backend on http://localhost:${PORT} (profile: ${SPRING_PROFILES_ACTIVE:-default})"
cd "$ROOT"
exec ./mvnw spring-boot:run -Dspring-boot.run.arguments="--server.port=${PORT}"
