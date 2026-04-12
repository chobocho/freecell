import { Figure } from './card.js';
import { DeckIndex } from './deck.js';
// 덱 인덱스 → 키 레이블 (화면 배치 순서와 일치)
const KEY_LABELS = {
    0: 'Q', 1: 'W', 2: 'E', 3: 'R', // Foundation 1-4
    4: 'U', 5: 'I', 6: 'O', 7: 'P', // FreeCell 1-4
    8: '1', 9: '2', 10: '3', 11: '4', // Tableau 1-4
    12: '5', 13: '6', 14: '7', 15: '8', // Tableau 5-8
};
export function calcLayout(canvasW, canvasH) {
    // 카드 폭: 화면 폭에서 8컬럼 + 여백이 들어가도록 계산
    // 최소 40px, 최대 100px
    const padX = Math.max(6, canvasW * 0.015);
    const padY = Math.max(6, canvasH * 0.02);
    const colGap = Math.max(4, canvasW * 0.008);
    const totalColW = canvasW - padX * 2;
    const cardW = Math.min(100, Math.max(40, Math.floor((totalColW - colGap * 7) / 8)));
    const cardH = Math.floor(cardW * 1.4);
    const stackGap = Math.max(16, Math.floor(cardH * 0.28));
    const stackGapClosed = Math.max(6, Math.floor(cardH * 0.12));
    // 8컬럼을 화면 중앙에 정렬
    const totalTabW = cardW * 8 + colGap * 7;
    const startX = Math.floor((canvasW - totalTabW) / 2);
    // Tableau X 좌표
    const tabX = [];
    for (let i = 0; i < 8; i++)
        tabX.push(startX + i * (cardW + colGap));
    // Foundation: 왼쪽 4개
    const foundX = tabX.slice(0, 4);
    // FreeCell: 오른쪽 4개
    const freeX = tabX.slice(4, 8);
    const topRowY = padY;
    const tableauY = topRowY + cardH + padY + 6;
    return {
        cardW, cardH, padX, padY, colGap,
        stackGap, stackGapClosed,
        topRowY, tableauY,
        foundX, freeX, tabX,
    };
}
// ─── 이미지 로더 ──────────────────────────────────────────────────────────
const IMAGE_NAMES = [];
const figPfx = ['c', 'd', 'h', 's'];
const numSfx = ['a', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'j', 'q', 'k'];
for (let f = 0; f < 4; f++) {
    for (let n = 0; n < 13; n++) {
        IMAGE_NAMES.push(figPfx[f] + numSfx[n]);
    }
}
export async function loadImages(baseUrl = 'img/') {
    const extras = ['abg']; // 카드 뒷면 이미지만 추가 로드
    const allNames = [...IMAGE_NAMES, ...extras];
    const map = new Map();
    const promises = allNames.map(name => new Promise((resolve) => {
        const img = new Image();
        img.onload = () => { map.set(name, img); resolve(); };
        img.onerror = () => { resolve(); }; // 실패해도 계속 진행
        img.src = `${baseUrl}${name}.png`;
    }));
    await Promise.all(promises);
    return map;
}
export class Renderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.images = new Map();
        // 애니메이션 — 승리/실패를 분리해 서로 간섭하지 않도록 함
        this._winAnimCards = [];
        this._failAnimCards = [];
        this._winAnimActive = false;
        /** 실패 이펙트 진행 중 (보드 숨김 + 폴링용) */
        this._failAnimating = false;
        const ctx = canvas.getContext('2d');
        if (!ctx)
            throw new Error('Canvas 2D context를 얻을 수 없습니다.');
        this.ctx = ctx;
    }
    async init() {
        this.images = await loadImages('img/');
        this.resize();
    }
    resize() {
        const w = this.canvas.clientWidth;
        const h = this.canvas.clientHeight;
        // devicePixelRatio 대응 (고해상도 디스플레이)
        const dpr = window.devicePixelRatio || 1;
        this.canvas.width = Math.round(w * dpr);
        this.canvas.height = Math.round(h * dpr);
        this.ctx.scale(dpr, dpr);
        this.layout = calcLayout(w, h);
    }
    getLayout() { return this.layout; }
    // ── 카드 위치 계산 ───────────────────────────────────────────────────────
    /** 덱의 특정 카드 화면 좌표 반환 */
    getCardRect(deckIdx, cardIdx, game) {
        const L = this.layout;
        const { cardW, cardH } = L;
        if (deckIdx >= DeckIndex.Found1 && deckIdx <= DeckIndex.Found4) {
            const col = deckIdx - DeckIndex.Found1;
            return { x: L.foundX[col], y: L.topRowY, w: cardW, h: cardH };
        }
        if (deckIdx >= DeckIndex.Free1 && deckIdx <= DeckIndex.Free4) {
            const col = deckIdx - DeckIndex.Free1;
            return { x: L.freeX[col], y: L.topRowY, w: cardW, h: cardH };
        }
        if (deckIdx >= DeckIndex.Tableau1 && deckIdx <= DeckIndex.Tableau8) {
            const col = deckIdx - DeckIndex.Tableau1;
            const x = L.tabX[col];
            let y = L.tableauY;
            const deck = game.getDeck(deckIdx);
            for (let i = 0; i < cardIdx; i++) {
                y += deck.get(i).isOpen ? L.stackGap : L.stackGapClosed;
            }
            return { x, y, w: cardW, h: cardH };
        }
        return { x: 0, y: 0, w: cardW, h: cardH };
    }
    /** 맨 위 카드 기준 (스택 전체 바닥 Y를 포함하는 실제 높이) */
    getDeckBottomY(deckIdx, game) {
        const deck = game.getDeck(deckIdx);
        if (deck.isEmpty())
            return this.getCardRect(deckIdx, 0, game).y + this.layout.cardH;
        const topRect = this.getCardRect(deckIdx, deck.size() - 1, game);
        return topRect.y + topRect.h;
    }
    // ── 메인 렌더 ────────────────────────────────────────────────────────────
    render(game, drag, _elapsedSec, kbState) {
        const W = this.canvas.clientWidth;
        const H = this.canvas.clientHeight;
        // 배경
        this._drawBackground(W, H);
        // 실패 이펙트 중에는 보드를 숨김 (카드가 제자리에서 날아가는 효과)
        if (!this._failAnimating) {
            this._drawFoundations(game, drag);
            this._drawFreeCells(game, drag);
            this._drawTableaus(game, drag);
            if (drag.isDragging) {
                this._drawDragCards(drag);
            }
            // 키보드 선택 하이라이트
            if (kbState?.selectedDeck !== null && kbState?.selectedDeck !== undefined) {
                this._drawKbHighlight(kbState.selectedDeck, game);
            }
            // Ctrl 키 힌트 오버레이
            if (kbState?.ctrlHeld) {
                this._drawKeyOverlay(game);
            }
        }
        // 이펙트 — 승리/실패 각각 독립 실행
        if (this._winAnimActive)
            this._stepWinAnim();
        if (this._failAnimating)
            this._stepFailAnim();
    }
    // ── 배경 ─────────────────────────────────────────────────────────────────
    _drawBackground(W, H) {
        const { ctx } = this;
        ctx.fillStyle = '#1b5e20'; // 오리지널 프리셀 스타일 단색 녹색
        ctx.fillRect(0, 0, W, H);
    }
    // ── Foundation 덱 ────────────────────────────────────────────────────────
    _drawFoundations(game, drag) {
        for (let i = DeckIndex.Found1; i <= DeckIndex.Found4; i++) {
            const deckIdx = i;
            const deck = game.getDeck(deckIdx);
            const col = i - DeckIndex.Found1;
            const x = this.layout.foundX[col];
            const y = this.layout.topRowY;
            this._drawDeckSlot(x, y, 'foundation', col);
            if (!deck.isEmpty()) {
                const isDragSrc = drag.isDragging && drag.fromDeck === deckIdx;
                if (!isDragSrc) {
                    this._drawCard(deck.top(), x, y);
                }
            }
        }
    }
    // ── FreeCell 덱 ──────────────────────────────────────────────────────────
    _drawFreeCells(game, drag) {
        for (let i = DeckIndex.Free1; i <= DeckIndex.Free4; i++) {
            const deckIdx = i;
            const deck = game.getDeck(deckIdx);
            const col = i - DeckIndex.Free1;
            const x = this.layout.freeX[col];
            const y = this.layout.topRowY;
            this._drawDeckSlot(x, y, 'freecell', col);
            if (!deck.isEmpty()) {
                const isDragSrc = drag.isDragging && drag.fromDeck === deckIdx;
                if (!isDragSrc) {
                    this._drawCard(deck.top(), x, y);
                }
            }
        }
    }
    // ── Tableau 덱 ───────────────────────────────────────────────────────────
    _drawTableaus(game, drag) {
        for (let i = DeckIndex.Tableau1; i <= DeckIndex.Tableau8; i++) {
            const deckIdx = i;
            const deck = game.getDeck(deckIdx);
            const col = i - DeckIndex.Tableau1;
            const x = this.layout.tabX[col];
            // 빈 슬롯
            this._drawDeckSlot(x, this.layout.tableauY, 'tableau', col);
            const dragCount = (drag.isDragging && drag.fromDeck === deckIdx) ? drag.cards.length : 0;
            const ghostFrom = deck.size() - dragCount; // 이 인덱스부터 드래그 중 (ghost)
            let y = this.layout.tableauY;
            for (let ci = 0; ci < deck.size(); ci++) {
                const card = deck.get(ci);
                if (ci >= ghostFrom) {
                    // 드래그 중인 카드 자리 - 반투명 ghost
                    this.ctx.save();
                    this.ctx.globalAlpha = 0.25;
                    this._drawCard(card, x, y);
                    this.ctx.restore();
                }
                else {
                    this._drawCard(card, x, y);
                }
                y += card.isOpen ? this.layout.stackGap : this.layout.stackGapClosed;
            }
        }
    }
    // ── 드래그 카드 ──────────────────────────────────────────────────────────
    _drawDragCards(drag) {
        const { ctx } = this;
        const { stackGap } = this.layout;
        const baseX = drag.x - drag.offsetX;
        const baseY = drag.y - drag.offsetY;
        ctx.save();
        ctx.shadowColor = 'rgba(0,0,0,0.5)';
        ctx.shadowBlur = 12;
        ctx.shadowOffsetY = 6;
        for (let i = 0; i < drag.cards.length; i++) {
            const card = drag.cards[i];
            const cy = baseY + i * stackGap;
            this._drawCard(card, baseX, cy, true);
        }
        ctx.restore();
    }
    // ── 덱 슬롯 (빈 자리) ────────────────────────────────────────────────────
    _drawDeckSlot(x, y, type, index) {
        const { ctx } = this;
        const { cardW, cardH } = this.layout;
        ctx.save();
        ctx.beginPath();
        this._roundRect(x, y, cardW, cardH, 6);
        switch (type) {
            case 'foundation':
                ctx.fillStyle = 'rgba(0,0,0,0.25)';
                ctx.strokeStyle = 'rgba(255,255,255,0.3)';
                break;
            case 'freecell':
                ctx.fillStyle = 'rgba(0,0,0,0.2)';
                ctx.strokeStyle = 'rgba(255,255,255,0.2)';
                break;
            case 'tableau':
                ctx.fillStyle = 'rgba(0,0,0,0.15)';
                ctx.strokeStyle = 'rgba(255,255,255,0.1)';
                break;
        }
        ctx.fill();
        ctx.lineWidth = 1.5;
        ctx.stroke();
        // Foundation 슬롯에 무늬 힌트 표시
        if (type === 'foundation') {
            const suits = ['♣', '♦', '♥', '♠'];
            const colors = ['rgba(200,230,200,0.4)', 'rgba(255,150,150,0.4)',
                'rgba(255,100,100,0.4)', 'rgba(200,230,200,0.4)'];
            ctx.fillStyle = colors[index];
            ctx.font = `${Math.floor(cardH * 0.35)}px serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(suits[index], x + cardW / 2, y + cardH / 2);
        }
        // FreeCell 슬롯에 'FC' 힌트
        if (type === 'freecell') {
            ctx.fillStyle = 'rgba(255,255,255,0.15)';
            ctx.font = `${Math.floor(cardH * 0.14)}px sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('FREE', x + cardW / 2, y + cardH / 2);
        }
        ctx.restore();
    }
    // ── 카드 그리기 ──────────────────────────────────────────────────────────
    _drawCard(card, x, y, elevated = false) {
        const { ctx } = this;
        const { cardW, cardH } = this.layout;
        if (!elevated) {
            ctx.save();
            ctx.shadowColor = 'rgba(0,0,0,0.3)';
            ctx.shadowBlur = 4;
            ctx.shadowOffsetY = 2;
        }
        if (card.isOpen) {
            const img = this.images.get(card.imageName);
            if (img) {
                ctx.drawImage(img, x, y, cardW, cardH);
            }
            else {
                this._drawCardFallback(card, x, y);
            }
        }
        else {
            const backImg = this.images.get('abg');
            if (backImg) {
                ctx.drawImage(backImg, x, y, cardW, cardH);
            }
            else {
                this._drawCardBack(x, y);
            }
        }
        if (!elevated)
            ctx.restore();
    }
    /** 이미지 로드 실패 시 텍스트로 카드 표시 */
    _drawCardFallback(card, x, y) {
        const { ctx } = this;
        const { cardW, cardH } = this.layout;
        ctx.fillStyle = '#fff';
        this._roundRect(x, y, cardW, cardH, 5);
        ctx.fill();
        ctx.strokeStyle = '#ccc';
        ctx.lineWidth = 1;
        ctx.stroke();
        const suitMap = { 1: '♣', 2: '♦', 3: '♥', 4: '♠' };
        const numMap = { 1: 'A', 11: 'J', 12: 'Q', 13: 'K' };
        const suit = suitMap[card.figure];
        const num = numMap[card.number] ?? String(card.number);
        const isRed = card.figure === Figure.Heart || card.figure === Figure.Diamond;
        ctx.fillStyle = isRed ? '#e53935' : '#212121';
        ctx.font = `bold ${Math.floor(cardW * 0.28)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`${num}${suit}`, x + cardW / 2, y + cardH / 2);
    }
    _drawCardBack(x, y) {
        const { ctx } = this;
        const { cardW, cardH } = this.layout;
        ctx.fillStyle = '#1565c0';
        this._roundRect(x, y, cardW, cardH, 5);
        ctx.fill();
        ctx.strokeStyle = '#90caf9';
        ctx.lineWidth = 1.5;
        ctx.stroke();
    }
    // ── 유틸리티 ─────────────────────────────────────────────────────────────
    _roundRect(x, y, w, h, r) {
        const { ctx } = this;
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + w - r, y);
        ctx.arcTo(x + w, y, x + w, y + r, r);
        ctx.lineTo(x + w, y + h - r);
        ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
        ctx.lineTo(x + r, y + h);
        ctx.arcTo(x, y + h, x, y + h - r, r);
        ctx.lineTo(x, y + r);
        ctx.arcTo(x, y, x + r, y, r);
        ctx.closePath();
    }
    // ── 힌트 표시 ────────────────────────────────────────────────────────────
    /** 유효한 드롭 대상 슬롯 강조 */
    drawDropHint(deckIdx, game) {
        const { ctx } = this;
        const { cardW, cardH } = this.layout;
        const rect = this.getCardRect(deckIdx, 0, game);
        ctx.save();
        ctx.beginPath();
        this._roundRect(rect.x, rect.y, cardW, cardH, 6);
        ctx.strokeStyle = 'rgba(255, 220, 0, 0.9)';
        ctx.lineWidth = 3;
        ctx.setLineDash([6, 3]);
        ctx.stroke();
        ctx.restore();
    }
    // ── 키보드 선택 하이라이트 ───────────────────────────────────────────────
    /** 키보드로 선택된 소스 덱에 황금 테두리 표시 */
    _drawKbHighlight(deckIdx, game) {
        const { ctx } = this;
        const { cardW, cardH } = this.layout;
        const L = this.layout;
        let x, y, h;
        if (deckIdx >= DeckIndex.Found1 && deckIdx <= DeckIndex.Found4) {
            const col = deckIdx - DeckIndex.Found1;
            x = L.foundX[col];
            y = L.topRowY;
            h = cardH;
        }
        else if (deckIdx >= DeckIndex.Free1 && deckIdx <= DeckIndex.Free4) {
            const col = deckIdx - DeckIndex.Free1;
            x = L.freeX[col];
            y = L.topRowY;
            h = cardH;
        }
        else {
            const col = deckIdx - DeckIndex.Tableau1;
            x = L.tabX[col];
            y = L.tableauY;
            // 전체 컬럼 높이까지 하이라이트
            h = Math.max(cardH, this.getDeckBottomY(deckIdx, game) - y);
        }
        const pad = 4;
        ctx.save();
        ctx.shadowColor = '#ffd700';
        ctx.shadowBlur = 16;
        ctx.beginPath();
        this._roundRect(x - pad, y - pad, cardW + pad * 2, h + pad * 2, 10);
        ctx.strokeStyle = '#ffd700';
        ctx.lineWidth = 3;
        ctx.stroke();
        // 선택된 영역에 옅은 황금 오버레이
        ctx.globalAlpha = 0.12;
        ctx.fillStyle = '#ffd700';
        ctx.fill();
        ctx.restore();
    }
    // ── Ctrl 키 힌트 오버레이 ────────────────────────────────────────────────
    /** Ctrl 누르는 동안 각 덱 슬롯에 키 레이블 배지 표시 */
    _drawKeyOverlay(game) {
        const { ctx } = this;
        const { cardW, cardH } = this.layout;
        const L = this.layout;
        // 배지 크기 계산
        const badgeSize = Math.max(18, Math.floor(cardW * 0.32));
        const fontSize = Math.max(11, Math.floor(badgeSize * 0.6));
        // 전체 화면 반투명 다크 오버레이
        ctx.save();
        ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
        ctx.fillRect(0, 0, this.canvas.clientWidth, this.canvas.clientHeight);
        ctx.restore();
        const drawBadge = (key, x, y, w, h) => {
            // 카드/슬롯 중앙에 큰 키 레이블
            const cx = x + w / 2;
            const cy = y + h / 2;
            const bw = badgeSize * 1.8;
            const bh = badgeSize * 1.4;
            const bx = cx - bw / 2;
            const by = cy - bh / 2;
            ctx.save();
            // 배지 배경
            ctx.beginPath();
            this._roundRect(bx, by, bw, bh, 6);
            ctx.fillStyle = 'rgba(20, 20, 20, 0.85)';
            ctx.fill();
            ctx.strokeStyle = 'rgba(255, 220, 80, 0.9)';
            ctx.lineWidth = 2;
            ctx.stroke();
            // 키 텍스트
            ctx.fillStyle = '#ffd740';
            ctx.font = `bold ${fontSize}px monospace`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(key, cx, cy);
            ctx.restore();
        };
        // Foundation 슬롯
        for (let i = DeckIndex.Found1; i <= DeckIndex.Found4; i++) {
            const col = i - DeckIndex.Found1;
            const key = KEY_LABELS[i];
            drawBadge(key, L.foundX[col], L.topRowY, cardW, cardH);
        }
        // FreeCell 슬롯
        for (let i = DeckIndex.Free1; i <= DeckIndex.Free4; i++) {
            const col = i - DeckIndex.Free1;
            const key = KEY_LABELS[i];
            drawBadge(key, L.freeX[col], L.topRowY, cardW, cardH);
        }
        // Tableau 슬롯
        for (let i = DeckIndex.Tableau1; i <= DeckIndex.Tableau8; i++) {
            const col = i - DeckIndex.Tableau1;
            const key = KEY_LABELS[i];
            const bottomY = this.getDeckBottomY(i, game);
            const h = Math.max(cardH, bottomY - L.tableauY);
            drawBadge(key, L.tabX[col], L.tableauY, cardW, h);
        }
        // 하단 범례
        this._drawKeyLegend();
    }
    /** Ctrl 오버레이 하단 범례 */
    _drawKeyLegend() {
        const { ctx } = this;
        const W = this.canvas.clientWidth;
        const H = this.canvas.clientHeight;
        const text = 'Q W E R  =  Foundation  │  U I O P  =  FreeCell  │  1-8  =  Tableau  │  Enter  =  자동이동';
        const pad = 10;
        const fh = Math.max(11, Math.min(14, Math.floor(W / 55)));
        ctx.save();
        ctx.font = `${fh}px monospace`;
        const tw = ctx.measureText(text).width;
        const bx = (W - tw) / 2 - pad;
        const by = H - fh - pad * 2 - 8;
        const bw = tw + pad * 2;
        const bh = fh + pad * 2;
        ctx.fillStyle = 'rgba(10, 10, 10, 0.82)';
        ctx.beginPath();
        this._roundRect(bx, by, bw, bh, 8);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,220,80,0.5)';
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.fillStyle = '#ffd740';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, W / 2, by + bh / 2);
        ctx.restore();
    }
    // ── 승리 이펙트 ──────────────────────────────────────────────────────────
    startWinEffect(game) {
        this._winAnimCards = [];
        const { cardW, cardH } = this.layout;
        // 모든 Foundation 카드를 날리기
        for (let di = DeckIndex.Found1; di <= DeckIndex.Found4; di++) {
            const deck = game.getDeck(di);
            for (let ci = 0; ci < deck.size(); ci++) {
                const rect = this.getCardRect(di, ci, game);
                const delay = Math.random() * 0.6;
                this._winAnimCards.push({
                    card: deck.get(ci),
                    x: rect.x, y: rect.y,
                    vx: (Math.random() - 0.5) * 8,
                    vy: -(Math.random() * 10 + 5),
                    angle: 0,
                    vAngle: (Math.random() - 0.5) * 0.2,
                    alpha: 1,
                    delay,
                    elapsed: 0,
                    w: cardW, h: cardH,
                });
            }
        }
        this._winAnimActive = true;
    }
    _stepWinAnim() {
        const { ctx } = this;
        const H = this.canvas.clientHeight;
        const G = 0.4; // 중력
        for (const c of this._winAnimCards) {
            c.elapsed += 0.016;
            if (c.elapsed < c.delay)
                continue;
            c.vy += G;
            c.x += c.vx;
            c.y += c.vy;
            c.angle += c.vAngle;
            if (c.y > H + 50) {
                c.alpha = 0;
                continue;
            }
            if (c.y > H * 0.7)
                c.alpha = Math.max(0, 1 - (c.y - H * 0.7) / (H * 0.3));
            ctx.save();
            ctx.globalAlpha = c.alpha;
            ctx.translate(c.x + c.w / 2, c.y + c.h / 2);
            ctx.rotate(c.angle);
            this._drawCard(c.card, -c.w / 2, -c.h / 2, true);
            ctx.restore();
        }
        const allDone = this._winAnimCards.every(c => c.alpha <= 0);
        if (allDone)
            this._winAnimActive = false;
    }
    // ── 패배 이펙트 (바람에 흩날리기) ────────────────────────────────────────
    startFailEffect(game) {
        this._failAnimCards = [];
        this._failAnimating = true;
        const { cardW, cardH } = this.layout;
        for (let di = DeckIndex.Tableau1; di <= DeckIndex.Tableau8; di++) {
            const deck = game.getDeck(di);
            for (let ci = 0; ci < deck.size(); ci++) {
                const rect = this.getCardRect(di, ci, game);
                this._failAnimCards.push({
                    card: deck.get(ci),
                    x: rect.x, y: rect.y,
                    vx: (Math.random() - 0.3) * 6 + 2, // 주로 오른쪽으로
                    vy: (Math.random() - 0.5) * 4,
                    angle: 0,
                    vAngle: (Math.random() - 0.5) * 0.15,
                    alpha: 1,
                    delay: Math.random() * 1.5,
                    elapsed: 0,
                    w: cardW, h: cardH,
                    scaleY: 1, // 불타는 효과용
                    firePhase: Math.random() * Math.PI * 2,
                });
            }
        }
        this._failAnimating = true; // already set above; keep explicit
    }
    _stepFailAnim() {
        const { ctx } = this;
        const W = this.canvas.clientWidth;
        const H = this.canvas.clientHeight;
        for (const c of this._failAnimCards) {
            c.elapsed += 0.016;
            if (c.elapsed < c.delay)
                continue;
            c.vx *= 0.99;
            c.vy += 0.15; // 약한 중력
            c.x += c.vx;
            c.y += c.vy;
            c.angle += c.vAngle;
            c.firePhase += 0.1;
            if (c.x > W + 100 || c.x < -100 || c.y > H + 100) {
                c.alpha = 0;
                continue;
            }
            c.alpha = Math.max(0, c.alpha - 0.008);
            ctx.save();
            ctx.globalAlpha = c.alpha;
            ctx.translate(c.x + c.w / 2, c.y + c.h / 2);
            ctx.rotate(c.angle);
            // 불타는 흔들림 효과
            const wobble = Math.sin(c.firePhase) * 2;
            this._drawCard(c.card, -c.w / 2 + wobble, -c.h / 2, true);
            // 불꽃 파티클 (맨 위에)
            if (c.alpha > 0.3) {
                this._drawFire(0, -c.h / 2, c.w, c.firePhase);
            }
            ctx.restore();
        }
        const allDone = this._failAnimCards.every(c => c.alpha <= 0);
        if (allDone) {
            this._failAnimating = false;
        }
    }
    _drawFire(cx, cy, w, _phase) {
        const { ctx } = this;
        const fireColors = ['#ff6f00', '#ff8f00', '#ffca28', '#fff176'];
        const count = 5;
        for (let i = 0; i < count; i++) {
            const px = cx + (Math.random() - 0.5) * w;
            const py = cy - Math.random() * 15;
            const r = Math.random() * 4 + 2;
            const col = fireColors[Math.floor(Math.random() * fireColors.length)];
            ctx.beginPath();
            ctx.arc(px, py, r, 0, Math.PI * 2);
            ctx.fillStyle = col;
            ctx.fill();
        }
    }
    get isAnimating() { return this._winAnimActive || this._failAnimating; }
    get isFailAnimating() { return this._failAnimating; }
}
//# sourceMappingURL=renderer.js.map