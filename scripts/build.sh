#!/usr/bin/env bash
# Assemble loadable extensions in dist/chrome and dist/firefox,
# and zip them for store upload.
set -euo pipefail
cd "$(dirname "$0")/.."

rm -rf dist
for target in chrome firefox; do
  out="dist/$target"
  mkdir -p "$out"
  cp -r src vendor icons "$out/"
  cp "manifest.$target.json" "$out/manifest.json"
  (cd "$out" && zip -qr "../counterpoint-$target.zip" .)
  echo "built $out (and dist/counterpoint-$target.zip)"
done
