// ─── FreeCell 솔버 ───────────────────────────────────────────────────────────
// 카드 id = 무늬(0=♣ 1=♦ 2=♥ 3=♠) * 13 + (숫자 - 1)   ← Figure enum - 1 과 같은 순서
// 탐색: 휴리스틱 최선 우선 탐색 + 방문 상태 메모 + 안전한 파운데이션 자동 이동.
// 풀이 수순은 실제 게임의 moveCard(from, to, count)에 그대로 넣을 수 있는 형태로 돌려준다.
//
// 용도: 난이도 분류(풀이를 찾기까지 탐색한 상태 수) — scripts/gen-levels.mjs 에서 사용.
// 게임 실행 중에는 사용하지 않는다(릴리스 번들에 포함되지 않음).
import { FreecellGame } from './freecell.js';
import { DeckIndex } from './deck.js';
export const SOLVER_PROFILES = [
    { remaining: 7, blocked: 6, cover: 0, usedFree: 3, emptyCol: 4, depth: -0.25 },
    { remaining: 6, blocked: 5, cover: 0, usedFree: 2, emptyCol: 3, depth: 0 },
    { remaining: 6, blocked: 4, cover: 2, usedFree: 2, emptyCol: 3, depth: 1 / 3 },
];
const suitOf = (id) => (id / 13) | 0;
const rankOf = (id) => (id % 13) + 1;
const isRed = (id) => { const s = suitOf(id); return s === 1 || s === 2; };
/** upper 를 lower 위에 쌓을 수 있는가 (교대 색상 + 숫자 1 작음) */
const stacks = (upper, lower) => rankOf(upper) + 1 === rankOf(lower) && isRed(upper) !== isRed(lower);
// ─── Layout 추출 ─────────────────────────────────────────────────────────────
export function layoutFromGame(game) {
    const cid = (c) => (c.figure - 1) * 13 + c.number - 1;
    const cascades = [];
    for (let i = 0; i < 8; i++) {
        const deck = game.getDeck((DeckIndex.Tableau1 + i));
        const col = [];
        for (let k = 0; k < deck.size(); k++)
            col.push(cid(deck.get(k)));
        cascades.push(col);
    }
    const free = [];
    for (let i = 0; i < 4; i++) {
        const top = game.getDeck((DeckIndex.Free1 + i)).top();
        free.push(top ? cid(top) : -1);
    }
    const found = [];
    for (let i = 0; i < 4; i++) {
        found.push(game.getDeck((DeckIndex.Found1 + i)).size());
    }
    return { cascades, free, found };
}
/** 게임 번호로 deal한 초기 배치 */
export function layoutFromGameNumber(gameNumber) {
    const game = new FreecellGame();
    game.deal(gameNumber);
    return layoutFromGame(game);
}
/** 위치(어느 열/어느 칸)와 무관한 상태 키: 열과 프리셀을 정렬해 대칭 상태를 하나로 본다 */
function keyOf(cas, free) {
    const cols = [];
    for (const c of cas)
        cols.push(String.fromCharCode(...c.map(v => v + 48)));
    cols.sort();
    const f = free.filter(v => v >= 0).sort((a, b) => a - b);
    return cols.join('|') + '#' + String.fromCharCode(...f.map(v => v + 48));
}
/**
 * 파운데이션으로 올려도 손해가 없는 카드인가.
 * 반대 색 두 무늬가 모두 (숫자 - 1) 이상 올라가 있으면, 이 카드 위에 놓을 카드가 더는 필요 없다.
 */
function isSafeToFound(id, found) {
    const r = rankOf(id);
    if (r <= 2)
        return true;
    const s = suitOf(id);
    const red = s === 1 || s === 2;
    const o1 = red ? 0 : 1, o2 = red ? 3 : 2;
    return found[o1] >= r - 1 && found[o2] >= r - 1;
}
/** 안전한 파운데이션 이동을 더 없을 때까지 적용 (상태를 직접 변경) */
function autoFound(cas, free, found, out) {
    let moved = true;
    while (moved) {
        moved = false;
        for (let i = 0; i < 8; i++) {
            const col = cas[i];
            if (col.length === 0)
                continue;
            const c = col[col.length - 1];
            const s = suitOf(c);
            if (found[s] === rankOf(c) - 1 && isSafeToFound(c, found)) {
                col.pop();
                found[s]++;
                out.push({ from: DeckIndex.Tableau1 + i, to: DeckIndex.Found1 + s, count: 1 });
                moved = true;
            }
        }
        for (let i = 0; i < 4; i++) {
            const c = free[i];
            if (c < 0)
                continue;
            const s = suitOf(c);
            if (found[s] === rankOf(c) - 1 && isSafeToFound(c, found)) {
                free[i] = -1;
                found[s]++;
                out.push({ from: DeckIndex.Free1 + i, to: DeckIndex.Found1 + s, count: 1 });
                moved = true;
            }
        }
    }
}
/** 휴리스틱 (작을수록 승리에 가까움). 항목별 의미는 SolverProfile 참고 */
function heuristic(cas, free, found, p) {
    let remaining = 52, cover = 0, emptyCols = 0, usedFree = 0, blocked = 0;
    for (let s = 0; s < 4; s++)
        remaining -= found[s];
    for (const col of cas) {
        const n = col.length;
        if (n === 0) {
            emptyCols++;
            continue;
        }
        let minRank = rankOf(col[0]);
        for (let i = 1; i < n; i++) {
            const r = rankOf(col[i]);
            if (r > minRank)
                blocked++;
            else
                minRank = r;
        }
        for (let i = 0; i < n; i++) {
            const c = col[i];
            if (found[suitOf(c)] === rankOf(c) - 1)
                cover += n - 1 - i;
        }
    }
    for (const f of free)
        if (f >= 0)
            usedFree++;
    return remaining * p.remaining + blocked * p.blocked + cover * p.cover
        + usedFree * p.usedFree - emptyCols * p.emptyCol;
}
// ─── 우선순위 큐 (최소 힙) ───────────────────────────────────────────────────
class MinHeap {
    constructor() {
        this.a = [];
        this.p = [];
    }
    get size() { return this.a.length; }
    push(node, prio) {
        const a = this.a, p = this.p;
        let i = a.length;
        a.push(node);
        p.push(prio);
        while (i > 0) {
            const up = (i - 1) >> 1;
            if (p[up] <= prio)
                break;
            a[i] = a[up];
            p[i] = p[up];
            i = up;
        }
        a[i] = node;
        p[i] = prio;
    }
    pop() {
        const a = this.a, p = this.p;
        const top = a[0];
        const last = a.pop(), lastP = p.pop();
        const n = a.length;
        if (n > 0) {
            let i = 0;
            for (;;) {
                let c = 2 * i + 1;
                if (c >= n)
                    break;
                if (c + 1 < n && p[c + 1] < p[c])
                    c++;
                if (p[c] >= lastP)
                    break;
                a[i] = a[c];
                p[i] = p[c];
                i = c;
            }
            a[i] = last;
            p[i] = lastP;
        }
        return top;
    }
}
// ─── 솔버 ────────────────────────────────────────────────────────────────────
export function solve(layout, options = {}) {
    const maxNodes = options.maxNodes ?? 20000;
    const profile = options.profile ?? SOLVER_PROFILES[0];
    const rootMoves = [];
    const cas0 = layout.cascades.map(c => c.slice());
    const free0 = layout.free.slice();
    const found0 = layout.found.slice();
    autoFound(cas0, free0, found0, rootMoves);
    const root = {
        cas: cas0, free: free0, found: found0,
        parent: null, moves: rootMoves, depth: 0,
        h: heuristic(cas0, free0, found0, profile),
    };
    const heap = new MinHeap();
    const seen = new Set();
    seen.add(keyOf(cas0, free0));
    // 우선순위가 같으면 나중에 넣은 상태를 먼저 본다
    let seq = 0;
    const prioOf = (n) => Math.round((n.h + n.depth * profile.depth) * 64) * 1048576 - (seq++);
    heap.push(root, prioOf(root));
    let nodes = 0;
    let goal = null;
    const isGoal = (n) => n.found[0] + n.found[1] + n.found[2] + n.found[3] === 52;
    if (isGoal(root))
        goal = root;
    while (goal === null && heap.size > 0) {
        if (nodes >= maxNodes)
            return { status: 'unknown', nodes, moves: [] };
        const cur = heap.pop();
        nodes++;
        const { cas, free, found } = cur;
        let emptyFree = 0, firstEmptyFree = -1;
        for (let i = 0; i < 4; i++) {
            if (free[i] < 0) {
                emptyFree++;
                if (firstEmptyFree < 0)
                    firstEmptyFree = i;
            }
        }
        let emptyCols = 0, firstEmptyCol = -1;
        for (let i = 0; i < 8; i++) {
            if (cas[i].length === 0) {
                emptyCols++;
                if (firstEmptyCol < 0)
                    firstEmptyCol = i;
            }
        }
        /** 이동 하나를 적용한 자식 상태를 큐에 넣는다. 승리면 true */
        const tryChild = (move, apply) => {
            const c2 = cas.slice();
            const f2 = free.slice();
            const fd2 = found.slice();
            apply(c2, f2, fd2);
            const moves = [move];
            // autoFound 는 열을 직접 변경하므로, 변경 대상 열은 복사본이어야 한다
            for (let i = 0; i < 8; i++) {
                if (c2[i] === cas[i] && c2[i].length > 0) {
                    const top = c2[i][c2[i].length - 1];
                    if (fd2[suitOf(top)] === rankOf(top) - 1)
                        c2[i] = c2[i].slice();
                }
            }
            autoFound(c2, f2, fd2, moves);
            const key = keyOf(c2, f2);
            if (seen.has(key))
                return false;
            seen.add(key);
            const child = {
                cas: c2, free: f2, found: fd2,
                parent: cur, moves, depth: cur.depth + 1,
                h: heuristic(c2, f2, fd2, profile),
            };
            if (isGoal(child)) {
                goal = child;
                return true;
            }
            heap.push(child, prioOf(child));
            return false;
        };
        let done = false;
        // ── 태블로 열에서 출발 ──
        for (let i = 0; i < 8 && !done; i++) {
            const col = cas[i];
            const n = col.length;
            if (n === 0)
                continue;
            const top = col[n - 1];
            const from = DeckIndex.Tableau1 + i;
            // 파운데이션으로
            const s = suitOf(top);
            if (found[s] === rankOf(top) - 1) {
                done = tryChild({ from, to: DeckIndex.Found1 + s, count: 1 }, (c, _f, fd) => {
                    c[i] = col.slice(0, n - 1);
                    fd[s]++;
                });
                if (done)
                    break;
            }
            // 맨 위의 연속 시퀀스 길이
            let run = 1;
            while (run < n && stacks(col[n - run], col[n - run - 1]))
                run++;
            // 다른 열 위로 (받는 카드가 정해져 있으므로 장수는 하나로 결정됨)
            for (let j = 0; j < 8 && !done; j++) {
                if (j === i || cas[j].length === 0)
                    continue;
                const dst = cas[j];
                const dtop = dst[dst.length - 1];
                const cap = (emptyFree + 1) << emptyCols;
                for (let k = 1; k <= run && k <= cap; k++) {
                    const base = col[n - k];
                    if (stacks(base, dtop)) {
                        done = tryChild({ from, to: DeckIndex.Tableau1 + j, count: k }, (c) => {
                            c[i] = col.slice(0, n - k);
                            c[j] = dst.concat(col.slice(n - k));
                        });
                        break;
                    }
                }
            }
            if (done)
                break;
            // 빈 열로 (첫 빈 열만 — 나머지는 대칭). 열 전체를 옮기는 것은 의미가 없으므로 제외
            if (firstEmptyCol >= 0) {
                const cap = (emptyFree + 1) << (emptyCols - 1);
                const j = firstEmptyCol;
                for (let k = Math.min(run, cap, n - 1); k >= 1 && !done; k--) {
                    done = tryChild({ from, to: DeckIndex.Tableau1 + j, count: k }, (c) => {
                        c[i] = col.slice(0, n - k);
                        c[j] = col.slice(n - k);
                    });
                }
                if (done)
                    break;
            }
            // 프리셀로 (첫 빈 칸만)
            if (firstEmptyFree >= 0) {
                const slot = firstEmptyFree;
                done = tryChild({ from, to: DeckIndex.Free1 + slot, count: 1 }, (c, f) => {
                    c[i] = col.slice(0, n - 1);
                    f[slot] = top;
                });
            }
        }
        // ── 프리셀에서 출발 ──
        for (let i = 0; i < 4 && !done; i++) {
            const card = free[i];
            if (card < 0)
                continue;
            const from = DeckIndex.Free1 + i;
            const s = suitOf(card);
            if (found[s] === rankOf(card) - 1) {
                done = tryChild({ from, to: DeckIndex.Found1 + s, count: 1 }, (_c, f, fd) => {
                    f[i] = -1;
                    fd[s]++;
                });
                if (done)
                    break;
            }
            for (let j = 0; j < 8 && !done; j++) {
                const dst = cas[j];
                if (dst.length === 0) {
                    if (j !== firstEmptyCol)
                        continue;
                }
                else if (!stacks(card, dst[dst.length - 1])) {
                    continue;
                }
                done = tryChild({ from, to: DeckIndex.Tableau1 + j, count: 1 }, (c, f) => {
                    f[i] = -1;
                    c[j] = dst.concat(card);
                });
            }
        }
    }
    if (goal === null)
        return { status: 'unsolvable', nodes, moves: [] };
    // 풀이 수순 복원 (루트 → 목표)
    const chain = [];
    for (let n = goal; n !== null; n = n.parent)
        chain.push(n);
    const moves = [];
    for (let i = chain.length - 1; i >= 0; i--)
        moves.push(...chain[i].moves);
    return { status: 'solved', nodes, moves };
}
/** 풀이 수순을 실제 게임에 재생해 승리하는지 확인 (솔버 검증용) */
export function replaySolution(game, moves) {
    for (const m of moves) {
        if (!game.moveCard(m.from, m.to, m.count))
            return false;
    }
    return game.isWin();
}
/**
 * 모든 탐색 성향으로 풀어 보고 가장 적게 헤맨 결과를 돌려준다.
 * 한 성향의 운 나쁜 탐색 때문에 쉬운 판이 어렵게 분류되는 것을 줄인다.
 */
export function measure(layout, maxNodes) {
    let best = Infinity;
    for (const profile of SOLVER_PROFILES) {
        // 이미 찾은 풀이보다 더 헤맬 필요는 없다
        const r = solve(layout, { maxNodes: Math.min(maxNodes, best), profile });
        if (r.status === 'solved' && r.nodes < best)
            best = r.nodes;
    }
    return best === Infinity ? { solved: false, nodes: maxNodes } : { solved: true, nodes: best };
}
//# sourceMappingURL=solver.js.map