// 카드 / 덱 (Card, Deck)
import { Color, Figure, CardNumber, Card } from '../dist/card.js';
import { InitDeck, FoundationDeck, FreeCellDeck, TableauDeck } from '../dist/deck.js';
import { suite, test, assert, assertEqual } from './helpers.mjs';

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
