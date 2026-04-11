import { Card, Figure } from './card.js';
import { DeckIndex, TOTAL_DECKS, InitDeck, FoundationDeck, FreeCellDeck, TableauDeck, } from './deck.js';
// ─── FreecellGame ────────────────────────────────────────────────────────────
export class FreecellGame {
    constructor() {
        this._decks = [];
        this._history = [];
        this._state = 'idle';
        this._moveCount = 0;
        /** deal() 직후 저장한 초기 배열 (다시 하기용) */
        this._initialSnapshot = null;
        this._buildDecks();
    }
    // ── Getter ──────────────────────────────────────────────────────────────
    get state() { return this._state; }
    get moveCount() { return this._moveCount; }
    get canUndo() { return this._history.length > 0; }
    getDeck(index) { return this._decks[index]; }
    // ── 초기화 ─────────────────────────────────────────────────────────────
    _buildDecks() {
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
     * - 컬럼 1~4: 7장씩
     * - 컬럼 5~8: 6장씩
     * - 각 컬럼 맨 위 카드만 오픈
     */
    deal() {
        this._buildDecks();
        this._history = [];
        this._moveCount = 0;
        const init = new InitDeck();
        // 카드를 순서대로 태블로에 배분 (원본 Android 배분 방식 동일)
        for (let i = 0; i < 52; i++) {
            const colIndex = i % 8;
            const deckIdx = (DeckIndex.Tableau1 + colIndex);
            const card = init.pop();
            card.close();
            this._decks[deckIdx].push(card);
        }
        // 각 태블로 맨 위 카드 오픈
        for (let i = DeckIndex.Tableau1; i <= DeckIndex.Tableau8; i++) {
            const deck = this._decks[i];
            if (!deck.isEmpty())
                deck.top().open();
        }
        this._state = 'play';
        // 다시 하기를 위한 초기 배열 저장
        this._initialSnapshot = this.serialize(0);
    }
    /**
     * 동일한 배열로 게임을 처음부터 다시 시작
     * @returns 복원 성공 여부
     */
    restart() {
        if (!this._initialSnapshot)
            return false;
        const result = this.restore(this._initialSnapshot);
        return result !== null;
    }
    // ── 이동 ────────────────────────────────────────────────────────────────
    /**
     * 카드 이동 시도
     * @returns 이동 성공 여부
     */
    moveCard(from, to, count) {
        if (this._state !== 'play')
            return false;
        // Foundation에서는 꺼낼 수 없음
        if (this._isFoundation(from))
            return false;
        // freecell → freecell 이동 불가
        if (this._isFreeCell(from) && this._isFreeCell(to))
            return false;
        // freecell / foundation으로는 1장만 이동
        if ((this._isFreeCell(to) || this._isFoundation(to)) && count !== 1)
            return false;
        const fromDeck = this._decks[from];
        const toDeck = this._decks[to];
        if (fromDeck.isEmpty())
            return false;
        if (count > fromDeck.size())
            return false;
        // 멀티카드 이동 가능 장수 초과 검사
        if (count > this.maxMovableCount(this.emptyFreeCellCount(), this.emptyTableauCount(to))) {
            return false;
        }
        // 이동할 카드들 미리 확인 (시퀀스 유효성)
        const cards = fromDeck.peekTop(count);
        if (!this._isValidSequence(cards))
            return false;
        // 목적지 덱이 맨 아래 카드를 받을 수 있는지
        if (!toDeck.canAccept(cards[0]))
            return false;
        // 이동 전 아래 카드가 닫혀있었는지 기록 (undo 시 원복용)
        const belowCard = fromDeck.size() > count ? fromDeck.get(fromDeck.size() - count - 1) : null;
        const didOpenCard = belowCard !== null && !belowCard.isOpen;
        // 실제 이동
        const moved = fromDeck.popMany(count);
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
    canMove(from, to, count) {
        if (this._state !== 'play')
            return false;
        if (this._isFoundation(from))
            return false;
        if (this._isFreeCell(from) && this._isFreeCell(to))
            return false;
        if ((this._isFreeCell(to) || this._isFoundation(to)) && count !== 1)
            return false;
        const fromDeck = this._decks[from];
        const toDeck = this._decks[to];
        if (fromDeck.isEmpty())
            return false;
        if (count > fromDeck.size())
            return false;
        if (count > this.maxMovableCount(this.emptyFreeCellCount(), this.emptyTableauCount(to)))
            return false;
        const cards = fromDeck.peekTop(count);
        if (!this._isValidSequence(cards))
            return false;
        return toDeck.canAccept(cards[0]);
    }
    /**
     * 마지막 이동 취소 (Undo)
     */
    undo() {
        if (this._history.length === 0)
            return;
        if (this._state !== 'play' && this._state !== 'win')
            return;
        const cmd = this._history.pop();
        const fromDeck = this._decks[cmd.from];
        const toDeck = this._decks[cmd.to];
        // 이동을 역으로: to → from
        const cards = toDeck.popMany(cmd.count);
        // undo 시 맨 위 카드를 다시 닫기 (pop 시 자동 open된 카드 원복)
        if (cmd.didOpenCard && !fromDeck.isEmpty()) {
            fromDeck.top().close();
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
    reset() {
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
    autoMoveToFoundation(from) {
        if (this._isFoundation(from))
            return null;
        const fromDeck = this._decks[from];
        if (fromDeck.isEmpty())
            return null;
        for (let i = DeckIndex.Found1; i <= DeckIndex.Found4; i++) {
            const foundIdx = i;
            if (this.canMove(from, foundIdx, 1)) {
                this.moveCard(from, foundIdx, 1);
                return foundIdx;
            }
        }
        return null;
    }
    // ── 공간 계산 ───────────────────────────────────────────────────────────
    /** 비어있는 FreeCell 수 */
    emptyFreeCellCount() {
        let count = 0;
        for (let i = DeckIndex.Free1; i <= DeckIndex.Free4; i++) {
            if (this._decks[i].isEmpty())
                count++;
        }
        return count;
    }
    /**
     * 비어있는 Tableau 컬럼 수 (목적지 컬럼 제외)
     * 목적지가 빈 태블로인 경우 해당 컬럼은 카운트에서 제외
     */
    emptyTableauCount(excludeDeck) {
        let count = 0;
        for (let i = DeckIndex.Tableau1; i <= DeckIndex.Tableau8; i++) {
            if (i === excludeDeck)
                continue;
            if (this._decks[i].isEmpty())
                count++;
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
    maxMovableCount(emptyFreeCells, emptyTableaus) {
        return (emptyFreeCells + 1) * Math.pow(2, emptyTableaus);
    }
    // ── 승리 판정 ───────────────────────────────────────────────────────────
    isWin() {
        return this._checkWin();
    }
    _checkWin() {
        for (let i = DeckIndex.Found1; i <= DeckIndex.Found4; i++) {
            if (!this._decks[i].isComplete())
                return false;
        }
        return true;
    }
    // ── 상태 머신 ───────────────────────────────────────────────────────────
    pause() {
        if (this._state === 'play')
            this._state = 'pause';
    }
    resume() {
        if (this._state === 'pause')
            this._state = 'play';
    }
    // ── 유틸리티 ────────────────────────────────────────────────────────────
    _isFoundation(idx) {
        return idx >= DeckIndex.Found1 && idx <= DeckIndex.Found4;
    }
    _isFreeCell(idx) {
        return idx >= DeckIndex.Free1 && idx <= DeckIndex.Free4;
    }
    /**
     * 카드 배열이 올바른 시퀀스인지 확인
     * (cards[0]이 바닥, cards[n-1]이 맨 위)
     * - 교대 색상 + 내림차순
     */
    _isValidSequence(cards) {
        if (cards.length <= 1)
            return true;
        for (let i = 0; i < cards.length - 1; i++) {
            const lower = cards[i];
            const upper = cards[i + 1];
            if (lower.color === upper.color)
                return false;
            if (upper.number !== lower.number - 1)
                return false;
        }
        return true;
    }
    /**
     * 덱이 Foundation으로 이동 가능한지 (UI에서 힌트 표시용)
     */
    isAutoMovable(from) {
        if (this._isFoundation(from))
            return false;
        const fromDeck = this._decks[from];
        if (fromDeck.isEmpty())
            return false;
        for (let i = DeckIndex.Found1; i <= DeckIndex.Found4; i++) {
            if (this.canMove(from, i, 1))
                return true;
        }
        return false;
    }
    // ── 직렬화 / 복원 ─────────────────────────────────────────────────────
    /**
     * 현재 게임 상태를 IndexedDB 저장용 스냅샷으로 직렬화
     */
    serialize(elapsed) {
        const decks = this._decks.map(deck => ({
            cards: deck.toArray().map(card => ({
                figure: card.figure,
                number: card.number,
                isOpen: card.isOpen,
            })),
        }));
        const history = this._history.map(cmd => ({
            from: cmd.from,
            to: cmd.to,
            count: cmd.count,
            didOpenCard: cmd.didOpenCard,
        }));
        return {
            version: 1,
            savedAt: Date.now(),
            gameState: this._state,
            moveCount: this._moveCount,
            elapsed,
            decks,
            history,
        };
    }
    /**
     * 스냅샷에서 게임 상태 복원
     * @returns 복원된 경과 시간(초), 실패 시 null
     */
    restore(snapshot) {
        try {
            // 덱 복원
            this._buildDecks();
            for (let i = 0; i < Math.min(snapshot.decks.length, TOTAL_DECKS); i++) {
                const deckData = snapshot.decks[i];
                for (const cardData of deckData.cards) {
                    const card = new Card(cardData.figure, cardData.number);
                    if (cardData.isOpen)
                        card.open();
                    this._decks[i].push(card);
                }
            }
            // 이동 이력 복원
            this._history = snapshot.history.map(h => ({
                from: h.from,
                to: h.to,
                count: h.count,
                didOpenCard: h.didOpenCard,
            }));
            this._moveCount = snapshot.moveCount;
            this._state = snapshot.gameState === 'pause' ? 'pause' : 'play';
            return snapshot.elapsed;
        }
        catch {
            this.reset();
            return null;
        }
    }
    /**
     * 현재 보드 스냅샷 (디버그용)
     */
    toString() {
        const lines = [];
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
// Foundation 덱별 무늬 (인덱스 순서 고정)
FreecellGame.FOUNDATION_FIGURES = [
    Figure.Club, Figure.Diamond, Figure.Heart, Figure.Spade,
];
//# sourceMappingURL=freecell.js.map