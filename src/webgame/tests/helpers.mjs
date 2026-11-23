/**
 * 테스트 공용 도우미 (node:test 기반)
 *
 * 실행: tsc && node --test        (webgame 폴더에서, tests/*.test.mjs 전체)
 *       node --test tests/solver.test.mjs   (파일 하나만)
 *
 * 테스트 파일은 suite('묶음 이름') 뒤에 test('설명', fn) 을 나열하는 형태다.
 * 테스트 이름은 "묶음 이름 › 설명" 으로 보고된다.
 */
import { test as nodeTest } from 'node:test';
import { Card } from '../dist/card.js';
import { FreecellGame } from '../dist/freecell.js';
import { InputHandler } from '../dist/input.js';
import { Renderer } from '../dist/renderer.js';

// ─── suite / test / assert ──────────────────────────────────────────────────

let currentSuite = '';

/** 이후 등록되는 테스트가 속할 묶음 이름을 지정한다 */
export function suite(name) {
  currentSuite = name;
}

/** 테스트 등록. fn 은 동기/비동기 모두 가능 */
export function test(desc, fn) {
  return nodeTest(currentSuite ? `${currentSuite} › ${desc}` : desc, fn);
}

/** 비동기 테스트 등록 (test 와 같음 — 기존 테스트 코드의 호출 형태 유지용) */
export const testAsync = test;

export function assert(condition, msg) {
  if (!condition) throw new Error(msg || '조건 불만족');
}

export function assertEqual(a, b, msg) {
  if (a !== b) throw new Error(
    (msg ? msg + ' ' : '') + `기대: ${JSON.stringify(b)}, 실제: ${JSON.stringify(a)}`
  );
}

// ─── 공용 도우미 ────────────────────────────────────────────────────────────

/** 앞면이 보이는 카드 한 장 */
export function makeOpen(fig, num) { const c = new Card(fig, num); c.open(); return c; }

/**
 * DOM 없이 가짜 window/canvas 로 실제 InputHandler + Renderer 를 구동하는 환경.
 * key(code, key, mods) / touch(type, touches) 로 이벤트를 보내고, 콜백 호출은 calls 에 기록된다.
 */
export function makeInputEnv(gameNumber = 1) {
  const winL = {}, canL = {};
  globalThis.HTMLInputElement    = globalThis.HTMLInputElement    ?? class {};
  globalThis.HTMLTextAreaElement = globalThis.HTMLTextAreaElement ?? class {};
  globalThis.window = {
    devicePixelRatio: 1,
    addEventListener: (type, fn) => { winL[type] = fn; },
  };
  const canvas = {
    clientWidth: 800, clientHeight: 600, width: 0, height: 0,
    getContext: () => ({ scale() {} }),
    addEventListener: (type, fn) => { canL[type] = fn; },
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }),
    classList: { add() {}, remove() {} },
  };
  const game = new FreecellGame();
  game.deal(gameNumber);
  const renderer = new Renderer(canvas);
  renderer.resize();
  const calls = [];
  const input = new InputHandler(canvas, game, renderer, {
    onNewGame:  () => calls.push('newGame'),
    onUndo:     () => calls.push('undo'),
    onPause:    () => calls.push('pause'),
    onHelp:     () => calls.push('help'),
    onMoveCard: (from, to, count) => { calls.push(`move:${from}:${to}:${count}`); return true; },
    onAutoMove: (from) => calls.push(`auto:${from}`),
    onAutoComplete: () => calls.push('autoComplete'),
    isHelpOpen: () => false,
    isModalBlocking: () => false,
  });
  const key = (code, k, mods = {}) => winL.keydown({
    code, key: k, ctrlKey: false, metaKey: false, altKey: false,
    target: null, preventDefault() {}, ...mods,
  });
  const touch = (type, touches) => canL[type]({ changedTouches: touches, preventDefault() {} });
  return { game, renderer, input, calls, key, touch };
}

/** 덱 맨 위 카드의 중앙 좌표에 해당하는 가짜 Touch */
export function touchOnTop(env, deckIdx, identifier) {
  const deck = env.game.getDeck(deckIdx);
  const r = env.renderer.getCardRect(deckIdx, deck.size() - 1, env.game);
  return { identifier, clientX: r.x + r.w / 2, clientY: r.y + r.h / 2 };
}
