#!/usr/bin/env bash
# Free common Next ports, wipe .next, start a single dev server on 3000.
# Run from repo root: npm run dev:reset
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

for port in 3000 3001 3002; do
  pids=$(lsof -nP -iTCP:"$port" -sTCP:LISTEN -t 2>/dev/null || true)
  if [[ -n "${pids}" ]]; then
    echo "Port $port in use by PID(s): $pids — sending SIGKILL"
    kill -9 $pids 2>/dev/null || true
  fi
done

sleep 0.5
rm -rf .next
rm -rf node_modules/.cache
echo "Starting Next on http://localhost:3000 (clean .next + webpack cache)"
exec npx next dev -p 3000
