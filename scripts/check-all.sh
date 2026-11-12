#!/usr/bin/env bash
# scripts/check-all.sh -- unit tests, feature-map check, every browser check and screenshot script, one PASS/FAIL line each.
# Usage: CHROMIUM=/opt/pw-browsers/chromium-1243/chrome-linux64/chrome bash scripts/check-all.sh
cd "$(dirname "$0")/.." || exit 2
export CHROMIUM="${CHROMIUM:-/opt/pw-browsers/chromium-1243/chrome-linux64/chrome}"
LOGS="${CHECK_LOGS:-/tmp/check-all-logs}"
mkdir -p "$LOGS"
fail=0; lines=()
run() { # name, command...
  local name="$1"; shift
  if timeout "${CHECK_TIMEOUT:-600}" "$@" >"$LOGS/$name.log" 2>&1; then lines+=("PASS $name"); else lines+=("FAIL $name (log: $LOGS/$name.log)"); fail=1; fi
}
run unit-tests node --test app/js/*.test.mjs
# the feature-map check loads prototype.html from a static server on 8196 and needs playwright on NODE_PATH
python3 -m http.server 8196 --bind 127.0.0.1 >/dev/null 2>&1 & srv=$!
NODE_PATH=/opt/node22/lib/node_modules run feature-map node docs/generated/friction-steps/check-feature-map.cjs
kill "$srv" 2>/dev/null
for f in scripts/check-*.mjs scripts/shoot-*.mjs; do run "$(basename "$f")" node "$f"; done
printf '%s\n' "${lines[@]}"
exit $fail
