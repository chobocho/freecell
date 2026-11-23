// 저장 / 복원 (스냅샷)
import { DeckIndex, TOTAL_DECKS } from '../dist/deck.js';
import { FreecellGame } from '../dist/freecell.js';
import { suite, test, assert, assertEqual } from './helpers.mjs';

// ─── FreecellGame - 직렬화/복원 ─────────────────────────────────────────────

suite('FreecellGame - 직렬화/복원 (IndexedDB 저장용)');

test('serialize() 기본 구조', () => {
  const g = new FreecellGame(); g.deal();
  const snap = g.serialize(42.5);
  assertEqual(snap.version,   1);
  assertEqual(snap.gameState, 'play');
  assertEqual(snap.moveCount, 0);
  assertEqual(snap.elapsed,   42.5);
  assertEqual(snap.decks.length, 16, '16개 덱');
  assert(snap.savedAt > 0, 'savedAt 타임스탬프');
});

test('serialize() 이동 후 history 포함', () => {
  const g = new FreecellGame(); g.deal();
  g.moveCard(DeckIndex.Tableau1, DeckIndex.Free1, 1);
  const snap = g.serialize(0);
  assertEqual(snap.history.length, 1);
  assertEqual(snap.history[0].from, DeckIndex.Tableau1);
  assertEqual(snap.history[0].to,   DeckIndex.Free1);
  assertEqual(snap.moveCount, 1);
});

test('serialize() 카드 상태 포함', () => {
  const g = new FreecellGame(); g.deal();
  const snap = g.serialize(0);
  // 태블로 1 (인덱스 8) 에 카드 있어야 함
  assert(snap.decks[8].cards.length > 0, '태블로1 카드 있음');
  // 맨 위 카드가 오픈 상태
  const topCard = snap.decks[8].cards[snap.decks[8].cards.length - 1];
  assert(topCard.isOpen, '태블로 맨 위 카드 오픈');
});

test('restore() 완전 복원 - 덱 상태', () => {
  const g1 = new FreecellGame(); g1.deal();
  g1.moveCard(DeckIndex.Tableau1, DeckIndex.Free1, 1);
  const snap = g1.serialize(99);

  const g2 = new FreecellGame();
  const restoredElapsed = g2.restore(snap);

  assertEqual(restoredElapsed, 99, '경과시간 복원');
  assertEqual(g2.state,     'play');
  assertEqual(g2.moveCount, 1);
  // Freecell에 카드 있어야 함
  assertEqual(g2.getDeck(DeckIndex.Free1).size(), 1, 'freecell 복원');
  // 태블로1 카드 수 복원
  assertEqual(
    g2.getDeck(DeckIndex.Tableau1).size(),
    g1.getDeck(DeckIndex.Tableau1).size(),
    '태블로1 카드 수 복원'
  );
});

test('restore() 이후 undo 가능', () => {
  const g1 = new FreecellGame(); g1.deal();
  g1.moveCard(DeckIndex.Tableau1, DeckIndex.Free1, 1);
  const snap = g1.serialize(0);

  const g2 = new FreecellGame();
  g2.restore(snap);
  assert(g2.canUndo, '복원 후 undo 가능');
  g2.undo();
  assertEqual(g2.getDeck(DeckIndex.Free1).size(), 0, 'undo 후 freecell 비어있음');
});

test('restore() pause 상태도 복원 (play로 전환)', () => {
  const g1 = new FreecellGame(); g1.deal(); g1.pause();
  const snap = g1.serialize(10);

  const g2 = new FreecellGame();
  g2.restore(snap);
  // pause로 복원되지만 main.ts에서 resume() 호출
  assert(g2.state === 'pause' || g2.state === 'play', 'play or pause 상태');
});

test('serialize → restore 왕복 후 카드 정보 일치', () => {
  const g1 = new FreecellGame(); g1.deal();
  // 여러 번 이동
  g1.moveCard(DeckIndex.Tableau1, DeckIndex.Free1, 1);
  g1.moveCard(DeckIndex.Tableau2, DeckIndex.Free2, 1);
  const snap = g1.serialize(30);

  const g2 = new FreecellGame();
  g2.restore(snap);

  // 16개 덱 전체 카드 수 비교
  for (let i = 0; i < 16; i++) {
    const d1 = g1.getDeck(i);
    const d2 = g2.getDeck(i);
    assertEqual(d2.size(), d1.size(), `덱 ${i} 카드 수`);
    // 맨 위 카드 비교 (비어있지 않은 경우)
    if (!d1.isEmpty()) {
      assert(d2.top().equals(d1.top()), `덱 ${i} 맨 위 카드`);
    }
  }
});

// ─── restore 후 restart (이어하기 → 다시 하기) ─────────────────────────────

suite('FreecellGame - restore 후 restart');

/** 두 게임의 전체 보드가 동일한지 비교 */
function boardsEqual(a, b) {
  for (let i = 0; i < TOTAL_DECKS; i++) {
    const da = a.getDeck(i), db = b.getDeck(i);
    if (da.size() !== db.size()) return false;
    for (let ci = 0; ci < da.size(); ci++) {
      if (!da.get(ci).equals(db.get(ci))) return false;
    }
  }
  return true;
}

test('serialize에 initialDecks 포함', () => {
  const g = new FreecellGame();
  g.deal(7);
  const snap = g.serialize(0);
  assert(Array.isArray(snap.initialDecks), 'initialDecks가 배열이어야 함');
  const total = snap.initialDecks.reduce((s, d) => s + d.cards.length, 0);
  assertEqual(total, 52, 'initialDecks 카드 총수');
});

test('restore된 게임에서 restart() 성공 + 초기 배열 복귀', () => {
  const g1 = new FreecellGame();
  g1.deal(7);
  const initial = new FreecellGame();
  initial.deal(7); // 비교 기준: 동일 딜의 초기 배열

  // 몇 수 진행 후 저장
  let moves = 0;
  for (let i = DeckIndex.Tableau1; i <= DeckIndex.Tableau8 && moves < 2; i++) {
    if (g1.autoMoveToFoundation(i) !== null) moves++;
  }
  const snap = g1.serialize(42);

  // 새 인스턴스에 복원 (페이지 새로고침 후 이어하기 상황)
  const g2 = new FreecellGame();
  assertEqual(g2.restore(snap), 42, 'restore 경과 시간');
  assert(g2.canRestart, 'restore 후 canRestart는 true');
  assert(g2.restart(), 'restore 후 restart()는 true');
  assertEqual(g2.moveCount, 0, 'restart 후 moveCount');
  assert(boardsEqual(g2, initial), 'restart 후 보드가 초기 배열과 일치');
});

test('initialDecks 없는 v1 저장본도 gameNumber로 restart 재구성', () => {
  const g1 = new FreecellGame();
  g1.deal(3);
  const snap = g1.serialize(0);
  delete snap.initialDecks; // 구버전 저장본 흉내

  const g2 = new FreecellGame();
  assert(g2.restore(snap) !== null, '복원 성공');
  assert(g2.restart(), '게임 번호로 초기 배열 재구성 → restart 성공');
  const initial = new FreecellGame();
  initial.deal(3);
  assert(boardsEqual(g2, initial), 'restart 후 보드가 게임 #3 초기 배열과 일치');
});

// ─── restore 스냅샷 검증 ────────────────────────────────────────────────────

suite('FreecellGame - restore 손상 스냅샷 거부');

test('카드 51장 스냅샷 거부', () => {
  const g1 = new FreecellGame();
  g1.deal(1);
  const snap = g1.serialize(0);
  // 태블로1에서 카드 한 장 제거 → 51장
  const tab1 = snap.decks[DeckIndex.Tableau1];
  tab1.cards.pop();
  const g2 = new FreecellGame();
  assertEqual(g2.restore(snap), null, '51장 스냅샷은 null 반환');
});

test('중복 카드 스냅샷 거부', () => {
  const g1 = new FreecellGame();
  g1.deal(1);
  const snap = g1.serialize(0);
  // 태블로1 맨 위 카드를 태블로2 맨 위 카드와 동일하게 조작 → 중복
  const t1 = snap.decks[DeckIndex.Tableau1].cards;
  const t2 = snap.decks[DeckIndex.Tableau2].cards;
  t1[t1.length - 1] = { ...t2[t2.length - 1] };
  const g2 = new FreecellGame();
  assertEqual(g2.restore(snap), null, '중복 카드 스냅샷은 null 반환');
});

test('범위 밖 무늬/숫자 거부', () => {
  const g1 = new FreecellGame();
  g1.deal(1);
  const snap = g1.serialize(0);
  snap.decks[DeckIndex.Tableau1].cards[0].figure = 9;
  const g2 = new FreecellGame();
  assertEqual(g2.restore(snap), null, '무늬 9는 거부');
});

suite('FreecellGame - 손상된 스냅샷 거부 (덱 수 / 이동 이력)');

test('덱이 16개가 아니면 거부 (남는 덱의 카드가 조용히 사라지는 것 방지)', () => {
  const g1 = new FreecellGame(); g1.deal(1);
  const snap = g1.serialize(0);
  // 52장은 그대로 두고 17번째 덱으로 한 장을 옮김
  snap.decks.push({ cards: [snap.decks[DeckIndex.Tableau1].cards.pop()] });
  assertEqual(new FreecellGame().restore(snap), null);
});

test('이동 이력의 덱 번호가 범위 밖이면 거부 (되돌리기에서 오류 방지)', () => {
  const g1 = new FreecellGame(); g1.deal(1);
  g1.moveCard(DeckIndex.Tableau1, DeckIndex.Free1, 1);
  const snap = g1.serialize(0);
  snap.history[0].to = 99;
  assertEqual(new FreecellGame().restore(snap), null);
});

test('이동 이력의 장수가 올바르지 않으면 거부', () => {
  for (const count of [0, -1, 1.5, '1']) {
    const g1 = new FreecellGame(); g1.deal(1);
    g1.moveCard(DeckIndex.Tableau1, DeckIndex.Free1, 1);
    const snap = g1.serialize(0);
    snap.history[0].count = count;
    assertEqual(new FreecellGame().restore(snap), null, `count=${count}`);
  }
});

test('이동 횟수/경과 시간이 숫자가 아니면 0으로 복원', () => {
  const g1 = new FreecellGame(); g1.deal(1);
  const snap = g1.serialize(0);
  snap.moveCount = 'x';
  snap.elapsed = NaN;
  const g2 = new FreecellGame();
  assertEqual(g2.restore(snap), 0);
  assertEqual(g2.moveCount, 0);
});

test('정상 스냅샷은 그대로 복원되고 되돌리기도 동작', () => {
  const g1 = new FreecellGame(); g1.deal(1);
  g1.moveCard(DeckIndex.Tableau1, DeckIndex.Free1, 1);
  const g2 = new FreecellGame();
  assertEqual(g2.restore(g1.serialize(7)), 7);
  g2.undo();
  assert(g2.getDeck(DeckIndex.Free1).isEmpty(), '되돌리기 후 FreeCell 비어 있음');
});
