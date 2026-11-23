// ─── 난이도 ──────────────────────────────────────────────────────────────────
// 게임 번호(1~32000)마다 하/중/상 난이도가 정해져 있다 (levels.ts — 솔버로 미리 계산한 표).
// 난이도별 새 게임은 LFSR 번호 순환에서 해당 난이도의 번호만 골라 쓴다.

import { LEVEL_DATA } from './levels.js';
import { MAX_GAME_NUMBER, nextGameNumber } from './lfsr.js';

export type Difficulty = 'easy' | 'medium' | 'hard';

export const DIFFICULTIES: readonly Difficulty[] = ['easy', 'medium', 'hard'];

export const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  easy: '하', medium: '중', hard: '상',
};

export function isDifficulty(v: unknown): v is Difficulty {
  return v === 'easy' || v === 'medium' || v === 'hard';
}

// ─── 난이도 표 인코딩 ────────────────────────────────────────────────────────
// 게임 번호 1부터 3판씩 한 글자에 담는다 (판당 2비트: 0=하 1=중 2=상).

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/** levels[게임 번호] = 0|1|2 (인덱스 0은 사용하지 않음) → 문자열 */
export function encodeLevels(levels: ArrayLike<number>): string {
  let out = '';
  for (let n = 1; n < levels.length; n += 3) {
    const a = levels[n] ?? 0, b = levels[n + 1] ?? 0, c = levels[n + 2] ?? 0;
    out += ALPHABET[a | (b << 2) | (c << 4)];
  }
  return out;
}

/** 문자열 → levels[게임 번호] = 0|1|2 (인덱스 0은 사용하지 않음) */
export function decodeLevels(data: string, count: number = MAX_GAME_NUMBER): Uint8Array {
  const levels = new Uint8Array(count + 1);
  for (let i = 0; i < data.length; i++) {
    const v = ALPHABET.indexOf(data[i]);
    for (let k = 0; k < 3; k++) {
      const n = i * 3 + k + 1;
      if (n <= count) levels[n] = (v >> (k * 2)) & 3;
    }
  }
  return levels;
}

let _levels: Uint8Array | null = null;

/** 게임 번호의 난이도. 번호 없는 게임(0)이나 범위 밖이면 null */
export function difficultyOf(gameNumber: number): Difficulty | null {
  if (!Number.isInteger(gameNumber) || gameNumber < 1 || gameNumber > MAX_GAME_NUMBER) return null;
  if (_levels === null) _levels = decodeLevels(LEVEL_DATA);
  return DIFFICULTIES[_levels[gameNumber]] ?? null;
}

/**
 * LFSR 순서로 해당 난이도의 다음 게임 번호를 고른다.
 * 번호 순환(nextGameNumber)에서 다른 난이도의 번호는 건너뛰므로,
 * 그 난이도의 모든 판을 한 번씩 다 할 때까지 같은 번호가 나오지 않는다.
 * @param state   그 난이도의 현재 LFSR 상태 (난이도별로 따로 저장)
 * @param exclude 뽑지 않을 게임 번호 (풀 수 없는 판 등)
 */
export function nextGameNumberOfDifficulty(
  difficulty: Difficulty,
  state: number,
  exclude: readonly number[] = [],
): { gameNumber: number; state: number } {
  let r = nextGameNumber(state, exclude);
  // 표가 손상되어 해당 난이도의 판이 하나도 없더라도 멈추지 않도록 한 바퀴까지만 찾는다
  for (let i = 0; i < MAX_GAME_NUMBER && difficultyOf(r.gameNumber) !== difficulty; i++) {
    r = nextGameNumber(r.state, exclude);
  }
  return r;
}
