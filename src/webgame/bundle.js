/**
 * bundle.js — assembles a single self-contained release/index.html.
 *
 * Inlines everything the game needs so it can be opened directly in a browser
 * with zero external files:
 *   - CSS  -> inlined <style>
 *   - JS   -> one IIFE bundle produced by esbuild from dist/main.js
 *   - IMG  -> every img/*.png embedded as a base64 data URI (window.__IMG__,
 *             read by loadImages() in src/renderer.ts)
 *   (sounds are generated at runtime via Web Audio API, no files needed)
 *
 * Usage (called by build.sh / build.bat after `tsc` and esbuild):
 *   node bundle.js <bundled-iife.js>
 *
 * Module order and import/export removal are esbuild's job, so adding a
 * module under src/ needs no change here.
 */
'use strict';

const fs = require('fs');
const path = require('path');

/**
 * Replace exactly one match of `pattern` in `text` with `replacement`.
 * Uses a replacer function so `$&`, `$1`, `$$` inside the inserted code or CSS
 * are kept literally. Throws when the tag is missing, so a changed index.html
 * fails the build instead of silently shipping a broken release.
 */
function replaceOnce(text, pattern, replacement, what) {
  let count = 0;
  const out = text.replace(pattern, () => { count++; return replacement; });
  if (count !== 1) throw new Error(`index.html: ${what} not found`);
  return out;
}

/**
 * Build the standalone HTML.
 * @param {{html: string, css: string, bundle: string, images: Record<string, string>}} parts
 *   html   — index.html source
 *   css    — stylesheet text
 *   bundle — IIFE JavaScript (no import/export)
 *   images — image name -> data URI
 * @returns {string}
 */
function assemble({ html, css, bundle, images }) {
  if (/<\/script/i.test(bundle)) {
    throw new Error('bundle contains "</script", which would end the inline script early');
  }
  if (/^\s*(import|export)\s/m.test(bundle)) {
    throw new Error('bundle still has import/export statements (expected an IIFE bundle)');
  }

  // JSON is valid JavaScript here; escape "<" so no value can close the script tag.
  const imgJson = JSON.stringify(images).replace(/</g, '\\u003c');

  let out = html;
  out = replaceOnce(
    out, /[ \t]*<link rel="stylesheet"[^>]*>[ \t]*\r?\n?/,
    `  <style>\n${css}\n  </style>\n`, 'stylesheet <link>');
  // Favicon points at img/icon.png which is not part of the asset set — drop it
  // so the standalone file has zero external references. (Optional tag.)
  out = out.replace(/[ \t]*<link rel="icon"[^>]*>[ \t]*\r?\n?/, '');
  out = replaceOnce(
    out, /[ \t]*<script type="module" src="dist\/main\.js"><\/script>/,
    `  <script>window.__IMG__ = ${imgJson};</script>\n  <script>\n${bundle}\n  </script>`,
    'module <script> for dist/main.js');
  return out;
}

/** Read img/*.png as data URIs keyed by file name without extension. */
function readImages(dir) {
  const images = {};
  for (const file of fs.readdirSync(dir).sort()) {
    if (!file.endsWith('.png')) continue;
    const b64 = fs.readFileSync(path.join(dir, file)).toString('base64');
    images[file.slice(0, -4)] = `data:image/png;base64,${b64}`;
  }
  return images;
}

function main() {
  const bundlePath = process.argv[2];
  if (!bundlePath) {
    console.error('usage: node bundle.js <bundled-iife.js>   (run build.sh / build.bat instead)');
    process.exit(1);
  }
  const bundle = fs.readFileSync(path.resolve(bundlePath), 'utf8');
  process.chdir(__dirname);

  // Catch a truncated or broken bundle before it is shipped.
  new Function(bundle); // eslint-disable-line no-new-func

  const images = readImages('img');
  const html = assemble({
    html: fs.readFileSync('index.html', 'utf8'),
    css: fs.readFileSync('css/style.css', 'utf8'),
    bundle,
    images,
  });

  fs.mkdirSync('release', { recursive: true });
  const outPath = path.join('release', 'index.html');
  fs.writeFileSync(outPath, html);

  const kb = (fs.statSync(outPath).size / 1024).toFixed(1);
  console.log(`       index.html: ${kb} KB (${Object.keys(images).length} images embedded)`);
}

module.exports = { assemble };

if (require.main === module) {
  try {
    main();
  } catch (e) {
    console.error(`BUNDLE FAILED: ${e.message}`);
    process.exit(1);
  }
}
