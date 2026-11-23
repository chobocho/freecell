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

suite('Renderer - 화면 갱신이 느릴 때의 이펙트 속도');

/** 프레임 간격(ms)을 정해 render() 를 반복 호출하고, 이펙트가 끝날 때까지 걸린 프레임 수를 돌려준다 */
function framesUntilFailDone(frameMs, maxFrames) {
  const { game, renderer } = boardWithFreeAndFoundation();
  renderer.ctx = fakeCtx();
  renderer._drawCard = () => {};
  game.giveUp();
  const realNow = performance.now;
  let t = 1000;
  performance.now = () => t;
  try {
    renderer.startFailEffect(game);
    for (let n = 1; n <= maxFrames; n++) {
      t += frameMs;
      renderer.render(game, { isDragging: false, cards: [] }, 0);
      if (!renderer.isFailAnimating) return n;
    }
    return Infinity;
  } finally {
    performance.now = realNow;
  }
}

test('초당 2프레임이어도 패배 이펙트는 실제 시간으로 몇 초 안에 끝난다 (슬로모션 아님)', () => {
  // 이펙트 길이는 최대 약 3.6초(대기 1.5초 + 사라지는 데 2.1초) → 0.5초 간격이면 10프레임 안팎
  const n = framesUntilFailDone(500, 200);
  assert(n <= 12, `12프레임(6초) 안에 끝나야 함, 실제 ${n}프레임`);
});

test('초당 60프레임일 때의 길이는 그대로 (2~4초)', () => {
  const n = framesUntilFailDone(1000 / 60, 600);
  assert(n >= 120 && n <= 240, `실제 ${n}프레임`);
});

test('한 프레임에 아주 긴 시간이 지나도(탭 복귀 등) 한 번에 최대 1초만 진행', () => {
  const n = framesUntilFailDone(60000, 200);
  assert(n >= 3 && n <= 6, `실제 ${n}프레임`);
});
