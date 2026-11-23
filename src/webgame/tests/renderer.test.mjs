// 렌더러 이펙트 (패배 이펙트에 포함되는 카드)
import { Figure, CardNumber } from '../dist/card.js';
import { DeckIndex } from '../dist/deck.js';
import { suite, test, assert, assertEqual, makeOpen, makeInputEnv } from './helpers.mjs';

suite('Renderer - 패배 이펙트 대상 카드');

/** 이펙트로 날아가는 카드 목록 (렌더러 내부 상태를 직접 확인) */
const flying = (renderer) => renderer._failAnimCards;

/** 게임 #1 에서 FreeCell 1 에 카드 한 장, Foundation 1 에 카드 두 장이 놓인 판 */
function boardWithFreeAndFoundation() {
  const env = makeInputEnv(1);
  assert(env.game.moveCard(DeckIndex.Tableau1, DeckIndex.Free1, 1), '준비: FreeCell 로 이동');
  const found = env.game.getDeck(DeckIndex.Found1);
  found.push(makeOpen(Figure.Club, CardNumber.Ace));
  found.push(makeOpen(Figure.Club, CardNumber.Two));
  return env;
}

function totalCards(game) {
  let n = 0;
  for (let i = DeckIndex.Found1; i <= DeckIndex.Tableau8; i++) n += game.getDeck(i).size();
  return n;
}

test('테이블 위의 모든 카드가 날아간다 (Tableau 뿐 아니라 FreeCell·Foundation 포함)', () => {
  const { game, renderer } = boardWithFreeAndFoundation();
  renderer.startFailEffect(game);
  assertEqual(flying(renderer).length, totalCards(game));
});

test('FreeCell 의 카드는 FreeCell 자리에서 출발한다', () => {
  const { game, renderer } = boardWithFreeAndFoundation();
  const card = game.getDeck(DeckIndex.Free1).top();
  const rect = renderer.getCardRect(DeckIndex.Free1, 0, game);
  renderer.startFailEffect(game);
  const anim = flying(renderer).find(c => c.card === card);
  assert(anim, 'FreeCell 카드가 이펙트에 포함');
  assertEqual(anim.x, rect.x);
  assertEqual(anim.y, rect.y);
});

test('Foundation 에 쌓인 카드는 전부 Foundation 자리에서 출발한다', () => {
  const { game, renderer } = boardWithFreeAndFoundation();
  const deck = game.getDeck(DeckIndex.Found1);
  const rect = renderer.getCardRect(DeckIndex.Found1, deck.size() - 1, game);
  renderer.startFailEffect(game);
  const anims = flying(renderer).filter(c => c.card === deck.get(0) || c.card === deck.get(1));
  assertEqual(anims.length, 2);
  assert(anims.every(c => c.x === rect.x && c.y === rect.y), '같은 자리에서 출발');
});

test('같은 카드가 두 번 들어가지 않는다 (이중 표시 없음)', () => {
  const { game, renderer } = boardWithFreeAndFoundation();
  renderer.startFailEffect(game);
  const cards = flying(renderer).map(c => c.card);
  assertEqual(new Set(cards).size, cards.length);
});

test('이펙트를 다시 시작하면 이전 카드 목록을 버리고 새로 만든다', () => {
  const { game, renderer } = boardWithFreeAndFoundation();
  renderer.startFailEffect(game);
  renderer.startFailEffect(game);
  assertEqual(flying(renderer).length, totalCards(game));
  assert(renderer.isFailAnimating);
});

test('stopEffects: 이펙트를 즉시 끝내고 카드 목록을 비운다', () => {
  const { game, renderer } = boardWithFreeAndFoundation();
  renderer.startFailEffect(game);
  renderer.stopEffects();
  assertEqual(flying(renderer).length, 0);
  assert(!renderer.isFailAnimating);
});

suite('Renderer - 패배 이펙트 그리기');

/** 어떤 메서드 호출·속성 대입도 받아 주는 가짜 2D 컨텍스트 */
function fakeCtx() {
  return new Proxy({}, {
    get: (t, k) => (k in t ? t[k] : () => {}),
    set: (t, k, v) => { t[k] = v; return true; },
  });
}

/** 이펙트 한 프레임을 진행하고, 그 프레임에 그려진 카드 목록을 돌려준다 */
function stepAndCollect(renderer, dt) {
  const drawn = [];
  renderer.ctx = fakeCtx();
  renderer._drawCard = (card, x, y) => { drawn.push({ card, x, y }); };
  renderer._stepFailAnim(dt, dt * 60);
  return drawn;
}

test('아직 날아가지 않은 카드는 제자리에 그대로 보인다 (시작하자마자 사라지지 않음)', () => {
  const { game, renderer } = boardWithFreeAndFoundation();
  renderer.startFailEffect(game);
  const drawn = stepAndCollect(renderer, 0.001);
  const cards = drawn.map(d => d.card);
  assertEqual(new Set(cards).size, totalCards(game), '모든 카드가 그려짐');
  assertEqual(cards.length, totalCards(game), '카드마다 한 번씩만 (이중 표시 없음)');
});

test('대기 중인 카드는 원래 자리에, 쌓인 순서(아래 → 위)대로 그린다', () => {
  const { game, renderer } = boardWithFreeAndFoundation();
  renderer.startFailEffect(game);
  for (const c of flying(renderer)) c.delay = 10; // 전부 대기 상태로 고정
  const drawn = stepAndCollect(renderer, 0.001);
  const deck = game.getDeck(DeckIndex.Tableau2);
  const idx = [];
  for (let ci = 0; ci < deck.size(); ci++) {
    const rect = renderer.getCardRect(DeckIndex.Tableau2, ci, game);
    const i = drawn.findIndex(d => d.card === deck.get(ci));
    assert(i >= 0, `카드 ${ci} 그려짐`);
    assertEqual(drawn[i].x, rect.x);
    assertEqual(drawn[i].y, rect.y);
    idx.push(i);
  }
  assert(idx.every((v, k) => k === 0 || v > idx[k - 1]), '아래 카드부터 그림');
});

test('모든 카드가 사라지면 이펙트가 끝난다', () => {
  const { game, renderer } = boardWithFreeAndFoundation();
  renderer.startFailEffect(game);
  for (const c of flying(renderer)) { c.delay = 0; c.alpha = 0.001; }
  stepAndCollect(renderer, 0.05);
  assert(!renderer.isFailAnimating);
});
