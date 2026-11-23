// ─── 난이도 표 생성 ──────────────────────────────────────────────────────────
// MS FreeCell 게임 #1~#32000 을 솔버로 풀어 "헤맨 정도(탐색 상태 수)"로 하/중/상을 나누고
// src/levels.ts 를 생성한다. 워커 스레드로 병렬 실행.
//
// 실행:  tsc && node scripts/gen-levels.mjs [maxNodes=30000] [last=32000]
// 결과:  src/levels.ts (난이도 표, last=32000일 때만), scripts/levels-nodes.json (게임별 측정값)
// 생성 후 tsc 를 다시 실행해야 dist/levels.js 에 반영된다.

import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import os from 'node:os';

const ROOT = new URL('../', import.meta.url);

if (!isMainThread) {
  const { measure, layoutFromGameNumber } = await import(new URL('dist/solver.js', ROOT));
  const { maxNodes } = workerData;
  parentPort.on('message', (n) => {
    const m = measure(layoutFromGameNumber(n), maxNodes);
    parentPort.postMessage({ n, nodes: m.solved ? m.nodes : -1 });
  });
} else {
  const maxNodes = Number(process.argv[2] ?? 30000);
  const last     = Number(process.argv[3] ?? 32000);
  const { MAX_GAME_NUMBER } = await import(new URL('dist/lfsr.js', ROOT));

  const workers = Math.max(1, Math.min(os.cpus().length - 2, 16));
  const nodes = new Int32Array(last + 1);   // -1 = 상한 안에 못 풂
  let next = 1, done = 0;
  const t0 = Date.now();

  await new Promise((resolve) => {
    for (let w = 0; w < workers; w++) {
      const worker = new Worker(fileURLToPath(import.meta.url), { workerData: { maxNodes } });
      const feed = () => {
        if (next > last) { worker.terminate(); return; }
        worker.postMessage(next++);
      };
      worker.on('message', ({ n, nodes: v }) => {
        nodes[n] = v;
        if (++done % 2000 === 0) {
          console.log(`  ${done}/${last}  (${((Date.now() - t0) / 1000).toFixed(0)}s)`);
        }
        if (done === last) resolve();
        else feed();
      });
      feed();
    }
  });

  // 풀린 판의 탐색 상태 수로 3등분한다. 못 푼 판은 '상'.
  const solved = [];
  for (let n = 1; n <= last; n++) if (nodes[n] >= 0) solved.push(nodes[n]);
  solved.sort((a, b) => a - b);
  const easyMax   = solved[Math.floor(last / 3) - 1];
  const mediumMax = solved[Math.floor(last * 2 / 3) - 1];

  const levels = new Uint8Array(last + 1);
  const count = [0, 0, 0];
  for (let n = 1; n <= last; n++) {
    const v = nodes[n];
    const lv = v < 0 ? 2 : v <= easyMax ? 0 : v <= mediumMax ? 1 : 2;
    levels[n] = lv;
    count[lv]++;
  }
  const unsolved = last - solved.length;

  writeFileSync(new URL('scripts/levels-nodes.json', ROOT),
    JSON.stringify({ maxNodes, last, nodes: Array.from(nodes.subarray(1)) }));

  if (last === MAX_GAME_NUMBER) {
    // difficulty.js 는 levels.js 를 import 하므로, 인코더는 여기서 같은 형식으로 직접 구현한다
    const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    let data = '';
    for (let n = 1; n <= last; n += 3) {
      data += ALPHABET[levels[n] | ((levels[n + 1] ?? 0) << 2) | ((levels[n + 2] ?? 0) << 4)];
    }
    const lines = data.match(/.{1,100}/g).map(l => `  '${l}'`).join(' +\n');
    writeFileSync(new URL('src/levels.ts', ROOT),
`// ─── 게임 번호별 난이도 표 (자동 생성 — 직접 수정하지 말 것) ─────────────────
// 생성: tsc && node scripts/gen-levels.mjs ${maxNodes}
// 기준: 솔버가 풀이를 찾기까지 탐색한 상태 수 (세 가지 탐색 성향 중 최솟값, 상한 ${maxNodes})
//   하: ${easyMax} 이하 (${count[0]}판)
//   중: ${mediumMax} 이하 (${count[1]}판)
//   상: 그 초과, 또는 상한 안에 풀이를 못 찾은 판 (${count[2]}판, 그중 미해결 ${unsolved}판)
// 형식: 게임 번호 1부터 3판씩 한 글자 (판당 2비트: 0=하 1=중 2=상). 해석은 difficulty.ts 의 decodeLevels.

export const LEVEL_EASY_MAX_NODES = ${easyMax};
export const LEVEL_MEDIUM_MAX_NODES = ${mediumMax};

export const LEVEL_DATA: string =
${lines};
`);
    console.log('wrote src/levels.ts');
  }
  console.log(`done in ${((Date.now() - t0) / 1000).toFixed(0)}s — workers=${workers} maxNodes=${maxNodes}`);
  console.log(`solved ${solved.length}/${last} (unsolved ${unsolved})`);
  console.log(`easy<=${easyMax} (${count[0]})  medium<=${mediumMax} (${count[1]})  hard (${count[2]})`);
  const q = (p) => solved[Math.floor(solved.length * p)];
  console.log(`nodes q10=${q(.1)} q25=${q(.25)} q50=${q(.5)} q75=${q(.75)} q90=${q(.9)} q99=${q(.99)}`);
  process.exit(0);
}
