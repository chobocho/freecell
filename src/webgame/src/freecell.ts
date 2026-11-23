import { Card, Figure, CardNumber } from './card.js';
import {
  Deck, DeckIndex, TOTAL_DECKS,
  InitDeck, FoundationDeck, FreeCellDeck, TableauDeck,
} from './deck.js';
import type { GameSnapshot, SavedDeck, SavedMove } from './storage.js';

// ─── 게임 상태 ──────────────────────────────────────────────────────────────

/** lost = 포기한 판 (이동/되돌리기 불가, restart() 또는 deal() 로만 벗어남) */
export type GameState = 'idle' | 'play' | 'pause' | 'win' | 'lost';

// ─── 이동 이력 ──────────────────────────────────────────────────────────────

interface MoveCommand {
  from: DeckIndex;
  to:   DeckIndex;
  count: number;
  /** undo 시 태블로 아래 카드를 다시 닫아야 하는지 */
  didOpenCard: boolean;
}

// ─── FreecellGame ────────────────────────────────────────────────────────────

export class FreecellGame {
  private _decks: Deck[] = [];
  private _history: MoveCommand[] = [];
  private _state: GameState = 'idle';
  private _moveCount: number = 0;
  /** 현재 게임 번호 (0 = 랜덤) */
  private _gameNumber: number = 0;
  /** deal() 직후 저장한 초기 배열 (다시 하기용) */
  private _initialSnapshot: import('./storage.js').GameSnapshot | null = null;

  // Foundation 덱별 무늬 (인덱스 순서 고정)
  private static readonly FOUNDATION_FIGURES: Figure[] = [
    Figure.Club, Figure.Diamond, Figure.Heart, Figure.Spade,
  ];

  constructor() {
    this._buildDecks();
  }

  // ── Getter ──────────────────────────────────────────────────────────────

  get state(): GameState    { return this._state; }
  get moveCount(): number   { return this._moveCount; }
  get canUndo(): boolean    { return this._history.length > 0; }
  get gameNumber(): number  { return this._gameNumber; }
  /** 초기 배열로 되돌릴 수 있는지 (restart 가능 여부) */
  get canRestart(): boolean { return this._initialSnapshot !== null; }

  getDeck(index: DeckIndex): Deck { return this._decks[index]; }

  // ── 초기화 ─────────────────────────────────────────────────────────────

  private _buildDecks(): void {
    this._decks = [];
    // Foundation 4개 (인덱스 0~3)
    for (const fig of FreecellGame.FOUNDATION_FIGURES) {
      this._decks.push(new FoundationDeck(fig));
    }
    // FreeCell 4개 (인덱스 4~7)
    for (let i = 0; i < 4; i++) {
      this._decks.push(new FreeCellDeck());
    }
    // Tableau 8개 (인덱스 8~15)
    for (let i = 0; i < 8; i++) {
      this._decks.push(new TableauDeck());
    }
  }

  /**
   * 새 게임 시작: 52장을 셔플하여 8개 태블로에 배분
   * @param gameNumber 1~32000: MS FreeCell 게임 번호 / undefined: 무작위
   */
  deal(gameNumber?: number): void {
    this._buildDecks();
    this._history = [];
    this._moveCount = 0;
    this._gameNumber = gameNumber ?? 0;
    // 이전 게임의 초기 배열이 새 스냅샷에 섞이지 않도록 먼저 비움
    this._initialSnapshot = null;

    const init = new InitDeck(gameNumber);
    // 카드를 순서대로 태블로에 배분 (원본 Android 배분 방식 동일)
    for (let i = 0; i < 52; i++) {
      const colIndex = i % 8;
      const deckIdx = (DeckIndex.Tableau1 + colIndex) as DeckIndex;
      const card = init.pop()!;
      card.close();
      this._decks[deckIdx].push(card);
    }
    // FreeCell은 모든 카드 앞면 공개
    for (let i = DeckIndex.Tableau1; i <= DeckIndex.Tableau8; i++) {
      const deck = this._decks[i];
      for (let ci = 0; ci < deck.size(); ci++) deck.get(ci).open();
    }

    this._state = 'play';
    // 다시 하기를 위한 초기 배열 저장
    this._initialSnapshot = this.serialize(0);
  }

  /**
   * 동일한 배열로 게임을 처음부터 다시 시작
   * @returns 복원 성공 여부
   */
  restart(): boolean {
    if (!this._initialSnapshot) return false;
    const result = this.restore(this._initialSnapshot);
    return result !== null;
  }

  // ── 이동 ────────────────────────────────────────────────────────────────

  /**
   * 카드 이동 시도
   * @returns 이동 성공 여부
   */
  moveCard(from: DeckIndex, to: DeckIndex, count: number): boolean {
    if (this._state !== 'play') return false;

    // Foundation에서는 꺼낼 수 없음
    if (this._isFoundation(from)) return false;

    // freecell → freecell 이동 불가
    if (this._isFreeCell(from) && this._isFreeCell(to)) return false;

    // freecell / foundation으로는 1장만 이동
    if ((this._isFreeCell(to) || this._isFoundation(to)) && count !== 1) return false;

    const fromDeck = this._decks[from];
    const toDeck   = this._decks[to];

    if (fromDeck.isEmpty()) return false;
    if (count > fromDeck.size()) return false;

    // 멀티카드 이동 가능 장수 초과 검사
    if (count > this.maxMovableCount(this.emptyFreeCellCount(), this.emptyTableauCount(to))) {
      return false;
    }

    // 이동할 카드들 미리 확인 (시퀀스 유효성)
    const cards = fromDeck.peekTop(count);
    if (!this._isValidSequence(cards)) return false;

    // 목적지 덱이 맨 아래 카드를 받을 수 있는지
    if (!toDeck.canAccept(cards[0])) return false;

    // 실제 이동
    const moved = fromDeck.popMany(count);
    // Tableau에서 카드를 뺀 직후 아래 카드가 자동 오픈되었으면 undo 시 다시 닫아야 함
    const didOpenCard = fromDeck instanceof TableauDeck && fromDeck.didOpenTopOnLastPop();
    toDeck.pushMany(moved);

    this._history.push({ from, to, count, didOpenCard });
    this._moveCount++;

    // 승리 판정
    if (this._checkWin()) {
      this._state = 'win';
    }

    return true;
  }

  /**
   * 이동 가능 여부만 확인 (실제 이동 안함)
   */
  canMove(from: DeckIndex, to: DeckIndex, count: number): boolean {
    if (this._state !== 'play') return false;
    if (this._isFoundation(from)) return false;
    if (this._isFreeCell(from) && this._isFreeCell(to)) return false;
    if ((this._isFreeCell(to) || this._isFoundation(to)) && count !== 1) return false;

    const fromDeck = this._decks[from];
    const toDeck   = this._decks[to];

    if (fromDeck.isEmpty()) return false;
    if (count > fromDeck.size()) return false;
    if (count > this.maxMovableCount(this.emptyFreeCellCount(), this.emptyTableauCount(to))) return false;

    const cards = fromDeck.peekTop(count);
    if (!this._isValidSequence(cards)) return false;

    return toDeck.canAccept(cards[0]);
  }

  /**
   * 마지막 이동 취소 (Undo)
   */
  undo(): void {
    if (this._history.length === 0) return;
    if (this._state !== 'play' && this._state !== 'win') return;

    const cmd = this._history.pop()!;
    const fromDeck = this._decks[cmd.from];
    const toDeck   = this._decks[cmd.to];

    // 이동을 역으로: to → from
    // removeTopRaw: Foundation 잠금·Tableau 자동 오픈을 무시하고 원본 그대로 회수
    const cards = toDeck.removeTopRaw(cmd.count);

    // 이동 당시 자동 오픈된 카드가 있었으면, 카드를 되돌리기 전에 다시 닫음
    if (cmd.didOpenCard && fromDeck instanceof TableauDeck) {
      fromDeck.closeTopIfNeeded();
    }

    fromDeck.pushMany(cards);

    if (this._state === 'win') {
      this._state = 'play';
    }
    // [원본 버그 수정] undo도 moveCount++ 하던 것을 제거 (의미상 오류)
  }

  /**
   * 게임 리셋 (idle 상태로)
   */
  reset(): void {
    this._buildDecks();
    this._history = [];
    this._moveCount = 0;
    this._state = 'idle';
  }

  // ── 자동 이동 ───────────────────────────────────────────────────────────

  /**
   * 지정 덱의 맨 위 카드를 Foundation으로 자동 이동 시도
   * @returns 이동 성공한 Foundation 인덱스, 없으면 null
   */
  autoMoveToFoundation(from: DeckIndex): DeckIndex | null {
    if (this._isFoundation(from)) return null;
    const fromDeck = this._decks[from];
    if (fromDeck.isEmpty()) return null;

    for (let i = DeckIndex.Found1; i <= DeckIndex.Found4; i++) {
      const foundIdx = i as DeckIndex;
      if (this.canMove(from, foundIdx, 1)) {
        this.moveCard(from, foundIdx, 1);
        return foundIdx;
      }
    }
    return null;
  }

  /** 진행 중인 판에서 Foundation으로 올릴 수 있는 카드가 하나라도 있는지 */
  hasFoundationMove(): boolean {
    if (this._state !== 'play') return false;
    for (let i = DeckIndex.Free1; i <= DeckIndex.Tableau8; i++) {
      if (this.isAutoMovable(i as DeckIndex)) return true;
    }
    return false;
  }

  /**
   * Foundation으로 올릴 수 있는 카드 한 장을 올린다 (FreeCell → Tableau 순으로 탐색).
   * 반복 호출하면 연쇄로 올릴 수 있는 카드까지 모두 올라간다.
   * @returns 카드를 올린 출발 덱, 올릴 카드가 없으면 null
   */
  autoMoveOne(): DeckIndex | null {
    if (this._state !== 'play') return null;
    for (let i = DeckIndex.Free1; i <= DeckIndex.Tableau8; i++) {
      if (this.autoMoveToFoundation(i as DeckIndex) !== null) return i as DeckIndex;
    }
    return null;
  }

  // ── 자동 완료 ───────────────────────────────────────────────────────────

  /**
   * 남은 모든 카드를 Foundation으로 순서대로 올려 게임을 끝낼 수 있는 상태인지 판정.
   * 현재 상태를 복제해 탐욕적으로 Foundation 이동을 반복했을 때 승리에 도달하면 true.
   * (판정만 수행 — 실제 보드는 변경하지 않음)
   */
  canAutoComplete(): boolean {
    if (this._state !== 'play') return false;
    const sim = new FreecellGame();
    if (sim.restore(this.serialize(0)) === null) return false;
    sim._greedyToFoundation();
    return sim._checkWin();
  }

  /**
   * 탐욕적으로 가능한 모든 카드를 Foundation으로 이동 (더 이상 이동 없을 때까지 반복).
   * @returns 이번 호출로 이동이 한 번이라도 일어났는지
   */
  private _greedyToFoundation(): boolean {
    let anyMove = false;
    let moved = true;
    while (moved) {
      moved = false;
      for (let i = DeckIndex.Free1; i <= DeckIndex.Tableau8; i++) {
        if (this._isFoundation(i)) continue;
        if (this.autoMoveToFoundation(i as DeckIndex) !== null) {
          moved = true;
          anyMove = true;
        }
      }
    }
    return anyMove;
  }

  // ── 공간 계산 ───────────────────────────────────────────────────────────

  /** 비어있는 FreeCell 수 */
  emptyFreeCellCount(): number {
    let count = 0;
    for (let i = DeckIndex.Free1; i <= DeckIndex.Free4; i++) {
      if (this._decks[i].isEmpty()) count++;
    }
    return count;
  }

  /**
   * 비어있는 Tableau 컬럼 수 (목적지 컬럼 제외)
   * 목적지가 빈 태블로인 경우 해당 컬럼은 카운트에서 제외
   */
  emptyTableauCount(excludeDeck?: DeckIndex): number {
    let count = 0;
    for (let i = DeckIndex.Tableau1; i <= DeckIndex.Tableau8; i++) {
      if (i === excludeDeck) continue;
      if (this._decks[i].isEmpty()) count++;
    }
    return count;
  }

  /**
   * 멀티카드 이동 가능 최대 장수
   * 공식: (빈 FreeCell + 1) × 2^(빈 Tableau 수)
   *
   * @param emptyFreeCells - 빈 FreeCells 수
   * @param emptyTableaus  - 빈 Tableau 컬럼 수 (목적지 제외)
   */
  maxMovableCount(emptyFreeCells: number, emptyTableaus: number): number {
    return (emptyFreeCells + 1) * Math.pow(2, emptyTableaus);
  }

  // ── 승리 판정 ───────────────────────────────────────────────────────────

  isWin(): boolean {
    return this._checkWin();
  }

  private _checkWin(): boolean {
    for (let i = DeckIndex.Found1; i <= DeckIndex.Found4; i++) {
      if (!(this._decks[i] as FoundationDeck).isComplete()) return false;
    }
    return true;
  }

  // ── 상태 머신 ───────────────────────────────────────────────────────────

  pause(): void {
    if (this._state === 'play') this._state = 'pause';
  }

  resume(): void {
    if (this._state === 'pause') this._state = 'play';
  }

  /**
   * 진행 중인 판을 포기한다 (play/pause → lost).
   * 카드 배치·이동 횟수·게임 번호는 그대로 두므로 결과 표시와 restart() 가 가능하다.
   * @returns 포기 처리 여부 (진행 중인 판이 아니면 false)
   */
  giveUp(): boolean {
    if (this._state !== 'play' && this._state !== 'pause') return false;
    this._state = 'lost';
    return true;
  }

  // ── 유틸리티 ────────────────────────────────────────────────────────────

  private _isFoundation(idx: DeckIndex): boolean {
    return idx >= DeckIndex.Found1 && idx <= DeckIndex.Found4;
  }

  private _isFreeCell(idx: DeckIndex): boolean {
    return idx >= DeckIndex.Free1 && idx <= DeckIndex.Free4;
  }

  /**
   * 카드 배열이 올바른 시퀀스인지 확인
   * (cards[0]이 바닥, cards[n-1]이 맨 위)
   * - 교대 색상 + 내림차순
   */
  private _isValidSequence(cards: Card[]): boolean {
    if (cards.length <= 1) return true;
    for (let i = 0; i < cards.length - 1; i++) {
      const lower = cards[i];
      const upper = cards[i + 1];
      if (lower.color === upper.color) return false;
      if (upper.number !== lower.number - 1) return false;
    }
    return true;
  }

  /**
   * 덱이 Foundation으로 이동 가능한지 (UI에서 힌트 표시용)
   */
  isAutoMovable(from: DeckIndex): boolean {
    if (this._isFoundation(from)) return false;
    const fromDeck = this._decks[from];
    if (fromDeck.isEmpty()) return false;
    for (let i = DeckIndex.Found1; i <= DeckIndex.Found4; i++) {
      if (this.canMove(from, i as DeckIndex, 1)) return true;
    }
    return false;
  }

  // ── 직렬화 / 복원 ─────────────────────────────────────────────────────

  /**
   * 현재 게임 상태를 IndexedDB 저장용 스냅샷으로 직렬화
   */
  serialize(elapsed: number): GameSnapshot {
    const decks = this._decks.map(deck => ({
      cards: deck.toArray().map(card => ({
        figure: card.figure as number,
        number: card.number as number,
        isOpen: card.isOpen,
      })),
    }));

    const history: SavedMove[] = this._history.map(cmd => ({
      from:        cmd.from as number,
      to:          cmd.to   as number,
      count:       cmd.count,
      didOpenCard: cmd.didOpenCard,
    }));

    return {
      version:    1,
      savedAt:    Date.now(),
      gameState:  this._state,
      moveCount:  this._moveCount,
      elapsed,
      decks,
      history,
      gameNumber: this._gameNumber,
      // 이어하기 후에도 "다시 하기"가 동작하도록 초기 배열을 함께 저장
      initialDecks: this._initialSnapshot?.decks,
    };
  }

  /**
   * 스냅샷 덱 데이터 검증: 유효한 무늬/숫자로 정확히 52장, 중복 없음
   * 손상된 저장 데이터로 비정상 보드가 복원되는 것을 방지
   */
  private static _validateDecks(decks: SavedDeck[]): boolean {
    // 덱 수가 다르면 남는 덱의 카드가 복원에서 빠져 52장이 안 되는 보드가 된다
    if (!Array.isArray(decks) || decks.length !== TOTAL_DECKS) return false;
    const seen = new Set<number>();
    for (const deckData of decks) {
      for (const c of deckData.cards) {
        if (c.figure < 1 || c.figure > 4) return false;
        if (c.number < 1 || c.number > 13) return false;
        const key = c.figure * 100 + c.number;
        if (seen.has(key)) return false;
        seen.add(key);
      }
    }
    return seen.size === 52;
  }

  /**
   * 이동 이력 검증: 덱 번호가 범위 안이고 장수가 1 이상의 정수
   * (범위 밖 번호가 남아 있으면 되돌리기에서 없는 덱을 건드려 오류가 난다)
   */
  private static _validateHistory(history: SavedMove[]): boolean {
    if (!Array.isArray(history)) return false;
    const isDeck = (v: unknown): boolean =>
      Number.isInteger(v) && (v as number) >= 0 && (v as number) < TOTAL_DECKS;
    return history.every(h =>
      isDeck(h.from) && isDeck(h.to) && Number.isInteger(h.count) && h.count >= 1);
  }

  /**
   * 스냅샷에서 게임 상태 복원
   * @returns 복원된 경과 시간(초), 실패 시 null
   */
  restore(snapshot: GameSnapshot): number | null {
    try {
      // 손상된 스냅샷(카드 수/중복/범위 오류) 거부
      if (!FreecellGame._validateDecks(snapshot.decks) ||
          !FreecellGame._validateHistory(snapshot.history)) {
        this.reset();
        return null;
      }

      // 덱 복원
      this._buildDecks();
      for (let i = 0; i < Math.min(snapshot.decks.length, TOTAL_DECKS); i++) {
        const deckData = snapshot.decks[i];
        for (const cardData of deckData.cards) {
          const card = new Card(cardData.figure as Figure, cardData.number as CardNumber);
          if (cardData.isOpen) card.open();
          this._decks[i].push(card);
        }
      }

      // 이동 이력 복원
      this._history = snapshot.history.map(h => ({
        from:        h.from as DeckIndex,
        to:          h.to   as DeckIndex,
        count:       h.count,
        didOpenCard: h.didOpenCard,
      }));

      // 숫자가 아닌 값이 화면에 그대로 나오지 않도록 (이동 횟수·경과 시간은 표시용이라 0으로 대체)
      const nonNegative = (v: unknown): number =>
        typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : 0;
      this._moveCount  = Math.floor(nonNegative(snapshot.moveCount));
      this._state      = snapshot.gameState === 'pause' ? 'pause' : 'play';
      this._gameNumber = snapshot.gameNumber ?? 0;

      // 초기 배열 복원 (이어하기 후 "다시 하기" 지원)
      if (snapshot.initialDecks && FreecellGame._validateDecks(snapshot.initialDecks)) {
        this._initialSnapshot = {
          version:    1,
          savedAt:    snapshot.savedAt,
          gameState:  'play',
          moveCount:  0,
          elapsed:    0,
          decks:      snapshot.initialDecks,
          history:    [],
          gameNumber: snapshot.gameNumber ?? 0,
        };
      } else if (this._gameNumber > 0) {
        // v1 저장본에 초기 배열이 없어도 게임 번호가 있으면 동일 딜로 재구성 가능
        const tmp = new FreecellGame();
        tmp.deal(this._gameNumber);
        this._initialSnapshot = tmp.serialize(0);
      }
      // 둘 다 불가능하면 기존 _initialSnapshot 유지 (restart() 경로에서는 이미 올바른 값)

      return nonNegative(snapshot.elapsed);
    } catch {
      this.reset();
      return null;
    }
  }

  /**
   * 현재 보드 스냅샷 (디버그용)
   */
  toString(): string {
    const lines: string[] = [];
    lines.push(`[상태: ${this._state}, 이동수: ${this._moveCount}]`);
    for (let i = 0; i < TOTAL_DECKS; i++) {
      const deck = this._decks[i];
      const label = i < 4 ? `Found${i + 1}` :
                    i < 8 ? `Free${i - 3}` :
                    `Tab${i - 7}`;
      lines.push(`  ${label}: ${deck.toArray().map(c => c.toString()).join(' ')}`);
    }
    return lines.join('\n');
  }
}
