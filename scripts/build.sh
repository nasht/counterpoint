#!/usr/bin/env bash
# Assemble loadable extensions in dist/chrome and dist/firefox,
# and zip them for store upload.
set -euo pipefail
cd "$(dirname "$0")/.."

stamp="$(git rev-parse --short HEAD 2>/dev/null || echo unknown) $(date -u +%Y-%m-%d\ %H:%M)Z"

rm -rf dist
for target in chrome firefox; do
  out="dist/$target"
  mkdir -p "$out"
  cp -r src vendor icons "$out/"
  cp "manifest.$target.json" "$out/manifest.json"
  printf 'export const BUILD_INFO = "%s";\n' "$stamp" > "$out/src/lib/version.js"
  (cd "$out" && zip -qr "../counterpoint-$target.zip" .)
  echo "built $out (and dist/counterpoint-$target.zip)"
done
