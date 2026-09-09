#!/bin/sh
# Bundle the REAL IntakeForm + the REAL assessment-intake schema for the local
# harness. Only @/lib/intake-actions is swapped for a fetch stub.
set -e
WEB="${WEB:-$(cd "$(dirname "$0")/../../.." && pwd)}"
H="$(cd "$(dirname "$0")" && pwd)"
mkdir -p "$H/build"

"$WEB/node_modules/.bin/esbuild" "$H/entry.tsx" \
  --bundle --format=iife --jsx=automatic --loader:.tsx=tsx --loader:.ts=ts \
  --define:process.env.NODE_ENV='"development"' \
  --alias:@/lib/intake-actions="$H/stub-actions.ts" \
  --alias:@="$WEB" \
  --outfile="$H/build/bundle.js" --log-level=warning

"$WEB/node_modules/.bin/esbuild" "$WEB/lib/assessment-intake.ts" \
  --bundle --platform=node --format=cjs \
  --alias:@="$WEB" \
  --outfile="$H/build/intake-lib.cjs" --log-level=warning

echo "built $H/build"
