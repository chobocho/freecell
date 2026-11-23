#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

RELEASE_DIR="release"
OUT_HTML="$RELEASE_DIR/index.html"

# esbuild command. Default downloads esbuild through npx on first use (needs
# network once; cached afterwards). Override to use an installed copy, e.g.
#   ESBUILD="esbuild" bash build.sh
#   ESBUILD="npx --no-install esbuild" bash build.sh   # never download
ESBUILD="${ESBUILD:-npx --yes esbuild}"

TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

echo "========================================="
echo " FreeCell Web - Single-File Release Build"
echo "========================================="
echo

# Step 1: TypeScript compile (type-check + emit dist/*.js).
# Use an installed compiler when available; otherwise download the JS-based
# TypeScript 5 compiler via npx (also works on Termux/Android).
echo "[1/4] Compiling TypeScript..."
if command -v tsc >/dev/null 2>&1; then
  tsc
else
  npx --yes --package typescript@5.9.3 tsc
fi
echo "       Done."

# Step 2: Bundle all modules into one IIFE.
#         esbuild follows the imports from dist/main.js, so module order and
#         import/export removal need no manual list.
echo "[2/4] Bundling JS (esbuild)..."
$ESBUILD dist/main.js \
  --bundle --format=iife --target=es2020 --charset=utf8 --log-level=warning \
  --outfile="$TMP_DIR/bundle.js"
echo "       Done."

# Step 3: Clean release folder
echo "[3/4] Cleaning release folder..."
rm -rf "$RELEASE_DIR"
mkdir -p "$RELEASE_DIR"
echo "       Done."

# Step 4: Inline everything into a single self-contained index.html
#         - CSS  -> inlined <style>
#         - JS   -> the IIFE bundle in one <script>
#         - IMG  -> every img/*.png embedded as base64 data URI
#         (sounds are generated at runtime via Web Audio API, no files needed)
echo "[4/4] Inlining into single index.html..."
node bundle.js "$TMP_DIR/bundle.js"
echo "       Done."
echo

echo "========================================="
echo " Build complete: $SCRIPT_DIR/$OUT_HTML"
echo " - Single self-contained file (open directly in a browser)"
echo "========================================="
echo
