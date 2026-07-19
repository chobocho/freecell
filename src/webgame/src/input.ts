import { DeckIndex, TableauDeck } from './deck.js';
import { FreecellGame } from './freecell.js';
import { Renderer, DragState, KeyboardSelectState } from './renderer.js';

// ─── 입력 이벤트 콜백 타입 ───────────────────────────────────────────────

export interface InputCallbacks {
  onNewGame():   void;
  onUndo():      void;
  onPause():     void;
  onHelp():      void;
  onMoveCard(from: DeckIndex, to: DeckIndex, count: number): boolean;
  onAutoMove(from: DeckIndex): void;
  /** 도움말 오버레이가 열려 있는지 (Esc/F1로만 닫도록 게임 키 차단) */
  isHelpOpen(): boolean;
  /** 확인/게임번호 등 모달이 열려 게임 단축키를 차단해야 하는지 */
  isModalBlocking(): boolean;
}

// KeyboardSelectState는 renderer.ts에서 export (순환 참조 방지)
export type { KeyboardSelectState } from './renderer.js';

// ─── 덱 키 매핑 ──────────────────────────────────────────────────────────
// 화면 배치와 일치:
//   Foundation(좌상단): Q W E R
//   FreeCell(우상단):   U I O P
//   Tableau(하단):      1 2 3 4 5 6 7 8

export const DECK_KEY_LABELS: Record<DeckIndex, string> = {
  [DeckIndex.Found1]: 'Q', [DeckIndex.Found2]: 'W',
  [DeckIndex.Found3]: 'E', [DeckIndex.Found4]: 'R',
  [DeckIndex.Free1]:  'U', [DeckIndex.Free2]:  'I',
  [DeckIndex.Free3]:  'O', [DeckIndex.Free4]:  'P',
  [DeckIndex.Tableau1]: '1', [DeckIndex.Tableau2]: '2',
  [DeckIndex.Tableau3]: '3', [DeckIndex.Tableau4]: '4',
  [DeckIndex.Tableau5]: '5', [DeckIndex.Tableau6]: '6',
  [DeckIndex.Tableau7]: '7', [DeckIndex.Tableau8]: '8',
};

const DECK_KEYS: Record<string, DeckIndex> = {
  'q': DeckIndex.Found1, 'w': DeckIndex.Found2,
  'e': DeckIndex.Found3, 'r': DeckIndex.Found4,
  'u': DeckIndex.Free1,  'i': DeckIndex.Free2,
  'o': DeckIndex.Free3,  'p': DeckIndex.Free4,
  '1': DeckIndex.Tableau1, '2': DeckIndex.Tableau2,
  '3': DeckIndex.Tableau3, '4': DeckIndex.Tableau4,
  '5': DeckIndex.Tableau5, '6': DeckIndex.Tableau6,
  '7': DeckIndex.Tableau7, '8': DeckIndex.Tableau8,
};

// ─── InputHandler ──────────────────────────────────────────────────────────

export class InputHandler {
  private drag: DragState = {
    isDragging: false,
    fromDeck:   DeckIndex.Tableau1,
    cards:      [],
    x: 0, y: 0,
    offsetX: 0, offsetY: 0,
  };

  private lastTapTime: number = 0;
  private lastTapDeck: DeckIndex | null = null;

  /** 드래그 시작 시 캐시한 캔버스 rect — 드래그 중 주소창 크기 변화로 rect가 바뀌어도 일관된 좌표 유지 */
  private _canvasRect: DOMRect | null = null;

  private _kbState: KeyboardSelectState = { selectedDeck: null, ctrlHeld: false };

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly game:   FreecellGame,
    private readonly renderer: Renderer,
    private readonly cb:     InputCallbacks,
  ) {
    this._bindMouse();
    this._bindTouch();
    this._bindKeyboard();
  }

  getDragState(): DragState { return this.drag; }
  getKeyboardState(): KeyboardSelectState { return this._kbState; }

  // ── 마우스 ──────────────────────────────────────────────────────────────

  private _bindMouse(): void {
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
      if (this.drag.isDragging) this._cancelDrag();
    });

    // 더블클릭 자동 이동 — _getCardAt으로 카드 단위 정확한 히트테스트
    this.canvas.addEventListener('dblclick', e => {
      e.preventDefault();
      if (this.game.state !== 'play') return;
      const rect = this.canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const hit = this._getCardAt(x, y);
      if (hit !== null) this.cb.onAutoMove(hit.deckIdx);
    });
  }

  // ── 터치 ─────────────────────────────────────────────────────────────────

  private _bindTouch(): void {
    this.canvas.addEventListener('touchstart', e => {
      e.preventDefault();
      const t   = e.changedTouches[0];
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
      this._onPress(t.clientX, t.clientY);
    }, { passive: false });

    this.canvas.addEventListener('touchmove', e => {
      e.preventDefault();
      const t = e.changedTouches[0];
      this._onMove(t.clientX, t.clientY);
    }, { passive: false });

    this.canvas.addEventListener('touchend', e => {
      e.preventDefault();
      const t = e.changedTouches[0];
      this._onRelease(t.clientX, t.clientY);
      // 터치 종료 후 캐시한 rect 해제 — 이후 마우스 이벤트가 낡은 rect를 쓰지 않도록
      this._canvasRect = null;
    }, { passive: false });

    this.canvas.addEventListener('touchcancel', () => {
      if (this.drag.isDragging) this._cancelDrag();
      this._canvasRect = null;
    });
  }

  // ── 키보드 ──────────────────────────────────────────────────────────────

  private _bindKeyboard(): void {
    window.addEventListener('keydown', e => {
      // 입력 필드에 포커스가 있으면 게임 단축키 처리하지 않음
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      // Ctrl 누름 추적 (오버레이 표시용)
      if (e.key === 'Control') {
        this._kbState.ctrlHeld = true;
        return;
      }

      // 도움말이 열려 있으면 Esc/F1로 닫기만 허용, 그 외 게임 키는 차단
      if (this.cb.isHelpOpen()) {
        if (e.key === 'Escape' || e.key === 'F1') {
          e.preventDefault();
          this.cb.onHelp();
        }
        return;
      }

      // 확인/게임번호 등 모달 표시 중에는 게임 단축키 차단 (모달 뒤 게임이 재개되는 것 방지)
      if (this.cb.isModalBlocking()) return;

      // 덱 선택 키 (Ctrl/Meta/Alt 없을 때만)
      if (!e.ctrlKey && !e.metaKey && !e.altKey) {
        const key = e.key.toLowerCase();
        if (key in DECK_KEYS) {
          e.preventDefault();
          this._handleDeckKey(DECK_KEYS[key]);
          return;
        }
      }

      switch (e.key) {
        case 'z': case 'Z':
          e.preventDefault();
          this.cb.onUndo();
          break;
        case 'n': case 'N':
          if (!e.ctrlKey) { e.preventDefault(); this.cb.onNewGame(); }
          break;
        case 'Enter':
          // Foundation 자동이동: 키보드 선택 덱 우선, 없으면 마우스 드래그 중인 덱
          if (this.game.state === 'play') {
            if (this._kbState.selectedDeck !== null) {
              e.preventDefault();
              this.cb.onAutoMove(this._kbState.selectedDeck);
              this._kbState.selectedDeck = null;
            } else if (this.drag.isDragging) {
              e.preventDefault();
              const fromDeck = this.drag.fromDeck;
              this._cancelDrag();
              this.cb.onAutoMove(fromDeck);
            }
          }
          break;
        case ' ':
          e.preventDefault();
          this.cb.onPause();
          break;
        case 'Escape':
          e.preventDefault();
          if (this._kbState.selectedDeck !== null) {
            // 키보드 선택 취소 우선
            this._kbState.selectedDeck = null;
          } else if (this.drag.isDragging) {
            this._cancelDrag();
          } else {
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
      if (e.key === 'Control') this._kbState.ctrlHeld = false;
    });

    // Ctrl 누른 채 Alt+Tab 등으로 포커스를 잃으면 keyup이 오지 않아 오버레이가 고착됨
    window.addEventListener('blur', () => {
      this._kbState.ctrlHeld = false;
    });
  }

  /** 덱 키 처리: 소스 선택 → 이동 */
  private _handleDeckKey(deckIdx: DeckIndex): void {
    if (this.game.state !== 'play') return;

    const { selectedDeck } = this._kbState;

    if (selectedDeck === null) {
      // 소스 선택
      this._kbState.selectedDeck = deckIdx;
    } else if (selectedDeck === deckIdx) {
      // 같은 덱 재선택 → 취소
      this._kbState.selectedDeck = null;
    } else {
      // 다른 덱 선택 → 이동 시도
      const count = this._kbMovableCount(selectedDeck, deckIdx);
      this.cb.onMoveCard(selectedDeck, deckIdx, count);
      // 성공/실패 무관하게 선택 해제
      this._kbState.selectedDeck = null;
    }
  }

  /** 키보드 이동 시 카드 수 결정 (최대 이동 가능 수량) */
  private _kbMovableCount(from: DeckIndex, to: DeckIndex): number {
    const deck = this.game.getDeck(from);
    if (deck.isEmpty()) return 0;
    // 소스가 FreeCell / Foundation: 항상 1장
    if (from >= DeckIndex.Free1 && from <= DeckIndex.Free4) return 1;
    if (from >= DeckIndex.Found1 && from <= DeckIndex.Found4) return 1;
    // 목적지가 FreeCell / Foundation: 항상 1장 (규칙상 1장만 허용)
    if (to >= DeckIndex.Free1 && to <= DeckIndex.Free4) return 1;
    if (to >= DeckIndex.Found1 && to <= DeckIndex.Found4) return 1;
    // Tableau → Tableau: 맨 위 연속 시퀀스 길이와 이동 가능 최대치 중 작은 값에서 시작,
    // 목적지가 실제로 받을 수 있는 count까지 감소 탐색 (유효한 이동을 거부하지 않도록)
    const maxCount = this.game.maxMovableCount(
      this.game.emptyFreeCellCount(),
      this.game.emptyTableauCount(to),
    );
    const seqLen = deck instanceof TableauDeck ? deck.sequenceLength() : deck.size();
    let count = Math.min(seqLen, maxCount);
    while (count > 1 && !this.game.canMove(from, to, count)) count--;
    return count;
  }

  // ── 공통 처리 ────────────────────────────────────────────────────────────

  private _onPress(cx: number, cy: number): void {
    if (this.game.state !== 'play') return;

    const rect   = this._canvasRect ?? this.canvas.getBoundingClientRect();
    const x      = cx - rect.left;
    const y      = cy - rect.top;
    const hit    = this._getCardAt(x, y);
    if (!hit) return;

    const { deckIdx, cardIdx } = hit;
    const deck   = this.game.getDeck(deckIdx);

    // Foundation에서는 드래그 불가
    if (deckIdx >= DeckIndex.Found1 && deckIdx <= DeckIndex.Found4) return;

    // 뽑을 카드들 결정 (클릭한 카드부터 맨 위까지)
    const topIdx = deck.size() - 1;
    const count  = topIdx - cardIdx + 1;
    const cards  = deck.peekTop(count);

    // 첫 카드가 닫혀있으면 드래그 불가
    if (!cards[0].isOpen) return;

    // 클릭한 카드의 실제 화면 위치를 기준으로 offset 계산
    const cardRect = this.renderer.getCardRect(deckIdx, cardIdx, this.game);

    this.drag = {
      isDragging: true,
      fromDeck:   deckIdx,
      cards:      [...cards],
      x, y,
      offsetX: x - cardRect.x,
      offsetY: y - cardRect.y,
    };
    this.canvas.classList.add('dragging');
  }

  private _onMove(cx: number, cy: number): void {
    if (!this.drag.isDragging) return;
    const rect = this._canvasRect ?? this.canvas.getBoundingClientRect();
    this.drag.x = cx - rect.left;
    this.drag.y = cy - rect.top;
  }

  private _onRelease(cx: number, cy: number): void {
    if (!this.drag.isDragging) return;

    const rect  = this._canvasRect ?? this.canvas.getBoundingClientRect();
    const x     = cx - rect.left;
    const y     = cy - rect.top;

    const target = this._getBestDropTarget(x, y, this.drag.fromDeck);
    if (target !== null && target !== this.drag.fromDeck) {
      this.cb.onMoveCard(this.drag.fromDeck, target, this.drag.cards.length);
    }

    this._endDrag();
  }

  private _cancelDrag(): void {
    this._endDrag();
  }

  private _endDrag(): void {
    this.drag.isDragging = false;
    this.drag.cards = [];
    this.canvas.classList.remove('dragging');
  }

  // ── 히트 테스트 ──────────────────────────────────────────────────────────

  /**
   * (x, y) 위치에서 클릭된 카드 덱/인덱스 반환
   */
  private _getCardAt(x: number, y: number): { deckIdx: DeckIndex; cardIdx: number } | null {
    const L   = this.renderer.getLayout();
    const { cardW, cardH } = L;

    // Foundation / FreeCell (맨 위 카드만 클릭 가능)
    for (let i = DeckIndex.Found1; i <= DeckIndex.Found4; i++) {
      const col = i - DeckIndex.Found1;
      if (this._inRect(x, y, L.foundX[col], L.topRowY, cardW, cardH)) {
        const deck = this.game.getDeck(i as DeckIndex);
        if (!deck.isEmpty()) return { deckIdx: i as DeckIndex, cardIdx: deck.size() - 1 };
      }
    }
    for (let i = DeckIndex.Free1; i <= DeckIndex.Free4; i++) {
      const col = i - DeckIndex.Free1;
      if (this._inRect(x, y, L.freeX[col], L.topRowY, cardW, cardH)) {
        const deck = this.game.getDeck(i as DeckIndex);
        if (!deck.isEmpty()) return { deckIdx: i as DeckIndex, cardIdx: deck.size() - 1 };
      }
    }

    // Tableau (아래에서 위로 탐색 - 맨 위 카드 우선)
    for (let i = DeckIndex.Tableau8; i >= DeckIndex.Tableau1; i--) {
      const col   = i - DeckIndex.Tableau1;
      const deck  = this.game.getDeck(i as DeckIndex);
      if (!this._inColumnX(x, L.tabX[col], cardW)) continue;

      // 맨 위부터 아래로 검사
      let yAcc = L.tableauY;
      const positions: number[] = [yAcc];
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
          return { deckIdx: i as DeckIndex, cardIdx: ci };
        }
      }
    }

    return null;
  }

  /**
   * (x, y) 위치의 덱 인덱스 반환 (드롭 대상)
   */
  private _getDeckAt(x: number, y: number): DeckIndex | null {
    const L = this.renderer.getLayout();
    const { cardW, cardH } = L;

    for (let i = DeckIndex.Found1; i <= DeckIndex.Found4; i++) {
      const col = i - DeckIndex.Found1;
      if (this._inRect(x, y, L.foundX[col], L.topRowY, cardW, cardH))
        return i as DeckIndex;
    }
    for (let i = DeckIndex.Free1; i <= DeckIndex.Free4; i++) {
      const col = i - DeckIndex.Free1;
      if (this._inRect(x, y, L.freeX[col], L.topRowY, cardW, cardH))
        return i as DeckIndex;
    }
    for (let i = DeckIndex.Tableau1; i <= DeckIndex.Tableau8; i++) {
      const col = i - DeckIndex.Tableau1;
      const bottomY = this.renderer.getDeckBottomY(i as DeckIndex, this.game);
      if (this._inColumnX(x, L.tabX[col], cardW) &&
          y >= L.tableauY && y <= Math.max(bottomY, L.tableauY + cardH)) {
        return i as DeckIndex;
      }
    }
    return null;
  }

  /**
   * 여러 후보 좌표에서 가장 적합한 드롭 대상 결정
   * 원본 Android 코드의 다중 히트 테스트 방식 개선 버전
   */
  private _getBestDropTarget(x: number, y: number, fromDeck: DeckIndex): DeckIndex | null {
    // 카드 중앙, 왼쪽, 오른쪽 3점에서 히트 테스트
    const L = this.renderer.getLayout();
    const offsets = [
      { dx: 0,                  dy: 0 },
      { dx: -L.cardW * 0.3,    dy: 0 },
      { dx:  L.cardW * 0.3,    dy: 0 },
      { dx: 0,                  dy: -L.stackGap * 0.5 },
    ];

    for (const { dx, dy } of offsets) {
      const target = this._getDeckAt(x + dx, y + dy);
      if (target !== null && target !== fromDeck) return target;
    }
    return null;
  }

  private _inRect(x: number, y: number, rx: number, ry: number, w: number, h: number): boolean {
    return x >= rx && x <= rx + w && y >= ry && y <= ry + h;
  }

  private _inColumnX(x: number, colX: number, cardW: number): boolean {
    return x >= colX && x <= colX + cardW;
  }

  private _touchPos(t: Touch): { x: number; y: number } {
    const rect = this._canvasRect ?? this.canvas.getBoundingClientRect();
    return { x: t.clientX - rect.left, y: t.clientY - rect.top };
  }
}
