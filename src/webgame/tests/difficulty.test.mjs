// 난이도 표 / 난이도별 게임 번호
import { MAX_GAME_NUMBER, isValidLfsrState } from '../dist/lfsr.js';
import { measure, layoutFromGameNumber } from '../dist/solver.js';
import { DIFFICULTIES, DIFFICULTY_LABEL, isDifficulty, encodeLevels, decodeLevels, difficultyOf, nextGameNumberOfDifficulty } from '../dist/difficulty.js';
import { LEVEL_DATA, LEVEL_EASY_MAX_NODES } from '../dist/levels.js';
import { suite, test, assert, assertEqual } from './helpers.mjs';

suite('난이도 표 / 난이도별 게임 번호');

test('encodeLevels ↔ decodeLevels 왕복 (3의 배수가 아닌 개수 포함)', () => {
  for (const count of [1, 2, 3, 4, 10, 32000]) {
    const levels = new Uint8Array(count + 1);
    for (let n = 1; n <= count; n++) levels[n] = (n * 7 + (n >> 3)) % 3;
    const decoded = decodeLevels(encodeLevels(levels), count);
    for (let n = 1; n <= count; n++) {
      if (decoded[n] !== levels[n]) throw new Error(`count=${count} n=${n}`);
    }
    assertEqual(encodeLevels(levels).length, Math.ceil(count / 3), `count=${count} 길이`);
  }
});

test('난이도 표: 32000판 전부 하/중/상 중 하나', () => {
  assertEqual(LEVEL_DATA.length, Math.ceil(MAX_GAME_NUMBER / 3), '표 길이');
  const levels = decodeLevels(LEVEL_DATA);
  for (let n = 1; n <= MAX_GAME_NUMBER; n++) {
    if (levels[n] > 2) throw new Error(`#${n} 잘못된 값 ${levels[n]}`);
  }
});

test('난이도 표: 하/중/상이 대략 3등분 (각 25%~42%)', () => {
  const count = { easy: 0, medium: 0, hard: 0 };
  for (let n = 1; n <= MAX_GAME_NUMBER; n++) count[difficultyOf(n)]++;
  for (const d of DIFFICULTIES) {
    const ratio = count[d] / MAX_GAME_NUMBER;
    assert(ratio > 0.25 && ratio < 0.42, `${d}: ${count[d]}판 (${(ratio * 100).toFixed(1)}%)`);
  }
});

test('난이도 표: 풀 수 없는 #11982 는 "상"', () => {
  assertEqual(difficultyOf(11982), 'hard');
});

test('difficultyOf: 번호 없는 게임(0)·범위 밖·비정수는 null', () => {
  for (const bad of [0, -1, 32001, 1.5, NaN]) {
    assertEqual(difficultyOf(bad), null, String(bad));
  }
  assert(isDifficulty(difficultyOf(1)));
  assert(isDifficulty(difficultyOf(32000)));
});

test('isDifficulty / DIFFICULTY_LABEL', () => {
  assert(isDifficulty('easy') && isDifficulty('medium') && isDifficulty('hard'));
  for (const bad of ['random', '', null, undefined, 1]) assert(!isDifficulty(bad), String(bad));
  assertEqual(DIFFICULTIES.map(d => DIFFICULTY_LABEL[d]).join(''), '하중상');
});

test('nextGameNumberOfDifficulty: 항상 요청한 난이도의 번호', () => {
  for (const d of DIFFICULTIES) {
    let state = 1234;
    for (let i = 0; i < 300; i++) {
      const r = nextGameNumberOfDifficulty(d, state, [11982]);
      assertEqual(difficultyOf(r.gameNumber), d, `#${r.gameNumber}`);
      assert(isValidLfsrState(r.state));
      state = r.state;
    }
  }
});

test('nextGameNumberOfDifficulty: 그 난이도의 판을 중복 없이 전부 한 번씩 (한 바퀴)', () => {
  for (const d of DIFFICULTIES) {
    let total = 0;
    for (let n = 1; n <= MAX_GAME_NUMBER; n++) {
      if (n !== 11982 && difficultyOf(n) === d) total++;
    }
    const seen = new Uint8Array(MAX_GAME_NUMBER + 1);
    let state = 4321;
    const first = nextGameNumberOfDifficulty(d, state, [11982]).gameNumber;
    for (let i = 0; i < total; i++) {
      const r = nextGameNumberOfDifficulty(d, state, [11982]);
      if (seen[r.gameNumber]) throw new Error(`${d}: #${r.gameNumber} 중복 (i=${i})`);
      seen[r.gameNumber] = 1;
      state = r.state;
    }
    // 한 바퀴가 끝나면 처음 번호부터 다시
    assertEqual(nextGameNumberOfDifficulty(d, state, [11982]).gameNumber, first, d);
  }
});

test('nextGameNumberOfDifficulty: 제외 번호는 나오지 않음', () => {
  let state = 77;
  const seen = new Set();
  for (let i = 0; i < 12000; i++) {
    const r = nextGameNumberOfDifficulty('hard', state, [11982]);
    seen.add(r.gameNumber);
    state = r.state;
  }
  assert(!seen.has(11982), '#11982 등장');
});

test('난이도 표 표본 검증: "하" 판은 솔버가 실제로 적게 헤매고 풀이가 재생됨', () => {
  let state = 2024, checked = 0;
  while (checked < 5) {
    const r = nextGameNumberOfDifficulty('easy', state);
    state = r.state;
    const m = measure(layoutFromGameNumber(r.gameNumber), 30000);
    assert(m.solved, `#${r.gameNumber} 미해결`);
    assert(m.nodes <= LEVEL_EASY_MAX_NODES, `#${r.gameNumber}: ${m.nodes} > ${LEVEL_EASY_MAX_NODES}`);
    checked++;
  }
});
