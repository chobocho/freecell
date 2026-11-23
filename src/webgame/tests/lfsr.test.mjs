// LFSR 게임 번호 순환
import { FreecellGame } from '../dist/freecell.js';
import { LFSR_PERIOD, MAX_GAME_NUMBER, lfsrStep, randomLfsrState, isValidLfsrState, nextGameNumber } from '../dist/lfsr.js';
import { suite, test, assert, assertEqual } from './helpers.mjs';

suite('LFSR 게임 번호 순환 (랜덤 새 게임)');

test('lfsrStep: 15비트 최대주기 — 1~32767을 한 번씩 모두 방문 후 복귀', () => {
  const seen = new Uint8Array(LFSR_PERIOD + 1);
  let s = 1;
  for (let i = 0; i < LFSR_PERIOD; i++) {
    assert(s >= 1 && s <= LFSR_PERIOD, `범위 밖 상태 ${s}`);
    assert(!seen[s], `상태 ${s} 중복 (i=${i})`);
    seen[s] = 1;
    s = lfsrStep(s);
  }
  assertEqual(s, 1, '주기 32767 후 시작 상태로 복귀');
});

test('lfsrStep: 0 은 나오지 않음', () => {
  let s = 12345;
  for (let i = 0; i < 1000; i++) { s = lfsrStep(s); assert(s !== 0); }
});

test('randomLfsrState: 항상 1~32767 정수', () => {
  for (let i = 0; i < 2000; i++) {
    const s = randomLfsrState();
    assert(Number.isInteger(s) && s >= 1 && s <= LFSR_PERIOD, `잘못된 상태 ${s}`);
  }
});

test('isValidLfsrState: 저장값 검증', () => {
  assert(isValidLfsrState(1));
  assert(isValidLfsrState(32767));
  for (const bad of [0, 32768, -1, 1.5, NaN, '5', null, undefined, {}]) {
    assert(!isValidLfsrState(bad), `${String(bad)} 는 거부`);
  }
});

test('nextGameNumber: 결과는 1~32000, 반환 상태는 유효한 LFSR 상태', () => {
  let state = 777;
  for (let i = 0; i < 5000; i++) {
    const r = nextGameNumber(state);
    assert(r.gameNumber >= 1 && r.gameNumber <= MAX_GAME_NUMBER, `범위 밖 ${r.gameNumber}`);
    assert(isValidLfsrState(r.state));
    state = r.state;
  }
});

test('nextGameNumber: 같은 상태 → 같은 결과 (결정적)', () => {
  const a = nextGameNumber(4242), b = nextGameNumber(4242);
  assertEqual(a.gameNumber, b.gameNumber);
  assertEqual(a.state, b.state);
});

test('nextGameNumber: 한 바퀴(32000판) 동안 같은 번호가 나오지 않고 전부 등장', () => {
  const seen = new Uint8Array(MAX_GAME_NUMBER + 1);
  let state = 20260;
  for (let i = 0; i < MAX_GAME_NUMBER; i++) {
    const r = nextGameNumber(state);
    assert(!seen[r.gameNumber], `#${r.gameNumber} 중복 (i=${i})`);
    seen[r.gameNumber] = 1;
    state = r.state;
  }
  // 한 바퀴가 끝나면 첫 번호부터 같은 순서로 다시 시작
  assertEqual(nextGameNumber(state).gameNumber, nextGameNumber(20260).gameNumber);
});

test('nextGameNumber: 제외 번호(#11982, 풀 수 없는 판)는 나오지 않고 나머지는 전부 등장', () => {
  const seen = new Uint8Array(MAX_GAME_NUMBER + 1);
  let state = 1;
  for (let i = 0; i < MAX_GAME_NUMBER - 1; i++) {
    const r = nextGameNumber(state, [11982]);
    assert(r.gameNumber !== 11982, '제외 번호 등장');
    assert(!seen[r.gameNumber], `#${r.gameNumber} 중복`);
    seen[r.gameNumber] = 1;
    state = r.state;
  }
});

test('nextGameNumber: 연속 번호가 단순 2배 패턴이 아님', () => {
  let state = 100, doubles = 0, prev = 0;
  for (let i = 0; i < 200; i++) {
    const r = nextGameNumber(state);
    if (prev && (r.gameNumber === prev * 2 || r.gameNumber === prev * 2 + 1)) doubles++;
    prev = r.gameNumber; state = r.state;
  }
  assert(doubles < 5, `2배 패턴 ${doubles}회`);
});

test('nextGameNumber: 고른 번호로 실제 deal 가능', () => {
  const r = nextGameNumber(999, [11982]);
  const g = new FreecellGame();
  g.deal(r.gameNumber);
  assertEqual(g.gameNumber, r.gameNumber);
});
