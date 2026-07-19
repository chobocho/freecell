#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

RELEASE_DIR="release"
OUT_HTML="$RELEASE_DIR/index.html"

echo "========================================="
echo " FreeCell Web - Single-File Release Build"
echo "========================================="
echo

# Step 1: TypeScript compile
echo "[1/3] Compiling TypeScript..."
tsc
echo "       Done."

# Step 2: Clean release folder
echo "[2/3] Cleaning release folder..."
rm -rf "$RELEASE_DIR"
mkdir -p "$RELEASE_DIR"
echo "       Done."

# Step 3: Bundle everything into a single self-contained index.html
#         - CSS  -> inlined <style>
#         - JS   -> all ES modules concatenated into one <script type="module">
#         - IMG  -> every img/*.png embedded as base64 data URI
#         (sounds are generated at runtime via Web Audio API, no files needed)
echo "[3/3] Bundling into single index.html..."
node bundle.js
echo "       Done."
echo

echo "========================================="
echo " Build complete: $SCRIPT_DIR/$OUT_HTML"
echo " - Single self-contained file (open directly in a browser)"
echo "========================================="
echo
