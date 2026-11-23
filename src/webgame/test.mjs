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
import { InputHandler } from './dist/input.js';
import { Renderer, loadImages } from './dist/renderer.js';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import {
  LFSR_PERIOD, MAX_GAME_NUMBER,
  lfsrStep, randomLfsrState, isValidLfsrState, nextGameNumber,
} from './dist/lfsr.js';
import { GameStorage } from './dist/storage.js';
import {
  SOLVER_PROFILES, solve, measure, replaySolution,
  layoutFromGame, layoutFromGameNumber,
} from './dist/solver.js';
import {
  DIFFICULTIES, DIFFICULTY_LABEL, isDifficulty,
  encodeLevels, decodeLevels, difficultyOf, nextGameNumberOfDifficulty,
} from './dist/difficulty.js';
import { LEVEL_DATA, LEVEL_EASY_MAX_NODES } from './dist/levels.js';

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

function makeOpen(fig, num) { const c = new Card(fig, num); c.open(); return c; }

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

// ─── 입력 처리 (InputHandler) ────────────────────────────────────────────────
// DOM 없이 가짜 window/canvas 로 실제 InputHandler + Renderer 를 구동한다.

function makeInputEnv(gameNumber = 1) {
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

/** 덱 맨 위 카드의 중앙 좌표에 해당하는 가짜 Touch */
function touchOnTop(env, deckIdx, identifier) {
  const deck = env.game.getDeck(deckIdx);
  const r = env.renderer.getCardRect(deckIdx, deck.size() - 1, env.game);
  return { identifier, clientX: r.x + r.w / 2, clientY: r.y + r.h / 2 };
}

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

suite('FreeCell 솔버');

test('layoutFromGameNumber: 52장이 중복 없이 8열에 7,7,7,7,6,6,6,6장', () => {
  const L = layoutFromGameNumber(1);
  assertEqual(L.cascades.map(c => c.length).join(','), '7,7,7,7,6,6,6,6');
  const all = L.cascades.flat();
  assertEqual(new Set(all).size, 52);
  assert(all.every(c => c >= 0 && c < 52), '카드 id 범위');
  assertEqual(L.free.join(','), '-1,-1,-1,-1');
  assertEqual(L.found.join(','), '0,0,0,0');
});

test('layoutFromGame: 카드 id = (무늬-1)*13 + 숫자-1, 진행 중인 판의 프리셀/파운데이션 반영', () => {
  const g = new FreecellGame();
  g.deal(1);
  const top = g.getDeck(DeckIndex.Tableau1).top();
  assert(g.moveCard(DeckIndex.Tableau1, DeckIndex.Free2, 1), '프리셀로 이동');
  const L = layoutFromGame(g);
  assertEqual(L.free[1], (top.figure - 1) * 13 + top.number - 1);
  assertEqual(L.free[0], -1);
  assertEqual(L.cascades[0].length, 6);
});

test('solve: 게임 #1~#5 를 풀고, 그 수순을 실제 게임에 재생하면 승리', () => {
  for (let n = 1; n <= 5; n++) {
    // 판마다 잘 듣는 탐색 성향이 다르므로, 풀리는 첫 성향의 결과를 쓴다
    let r = { status: 'unknown', moves: [], nodes: 0 };
    for (const profile of SOLVER_PROFILES) {
      r = solve(layoutFromGameNumber(n), { maxNodes: 30000, profile });
      if (r.status === 'solved') break;
    }
    assertEqual(r.status, 'solved', `#${n}`);
    assert(r.moves.length > 0 && r.nodes > 0, `#${n} 수순/노드`);
    const g = new FreecellGame();
    g.deal(n);
    assert(replaySolution(g, r.moves), `#${n} 재생 실패`);
    assertEqual(g.state, 'win', `#${n}`);
  }
});

test('solve: 모든 탐색 성향의 풀이가 실제 게임 규칙을 통과', () => {
  for (const profile of SOLVER_PROFILES) {
    for (const n of [7, 100, 617]) {
      const r = solve(layoutFromGameNumber(n), { maxNodes: 30000, profile });
      if (r.status !== 'solved') continue;   // 성향에 따라 상한 안에 못 풀 수 있다
      const g = new FreecellGame();
      g.deal(n);
      assert(replaySolution(g, r.moves), `#${n} 재생 실패`);
    }
  }
});

test('solve: 같은 입력이면 항상 같은 결과 (결정적)', () => {
  const a = solve(layoutFromGameNumber(3), { maxNodes: 30000 });
  const b = solve(layoutFromGameNumber(3), { maxNodes: 30000 });
  assertEqual(a.nodes, b.nodes);
  assertEqual(JSON.stringify(a.moves), JSON.stringify(b.moves));
});

test('solve: 상한이 너무 작으면 unknown (풀이 없음으로 단정하지 않음)', () => {
  const r = solve(layoutFromGameNumber(1), { maxNodes: 3 });
  assertEqual(r.status, 'unknown');
  assertEqual(r.moves.length, 0);
  assert(r.nodes <= 3);
});

test('solve: 입력 배치를 변경하지 않음', () => {
  const L = layoutFromGameNumber(2);
  const before = JSON.stringify(L);
  solve(L, { maxNodes: 2000 });
  assertEqual(JSON.stringify(L), before);
});

test('solve: 진행 중인 판(프리셀 사용 중)에서도 이어서 풀 수 있음', () => {
  const g = new FreecellGame();
  g.deal(1);
  g.moveCard(DeckIndex.Tableau1, DeckIndex.Free1, 1);
  const r = solve(layoutFromGame(g), { maxNodes: 30000 });
  assertEqual(r.status, 'solved');
  assert(replaySolution(g, r.moves), '이어서 재생');
});

test('solve: 이미 끝난 배치는 수순 없이 solved', () => {
  const r = solve({
    cascades: [[], [], [], [], [], [], [], []],
    free: [-1, -1, -1, -1],
    found: [13, 13, 13, 13],
  });
  assertEqual(r.status, 'solved');
  assertEqual(r.moves.length, 0);
});

test('solve: 안전한 파운데이션 이동만 남은 배치는 탐색 없이 끝냄', () => {
  // 각 무늬 K 한 장씩만 남은 상태
  const r = solve({
    cascades: [[12], [25], [38], [51], [], [], [], []],
    free: [-1, -1, -1, -1],
    found: [12, 12, 12, 12],
  });
  assertEqual(r.status, 'solved');
  assertEqual(r.moves.length, 4);
  assertEqual(r.nodes, 0);
});

test('measure: 풀린 판은 어느 한 성향의 탐색 수보다 크지 않은 최솟값', () => {
  const L = layoutFromGameNumber(1);
  const m = measure(L, 30000);
  assert(m.solved, '풀림');
  for (const profile of SOLVER_PROFILES) {
    const r = solve(L, { maxNodes: 30000, profile });
    if (r.status === 'solved') assert(m.nodes <= r.nodes, `${m.nodes} <= ${r.nodes}`);
  }
});

test('measure: 상한 안에 못 풀면 solved=false, nodes=상한', () => {
  const m = measure(layoutFromGameNumber(1), 2);
  assertEqual(m.solved, false);
  assertEqual(m.nodes, 2);
});

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

suite('GameStorage - LFSR 상태 저장 (가짜 IndexedDB)');

/** 최소 기능 가짜 IndexedDB: 키-값 저장소 하나, 요청은 비동기로 완료 */
function installFakeIndexedDB() {
  const data = new Map();
  const request = (run) => {
    const req = { result: undefined, error: null, onsuccess: null, onerror: null };
    queueMicrotask(() => { req.result = run(); req.onsuccess?.({ target: req }); });
    return req;
  };
  const store = {
    put:    (v, k) => request(() => { data.set(k, v); return k; }),
    get:    (k)    => request(() => data.get(k)),
    delete: (k)    => request(() => { data.delete(k); }),
  };
  const db = {
    objectStoreNames: { contains: () => true },
    createObjectStore: () => store,
    transaction: () => ({ objectStore: () => store }),
  };
  globalThis.indexedDB = { open: () => request(() => db) };
  return data;
}

async function testAsync(desc, fn) {
  try {
    await fn();
    console.log(`  \x1b[32m✓\x1b[0m ${desc}`);
    passed++;
  } catch (e) {
    console.log(`  \x1b[31m✗\x1b[0m ${desc}`);
    console.log(`    \x1b[33m→ ${e.message}\x1b[0m`);
    failed++;
  }
}

await testAsync('저장값이 없으면 loadLfsrState 는 null', async () => {
  installFakeIndexedDB();
  const st = new GameStorage();
  await st.init();
  assertEqual(await st.loadLfsrState(), null);
});

await testAsync('saveLfsrState → loadLfsrState 왕복', async () => {
  installFakeIndexedDB();
  const st = new GameStorage();
  await st.init();
  await st.saveLfsrState(12345);
  assertEqual(await st.loadLfsrState(), 12345);
});

await testAsync('손상된 저장값(범위 밖/비정수/문자열)은 null 로 처리', async () => {
  const data = installFakeIndexedDB();
  const st = new GameStorage();
  await st.init();
  for (const bad of [0, 32768, 1.5, '77', { a: 1 }]) {
    data.set('lfsr', bad);
    assertEqual(await st.loadLfsrState(), null, String(bad));
  }
});

await testAsync('새 게임 시 clear() 는 자동저장만 지우고 LFSR 상태는 유지', async () => {
  const data = installFakeIndexedDB();
  const st = new GameStorage();
  await st.init();
  const g = new FreecellGame();
  g.deal(1);
  await st.save(g.serialize(0));
  await st.saveLfsrState(321);
  assert(data.has('autosave'), '자동저장 기록됨');
  await st.clear();
  assert(!data.has('autosave'), '자동저장 삭제됨');
  assertEqual(await st.loadLfsrState(), 321);
});

await testAsync('난이도별 LFSR 상태는 서로 다른 키(lfsr, lfsr:easy …)에 따로 저장', async () => {
  const data = installFakeIndexedDB();
  const st = new GameStorage();
  await st.init();
  await st.saveLfsrState(11);
  await st.saveLfsrState(22, 'easy');
  await st.saveLfsrState(33, 'hard');
  assertEqual(await st.loadLfsrState(), 11);
  assertEqual(await st.loadLfsrState('easy'), 22);
  assertEqual(await st.loadLfsrState('medium'), null);
  assertEqual(await st.loadLfsrState('hard'), 33);
  assertEqual([...data.keys()].sort().join(','), 'lfsr,lfsr:easy,lfsr:hard');
});

await testAsync('IndexedDB 를 쓸 수 없어도(init 전) 오류 없이 null/무시', async () => {
  const st = new GameStorage();
  await st.saveLfsrState(5);
  assertEqual(await st.loadLfsrState(), null);
});

// ─── 릴리스 빌드 (bundle.js) ─────────────────────────────────────────────────

suite('릴리스 빌드: 이미지 내장 / 단일 HTML 조립');

/** 가짜 Image: src 가 지정되면 기록하고 다음 틱에 onload 호출 */
function installFakeImage() {
  const srcs = [];
  globalThis.Image = class {
    set src(v) { srcs.push(v); queueMicrotask(() => this.onload && this.onload()); }
  };
  return srcs;
}

await testAsync('loadImages: 내장 이미지 맵(__IMG__)이 없으면 img/이름.png 를 불러온다', async () => {
  delete globalThis.__IMG__;
  const srcs = installFakeImage();
  const map = await loadImages('img/');
  assert(srcs.includes('img/abg.png'), 'abg.png 경로');
  assert(srcs.every(v => v.startsWith('img/') && v.endsWith('.png')), '모두 파일 경로');
  assertEqual(map.size, srcs.length);
});

await testAsync('loadImages: 내장 이미지 맵에 있는 이미지는 data URI 를, 없는 이미지는 파일 경로를 쓴다', async () => {
  globalThis.__IMG__ = { abg: 'data:image/png;base64,AAAA' };
  try {
    const srcs = installFakeImage();
    await loadImages('img/');
    assert(srcs.includes('data:image/png;base64,AAAA'), 'abg 는 내장 이미지');
    assert(!srcs.includes('img/abg.png'), 'abg 를 파일로 요청하지 않음');
    assertEqual(srcs.filter(v => v.startsWith('img/')).length, srcs.length - 1, '나머지는 파일 경로');
  } finally {
    delete globalThis.__IMG__;
  }
});

const { assemble } = createRequire(import.meta.url)('./bundle.js');

const SHELL = [
  '<html><head>',
  '  <link rel="icon" href="img/icon.png">',
  '  <link rel="stylesheet" href="css/style.css">',
  '</head><body>',
  '  <script type="module" src="dist/main.js"></script>',
  '</body></html>',
].join('\n');

test('assemble: CSS·JS·이미지를 넣고 외부 참조를 남기지 않는다', () => {
  const out = assemble({
    html: SHELL, css: 'body{color:red}', bundle: '(() => { run(); })();',
    images: { abg: 'data:image/png;base64,AAAA' },
  });
  assert(out.includes('<style>\nbody{color:red}'), 'CSS 인라인');
  assert(out.includes('(() => { run(); })();'), 'JS 인라인');
  assert(out.includes('"abg":"data:image/png;base64,AAAA"'), '이미지 맵');
  assert(!/<link\b/.test(out), 'link 태그 없음');
  assert(!/\bsrc=/.test(out), '외부 src 없음');
  assert(!out.includes('type="module"'), '모듈 스크립트가 아님 (IIFE)');
  assert(out.indexOf('__IMG__') < out.indexOf('run()'), '이미지 맵이 게임 코드보다 먼저');
});

test('assemble: 코드·CSS 안의 $& $1 $$ 같은 문자열을 그대로 보존한다', () => {
  const out = assemble({
    html: SHELL, css: 'a::after{content:"$&"}', bundle: 'const s = "$& $1 $$ $\'";', images: {},
  });
  assert(out.includes('const s = "$& $1 $$ $\'";'), 'JS 보존');
  assert(out.includes('a::after{content:"$&"}'), 'CSS 보존');
});

test('assemble: index.html 에 교체할 태그가 없으면 오류', () => {
  const noScript = SHELL.replace(/\s*<script[^\n]*/, '');
  const noCss = SHELL.replace(/\s*<link rel="stylesheet"[^\n]*/, '');
  let e1 = null, e2 = null;
  try { assemble({ html: noScript, css: '', bundle: 'x()', images: {} }); } catch (e) { e1 = e; }
  try { assemble({ html: noCss, css: '', bundle: 'x()', images: {} }); } catch (e) { e2 = e; }
  assert(e1 !== null, '스크립트 태그 없음 → 오류');
  assert(e2 !== null, '스타일시트 태그 없음 → 오류');
});

test('assemble: 번들에 </script 가 들어 있으면 오류 (HTML 이 깨짐)', () => {
  let err = null;
  try { assemble({ html: SHELL, css: '', bundle: 'const s = "</script>";', images: {} }); }
  catch (e) { err = e; }
  assert(err !== null);
});

test('assemble: 번들에 import/export 구문이 남아 있으면 오류 (IIFE 가 아님)', () => {
  let err = null;
  try { assemble({ html: SHELL, css: '', bundle: 'import { a } from "./a.js";\na();', images: {} }); }
  catch (e) { err = e; }
  assert(err !== null);
});

test('assemble: icon 을 주면 파비콘을 data URI 로 내장한다', () => {
  const out = assemble({
    html: SHELL, css: '', bundle: 'x()', images: {}, icon: 'data:image/png;base64,ICON',
  });
  assert(out.includes('<link rel="icon" href="data:image/png;base64,ICON">'), '파비콘 내장');
  assert(!out.includes('img/icon.png'), '외부 파일 참조 없음');
  assertEqual((out.match(/<link\b/g) || []).length, 1, 'link 는 파비콘 하나뿐');
});

test('assemble: icon 이 없으면 파비콘 태그를 지운다 (깨진 참조를 남기지 않음)', () => {
  const out = assemble({ html: SHELL, css: '', bundle: 'x()', images: {} });
  assert(!/<link\b/.test(out));
});

test('img/icon.png: index.html 이 가리키는 파비콘 파일이 있고 정사각형 PNG 이다', () => {
  const buf = readFileSync(new URL('./img/icon.png', import.meta.url));
  assertEqual(buf.subarray(1, 4).toString('latin1'), 'PNG');
  const w = buf.readUInt32BE(16), h = buf.readUInt32BE(20);
  assertEqual(w, h, '정사각형');
  assert(w >= 64, `너무 작음: ${w}`);
  assert(buf.length < 20000, `너무 큼: ${buf.length} bytes`);
});

// ─── 결과 ───────────────────────────────────────────────────────────────────

const total = passed + failed;
console.log('\n' + '─'.repeat(50));
if (failed === 0) {
  console.log(`\x1b[32m✓ 모든 테스트 통과: ${passed}/${total}\x1b[0m`);
} else {
  console.log(`\x1b[31m✗ 실패: ${failed}개 / 통과: ${passed}개 / 전체: ${total}개\x1b[0m`);
  process.exit(1);
}
