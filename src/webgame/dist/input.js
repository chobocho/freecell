import { DeckIndex, TableauDeck } from './deck.js';
// ─── 덱 키 매핑 ──────────────────────────────────────────────────────────
// 화면 배치와 일치:
//   Foundation(좌상단): Q W E R
//   FreeCell(우상단):   U I O P
//   Tableau(하단):      1 2 3 4 5 6 7 8
//
// e.code(물리 키 위치) 기반 — 한/영 IME 상태와 무관하게 인식한다.
// (한글 입력 상태에서는 e.key 가 'ㅂ' 또는 'Process' 로 들어와 e.key 매핑은 동작하지 않는다.)
const DECK_CODES = {
    'KeyQ': DeckIndex.Found1, 'KeyW': DeckIndex.Found2,
    'KeyE': DeckIndex.Found3, 'KeyR': DeckIndex.Found4,
    'KeyU': DeckIndex.Free1, 'KeyI': DeckIndex.Free2,
    'KeyO': DeckIndex.Free3, 'KeyP': DeckIndex.Free4,
    'Digit1': DeckIndex.Tableau1, 'Digit2': DeckIndex.Tableau2,
    'Digit3': DeckIndex.Tableau3, 'Digit4': DeckIndex.Tableau4,
    'Digit5': DeckIndex.Tableau5, 'Digit6': DeckIndex.Tableau6,
    'Digit7': DeckIndex.Tableau7, 'Digit8': DeckIndex.Tableau8,
    'Numpad1': DeckIndex.Tableau1, 'Numpad2': DeckIndex.Tableau2,
    'Numpad3': DeckIndex.Tableau3, 'Numpad4': DeckIndex.Tableau4,
    'Numpad5': DeckIndex.Tableau5, 'Numpad6': DeckIndex.Tableau6,
    'Numpad7': DeckIndex.Tableau7, 'Numpad8': DeckIndex.Tableau8,
};
/**
 * 키 이벤트를 물리 키 코드로 정규화한다.
 * e.code 가 비어 있는 환경(일부 가상 키보드)에서는 e.key 로부터 같은 형식의 코드를 만든다.
 */
function keyCodeOf(e) {
    if (e.code)
        return e.code;
    const k = e.key;
    if (k.length === 1) {
        if (k === ' ')
            return 'Space';
        if (k >= '0' && k <= '9')
            return 'Digit' + k;
        const upper = k.toUpperCase();
        if (upper >= 'A' && upper <= 'Z')
            return 'Key' + upper;
    }
    return k; // 'Enter', 'Escape', 'F1' 등은 key 와 code 가 같다
}
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
        /** 드래그 시작 시 캐시한 캔버스 rect — 드래그 중 주소창 크기 변화로 rect가 바뀌어도 일관된 좌표 유지 */
        this._canvasRect = null;
        /** 현재 추적 중인 터치(손가락)의 identifier — 두 번째 손가락이 드래그를 가로채지 못하게 함 */
        this._activeTouchId = null;
        this._kbState = { selectedDeck: null, ctrlHeld: false };
        this._bindMouse();
        this._bindTouch();
        this._bindKeyboard();
    }
    getDragState() { return this.drag; }
    getKeyboardState() { return this._kbState; }
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
        // 더블클릭 자동 이동 — _getCardAt으로 카드 단위 정확한 히트테스트
        this.canvas.addEventListener('dblclick', e => {
            e.preventDefault();
            if (this.game.state !== 'play')
                return;
            const rect = this.canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            const hit = this._getCardAt(x, y);
            if (hit !== null)
                this.cb.onAutoMove(hit.deckIdx);
        });
    }
    // ── 터치 ─────────────────────────────────────────────────────────────────
    _bindTouch() {
        this.canvas.addEventListener('touchstart', e => {
            e.preventDefault();
            // 이미 한 손가락으로 드래그 중이면 다른 손가락은 무시 (드래그 가로채기·오탐 더블탭 방지)
            if (this.drag.isDragging && this._activeTouchId !== null)
                return;
            const t = e.changedTouches[0];
            // 이벤트 시작 시 rect 캐시 — touchmove/touchend도 동일 rect 사용
            this._canvasRect = this.canvas.getBoundingClientRect();
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
            this._activeTouchId = t.identifier;
            this._onPress(t.clientX, t.clientY);
        }, { passive: false });
        this.canvas.addEventListener('touchmove', e => {
            e.preventDefault();
            const t = this._findActiveTouch(e.changedTouches);
            if (!t)
                return;
            this._onMove(t.clientX, t.clientY);
        }, { passive: false });
        this.canvas.addEventListener('touchend', e => {
            e.preventDefault();
            const t = this._findActiveTouch(e.changedTouches);
            if (!t)
                return; // 추적 중이 아닌 손가락이 떨어진 경우
            this._onRelease(t.clientX, t.clientY);
            this._activeTouchId = null;
            // 터치 종료 후 캐시한 rect 해제 — 이후 마우스 이벤트가 낡은 rect를 쓰지 않도록
            this._canvasRect = null;
        }, { passive: false });
        this.canvas.addEventListener('touchcancel', e => {
            // 추적 중이 아닌 손가락의 취소는 진행 중인 드래그에 영향을 주지 않는다
            if (!this._findActiveTouch(e.changedTouches))
                return;
            if (this.drag.isDragging)
                this._cancelDrag();
            this._activeTouchId = null;
            this._canvasRect = null;
        });
    }
    /** 추적 중인 손가락(identifier)에 해당하는 Touch 를 찾는다. 추적 중인 손가락이 없으면 첫 터치 */
    _findActiveTouch(list) {
        if (this._activeTouchId === null)
            return list[0] ?? null;
        for (let i = 0; i < list.length; i++) {
            if (list[i].identifier === this._activeTouchId)
                return list[i];
        }
        return null;
    }
    // ── 키보드 ──────────────────────────────────────────────────────────────
    _bindKeyboard() {
        window.addEventListener('keydown', e => {
            // 입력 필드에 포커스가 있으면 게임 단축키 처리하지 않음
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)
                return;
            // Ctrl 누름 추적 (오버레이 표시용)
            if (e.key === 'Control') {
                this._kbState.ctrlHeld = true;
                return;
            }
            // 도움말이 열려 있으면 Esc/F1로 닫기만 허용, 그 외 게임 키는 차단
            const code = keyCodeOf(e);
            if (this.cb.isHelpOpen()) {
                if (code === 'Escape' || code === 'F1') {
                    e.preventDefault();
                    this.cb.onHelp();
                }
                return;
            }
            // 확인/게임번호 등 모달 표시 중에는 게임 단축키 차단 (모달 뒤 게임이 재개되는 것 방지)
            if (this.cb.isModalBlocking())
                return;
            // 덱 선택 키 (Ctrl/Meta/Alt 없을 때만)
            if (!e.ctrlKey && !e.metaKey && !e.altKey && code in DECK_CODES) {
                e.preventDefault();
                this._handleDeckKey(DECK_CODES[code]);
                return;
            }
            switch (code) {
                case 'KeyZ':
                    e.preventDefault();
                    this.cb.onUndo();
                    break;
                case 'KeyN':
                    if (!e.ctrlKey) {
                        e.preventDefault();
                        this.cb.onNewGame();
                    }
                    break;
                case 'Enter':
                case 'NumpadEnter':
                    // Foundation 자동이동: 키보드 선택 덱 우선, 없으면 마우스 드래그 중인 덱
                    if (this.game.state === 'play') {
                        if (this._kbState.selectedDeck !== null) {
                            e.preventDefault();
                            this.cb.onAutoMove(this._kbState.selectedDeck);
                            this._kbState.selectedDeck = null;
                        }
                        else if (this.drag.isDragging) {
                            e.preventDefault();
                            const fromDeck = this.drag.fromDeck;
                            this._cancelDrag();
                            this.cb.onAutoMove(fromDeck);
                        }
                    }
                    break;
                case 'Space':
                    e.preventDefault();
                    this.cb.onPause();
                    break;
                case 'Escape':
                    e.preventDefault();
                    if (this._kbState.selectedDeck !== null) {
                        // 키보드 선택 취소 우선
                        this._kbState.selectedDeck = null;
                    }
                    else if (this.drag.isDragging) {
                        this._cancelDrag();
                    }
                    else {
                        this.cb.onPause();
                    }
                    break;
                case 'F1':
                    e.preventDefault();
                    this.cb.onHelp();
                    break;
            }
        });
        window.addEventListener('keyup', e => {
            if (e.key === 'Control')
                this._kbState.ctrlHeld = false;
        });
        // Ctrl 누른 채 Alt+Tab 등으로 포커스를 잃으면 keyup이 오지 않아 오버레이가 고착됨
        window.addEventListener('blur', () => {
            this._kbState.ctrlHeld = false;
        });
    }
    /** 덱 키 처리: 소스 선택 → 이동 */
    _handleDeckKey(deckIdx) {
        if (this.game.state !== 'play')
            return;
        const { selectedDeck } = this._kbState;
        if (selectedDeck === null) {
            // 소스 선택
            this._kbState.selectedDeck = deckIdx;
        }
        else if (selectedDeck === deckIdx) {
            // 같은 덱 재선택 → 취소
            this._kbState.selectedDeck = null;
        }
        else {
            // 다른 덱 선택 → 이동 시도
            const count = this._kbMovableCount(selectedDeck, deckIdx);
            this.cb.onMoveCard(selectedDeck, deckIdx, count);
            // 성공/실패 무관하게 선택 해제
            this._kbState.selectedDeck = null;
        }
    }
    /** 키보드 이동 시 카드 수 결정 (최대 이동 가능 수량) */
    _kbMovableCount(from, to) {
        const deck = this.game.getDeck(from);
        if (deck.isEmpty())
            return 0;
        // 소스가 FreeCell / Foundation: 항상 1장
        if (from >= DeckIndex.Free1 && from <= DeckIndex.Free4)
            return 1;
        if (from >= DeckIndex.Found1 && from <= DeckIndex.Found4)
            return 1;
        // 목적지가 FreeCell / Foundation: 항상 1장 (규칙상 1장만 허용)
        if (to >= DeckIndex.Free1 && to <= DeckIndex.Free4)
            return 1;
        if (to >= DeckIndex.Found1 && to <= DeckIndex.Found4)
            return 1;
        // Tableau → Tableau: 맨 위 연속 시퀀스 길이와 이동 가능 최대치 중 작은 값에서 시작,
        // 목적지가 실제로 받을 수 있는 count까지 감소 탐색 (유효한 이동을 거부하지 않도록)
        const maxCount = this.game.maxMovableCount(this.game.emptyFreeCellCount(), this.game.emptyTableauCount(to));
        const seqLen = deck instanceof TableauDeck ? deck.sequenceLength() : deck.size();
        let count = Math.min(seqLen, maxCount);
        while (count > 1 && !this.game.canMove(from, to, count))
            count--;
        return count;
    }
    // ── 공통 처리 ────────────────────────────────────────────────────────────
    _onPress(cx, cy) {
        if (this.game.state !== 'play')
            return;
        const rect = this._canvasRect ?? this.canvas.getBoundingClientRect();
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
        // 뽑을 카드들 결정 (클릭한 카드부터 맨 위까지)
        const topIdx = deck.size() - 1;
        const count = topIdx - cardIdx + 1;
        const cards = deck.peekTop(count);
        // 첫 카드가 닫혀있으면 드래그 불가
        if (!cards[0].isOpen)
            return;
        // 클릭한 카드의 실제 화면 위치를 기준으로 offset 계산
        const cardRect = this.renderer.getCardRect(deckIdx, cardIdx, this.game);
        this.drag = {
            isDragging: true,
            fromDeck: deckIdx,
            cards: [...cards],
            x, y,
            offsetX: x - cardRect.x,
            offsetY: y - cardRect.y,
        };
        this.canvas.classList.add('dragging');
    }
    _onMove(cx, cy) {
        if (!this.drag.isDragging)
            return;
        const rect = this._canvasRect ?? this.canvas.getBoundingClientRect();
        this.drag.x = cx - rect.left;
        this.drag.y = cy - rect.top;
    }
    _onRelease(cx, cy) {
        if (!this.drag.isDragging)
            return;
        const rect = this._canvasRect ?? this.canvas.getBoundingClientRect();
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
                // 최소 터치 밴드는 카드 높이를 넘지 않도록 제한 (초소형 카드에서 바깥 클릭 오탐 방지)
                const minBand = Math.min(30, cardH);
                if (y >= cardY && y <= Math.max(cardBottom, cardY + minBand)) {
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
        const rect = this._canvasRect ?? this.canvas.getBoundingClientRect();
        return { x: t.clientX - rect.left, y: t.clientY - rect.top };
    }
}
//# sourceMappingURL=input.js.map