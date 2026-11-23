// 게임 번호 배치 / 같은 판 다시 하기 / 포기
import { Figure } from '../dist/card.js';
import { DeckIndex } from '../dist/deck.js';
import { FreecellGame } from '../dist/freecell.js';
import { SOLVER_PROFILES, solve, replaySolution, layoutFromGameNumber } from '../dist/solver.js';
import { suite, test, assert, assertEqual, makeInputEnv, touchOnTop } from './helpers.mjs';

// ─── FreecellGame - 게임 번호 / restart ─────────────────────────────────────

suite('FreecellGame - 게임 번호 & restart');

test('deal(1) → gameNumber === 1', () => {
  const g = new FreecellGame(); g.deal(1);
  assertEqual(g.gameNumber, 1);
});

test('deal(32000) → gameNumber === 32000', () => {
  const g = new FreecellGame(); g.deal(32000);
  assertEqual(g.gameNumber, 32000);
});

test('deal() 랜덤 → gameNumber === 0', () => {
  const g = new FreecellGame(); g.deal();
  assertEqual(g.gameNumber, 0);
});

test('같은 게임 번호로 deal → 동일 배치', () => {
  const g1 = new FreecellGame(); g1.deal(42);
  const g2 = new FreecellGame(); g2.deal(42);
  for (let i = DeckIndex.Tableau1; i <= DeckIndex.Tableau8; i++) {
    const d1 = g1.getDeck(i);
    const d2 = g2.getDeck(i);
    assertEqual(d1.size(), d2.size(), `Tab${i} 카드 수`);
    for (let ci = 0; ci < d1.size(); ci++) {
      assert(d1.get(ci).equals(d2.get(ci)), `Tab${i}[${ci}] 카드 다름`);
    }
  }
});

test('다른 게임 번호 → 다른 배치', () => {
  const g1 = new FreecellGame(); g1.deal(1);
  const g2 = new FreecellGame(); g2.deal(2);
  // 모든 컬럼이 동일할 확률은 사실상 0
  let allSame = true;
  outer: for (let i = DeckIndex.Tableau1; i <= DeckIndex.Tableau8; i++) {
    const d1 = g1.getDeck(i);
    const d2 = g2.getDeck(i);
    for (let ci = 0; ci < d1.size(); ci++) {
      if (!d1.get(ci).equals(d2.get(ci))) { allSame = false; break outer; }
    }
  }
  assert(!allSame, '게임 1과 게임 2의 배치가 달라야 함');
});

test('restart() → 초기 배치로 복원', () => {
  const g = new FreecellGame(); g.deal(7);
  // 초기 맨 위 카드 기록
  const initTop1 = g.getDeck(DeckIndex.Tableau1).top();
  const initTop2 = g.getDeck(DeckIndex.Tableau2).top();

  // 여러 번 이동
  g.moveCard(DeckIndex.Tableau1, DeckIndex.Free1, 1);
  g.moveCard(DeckIndex.Tableau2, DeckIndex.Free2, 1);
  assert(g.moveCount > 0, '이동 후 moveCount > 0');

  g.restart();
  assertEqual(g.moveCount, 0, 'restart 후 moveCount = 0');
  assertEqual(g.state, 'play', 'restart 후 play 상태');
  assert(g.getDeck(DeckIndex.Tableau1).top().equals(initTop1), 'Tab1 맨 위 카드 복원');
  assert(g.getDeck(DeckIndex.Tableau2).top().equals(initTop2), 'Tab2 맨 위 카드 복원');
});

test('restart() → gameNumber 유지', () => {
  const g = new FreecellGame(); g.deal(123);
  g.moveCard(DeckIndex.Tableau1, DeckIndex.Free1, 1);
  g.restart();
  assertEqual(g.gameNumber, 123, 'restart 후 gameNumber 유지');
});

test('restart() 없이 (deal 전) → false 반환', () => {
  const g = new FreecellGame();
  assert(!g.restart(), 'deal 전 restart는 false');
});

// ─── MS 게임 번호 딜 (공식 배치 회귀) ────────────────────────────────────────

suite('MS FreeCell 공식 배치 (게임 #1)');

// 카드 → "RankSuit" 문자열 (T=10, C♣ D♦ H♥ S♠)
function cardStr(card) {
  const RANK = { 1:'A', 2:'2', 3:'3', 4:'4', 5:'5', 6:'6', 7:'7',
                 8:'8', 9:'9', 10:'T', 11:'J', 12:'Q', 13:'K' };
  const SUIT = { [Figure.Club]:'C', [Figure.Diamond]:'D', [Figure.Heart]:'H', [Figure.Spade]:'S' };
  return RANK[card.number] + SUIT[card.figure];
}

test('게임 #1 → 8개 컬럼이 공식 배치와 일치', () => {
  // 각 컬럼 바닥→위 (딜 순서). MS FreeCell Game #1 표준 배치.
  const expected = [
    'JD KD 2S 4C 3S 6D 6S',
    '2D KC KS 5C TD 8S 9C',
    '9H 9S 9D TS 4S 8D 2H',
    'JC 5S QD QH TH QS 6H',
    '5D AD JS 4H 8H 6C',
    '7H QC AS AC 2C 3D',
    '7C KH AH 4D JH 8C',
    '5H 3H 3C 7S 7D TC',
  ];
  const g = new FreecellGame();
  g.deal(1);
  for (let c = 0; c < 8; c++) {
    const deck = g.getDeck(DeckIndex.Tableau1 + c);
    const actual = deck.toArray().map(cardStr).join(' ');
    assertEqual(actual, expected[c], `컬럼 ${c + 1}`);
  }
});

test('게임 #1 첫 배분 행 = JD 2D 9H JC 5D 7H 7C 5H', () => {
  const g = new FreecellGame();
  g.deal(1);
  const firstRow = [];
  for (let c = 0; c < 8; c++) firstRow.push(cardStr(g.getDeck(DeckIndex.Tableau1 + c).get(0)));
  assertEqual(firstRow.join(' '), 'JD 2D 9H JC 5D 7H 7C 5H');
});

suite('FreecellGame - 포기 (giveUp → lost 상태)');

/** 게임 #1 에서 실제로 가능한 이동 하나를 수행 (Tableau1 맨 위 → FreeCell1) */
function playOneMove(g) {
  assert(g.moveCard(DeckIndex.Tableau1, DeckIndex.Free1, 1), '준비 이동');
}

test('play 상태에서 giveUp → true, 상태 lost', () => {
  const g = new FreecellGame();
  g.deal(1);
  assertEqual(g.giveUp(), true);
  assertEqual(g.state, 'lost');
});

test('pause 상태에서도 giveUp 가능', () => {
  const g = new FreecellGame();
  g.deal(1);
  g.pause();
  assertEqual(g.giveUp(), true);
  assertEqual(g.state, 'lost');
});

test('idle 상태에서는 giveUp 불가 (상태 유지)', () => {
  const g = new FreecellGame();
  assertEqual(g.giveUp(), false);
  assertEqual(g.state, 'idle');
});

test('이미 포기한 판은 다시 giveUp 불가', () => {
  const g = new FreecellGame();
  g.deal(1);
  g.giveUp();
  assertEqual(g.giveUp(), false);
  assertEqual(g.state, 'lost');
});

test('승리한 판은 giveUp 불가', () => {
  const g = new FreecellGame();
  g.deal(1);
  let r = { status: 'unknown', moves: [] };
  for (const profile of SOLVER_PROFILES) {
    r = solve(layoutFromGameNumber(1), { maxNodes: 30000, profile });
    if (r.status === 'solved') break;
  }
  assert(replaySolution(g, r.moves), '풀이 재생');
  assertEqual(g.state, 'win');
  assertEqual(g.giveUp(), false);
  assertEqual(g.state, 'win');
});

test('포기해도 게임 번호·이동 횟수는 유지 (결과 표시용)', () => {
  const g = new FreecellGame();
  g.deal(617);
  g.moveCard(DeckIndex.Tableau1, DeckIndex.Free1, 1);
  const moves = g.moveCount;
  g.giveUp();
  assertEqual(g.gameNumber, 617);
  assertEqual(g.moveCount, moves);
});

test('lost 상태에서는 카드 이동 불가', () => {
  const g = new FreecellGame();
  g.deal(1);
  g.giveUp();
  assertEqual(g.moveCard(DeckIndex.Tableau1, DeckIndex.Free1, 1), false);
  assertEqual(g.getDeck(DeckIndex.Free1).size(), 0);
  assertEqual(g.autoMoveToFoundation(DeckIndex.Tableau1), null);
});

test('lost 상태에서는 undo 가 동작하지 않음', () => {
  const g = new FreecellGame();
  g.deal(1);
  playOneMove(g);
  g.giveUp();
  g.undo();
  assertEqual(g.getDeck(DeckIndex.Free1).size(), 1, '되돌려지지 않음');
  assertEqual(g.state, 'lost');
});

test('lost 상태에서는 pause/resume 이 상태를 바꾸지 않음', () => {
  const g = new FreecellGame();
  g.deal(1);
  g.giveUp();
  g.pause();
  assertEqual(g.state, 'lost');
  g.resume();
  assertEqual(g.state, 'lost');
});

test('lost 상태에서는 자동 완료 불가', () => {
  const g = new FreecellGame();
  g.deal(1);
  g.giveUp();
  assertEqual(g.canAutoComplete(), false);
  assertEqual(g.isWin(), false);
});

test('포기한 판을 restart() 하면 같은 배열로 처음부터 (play, 이동 0)', () => {
  const g = new FreecellGame();
  g.deal(1);
  const initial = JSON.stringify(g.serialize(0).decks);
  playOneMove(g);
  g.giveUp();
  assertEqual(g.canRestart, true);
  assertEqual(g.restart(), true);
  assertEqual(g.state, 'play');
  assertEqual(g.moveCount, 0);
  assertEqual(g.canUndo, false);
  assertEqual(g.gameNumber, 1);
  assertEqual(JSON.stringify(g.serialize(0).decks), initial);
});

test('포기한 뒤 deal() 로 새 게임 시작 가능', () => {
  const g = new FreecellGame();
  g.deal(1);
  g.giveUp();
  g.deal(2);
  assertEqual(g.state, 'play');
  assertEqual(g.gameNumber, 2);
});

test('포기한 판의 스냅샷을 복원해도 lost 로 이어지지 않음 (play 로 복원)', () => {
  const g = new FreecellGame();
  g.deal(1);
  g.giveUp();
  const g2 = new FreecellGame();
  assert(g2.restore(g.serialize(12)) !== null, '복원');
  assertEqual(g2.state, 'play');
});

test('입력: lost 상태에서는 키보드 덱 선택·터치 드래그가 되지 않음', () => {
  const env = makeInputEnv();
  env.game.giveUp();
  env.key('Digit1', '1');
  assertEqual(env.input.getKeyboardState().selectedDeck, null);
  env.touch('touchstart', [touchOnTop(env, DeckIndex.Tableau1, 1)]);
  assert(!env.input.getDragState().isDragging, '드래그 시작 안 함');
  assertEqual(env.calls.length, 0);
});
