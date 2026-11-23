// FreeCell 솔버
import { DeckIndex } from '../dist/deck.js';
import { FreecellGame } from '../dist/freecell.js';
import { SOLVER_PROFILES, solve, measure, replaySolution, layoutFromGame, layoutFromGameNumber } from '../dist/solver.js';
import { suite, test, assert, assertEqual } from './helpers.mjs';

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
