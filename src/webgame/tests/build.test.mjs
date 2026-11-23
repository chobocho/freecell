// 릴리스 빌드 (bundle.js, 이미지 내장, 파비콘)
import { loadImages } from '../dist/renderer.js';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { suite, test, testAsync, assert, assertEqual } from './helpers.mjs';

// ─── 릴리스 빌드 (bundle.js) ─────────────────────────────────────────────────

suite('릴리스 빌드: 이미지 내장 / 단일 HTML 조립');

/** 가짜 Image: src 가 지정되면 기록하고 다음 틱에 onload 호출 */
function installFakeImage() {
  const srcs = [];
  globalThis.Image = class {
    set src(v) { srcs.push(v); queueMicrotask(() => this.onload && this.onload()); }
  };
  return srcs;
}

await testAsync('loadImages: 내장 이미지 맵(__IMG__)이 없으면 img/이름.png 를 불러온다', async () => {
  delete globalThis.__IMG__;
  const srcs = installFakeImage();
  const map = await loadImages('img/');
  assert(srcs.includes('img/abg.png'), 'abg.png 경로');
  assert(srcs.every(v => v.startsWith('img/') && v.endsWith('.png')), '모두 파일 경로');
  assertEqual(map.size, srcs.length);
});

await testAsync('loadImages: 내장 이미지 맵에 있는 이미지는 data URI 를, 없는 이미지는 파일 경로를 쓴다', async () => {
  globalThis.__IMG__ = { abg: 'data:image/png;base64,AAAA' };
  try {
    const srcs = installFakeImage();
    await loadImages('img/');
    assert(srcs.includes('data:image/png;base64,AAAA'), 'abg 는 내장 이미지');
    assert(!srcs.includes('img/abg.png'), 'abg 를 파일로 요청하지 않음');
    assertEqual(srcs.filter(v => v.startsWith('img/')).length, srcs.length - 1, '나머지는 파일 경로');
  } finally {
    delete globalThis.__IMG__;
  }
});

const { assemble } = createRequire(import.meta.url)('../bundle.js');

const SHELL = [
  '<html><head>',
  '  <link rel="icon" href="img/icon.png">',
  '  <link rel="stylesheet" href="css/style.css">',
  '</head><body>',
  '  <script type="module" src="dist/main.js"></script>',
  '</body></html>',
].join('\n');

test('assemble: CSS·JS·이미지를 넣고 외부 참조를 남기지 않는다', () => {
  const out = assemble({
    html: SHELL, css: 'body{color:red}', bundle: '(() => { run(); })();',
    images: { abg: 'data:image/png;base64,AAAA' },
  });
  assert(out.includes('<style>\nbody{color:red}'), 'CSS 인라인');
  assert(out.includes('(() => { run(); })();'), 'JS 인라인');
  assert(out.includes('"abg":"data:image/png;base64,AAAA"'), '이미지 맵');
  assert(!/<link\b/.test(out), 'link 태그 없음');
  assert(!/\bsrc=/.test(out), '외부 src 없음');
  assert(!out.includes('type="module"'), '모듈 스크립트가 아님 (IIFE)');
  assert(out.indexOf('__IMG__') < out.indexOf('run()'), '이미지 맵이 게임 코드보다 먼저');
});

test('assemble: 코드·CSS 안의 $& $1 $$ 같은 문자열을 그대로 보존한다', () => {
  const out = assemble({
    html: SHELL, css: 'a::after{content:"$&"}', bundle: 'const s = "$& $1 $$ $\'";', images: {},
  });
  assert(out.includes('const s = "$& $1 $$ $\'";'), 'JS 보존');
  assert(out.includes('a::after{content:"$&"}'), 'CSS 보존');
});

test('assemble: index.html 에 교체할 태그가 없으면 오류', () => {
  const noScript = SHELL.replace(/\s*<script[^\n]*/, '');
  const noCss = SHELL.replace(/\s*<link rel="stylesheet"[^\n]*/, '');
  let e1 = null, e2 = null;
  try { assemble({ html: noScript, css: '', bundle: 'x()', images: {} }); } catch (e) { e1 = e; }
  try { assemble({ html: noCss, css: '', bundle: 'x()', images: {} }); } catch (e) { e2 = e; }
  assert(e1 !== null, '스크립트 태그 없음 → 오류');
  assert(e2 !== null, '스타일시트 태그 없음 → 오류');
});

test('assemble: 번들에 </script 가 들어 있으면 오류 (HTML 이 깨짐)', () => {
  let err = null;
  try { assemble({ html: SHELL, css: '', bundle: 'const s = "</script>";', images: {} }); }
  catch (e) { err = e; }
  assert(err !== null);
});

test('assemble: 번들에 import/export 구문이 남아 있으면 오류 (IIFE 가 아님)', () => {
  let err = null;
  try { assemble({ html: SHELL, css: '', bundle: 'import { a } from "./a.js";\na();', images: {} }); }
  catch (e) { err = e; }
  assert(err !== null);
});

test('assemble: icon 을 주면 파비콘을 data URI 로 내장한다', () => {
  const out = assemble({
    html: SHELL, css: '', bundle: 'x()', images: {}, icon: 'data:image/png;base64,ICON',
  });
  assert(out.includes('<link rel="icon" href="data:image/png;base64,ICON">'), '파비콘 내장');
  assert(!out.includes('img/icon.png'), '외부 파일 참조 없음');
  assertEqual((out.match(/<link\b/g) || []).length, 1, 'link 는 파비콘 하나뿐');
});

test('assemble: icon 이 없으면 파비콘 태그를 지운다 (깨진 참조를 남기지 않음)', () => {
  const out = assemble({ html: SHELL, css: '', bundle: 'x()', images: {} });
  assert(!/<link\b/.test(out));
});

test('img/icon.png: index.html 이 가리키는 파비콘 파일이 있고 정사각형 PNG 이다', () => {
  const buf = readFileSync(new URL('../img/icon.png', import.meta.url));
  assertEqual(buf.subarray(1, 4).toString('latin1'), 'PNG');
  const w = buf.readUInt32BE(16), h = buf.readUInt32BE(20);
  assertEqual(w, h, '정사각형');
  assert(w >= 64, `너무 작음: ${w}`);
  assert(buf.length < 20000, `너무 큼: ${buf.length} bytes`);
});
