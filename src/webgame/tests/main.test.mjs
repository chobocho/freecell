// 게임 컨트롤러 (main.ts) — 다시 하기 이펙트 중의 입력 처리
// 가짜 DOM / 타이머 / 화면 갱신으로 실제 GameController 를 구동한다.
import { suite, test, assert, assertEqual } from './helpers.mjs';
import { calcLayout } from '../dist/renderer.js';

// ─── 가짜 타이머 (직접 시간을 진행시킨다) ────────────────────────────────────

let now = 1_000_000;
let nextId = 1;
const timers = new Map();
const addTimer = (fn, delay, repeat) => {
  const id = nextId++;
  timers.set(id, { fn, delay: delay ?? 0, repeat, at: now + (delay ?? 0) });
  return id;
};
const delTimer = (id) => { timers.delete(id); };
globalThis.setTimeout    = (fn, d) => addTimer(fn, d, false);
globalThis.setInterval   = (fn, d) => addTimer(fn, d, true);
globalThis.clearTimeout  = delTimer;
globalThis.clearInterval = delTimer;
Date.now = () => now;
performance.now = () => now;

/** 시간을 ms 만큼 진행시키며 만료된 타이머를 실행 */
function advance(ms) {
  const end = now + ms;
  for (;;) {
    let due = null, dueId = 0;
    for (const [id, t] of timers) {
      if (t.at <= end && (due === null || t.at < due.at)) { due = t; dueId = id; }
    }
    if (!due) break;
    now = due.at;
    if (due.repeat) due.at += due.delay; else timers.delete(dueId);
    due.fn();
  }
  now = end;
}
const intervals = (delay) => [...timers.values()].filter(t => t.repeat && t.delay === delay).length;

// ─── 가짜 DOM ────────────────────────────────────────────────────────────────

const noop = () => {};
const ctx = new Proxy({}, {
  get: (o, k) => (k in o ? o[k] : k === 'measureText' ? () => ({ width: 0 }) : noop),
  set: (o, k, v) => { o[k] = v; return true; },
});
function makeEl(id) {
  const cls = new Set(), listeners = {};
  return {
    id, textContent: '', innerHTML: '', value: '', disabled: false, title: '', dataset: {}, style: {},
    clientWidth: 800, clientHeight: 600, width: 0, height: 0,
    classList: {
      add: (c) => cls.add(c), remove: (c) => cls.delete(c), contains: (c) => cls.has(c),
      toggle: (c, on) => { (on ?? !cls.has(c)) ? cls.add(c) : cls.delete(c); },
    },
    addEventListener: (type, fn) => { (listeners[type] ??= []).push(fn); },
    click() { this.fire('click', {}); },
    fire(type, ev) { for (const fn of listeners[type] ?? []) fn({ preventDefault: noop, ...ev }); },
    focus: noop, select: noop, setAttribute: noop,
    getContext: () => ctx,
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }),
  };
}
const els = new Map();
const el = (id) => { if (!els.has(id)) els.set(id, makeEl(id)); return els.get(id); };

let frame = null;
globalThis.requestAnimationFrame = (fn) => { frame = fn; return 1; };
/** 화면을 n 프레임 그린다 (프레임당 50ms) */
function frames(n) {
  for (let i = 0; i < n; i++) { now += 50; const f = frame; frame = null; f?.(now); }
}

globalThis.HTMLInputElement    = class {};
globalThis.HTMLTextAreaElement = class {};
globalThis.ResizeObserver = class { observe() {} };
globalThis.Image = class { set src(_v) { queueMicrotask(() => this.onerror?.()); } };
globalThis.localStorage = { getItem: () => null, setItem: noop };
// IndexedDB 는 열기에 실패한 것으로 처리 → 저장 기능만 꺼진 채로 게임은 동작
globalThis.indexedDB = {
  open() { const r = { error: null }; queueMicrotask(() => r.onerror?.()); return r; },
};
globalThis.document = {
  getElementById: el, querySelectorAll: () => [], addEventListener: noop, visibilityState: 'visible',
};
const winL = {};
globalThis.window = {
  devicePixelRatio: 1, addEventListener: (type, fn) => { (winL[type] ??= []).push(fn); },
  setTimeout: globalThis.setTimeout, setInterval: globalThis.setInterval,
};
console.warn = noop; // AudioContext / IndexedDB 없음 경고

const tick = () => new Promise(r => setImmediate(r));
await import('../dist/main.js');
for (let i = 0; i < 5; i++) await tick(); // controller.start() 완료 대기

/** 번호 1번 판을 시작한다 */
async function startGame() {
  el('overlay-start-btn').click();
  for (let i = 0; i < 5; i++) await tick();
  el('game-number-input').value = '1';
  el('game-number-start-btn').click();
}
/** 키 입력 (물리 키 코드) */
const key = (code) => {
  for (const fn of winL.keydown ?? []) fn({
    code, key: '', ctrlKey: false, metaKey: false, altKey: false, target: null, preventDefault: noop,
  });
};
/** 진행 중인 판을 버리고 새 판을 시작한다 */
function newGame(number) {
  el('btn-new').click();
  el('confirm-yes-btn').click();
  el('game-number-input').value = String(number);
  el('game-number-start-btn').click();
}
const restart = () => { el('btn-restart').click(); el('confirm-yes-btn').click(); };

// ─── 테스트 ──────────────────────────────────────────────────────────────────

suite('다시 하기 이펙트 중 입력');

test('게임을 시작하면 게임 타이머가 하나 돈다', async () => {
  await startGame();
  assertEqual(intervals(1000), 1, '게임 타이머');
  assertEqual(intervals(100), 0, '다시 하기 대기 없음');
});

test('이펙트 중 다시 하기를 또 눌러도 대기 타이머는 하나뿐', () => {
  restart();
  assertEqual(intervals(100), 1);
  restart();
  restart();
  assertEqual(intervals(100), 1, '대기 타이머가 겹치지 않아야 함');
});

test('이펙트 중에는 일시정지 버튼으로 게임이 재개되지 않음', () => {
  el('btn-pause').click();
  assertEqual(intervals(1000), 0, '보이지 않는 판의 타이머가 돌면 안 됨');
});

test('이펙트 중에는 새 게임/포기 확인 창이 뜨지 않음', () => {
  el('confirm-overlay').classList.add('hidden');
  el('btn-new').click();
  el('btn-give-up').click();
  assert(el('confirm-overlay').classList.contains('hidden'), '확인 창 숨김 유지');
});

test('이펙트가 끝나면 한 번만 다시 시작하고 대기 타이머가 남지 않음', () => {
  frames(200);       // 패배 이펙트 끝까지
  advance(100);      // 대기 폴링 1회
  assertEqual(intervals(100), 0, '대기 타이머 종료');
  assertEqual(intervals(1000), 1, '게임 타이머 재개');
  advance(1000);
  assertEqual(intervals(100), 0, '이후에도 다시 시작이 반복되지 않음');
});

test('다시 시작한 뒤에는 일시정지/재개가 정상 동작', () => {
  el('btn-pause').click();
  assertEqual(intervals(1000), 0, '일시정지');
  el('btn-pause').click();
  assertEqual(intervals(1000), 1, '재개');
});

suite('경과 시간');

test('일시정지할 때 1초 미만의 경과 시간이 버려지지 않음', () => {
  newGame(1);
  for (let i = 0; i < 2; i++) {
    advance(1900);
    el('btn-pause').click(); // 일시정지
    advance(5000);           // 멈춘 동안은 흐르지 않음
    el('btn-pause').click(); // 재개
  }
  advance(1000);
  // 1.9초 + 1.9초 + 1.0초 = 4.8초
  assertEqual(el('timer-value').textContent, '0:04');
});

suite('드래그 중 되돌리기');

test('되돌리기를 하면 진행 중인 드래그가 취소됨 (보이던 카드와 다른 카드가 옮겨지는 것 방지)', () => {
  newGame(1);
  key('Digit1'); key('KeyU'); // Tableau1 맨 위 카드 → FreeCell1
  assertEqual(el('moves-value').textContent, '1', '이동 1회');

  // Tableau2 맨 위 카드(7번째)를 마우스로 집는다
  const L = calcLayout(800, 600);
  const canvas = el('game-canvas');
  canvas.fire('mousedown', { button: 0, clientX: L.tabX[1] + 5, clientY: L.tableauY + 6 * L.stackGap + 5 });
  assert(canvas.classList.contains('dragging'), '드래그 시작');

  el('btn-undo').click();
  assert(!canvas.classList.contains('dragging'), '드래그 취소');
});
