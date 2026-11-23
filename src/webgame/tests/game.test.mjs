// 게임 규칙 (FreecellGame: 이동, 되돌리기, 승리, 자동 이동)
import { Figure, CardNumber, Card } from '../dist/card.js';
import { DeckIndex } from '../dist/deck.js';
import { FreecellGame } from '../dist/freecell.js';
import { suite, test, assert, assertEqual, makeOpen, makeInputEnv } from './helpers.mjs';

// ─── FreecellGame - 기본 구조 ───────────────────────────────────────────────

suite('FreecellGame - 기본 구조');

test('초기 상태: idle', () => assertEqual(new FreecellGame().state, 'idle'));
test('deal() 후 play 상태', () => {
  const g = new FreecellGame(); g.deal();
  assertEqual(g.state, 'play');
});
test('deal() 후 총 52장 태블로에 분배', () => {
  const g = new FreecellGame(); g.deal();
  let total = 0;
  for (let i = DeckIndex.Tableau1; i <= DeckIndex.Tableau8; i++) total += g.getDeck(i).size();
  assertEqual(total, 52);
});
test('deal() 후 freecell 비어있음', () => {
  const g = new FreecellGame(); g.deal();
  for (let i = DeckIndex.Free1; i <= DeckIndex.Free4; i++)
    assertEqual(g.getDeck(i).size(), 0);
});
test('deal() 후 foundation 비어있음', () => {
  const g = new FreecellGame(); g.deal();
  for (let i = DeckIndex.Found1; i <= DeckIndex.Found4; i++)
    assertEqual(g.getDeck(i).size(), 0);
});
test('컬럼 1~4: 7장, 컬럼 5~8: 6장', () => {
  const g = new FreecellGame(); g.deal();
  for (let i = DeckIndex.Tableau1; i <= DeckIndex.Tableau4; i++)
    assertEqual(g.getDeck(i).size(), 7, `Tab${i - DeckIndex.Tableau1 + 1}`);
  for (let i = DeckIndex.Tableau5; i <= DeckIndex.Tableau8; i++)
    assertEqual(g.getDeck(i).size(), 6, `Tab${i - DeckIndex.Tableau1 + 1}`);
});
test('FreeCell: 태블로 모든 카드 앞면 공개', () => {
  const g = new FreecellGame(); g.deal();
  for (let i = DeckIndex.Tableau1; i <= DeckIndex.Tableau8; i++) {
    const deck = g.getDeck(i);
    for (let ci = 0; ci < deck.size(); ci++) {
      assert(deck.get(ci).isOpen, `Tab${i - DeckIndex.Tableau1 + 1} 카드[${ci}] 닫혀있음`);
    }
  }
});

// ─── FreecellGame - 이동 규칙 ───────────────────────────────────────────────

suite('FreecellGame - 이동 규칙');

test('태블로 → freecell 이동 성공', () => {
  const g = new FreecellGame(); g.deal();
  const before = g.getDeck(DeckIndex.Tableau1).size();
  assert(g.moveCard(DeckIndex.Tableau1, DeckIndex.Free1, 1));
  assertEqual(g.getDeck(DeckIndex.Tableau1).size(), before - 1);
  assertEqual(g.getDeck(DeckIndex.Free1).size(), 1);
});
test('freecell → freecell 이동 불가', () => {
  const g = new FreecellGame(); g.deal();
  g.moveCard(DeckIndex.Tableau1, DeckIndex.Free1, 1);
  assert(!g.moveCard(DeckIndex.Free1, DeckIndex.Free2, 1));
});
test('Foundation에서 꺼내기 불가', () => {
  const g = new FreecellGame(); g.deal();
  const ace = new Card(Figure.Club, CardNumber.Ace); ace.open();
  g.getDeck(DeckIndex.Found1).push(ace);
  assert(!g.moveCard(DeckIndex.Found1, DeckIndex.Tableau1, 1));
});
test('freecell에 2장 이동 불가', () => {
  const g = new FreecellGame(); g.deal();
  assert(!g.moveCard(DeckIndex.Tableau1, DeckIndex.Free1, 2));
});
test('freecell 4개 모두 채우면 emptyFreeCellCount() = 0', () => {
  const g = new FreecellGame(); g.deal();
  g.moveCard(DeckIndex.Tableau1, DeckIndex.Free1, 1);
  g.moveCard(DeckIndex.Tableau2, DeckIndex.Free2, 1);
  g.moveCard(DeckIndex.Tableau3, DeckIndex.Free3, 1);
  g.moveCard(DeckIndex.Tableau4, DeckIndex.Free4, 1);
  assertEqual(g.emptyFreeCellCount(), 0);
});
test('pause 상태에서 이동 불가', () => {
  const g = new FreecellGame(); g.deal(); g.pause();
  assert(!g.moveCard(DeckIndex.Tableau1, DeckIndex.Free1, 1));
});

// ─── FreecellGame - Undo ─────────────────────────────────────────────────────

suite('FreecellGame - Undo');

test('이동 후 undo → 원위치 복원', () => {
  const g = new FreecellGame(); g.deal();
  const origTop  = g.getDeck(DeckIndex.Tableau1).top();
  const origSize = g.getDeck(DeckIndex.Tableau1).size();
  g.moveCard(DeckIndex.Tableau1, DeckIndex.Free1, 1);
  g.undo();
  assertEqual(g.getDeck(DeckIndex.Tableau1).size(), origSize);
  assert(g.getDeck(DeckIndex.Tableau1).top().equals(origTop));
  assertEqual(g.getDeck(DeckIndex.Free1).size(), 0);
});
test('이동 없이 undo → 변화 없음', () => {
  const g = new FreecellGame(); g.deal();
  const before = g.getDeck(DeckIndex.Tableau1).size();
  g.undo();
  assertEqual(g.getDeck(DeckIndex.Tableau1).size(), before);
});
test('연속 2회 undo', () => {
  const g = new FreecellGame(); g.deal();
  const size0 = g.getDeck(DeckIndex.Tableau1).size();
  g.moveCard(DeckIndex.Tableau1, DeckIndex.Free1, 1);
  g.moveCard(DeckIndex.Tableau2, DeckIndex.Free2, 1);
  g.undo(); g.undo();
  assertEqual(g.getDeck(DeckIndex.Tableau1).size(), size0);
  assertEqual(g.getDeck(DeckIndex.Free1).size(), 0);
  assertEqual(g.getDeck(DeckIndex.Free2).size(), 0);
});
test('undo는 moveCount 증가 없음 (원본 버그 수정)', () => {
  const g = new FreecellGame(); g.deal();
  g.moveCard(DeckIndex.Tableau1, DeckIndex.Free1, 1);
  const countAfterMove = g.moveCount;
  g.undo();
  assertEqual(g.moveCount, countAfterMove, 'undo는 moveCount 증가 안함');
});

// ─── FreecellGame - 승리 판정 ───────────────────────────────────────────────

suite('FreecellGame - 승리 판정');

test('초기에는 승리 아님', () => {
  const g = new FreecellGame(); g.deal();
  assert(!g.isWin());
});
test('Foundation 4개 모두 13장 → isWin() + state=win', () => {
  const g = new FreecellGame(); g.deal();
  const figs = [Figure.Club, Figure.Diamond, Figure.Heart, Figure.Spade];
  for (let f = 0; f < 4; f++) {
    const d = g.getDeck(DeckIndex.Found1 + f);
    d.clear();
    for (let n = 1; n <= 13; n++) { const c = new Card(figs[f], n); c.open(); d.push(c); }
  }
  assert(g.isWin());
});
test('Foundation 일부만 완성 → 승리 아님', () => {
  const g = new FreecellGame(); g.deal();
  const d = g.getDeck(DeckIndex.Found1);
  d.clear();
  for (let n = 1; n <= 13; n++) { const c = new Card(Figure.Club, n); c.open(); d.push(c); }
  assert(!g.isWin());
});

// ─── FreecellGame - 상태 머신 ───────────────────────────────────────────────

suite('FreecellGame - 상태 머신');

test('idle → play (deal)', () => {
  const g = new FreecellGame();
  assertEqual(g.state, 'idle');
  g.deal();
  assertEqual(g.state, 'play');
});
test('play → pause → play', () => {
  const g = new FreecellGame(); g.deal();
  g.pause(); assertEqual(g.state, 'pause');
  g.resume(); assertEqual(g.state, 'play');
});
test('play → idle (reset)', () => {
  const g = new FreecellGame(); g.deal();
  g.reset();
  assertEqual(g.state, 'idle');
});

// ─── maxMovableCount 공식 ────────────────────────────────────────────────────

suite('maxMovableCount 공식 (빈FreeCell+1) × 2^(빈Tableau)');

const g0 = new FreecellGame();
test('(0, 0) → 1',  () => assertEqual(g0.maxMovableCount(0, 0), 1));
test('(1, 0) → 2',  () => assertEqual(g0.maxMovableCount(1, 0), 2));
test('(2, 0) → 3',  () => assertEqual(g0.maxMovableCount(2, 0), 3));
test('(3, 0) → 4',  () => assertEqual(g0.maxMovableCount(3, 0), 4));
test('(0, 1) → 2',  () => assertEqual(g0.maxMovableCount(0, 1), 2));
test('(1, 1) → 4',  () => assertEqual(g0.maxMovableCount(1, 1), 4));
test('(4, 2) → 20', () => assertEqual(g0.maxMovableCount(4, 2), 20));

// ─── FreecellGame - 카드 앞면 유지 (FreeCell 규칙) ──────────────────────────

suite('FreecellGame - 이동/Undo 후 카드 앞면 유지');

test('태블로→FreeCell 이동 후 남은 카드 모두 앞면 유지', () => {
  const g = new FreecellGame(); g.deal();
  g.moveCard(DeckIndex.Tableau1, DeckIndex.Free1, 1);
  for (let i = DeckIndex.Tableau1; i <= DeckIndex.Tableau8; i++) {
    const deck = g.getDeck(i);
    for (let ci = 0; ci < deck.size(); ci++) {
      assert(deck.get(ci).isOpen, `이동 후 Tab${i - DeckIndex.Tableau1 + 1}[${ci}] 닫혀있음`);
    }
  }
});

test('undo 후 태블로 카드 모두 앞면 유지', () => {
  const g = new FreecellGame(); g.deal();
  g.moveCard(DeckIndex.Tableau1, DeckIndex.Free1, 1);
  g.undo();
  for (let i = DeckIndex.Tableau1; i <= DeckIndex.Tableau8; i++) {
    const deck = g.getDeck(i);
    for (let ci = 0; ci < deck.size(); ci++) {
      assert(deck.get(ci).isOpen, `undo 후 Tab${i - DeckIndex.Tableau1 + 1}[${ci}] 닫혀있음`);
    }
  }
});

// ─── FreecellGame - autoMoveToFoundation ────────────────────────────────────

suite('FreecellGame - autoMoveToFoundation');

test('Foundation에 에이스 올리기 (autoMove)', () => {
  const g = new FreecellGame();
  g.deal();
  // 태블로 컬럼을 비우고 에이스를 맨 위에 직접 배치
  const tab = g.getDeck(DeckIndex.Tableau1);
  tab.clear();
  const ace = new Card(Figure.Club, CardNumber.Ace); ace.open(); tab.push(ace);

  const result = g.autoMoveToFoundation(DeckIndex.Tableau1);
  assert(result !== null, 'autoMove 결과가 null이면 안 됨');
  assertEqual(tab.size(), 0, '이동 후 태블로 비어있음');
  assertEqual(g.getDeck(DeckIndex.Found1).size(), 1, 'Foundation에 에이스 올라감');
});

test('autoMove 불가한 경우 null 반환', () => {
  const g = new FreecellGame(); g.deal();
  // 태블로 1 맨 위가 에이스가 아닌 경우 Foundation 이동 불가 (일반 게임 초기 상태)
  // Foundation이 비어있으므로 에이스만 받을 수 있음
  const tab = g.getDeck(DeckIndex.Tableau1);
  tab.clear();
  const king = new Card(Figure.Heart, CardNumber.King); king.open(); tab.push(king);

  const result = g.autoMoveToFoundation(DeckIndex.Tableau1);
  assertEqual(result, null, 'King은 빈 Foundation에 올릴 수 없음');
  assertEqual(tab.size(), 1, '이동 없이 그대로');
});

test('Foundation에서 autoMove 불가', () => {
  const g = new FreecellGame(); g.deal();
  const result = g.autoMoveToFoundation(DeckIndex.Found1);
  assertEqual(result, null, 'Foundation에서는 autoMove 불가');
});

test('isAutoMovable: Foundation에 올릴 수 있으면 true', () => {
  const g = new FreecellGame(); g.deal();
  const tab = g.getDeck(DeckIndex.Tableau1);
  tab.clear();
  const ace = new Card(Figure.Spade, CardNumber.Ace); ace.open(); tab.push(ace);
  assert(g.isAutoMovable(DeckIndex.Tableau1), '에이스는 autoMovable');
});

test('isAutoMovable: 올릴 수 없으면 false', () => {
  const g = new FreecellGame(); g.deal();
  const tab = g.getDeck(DeckIndex.Tableau1);
  tab.clear();
  const king = new Card(Figure.Heart, CardNumber.King); king.open(); tab.push(king);
  assert(!g.isAutoMovable(DeckIndex.Tableau1), 'King은 autoMovable 아님');
});

// ─── Foundation 이동 undo (회귀) ─────────────────────────────────────────────

suite('FreecellGame - Foundation 이동 undo');

test('Foundation으로 보낸 카드가 undo로 회수됨', () => {
  const g = new FreecellGame();
  g.deal(1);
  const t1 = g.getDeck(DeckIndex.Tableau1);
  const ace = new Card(Figure.Club, CardNumber.Ace); ace.open();
  t1.push(ace);
  const beforeSize = t1.size();
  const found = g.autoMoveToFoundation(DeckIndex.Tableau1);
  assert(found !== null, 'A♣가 Foundation으로 이동');
  assertEqual(g.getDeck(DeckIndex.Found1).size(), 1, '이동 후 Foundation 1장');
  g.undo();
  assertEqual(g.getDeck(DeckIndex.Found1).size(), 0, 'undo 후 Foundation 0장');
  assertEqual(t1.size(), beforeSize, 'undo 후 원래 컬럼 크기 복원');
  assert(t1.top().equals(ace), 'undo 후 A♣가 컬럼 맨 위로 복원');
});

// ─── Tableau 자동 오픈 카드 undo 재폐쇄 (didOpenCard) ───────────────────────

suite('FreecellGame - undo 시 자동 오픈 카드 재폐쇄');

test('닫힌 카드 위 카드 이동 → undo 시 아래 카드 다시 닫힘', () => {
  const g = new FreecellGame();
  g.deal(1);
  const t1 = g.getDeck(DeckIndex.Tableau1);
  t1.clear();
  const king = new Card(Figure.Spade, CardNumber.King); // 닫힌 상태
  const queen = new Card(Figure.Heart, CardNumber.Queen); queen.open();
  t1.push(king);
  t1.push(queen);
  assert(!t1.get(0).isOpen, '이동 전 King은 닫힘');

  const ok = g.moveCard(DeckIndex.Tableau1, DeckIndex.Free1, 1);
  assert(ok, 'Queen을 FreeCell로 이동');
  assert(t1.top().isOpen, '이동 후 King 자동 오픈');

  g.undo();
  assertEqual(t1.size(), 2, 'undo 후 2장');
  assert(t1.top().equals(queen), 'undo 후 Queen이 맨 위');
  assert(!t1.get(0).isOpen, 'undo 후 King 다시 닫힘 (didOpenCard 복원)');
});

// ─── 키보드 이동 장수 계산 로직 (sequenceLength + canMove) ─────────────────────

suite('키보드 이동 장수 계산 (sequenceLength 반영)');

test('맨 위 시퀀스만 이동 대상으로 계산', () => {
  const g = new FreecellGame();
  g.deal(1);
  const src = g.getDeck(DeckIndex.Tableau1);
  const dst = g.getDeck(DeckIndex.Tableau2);
  src.clear();
  dst.clear();
  // 컬럼: [무관 5♠][무관 5♠ 위 시퀀스 아님] ... 맨 위 2장만 시퀀스: 8♥ 7♠
  src.push(makeOpen(Figure.Club, CardNumber.King));  // 시퀀스와 무관
  src.push(makeOpen(Figure.Heart, CardNumber.Eight));
  src.push(makeOpen(Figure.Spade, CardNumber.Seven));
  assertEqual(src.sequenceLength(), 2, '맨 위 연속 시퀀스 길이 = 2');

  // 목적지: 9♦ (7♠ 위에 8♥가 올라가려면 목적지 top이 9 red? 8♥는 red, 9는 black이어야)
  dst.push(makeOpen(Figure.Club, CardNumber.Nine)); // 9♣(black) ← 8♥(red) 수용 가능
  // maxMovableCount는 충분(빈 셀 4, 빈 태블로 다수) → 시퀀스 길이 2로 제한되어야 함
  const maxCount = g.maxMovableCount(g.emptyFreeCellCount(), g.emptyTableauCount(DeckIndex.Tableau2));
  const seqLen = src.sequenceLength();
  let count = Math.min(seqLen, maxCount);
  while (count > 1 && !g.canMove(DeckIndex.Tableau1, DeckIndex.Tableau2, count)) count--;
  assertEqual(count, 2, '계산된 이동 장수 = 2 (시퀀스 전체)');
  assert(g.canMove(DeckIndex.Tableau1, DeckIndex.Tableau2, count), '해당 장수로 이동 가능');
});

// ─── 자동 완료 판정 ─────────────────────────────────────────────────────────

suite('FreecellGame - canAutoComplete');

test('모든 카드가 순서대로 올라갈 수 있으면 true', () => {
  const g = new FreecellGame();
  g.deal(1);
  // 각 태블로를 비우고 4개 컬럼에 무늬별 A→K 내림차순(위가 A) 배치
  for (let i = DeckIndex.Free1; i <= DeckIndex.Tableau8; i++) {
    if (i >= DeckIndex.Found1 && i <= DeckIndex.Found4) continue;
    g.getDeck(i).clear();
  }
  const figs = [Figure.Club, Figure.Diamond, Figure.Heart, Figure.Spade];
  for (let f = 0; f < 4; f++) {
    const col = g.getDeck(DeckIndex.Tableau1 + f);
    for (let n = CardNumber.King; n >= CardNumber.Ace; n--) col.push(makeOpen(figs[f], n));
  }
  assert(g.canAutoComplete(), '전부 순서대로 올릴 수 있으면 canAutoComplete true');
});

test('막힌 배치면 false', () => {
  const g = new FreecellGame();
  g.deal(1);
  assert(!g.canAutoComplete(), '초기 배치는 자동 완료 불가');
});

suite('FreecellGame - 수동 자동 올리기 (hasFoundationMove / autoMoveOne)');

/** 게임 #1 을 비우고 지정한 카드들로 판을 구성한다. cols: { [DeckIndex]: [[figure, number], ...] (아래→위) } */
function makeBoard(cols) {
  const g = new FreecellGame();
  g.deal(1);
  for (let i = DeckIndex.Free1; i <= DeckIndex.Tableau8; i++) g.getDeck(i).clear();
  for (const [idx, cards] of Object.entries(cols)) {
    for (const [f, n] of cards) g.getDeck(Number(idx)).push(makeOpen(f, n));
  }
  return g;
}

function foundationTotal(g) {
  let n = 0;
  for (let i = DeckIndex.Found1; i <= DeckIndex.Found4; i++) n += g.getDeck(i).size();
  return n;
}

test('올릴 카드가 없으면 hasFoundationMove false, autoMoveOne null', () => {
  const g = makeBoard({
    [DeckIndex.Tableau1]: [[Figure.Club, CardNumber.Ace], [Figure.Heart, CardNumber.King]],
  });
  assertEqual(g.hasFoundationMove(), false);
  assertEqual(g.autoMoveOne(), null);
  assertEqual(foundationTotal(g), 0);
  assertEqual(g.moveCount, 0);
});

test('Tableau 맨 위 에이스가 있으면 hasFoundationMove true, autoMoveOne 이 출발 덱을 반환', () => {
  const g = makeBoard({
    [DeckIndex.Tableau3]: [[Figure.Heart, CardNumber.King], [Figure.Club, CardNumber.Ace]],
  });
  assertEqual(g.hasFoundationMove(), true);
  assertEqual(g.autoMoveOne(), DeckIndex.Tableau3);
  assertEqual(foundationTotal(g), 1);
  assertEqual(g.getDeck(DeckIndex.Tableau3).size(), 1);
});

test('FreeCell 에 있는 카드도 올린다', () => {
  const g = makeBoard({ [DeckIndex.Free2]: [[Figure.Spade, CardNumber.Ace]] });
  assertEqual(g.hasFoundationMove(), true);
  assertEqual(g.autoMoveOne(), DeckIndex.Free2);
  assertEqual(g.getDeck(DeckIndex.Free2).size(), 0);
});

test('autoMoveOne 을 반복하면 연쇄로 올릴 수 있는 카드까지 올리고, 막힌 카드는 남긴다', () => {
  // 클럽 A,2,3 은 연쇄로 올라가고, 하트 2 는 하트 A 가 킹 밑에 깔려 있어 남는다
  const g = makeBoard({
    [DeckIndex.Tableau1]: [[Figure.Club, CardNumber.Three], [Figure.Club, CardNumber.Two], [Figure.Club, CardNumber.Ace]],
    [DeckIndex.Tableau2]: [[Figure.Heart, CardNumber.Ace], [Figure.Spade, CardNumber.King]],
    [DeckIndex.Free1]:    [[Figure.Heart, CardNumber.Two]],
  });
  let n = 0;
  while (g.autoMoveOne() !== null) n++;
  assertEqual(n, 3);
  assertEqual(foundationTotal(g), 3);
  assertEqual(g.getDeck(DeckIndex.Tableau1).size(), 0);
  assertEqual(g.getDeck(DeckIndex.Tableau2).size(), 2);
  assertEqual(g.getDeck(DeckIndex.Free1).size(), 1);
  assertEqual(g.hasFoundationMove(), false);
  assertEqual(g.state, 'play');
});

test('올린 카드는 한 장씩 undo 로 되돌릴 수 있다', () => {
  const g = makeBoard({
    [DeckIndex.Tableau1]: [[Figure.Club, CardNumber.Two], [Figure.Club, CardNumber.Ace]],
  });
  while (g.autoMoveOne() !== null) { /* 전부 올림 */ }
  assertEqual(g.moveCount, 2);
  g.undo();
  g.undo();
  assertEqual(foundationTotal(g), 0);
  assertEqual(g.getDeck(DeckIndex.Tableau1).size(), 2);
});

test('마지막 카드를 올리면 승리 상태가 된다', () => {
  const g = new FreecellGame();
  g.deal(1);
  for (let i = DeckIndex.Free1; i <= DeckIndex.Tableau8; i++) g.getDeck(i).clear();
  const figs = [Figure.Club, Figure.Diamond, Figure.Heart, Figure.Spade];
  for (let f = 0; f < 4; f++) {
    const col = g.getDeck(DeckIndex.Tableau1 + f);
    for (let n = CardNumber.King; n >= CardNumber.Ace; n--) col.push(makeOpen(figs[f], n));
  }
  let n = 0;
  while (g.autoMoveOne() !== null) n++;
  assertEqual(n, 52);
  assertEqual(g.state, 'win');
  assertEqual(g.hasFoundationMove(), false);
});

test('일시정지·포기 상태에서는 올리지 않는다', () => {
  const cols = { [DeckIndex.Tableau1]: [[Figure.Club, CardNumber.Ace]] };
  const paused = makeBoard(cols);
  paused.pause();
  assertEqual(paused.hasFoundationMove(), false);
  assertEqual(paused.autoMoveOne(), null);
  assertEqual(foundationTotal(paused), 0);

  const lost = makeBoard(cols);
  lost.giveUp();
  assertEqual(lost.hasFoundationMove(), false);
  assertEqual(lost.autoMoveOne(), null);
  assertEqual(foundationTotal(lost), 0);
});

test('입력: A 키(한글 IME "ㅁ" 포함)로 자동 올리기 요청', () => {
  const env = makeInputEnv();
  env.key('KeyA', 'ㅁ');
  assertEqual(env.calls.join(','), 'autoComplete');
});

test('입력: Ctrl+A 는 자동 올리기로 처리하지 않는다', () => {
  const env = makeInputEnv();
  env.key('KeyA', 'a', { ctrlKey: true });
  assertEqual(env.calls.length, 0);
});
