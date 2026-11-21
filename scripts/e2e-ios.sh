#!/usr/bin/env bash
# Requires an installed E2E app and an already-running, seeded dev API.
set -euo pipefail
cd "$(dirname "$0")/.."

for command in maestro xcrun python3 curl; do
  command -v "$command" >/dev/null || { echo "Missing prerequisite: $command" >&2; exit 1; }
done

DEVICE="${E2E_DEVICE:-$(xcrun simctl list devices booted -j | python3 -c '
import json, sys
ids = [d["udid"] for group in json.load(sys.stdin)["devices"].values() for d in group if d["state"] == "Booted"]
if len(ids) != 1:
    sys.exit("Boot exactly one iOS simulator, or set E2E_DEVICE to its UDID.")
print(ids[0])
')}"
APP_ID=app.puzzlepause.mobile.e2e
if [[ -n "${E2E_APP_PATH:-}" ]]; then
  xcrun simctl install "$DEVICE" "$E2E_APP_PATH"
fi
xcrun simctl get_app_container "$DEVICE" "$APP_ID" app >/dev/null || {
  echo "Build/install first: npm run e2e:ios:build (or set E2E_APP_PATH)." >&2
  exit 1
}

BACKEND_DIR="${E2E_BACKEND_DIR:-../daily_puzzle_app}"
DB="${E2E_DB_PATH:-$BACKEND_DIR/data/puzzle.db}"
EMAIL="${E2E_EMAIL:-mobile-e2e@example.com}"
PORT="${E2E_BRIDGE_PORT:-8766}"
RESULTS="${E2E_RESULTS_DIR:-e2e-results}"
mkdir -p "$RESULTS"

python3 scripts/e2e-login-bridge.py --db "$DB" --email "$EMAIL" --port "$PORT" >"$RESULTS/login-bridge.log" 2>&1 &
BRIDGE_PID=$!
trap 'kill "$BRIDGE_PID" 2>/dev/null || true; wait "$BRIDGE_PID" 2>/dev/null || true' EXIT
READY=false
for _ in {1..50}; do
  if ! kill -0 "$BRIDGE_PID" 2>/dev/null; then
    echo "Login bridge failed. See $RESULTS/login-bridge.log" >&2
    exit 1
  fi
  if curl --fail --silent "http://127.0.0.1:$PORT/health" >/dev/null; then
    READY=true
    break
  fi
  sleep 0.1
done
[[ "$READY" == true ]] || { echo "Login bridge did not become ready" >&2; exit 1; }

START=$SECONDS
maestro --device "$DEVICE" test \
  -e "E2E_EMAIL=$EMAIL" \
  -e "BRIDGE_URL=http://127.0.0.1:$PORT" \
  --format junit --output "$RESULTS/junit.xml" \
  --debug-output "$RESULTS/debug" \
  .maestro/smoke.yaml
echo "iOS smoke completed in $((SECONDS - START))s (excluding build/install)."
