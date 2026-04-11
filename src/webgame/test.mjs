/**
 * Node.js 유닛 테스트 (ES module)
 * 실행: node test.mjs
 */
import { Color, Figure, CardNumber, Card } from './dist/card.js';
import {
  DeckIndex, TOTAL_DECKS,
  InitDeck, FoundationDeck, FreeCellDeck, TableauDeck,
} from './dist/deck.js';
import { FreecellGame } from './dist/freecell.js';

// ─── 간단한 테스트 프레임워크 ────────────────────────────────────────────────

let passed = 0, failed = 0;
let currentSuite = '';

function suite(name) {
  currentSuite = name;
  console.log(`\n\x1b[34m▶ ${name}\x1b[0m`);
}

function test(desc, fn) {
  try {
    fn();
    console.log(`  \x1b[32m✓\x1b[0m ${desc}`);
    passed++;
  } catch (e) {
    console.log(`  \x1b[31m✗\x1b[0m ${desc}`);
    console.log(`    \x1b[33m→ ${e.message}\x1b[0m`);
    failed++;
  }
}

function assert(condition, msg) {
  if (!condition) throw new Error(msg || '조건 불만족');
}

function assertEqual(a, b, msg) {
  if (a !== b) throw new Error(
    (msg ? msg + ' ' : '') + `기대: ${JSON.stringify(b)}, 실제: ${JSON.stringify(a)}`
  );
}

// ─── Card 테스트 ────────────────────────────────────────────────────────────

suite('Card 클래스');

test('클로버 에이스 생성', () => {
  const c = new Card(Figure.Club, CardNumber.Ace);
  assertEqual(c.figure, Figure.Club);
  assertEqual(c.number, CardNumber.Ace);
  assertEqual(c.color, Color.Black);
});
test('하트 킹 생성', () => {
  const c = new Card(Figure.Heart, CardNumber.King);
  assertEqual(c.figure, Figure.Heart);
  assertEqual(c.number, CardNumber.King);
  assertEqual(c.color, Color.Red);
});
test('다이아 5 → 색상 Red', () => {
  assertEqual(new Card(Figure.Diamond, 5).color, Color.Red);
});
test('스페이드 7 → 색상 Black', () => {
  assertEqual(new Card(Figure.Spade, 7).color, Color.Black);
});
test('카드 오픈/닫기', () => {
  const c = new Card(Figure.Heart, 3);
  assert(!c.isOpen, '초기에는 닫혀있어야 함');
  c.open();  assert(c.isOpen);
  c.close(); assert(!c.isOpen);
});
test('이미지명 ca', () => assertEqual(new Card(Figure.Club, CardNumber.Ace).imageName, 'ca'));
test('이미지명 hk', () => assertEqual(new Card(Figure.Heart, CardNumber.King).imageName, 'hk'));
test('이미지명 d10', () => assertEqual(new Card(Figure.Diamond, CardNumber.Ten).imageName, 'd10'));
test('이미지명 s7',  () => assertEqual(new Card(Figure.Spade, 7).imageName, 's7'));
test('이미지명 cj',  () => assertEqual(new Card(Figure.Club, CardNumber.Jack).imageName, 'cj'));
test('이미지명 dq',  () => assertEqual(new Card(Figure.Diamond, CardNumber.Queen).imageName, 'dq'));
test('카드 동등 비교 (같음)', () => {
  assert(new Card(Figure.Heart, 5).equals(new Card(Figure.Heart, 5)));
});
test('카드 동등 비교 (다른 무늬)', () => {
  assert(!new Card(Figure.Heart, 5).equals(new Card(Figure.Spade, 5)));
});

// ─── InitDeck 테스트 ────────────────────────────────────────────────────────

suite('InitDeck (셔플 덱)');

test('52장 생성', () => assertEqual(new InitDeck().size(), 52));
test('모든 카드 오픈 상태', () => {
  const d = new InitDeck();
  for (let i = 0; i < 52; i++) assert(d.get(i).isOpen, `${i}번 카드 닫혀있음`);
});
test('중복 카드 없음', () => {
  const d = new InitDeck();
  const seen = new Set();
  for (let i = 0; i < 52; i++) {
    const c = d.get(i);
    const key = `${c.figure}-${c.number}`;
    assert(!seen.has(key), `중복: ${key}`);
    seen.add(key);
  }
});
test('pop으로 카드 꺼내기', () => {
  const d = new InitDeck();
  const card = d.pop();
  assert(card instanceof Card);
  assertEqual(d.size(), 51);
});

// ─── FoundationDeck 테스트 ──────────────────────────────────────────────────

suite('FoundationDeck (완성 덱)');

test('빈 덱에 에이스만 허용', () => {
  const d = new FoundationDeck(Figure.Heart);
  const ace = new Card(Figure.Heart, CardNumber.Ace); ace.open();
  assert(d.canAccept(ace));
});
test('빈 덱에 에이스 아닌 카드 거부', () => {
  const d = new FoundationDeck(Figure.Heart);
  const two = new Card(Figure.Heart, 2); two.open();
  assert(!d.canAccept(two));
});
test('같은 무늬 오름차순 허용', () => {
  const d = new FoundationDeck(Figure.Heart);
  const ace = new Card(Figure.Heart, CardNumber.Ace); ace.open(); d.push(ace);
  const two = new Card(Figure.Heart, 2); two.open();
  assert(d.canAccept(two));
});
test('다른 무늬 거부', () => {
  const d = new FoundationDeck(Figure.Heart);
  const ace = new Card(Figure.Heart, CardNumber.Ace); ace.open(); d.push(ace);
  const two = new Card(Figure.Spade, 2); two.open();
  assert(!d.canAccept(two));
});
test('숫자 건너뜀 거부', () => {
  const d = new FoundationDeck(Figure.Club);
  const ace = new Card(Figure.Club, CardNumber.Ace); ace.open(); d.push(ace);
  const three = new Card(Figure.Club, 3); three.open();
  assert(!d.canAccept(three));
});
test('Foundation에서 pop 불가 (null 반환)', () => {
  const d = new FoundationDeck(Figure.Spade);
  const ace = new Card(Figure.Spade, CardNumber.Ace); ace.open(); d.push(ace);
  assertEqual(d.pop(), null);
  assertEqual(d.size(), 1);
});
test('완성: 13장 → isComplete()', () => {
  const d = new FoundationDeck(Figure.Spade);
  for (let n = 1; n <= 13; n++) { const c = new Card(Figure.Spade, n); c.open(); d.push(c); }
  assert(d.isComplete());
});

// ─── FreeCellDeck 테스트 ────────────────────────────────────────────────────

suite('FreeCellDeck (임시 보관 덱)');

test('빈 셀에 임의 카드 허용', () => {
  const d = new FreeCellDeck();
  const c = new Card(Figure.Heart, 7); c.open();
  assert(d.canAccept(c));
});
test('이미 카드 있으면 거부 (1장 제한)', () => {
  const d = new FreeCellDeck();
  const c1 = new Card(Figure.Heart, 7); c1.open(); d.push(c1);
  const c2 = new Card(Figure.Club, 3); c2.open();
  assert(!d.canAccept(c2));
});
test('닫힌 카드 거부', () => {
  const d = new FreeCellDeck();
  assert(!d.canAccept(new Card(Figure.Heart, 5)));
});

// ─── TableauDeck 테스트 ─────────────────────────────────────────────────────

suite('TableauDeck (태블로 덱)');

test('빈 컬럼에 아무 카드나 허용', () => {
  const d = new TableauDeck();
  const c = new Card(Figure.Heart, CardNumber.King); c.open();
  assert(d.canAccept(c));
});
test('교대색 + 내림차순 허용 (빨강6 → 검정5)', () => {
  const d = new TableauDeck();
  const r6 = new Card(Figure.Heart, 6); r6.open(); d.push(r6);
  const b5 = new Card(Figure.Spade, 5); b5.open();
  assert(d.canAccept(b5));
});
test('같은 색 거부', () => {
  const d = new TableauDeck();
  const r6 = new Card(Figure.Heart, 6); r6.open(); d.push(r6);
  const r5 = new Card(Figure.Diamond, 5); r5.open();
  assert(!d.canAccept(r5));
});
test('숫자 오류 거부 (빨강6 → 검정4)', () => {
  const d = new TableauDeck();
  const r6 = new Card(Figure.Heart, 6); r6.open(); d.push(r6);
  const b4 = new Card(Figure.Spade, 4); b4.open();
  assert(!d.canAccept(b4));
});
test('닫힌 카드 위에 항상 허용', () => {
  const d = new TableauDeck();
  d.push(new Card(Figure.Heart, 6)); // closed
  const c = new Card(Figure.Spade, 5); c.open();
  assert(d.canAccept(c));
});
test('pop 시 아래 카드 자동 오픈', () => {
  const d = new TableauDeck();
  d.push(new Card(Figure.Club, 8));     // closed
  const top = new Card(Figure.Heart, 7); top.open(); d.push(top);
  d.pop();
  assert(d.top().isOpen, 'pop 후 아래 카드 오픈');
});
test('sequenceLength: 올바른 시퀀스 3장', () => {
  const d = new TableauDeck();
  const r8 = new Card(Figure.Heart, 8); r8.open(); d.push(r8);
  const b7 = new Card(Figure.Spade, 7); b7.open(); d.push(b7);
  const r6 = new Card(Figure.Diamond, 6); r6.open(); d.push(r6);
  assertEqual(d.sequenceLength(), 3);
});
test('sequenceLength: 같은 색으로 끊기면 1', () => {
  const d = new TableauDeck();
  const r8 = new Card(Figure.Heart, 8); r8.open(); d.push(r8);
  const r7 = new Card(Figure.Diamond, 7); r7.open(); d.push(r7);
  assertEqual(d.sequenceLength(), 1);
});

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
test('태블로 맨 위만 오픈, 나머지 닫힘', () => {
  const g = new FreecellGame(); g.deal();
  for (let i = DeckIndex.Tableau1; i <= DeckIndex.Tableau8; i++) {
    const deck = g.getDeck(i);
    assert(deck.top().isOpen);
    if (deck.size() > 1) assert(!deck.get(deck.size() - 2).isOpen);
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

// ─── 결과 ───────────────────────────────────────────────────────────────────

const total = passed + failed;
console.log('\n' + '─'.repeat(50));
if (failed === 0) {
  console.log(`\x1b[32m✓ 모든 테스트 통과: ${passed}/${total}\x1b[0m`);
} else {
  console.log(`\x1b[31m✗ 실패: ${failed}개 / 통과: ${passed}개 / 전체: ${total}개\x1b[0m`);
  process.exit(1);
}
