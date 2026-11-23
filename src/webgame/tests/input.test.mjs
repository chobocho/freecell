// 입력 처리 (키보드 / 터치)
import { DeckIndex } from '../dist/deck.js';
import { suite, test, assert, assertEqual, makeInputEnv, touchOnTop } from './helpers.mjs';

// ─── 입력 처리 (InputHandler) ────────────────────────────────────────────────
// DOM 없이 가짜 window/canvas 로 실제 InputHandler + Renderer 를 구동한다.


suite('키보드: 물리 키(e.code) 기반 단축키 — 한글 IME 대응');

test('한글 IME 상태(key="ㅂ")에서도 Q 자리 키로 Foundation1 선택', () => {
  const env = makeInputEnv();
  env.key('KeyQ', 'ㅂ');
  assertEqual(env.input.getKeyboardState().selectedDeck, DeckIndex.Found1);
});

test('IME 조합 중(key="Process")에도 숫자 3으로 Tableau3 선택', () => {
  const env = makeInputEnv();
  env.key('Digit3', 'Process');
  assertEqual(env.input.getKeyboardState().selectedDeck, DeckIndex.Tableau3);
});

test('한글 IME 상태에서 U/I/O/P 자리 키로 FreeCell 선택', () => {
  const codes = ['KeyU', 'KeyI', 'KeyO', 'KeyP'];
  const hangul = ['ㅕ', 'ㅑ', 'ㅐ', 'ㅔ'];
  codes.forEach((code, i) => {
    const env = makeInputEnv();
    env.key(code, hangul[i]);
    assertEqual(env.input.getKeyboardState().selectedDeck, DeckIndex.Free1 + i, code);
  });
});

test('숫자 키패드(Numpad1~8)로 Tableau 선택', () => {
  for (let n = 1; n <= 8; n++) {
    const env = makeInputEnv();
    env.key(`Numpad${n}`, String(n));
    assertEqual(env.input.getKeyboardState().selectedDeck, DeckIndex.Tableau1 + n - 1, `Numpad${n}`);
  }
});

test('한글 IME 상태에서 Z(되돌리기)·N(새 게임) 동작', () => {
  const env = makeInputEnv();
  env.key('KeyZ', 'ㅋ');
  env.key('KeyN', 'ㅜ');
  assertEqual(env.calls.join(','), 'undo,newGame');
});

test('영문 상태(key="q", code="KeyQ")도 기존대로 동작', () => {
  const env = makeInputEnv();
  env.key('KeyQ', 'q');
  assertEqual(env.input.getKeyboardState().selectedDeck, DeckIndex.Found1);
});

test('code 가 비어 있으면(일부 가상 키보드) key 값으로 대체 인식', () => {
  const env = makeInputEnv();
  env.key('', 'W');
  assertEqual(env.input.getKeyboardState().selectedDeck, DeckIndex.Found2);
  env.key('', 'z');
  assertEqual(env.calls.join(','), 'undo');
});

test('두 번째 덱 키로 이동 요청 (한글 IME 상태)', () => {
  const env = makeInputEnv();
  env.key('Digit1', 'Process');
  env.key('KeyU', 'ㅕ');
  assertEqual(env.calls.length, 1);
  assert(env.calls[0].startsWith(`move:${DeckIndex.Tableau1}:${DeckIndex.Free1}:`), env.calls[0]);
  assertEqual(env.input.getKeyboardState().selectedDeck, null);
});

test('NumpadEnter 로 선택 카드 자동 이동', () => {
  const env = makeInputEnv();
  env.key('Digit2', '2');
  env.key('NumpadEnter', 'Enter');
  assertEqual(env.calls.join(','), `auto:${DeckIndex.Tableau2}`);
});

test('Space 는 일시정지, Escape 는 선택 취소 우선', () => {
  const env = makeInputEnv();
  env.key('Space', ' ');
  assertEqual(env.calls.join(','), 'pause');
  env.key('Digit4', '4');
  env.key('Escape', 'Escape');
  assertEqual(env.input.getKeyboardState().selectedDeck, null);
  assertEqual(env.calls.join(','), 'pause', '선택 취소 시에는 일시정지 호출 안 함');
});

test('Ctrl 조합(Ctrl+N, Ctrl+R 등)은 게임 단축키로 처리하지 않음', () => {
  const env = makeInputEnv();
  env.key('KeyN', 'n', { ctrlKey: true });
  env.key('KeyR', 'r', { ctrlKey: true });
  assertEqual(env.calls.length, 0);
  assertEqual(env.input.getKeyboardState().selectedDeck, null);
});

suite('터치: 멀티터치 드래그 가로채기 방지');


test('한 손가락 드래그 → 드롭은 기존대로 이동 요청', () => {
  const env = makeInputEnv();
  env.touch('touchstart', [touchOnTop(env, DeckIndex.Tableau1, 1)]);
  assert(env.input.getDragState().isDragging, '드래그 시작');
  const L = env.renderer.getLayout();
  const drop = { identifier: 1, clientX: L.freeX[0] + L.cardW / 2, clientY: L.topRowY + L.cardH / 2 };
  env.touch('touchmove', [drop]);
  env.touch('touchend',  [drop]);
  assert(!env.input.getDragState().isDragging, '드래그 종료');
  assertEqual(env.calls.join(','), `move:${DeckIndex.Tableau1}:${DeckIndex.Free1}:1`);
});

test('드래그 중 두 번째 손가락 touchstart 는 드래그를 바꾸지 않음', () => {
  const env = makeInputEnv();
  env.touch('touchstart', [touchOnTop(env, DeckIndex.Tableau1, 1)]);
  const card = env.input.getDragState().cards[0];
  env.touch('touchstart', [touchOnTop(env, DeckIndex.Tableau5, 2)]);
  const d = env.input.getDragState();
  assert(d.isDragging, '드래그 유지');
  assertEqual(d.fromDeck, DeckIndex.Tableau1, '출발 덱 유지');
  assertEqual(d.cards[0], card, '잡은 카드 유지');
});

test('두 번째 손가락의 touchmove 는 드래그 좌표를 움직이지 않음', () => {
  const env = makeInputEnv();
  env.touch('touchstart', [touchOnTop(env, DeckIndex.Tableau1, 1)]);
  const { x, y } = env.input.getDragState();
  env.touch('touchstart', [touchOnTop(env, DeckIndex.Tableau5, 2)]);
  env.touch('touchmove',  [{ identifier: 2, clientX: 700, clientY: 500 }]);
  const d = env.input.getDragState();
  assertEqual(d.x, x, 'x 유지');
  assertEqual(d.y, y, 'y 유지');
});

test('두 번째 손가락을 떼어도 드래그가 끝나거나 카드가 놓이지 않음', () => {
  const env = makeInputEnv();
  env.touch('touchstart', [touchOnTop(env, DeckIndex.Tableau1, 1)]);
  const L = env.renderer.getLayout();
  // 두 번째 손가락이 FreeCell1 위에서 떼어짐 — 예전에는 여기로 카드가 놓였다
  const other = { identifier: 2, clientX: L.freeX[0] + L.cardW / 2, clientY: L.topRowY + L.cardH / 2 };
  env.touch('touchstart', [other]);
  env.touch('touchend',   [other]);
  assert(env.input.getDragState().isDragging, '드래그 유지');
  assertEqual(env.calls.length, 0, '이동/자동이동 요청 없음');
});

test('여러 터치가 함께 보고되어도 드래그 중인 손가락만 추적', () => {
  const env = makeInputEnv();
  env.touch('touchstart', [touchOnTop(env, DeckIndex.Tableau1, 7)]);
  env.touch('touchstart', [touchOnTop(env, DeckIndex.Tableau5, 8)]);
  // changedTouches[0] 이 다른 손가락인 경우
  env.touch('touchmove', [
    { identifier: 8, clientX: 700, clientY: 500 },
    { identifier: 7, clientX: 123, clientY: 234 },
  ]);
  const d = env.input.getDragState();
  assertEqual(d.x, 123);
  assertEqual(d.y, 234);
});

test('드래그 중 두 번째 손가락 탭은 더블탭 자동이동을 일으키지 않음', () => {
  const env = makeInputEnv();
  env.touch('touchstart', [touchOnTop(env, DeckIndex.Tableau1, 1)]);
  env.touch('touchstart', [touchOnTop(env, DeckIndex.Tableau1, 2)]);
  assertEqual(env.calls.length, 0);
  assert(env.input.getDragState().isDragging, '드래그 유지');
});

test('드래그한 손가락을 뗀 뒤에는 다른 손가락으로 새 드래그 가능', () => {
  const env = makeInputEnv();
  const t1 = touchOnTop(env, DeckIndex.Tableau1, 1);
  env.touch('touchstart', [t1]);
  env.touch('touchstart', [touchOnTop(env, DeckIndex.Tableau5, 2)]);
  env.touch('touchend',   [t1]);
  assert(!env.input.getDragState().isDragging, '첫 드래그 종료');
  env.touch('touchend',   [touchOnTop(env, DeckIndex.Tableau5, 2)]);
  env.touch('touchstart', [touchOnTop(env, DeckIndex.Tableau3, 3)]);
  const d = env.input.getDragState();
  assert(d.isDragging, '새 드래그 시작');
  assertEqual(d.fromDeck, DeckIndex.Tableau3);
});

test('touchcancel 후 새 터치로 드래그 가능', () => {
  const env = makeInputEnv();
  env.touch('touchstart', [touchOnTop(env, DeckIndex.Tableau1, 1)]);
  env.touch('touchcancel', [touchOnTop(env, DeckIndex.Tableau1, 1)]);
  assert(!env.input.getDragState().isDragging, '취소됨');
  env.touch('touchstart', [touchOnTop(env, DeckIndex.Tableau2, 5)]);
  assertEqual(env.input.getDragState().fromDeck, DeckIndex.Tableau2);
  assert(env.input.getDragState().isDragging);
});

suite('마우스: 왼쪽 버튼만 드래그');

test('왼쪽 버튼으로 누르면 드래그 시작', () => {
  const env = makeInputEnv();
  const t = touchOnTop(env, DeckIndex.Tableau1, 0);
  env.mouse('mousedown', t.clientX, t.clientY, 0);
  assert(env.input.getDragState().isDragging, '드래그 중');
});

test('오른쪽/가운데 버튼으로는 드래그가 시작되지 않음', () => {
  for (const button of [1, 2]) {
    const env = makeInputEnv();
    const t = touchOnTop(env, DeckIndex.Tableau1, 0);
    env.mouse('mousedown', t.clientX, t.clientY, button);
    assert(!env.input.getDragState().isDragging, `button=${button}`);
  }
});

suite('입력 상태 초기화 (새 판 시작 시)');

test('clearSelection(): 키보드 선택과 드래그를 모두 해제', () => {
  const env = makeInputEnv();
  env.key('Digit3', '3');
  assertEqual(env.input.getKeyboardState().selectedDeck, DeckIndex.Tableau3);
  env.input.clearSelection();
  assertEqual(env.input.getKeyboardState().selectedDeck, null);

  const t = touchOnTop(env, DeckIndex.Tableau1, 0);
  env.mouse('mousedown', t.clientX, t.clientY, 0);
  env.input.clearSelection();
  assert(!env.input.getDragState().isDragging, '드래그 해제');
});
