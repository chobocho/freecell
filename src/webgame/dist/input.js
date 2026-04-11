import { DeckIndex } from './deck.js';
// ─── InputHandler ──────────────────────────────────────────────────────────
export class InputHandler {
    constructor(canvas, game, renderer, cb) {
        this.canvas = canvas;
        this.game = game;
        this.renderer = renderer;
        this.cb = cb;
        this.drag = {
            isDragging: false,
            fromDeck: DeckIndex.Tableau1,
            cards: [],
            x: 0, y: 0,
            offsetX: 0, offsetY: 0,
        };
        this.lastTapTime = 0;
        this.lastTapDeck = null;
        this._bindMouse();
        this._bindTouch();
        this._bindKeyboard();
    }
    getDragState() { return this.drag; }
    // ── 마우스 ──────────────────────────────────────────────────────────────
    _bindMouse() {
        this.canvas.addEventListener('mousedown', e => {
            e.preventDefault();
            this._onPress(e.clientX, e.clientY);
        });
        this.canvas.addEventListener('mousemove', e => {
            e.preventDefault();
            this._onMove(e.clientX, e.clientY);
        });
        this.canvas.addEventListener('mouseup', e => {
            e.preventDefault();
            this._onRelease(e.clientX, e.clientY);
        });
        this.canvas.addEventListener('mouseleave', () => {
            if (this.drag.isDragging)
                this._cancelDrag();
        });
        // 더블클릭 자동 이동
        this.canvas.addEventListener('dblclick', e => {
            e.preventDefault();
            const deckIdx = this._getDeckAt(e.clientX, e.clientY);
            if (deckIdx !== null)
                this.cb.onAutoMove(deckIdx);
        });
    }
    // ── 터치 ─────────────────────────────────────────────────────────────────
    _bindTouch() {
        this.canvas.addEventListener('touchstart', e => {
            e.preventDefault();
            const t = e.changedTouches[0];
            const pos = this._touchPos(t);
            const now = Date.now();
            const deckIdx = this._getDeckAt(pos.x, pos.y);
            // 더블탭 감지 (400ms 이내, 같은 덱)
            if (now - this.lastTapTime < 400 && deckIdx !== null && deckIdx === this.lastTapDeck) {
                this.cb.onAutoMove(deckIdx);
                this.lastTapTime = 0;
                return;
            }
            this.lastTapTime = now;
            this.lastTapDeck = deckIdx;
            this._onPress(pos.x, pos.y);
        }, { passive: false });
        this.canvas.addEventListener('touchmove', e => {
            e.preventDefault();
            const t = e.changedTouches[0];
            const pos = this._touchPos(t);
            this._onMove(pos.x, pos.y);
        }, { passive: false });
        this.canvas.addEventListener('touchend', e => {
            e.preventDefault();
            const t = e.changedTouches[0];
            const pos = this._touchPos(t);
            this._onRelease(pos.x, pos.y);
        }, { passive: false });
        this.canvas.addEventListener('touchcancel', () => {
            if (this.drag.isDragging)
                this._cancelDrag();
        });
    }
    // ── 키보드 ──────────────────────────────────────────────────────────────
    _bindKeyboard() {
        window.addEventListener('keydown', e => {
            switch (e.key) {
                case 'z':
                case 'Z':
                    if (e.ctrlKey || e.metaKey || !e.ctrlKey) {
                        e.preventDefault();
                        this.cb.onUndo();
                    }
                    break;
                case 'n':
                case 'N':
                    if (!e.ctrlKey) {
                        e.preventDefault();
                        this.cb.onNewGame();
                    }
                    break;
                case ' ':
                    e.preventDefault();
                    this.cb.onPause();
                    break;
                case 'Escape':
                    e.preventDefault();
                    if (this.drag.isDragging)
                        this._cancelDrag();
                    else
                        this.cb.onPause();
                    break;
            }
        });
    }
    // ── 공통 처리 ────────────────────────────────────────────────────────────
    _onPress(cx, cy) {
        if (this.game.state !== 'play')
            return;
        const rect = this.canvas.getBoundingClientRect();
        const x = cx - rect.left;
        const y = cy - rect.top;
        const hit = this._getCardAt(x, y);
        if (!hit)
            return;
        const { deckIdx, cardIdx } = hit;
        const deck = this.game.getDeck(deckIdx);
        // Foundation에서는 드래그 불가
        if (deckIdx >= DeckIndex.Found1 && deckIdx <= DeckIndex.Found4)
            return;
        // 뽑을 카드들 결정
        const topIdx = deck.size() - 1;
        const count = topIdx - cardIdx + 1; // 선택한 카드부터 맨 위까지
        const cards = deck.peekTop(count);
        // 첫 카드가 닫혀있으면 드래그 불가
        if (!cards[0].isOpen)
            return;
        // 시퀀스가 올바른지 확인 (멀티카드)
        const maxCount = this.game.maxMovableCount(this.game.emptyFreeCellCount(), this.game.emptyTableauCount(deckIdx));
        const actualCount = Math.min(count, maxCount);
        const finalCards = deck.peekTop(actualCount);
        const cardRect = this.renderer.getCardRect(deckIdx, topIdx - actualCount + 1, this.game);
        this.drag = {
            isDragging: true,
            fromDeck: deckIdx,
            cards: [...finalCards],
            x, y,
            offsetX: x - cardRect.x,
            offsetY: y - cardRect.y,
        };
        this.canvas.classList.add('dragging');
    }
    _onMove(cx, cy) {
        if (!this.drag.isDragging)
            return;
        const rect = this.canvas.getBoundingClientRect();
        this.drag.x = cx - rect.left;
        this.drag.y = cy - rect.top;
    }
    _onRelease(cx, cy) {
        if (!this.drag.isDragging)
            return;
        const rect = this.canvas.getBoundingClientRect();
        const x = cx - rect.left;
        const y = cy - rect.top;
        const target = this._getBestDropTarget(x, y, this.drag.fromDeck);
        if (target !== null && target !== this.drag.fromDeck) {
            this.cb.onMoveCard(this.drag.fromDeck, target, this.drag.cards.length);
        }
        this._endDrag();
    }
    _cancelDrag() {
        this._endDrag();
    }
    _endDrag() {
        this.drag.isDragging = false;
        this.drag.cards = [];
        this.canvas.classList.remove('dragging');
    }
    // ── 히트 테스트 ──────────────────────────────────────────────────────────
    /**
     * (x, y) 위치에서 클릭된 카드 덱/인덱스 반환
     */
    _getCardAt(x, y) {
        const L = this.renderer.getLayout();
        const { cardW, cardH } = L;
        // Foundation / FreeCell (맨 위 카드만 클릭 가능)
        for (let i = DeckIndex.Found1; i <= DeckIndex.Found4; i++) {
            const col = i - DeckIndex.Found1;
            if (this._inRect(x, y, L.foundX[col], L.topRowY, cardW, cardH)) {
                const deck = this.game.getDeck(i);
                if (!deck.isEmpty())
                    return { deckIdx: i, cardIdx: deck.size() - 1 };
            }
        }
        for (let i = DeckIndex.Free1; i <= DeckIndex.Free4; i++) {
            const col = i - DeckIndex.Free1;
            if (this._inRect(x, y, L.freeX[col], L.topRowY, cardW, cardH)) {
                const deck = this.game.getDeck(i);
                if (!deck.isEmpty())
                    return { deckIdx: i, cardIdx: deck.size() - 1 };
            }
        }
        // Tableau (아래에서 위로 탐색 - 맨 위 카드 우선)
        for (let i = DeckIndex.Tableau8; i >= DeckIndex.Tableau1; i--) {
            const col = i - DeckIndex.Tableau1;
            const deck = this.game.getDeck(i);
            if (!this._inColumnX(x, L.tabX[col], cardW))
                continue;
            // 맨 위부터 아래로 검사
            let yAcc = L.tableauY;
            const positions = [yAcc];
            for (let ci = 0; ci < deck.size() - 1; ci++) {
                yAcc += deck.get(ci).isOpen ? L.stackGap : L.stackGapClosed;
                positions.push(yAcc);
            }
            // 역순으로 확인 (위 카드가 아래 카드를 가리므로)
            for (let ci = deck.size() - 1; ci >= 0; ci--) {
                const cardY = positions[ci];
                const cardBottom = ci === deck.size() - 1
                    ? cardY + cardH
                    : positions[ci + 1]; // 다음 카드가 아래 카드를 가림
                if (y >= cardY && y <= Math.max(cardBottom, cardY + 20)) {
                    return { deckIdx: i, cardIdx: ci };
                }
            }
        }
        return null;
    }
    /**
     * (x, y) 위치의 덱 인덱스 반환 (드롭 대상)
     */
    _getDeckAt(x, y) {
        const L = this.renderer.getLayout();
        const { cardW, cardH } = L;
        for (let i = DeckIndex.Found1; i <= DeckIndex.Found4; i++) {
            const col = i - DeckIndex.Found1;
            if (this._inRect(x, y, L.foundX[col], L.topRowY, cardW, cardH))
                return i;
        }
        for (let i = DeckIndex.Free1; i <= DeckIndex.Free4; i++) {
            const col = i - DeckIndex.Free1;
            if (this._inRect(x, y, L.freeX[col], L.topRowY, cardW, cardH))
                return i;
        }
        for (let i = DeckIndex.Tableau1; i <= DeckIndex.Tableau8; i++) {
            const col = i - DeckIndex.Tableau1;
            const bottomY = this.renderer.getDeckBottomY(i, this.game);
            if (this._inColumnX(x, L.tabX[col], cardW) &&
                y >= L.tableauY && y <= Math.max(bottomY, L.tableauY + cardH)) {
                return i;
            }
        }
        return null;
    }
    /**
     * 여러 후보 좌표에서 가장 적합한 드롭 대상 결정
     * 원본 Android 코드의 다중 히트 테스트 방식 개선 버전
     */
    _getBestDropTarget(x, y, fromDeck) {
        // 카드 중앙, 왼쪽, 오른쪽 3점에서 히트 테스트
        const L = this.renderer.getLayout();
        const offsets = [
            { dx: 0, dy: 0 },
            { dx: -L.cardW * 0.3, dy: 0 },
            { dx: L.cardW * 0.3, dy: 0 },
            { dx: 0, dy: -L.stackGap * 0.5 },
        ];
        for (const { dx, dy } of offsets) {
            const target = this._getDeckAt(x + dx, y + dy);
            if (target !== null && target !== fromDeck)
                return target;
        }
        return null;
    }
    _inRect(x, y, rx, ry, w, h) {
        return x >= rx && x <= rx + w && y >= ry && y <= ry + h;
    }
    _inColumnX(x, colX, cardW) {
        return x >= colX && x <= colX + cardW;
    }
    _touchPos(t) {
        const rect = this.canvas.getBoundingClientRect();
        return { x: t.clientX - rect.left, y: t.clientY - rect.top };
    }
}
//# sourceMappingURL=input.js.map