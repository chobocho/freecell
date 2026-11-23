/**
 * bundle.js — assembles a single self-contained release/index.html.
 *
 * Inlines everything the game needs so it can be opened directly in a browser
 * with zero external files:
 *   - CSS  -> inlined <style>
 *   - JS   -> all ES modules concatenated into one <script type="module">
 *   - IMG  -> every img/*.png embedded as a base64 data URI
 *   (sounds are generated at runtime via Web Audio API, no files needed)
 *
 * Run from the webgame directory: `node bundle.js`
 * Assumes `tsc` has already emitted dist/*.js.
 */
'use strict';

const fs = require('fs');
const path = require('path');

process.chdir(__dirname);

const read = (p) => fs.readFileSync(p, 'utf8');

// --- 1. HTML shell -------------------------------------------------------
let html = read('index.html');

// --- 2. Inline CSS -------------------------------------------------------
const css = read('css/style.css');

// --- 3. Bundle JS modules ------------------------------------------------
// Dependency order (leaf -> root). Each module is a plain ES2020 module
// emitted by tsc; because they share one <script type="module"> scope we can
// simply drop the local import lines and the `export` keyword.
const MODULE_ORDER = [
  'card', 'deck', 'lfsr', 'sound', 'storage',
  'freecell', 'input', 'renderer', 'main',
];

const bundle = MODULE_ORDER.map((name) => {
  let code = read(`dist/${name}.js`);
  code = code
    // drop `import ... from './x.js';` (local module imports, single-line)
    .replace(/^\s*import\s.*from\s+['"]\.\/.*['"];\s*$/gm, '')
    // drop leading `export ` on top-level declarations
    .replace(/^export\s+/gm, '')
    // drop sourceMappingURL comments
    .replace(/^\/\/#\s*sourceMappingURL=.*$/gm, '');
  return `// ===== ${name}.js =====\n${code.trim()}\n`;
}).join('\n');

// Serve embedded images instead of hitting the filesystem: patch the loader's
// `img.src = ` line to prefer the inlined data-URI map when present.
const patched = bundle.replace(
  /img\.src = `\$\{baseUrl\}\$\{name\}\.png`;/,
  'img.src = (window.__IMG__ && window.__IMG__[name]) || `${baseUrl}${name}.png`;'
);
if (patched === bundle) {
  console.error('WARNING: image loader line not found — images may not be inlined.');
}

// --- 4. Embed images as base64 data URIs ---------------------------------
const imgMap = {};
for (const file of fs.readdirSync('img').sort()) {
  if (!file.endsWith('.png')) continue;
  const name = file.slice(0, -4);
  const b64 = fs.readFileSync(`img/${file}`).toString('base64');
  imgMap[name] = `data:image/png;base64,${b64}`;
}
const imgScript =
  `<script>window.__IMG__ = ${JSON.stringify(imgMap)};</script>`;

// --- 5. Assemble ---------------------------------------------------------
// Replace the external stylesheet link with an inline <style>.
html = html.replace(
  /[ \t]*<link rel="stylesheet"[^>]*>\s*/,
  `  <style>\n${css}\n  </style>\n`
);
// Favicon points at img/icon.png which is not part of the asset set — drop it
// so the standalone file has zero external references.
html = html.replace(/[ \t]*<link rel="icon"[^>]*>\s*\n?/, '');

// Replace the external module script with the image map + inlined bundle.
html = html.replace(
  /[ \t]*<script type="module" src="dist\/main\.js"><\/script>/,
  `  ${imgScript}\n  <script type="module">\n${patched}\n  </script>`
);

fs.mkdirSync('release', { recursive: true });
fs.writeFileSync(path.join('release', 'index.html'), html);

const bytes = fs.statSync(path.join('release', 'index.html')).size;
console.log(`       index.html: ${(bytes / 1024).toFixed(1)} KB (${Object.keys(imgMap).length} images embedded)`);
