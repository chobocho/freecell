#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

RELEASE_DIR="release"

echo "========================================="
echo " FreeCell Web - Release Build"
echo "========================================="
echo

# Step 1: TypeScript compile
echo "[1/3] Compiling TypeScript..."
tsc
echo "       Done."

# Step 2: Clean release folder
echo "[2/3] Cleaning release folder..."
rm -rf "$RELEASE_DIR"
mkdir -p "$RELEASE_DIR/css" "$RELEASE_DIR/dist" "$RELEASE_DIR/img"
echo "       Done."

# Step 3: Copy files
echo "[3/3] Copying files..."
cp index.html       "$RELEASE_DIR/"
cp css/style.css    "$RELEASE_DIR/css/"
cp dist/*.js        "$RELEASE_DIR/dist/"
cp img/*            "$RELEASE_DIR/img/"
echo "       Done."
echo

# Summary
JS_COUNT=$(ls "$RELEASE_DIR/dist/"*.js 2>/dev/null | wc -l)
IMG_COUNT=$(ls "$RELEASE_DIR/img/"*    2>/dev/null | wc -l)

echo "========================================="
echo " Build complete: $SCRIPT_DIR/$RELEASE_DIR/"
echo " - index.html"
echo " - css/style.css"
echo " - dist/*.js  ($JS_COUNT files)"
echo " - img/*      ($IMG_COUNT files)"
echo "========================================="
echo
