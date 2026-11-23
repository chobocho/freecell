// 파비콘(img/icon.png) 생성 — 초록 바탕의 금색 스페이드 (헤더 로고 "♠ FreeCell"과 같은 색)
// 사용: node scripts/gen-icon.mjs
// 외부 도구 없이 도형을 직접 그려 PNG로 저장한다 (4배 슈퍼샘플링으로 가장자리 보정).

import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';

const SIZE = 192;      // 출력 크기 (px)
const SS = 4;          // 슈퍼샘플링 배수
const BG = [0x1b, 0x5e, 0x20];   // 테이블 초록
const FG = [0xff, 0xd5, 0x4f];   // 로고 금색

/** 둥근 모서리 정사각형 (0~1 좌표) */
function inRoundedSquare(x, y, r = 0.2) {
  const dx = Math.max(r - x, 0, x - (1 - r));
  const dy = Math.max(r - y, 0, y - (1 - r));
  return dx * dx + dy * dy <= r * r;
}

function inCircle(x, y, cx, cy, r) {
  return (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
}

function inTriangle(x, y, [ax, ay], [bx, by], [cx, cy]) {
  const s = (px, py, qx, qy) => (x - qx) * (py - qy) - (px - qx) * (y - qy);
  const d1 = s(ax, ay, bx, by), d2 = s(bx, by, cx, cy), d3 = s(cx, cy, ax, ay);
  const neg = d1 < 0 || d2 < 0 || d3 < 0;
  const pos = d1 > 0 || d2 > 0 || d3 > 0;
  return !(neg && pos);
}

/** 스페이드: 아래 두 원 + 위로 뾰족한 삼각형 + 받침 */
function inSpade(x, y) {
  return inCircle(x, y, 0.365, 0.555, 0.165)
      || inCircle(x, y, 0.635, 0.555, 0.165)
      || inTriangle(x, y, [0.5, 0.14], [0.215, 0.49], [0.785, 0.49])
      || inTriangle(x, y, [0.5, 0.56], [0.39, 0.86], [0.61, 0.86]);
}

// ── 픽셀 계산 ──────────────────────────────────────────────────────────────
const raw = Buffer.alloc(SIZE * (1 + SIZE * 4)); // 행마다 필터 바이트 1개 + RGBA
for (let py = 0; py < SIZE; py++) {
  const row = py * (1 + SIZE * 4);
  raw[row] = 0; // 필터 없음
  for (let px = 0; px < SIZE; px++) {
    let bg = 0, fg = 0;
    for (let sy = 0; sy < SS; sy++) {
      for (let sx = 0; sx < SS; sx++) {
        const x = (px + (sx + 0.5) / SS) / SIZE;
        const y = (py + (sy + 0.5) / SS) / SIZE;
        if (!inRoundedSquare(x, y)) continue;
        if (inSpade(x, y)) fg++; else bg++;
      }
    }
    const n = bg + fg;
    const o = row + 1 + px * 4;
    for (let c = 0; c < 3; c++) {
      raw[o + c] = n === 0 ? 0 : Math.round((BG[c] * bg + FG[c] * fg) / n);
    }
    raw[o + 3] = Math.round((255 * n) / (SS * SS));
  }
}

// ── PNG 작성 ───────────────────────────────────────────────────────────────
const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const body = Buffer.concat([Buffer.from(type, 'latin1'), data]);
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(SIZE, 0);
ihdr.writeUInt32BE(SIZE, 4);
ihdr[8] = 8;  // 비트 깊이
ihdr[9] = 6;  // RGBA

const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk('IHDR', ihdr),
  chunk('IDAT', deflateSync(raw, { level: 9 })),
  chunk('IEND', Buffer.alloc(0)),
]);

const out = new URL('../img/icon.png', import.meta.url);
writeFileSync(out, png);
console.log(`img/icon.png: ${SIZE}x${SIZE}, ${png.length} bytes`);
