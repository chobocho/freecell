import { Card, Figure } from './card.js';
import { DeckIndex, TOTAL_DECKS, InitDeck, FoundationDeck, FreeCellDeck, TableauDeck, } from './deck.js';
// ─── FreecellGame ────────────────────────────────────────────────────────────
export class FreecellGame {
    constructor() {
        this._decks = [];
        this._history = [];
        this._state = 'idle';
        this._moveCount = 0;
        /** 현재 게임 번호 (0 = 랜덤) */
        this._gameNumber = 0;
        /** deal() 직후 저장한 초기 배열 (다시 하기용) */
        this._initialSnapshot = null;
        this._buildDecks();
    }
    // ── Getter ──────────────────────────────────────────────────────────────
    get state() { return this._state; }
    get moveCount() { return this._moveCount; }
    get canUndo() { return this._history.length > 0; }
    get gameNumber() { return this._gameNumber; }
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
     * @param gameNumber 1~32000: MS FreeCell 게임 번호 / undefined: 무작위
     */
    deal(gameNumber) {
        this._buildDecks();
        this._history = [];
        this._moveCount = 0;
        this._gameNumber = gameNumber ?? 0;
        const init = new InitDeck(gameNumber);
        // 카드를 순서대로 태블로에 배분 (원본 Android 배분 방식 동일)
        for (let i = 0; i < 52; i++) {
            const colIndex = i % 8;
            const deckIdx = (DeckIndex.Tableau1 + colIndex);
            const card = init.pop();
            card.close();
            this._decks[deckIdx].push(card);
        }
        // FreeCell은 모든 카드 앞면 공개
        for (let i = DeckIndex.Tableau1; i <= DeckIndex.Tableau8; i++) {
            const deck = this._decks[i];
            for (let ci = 0; ci < deck.size(); ci++)
                deck.get(ci).open();
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
    // ── 자동 완료 ───────────────────────────────────────────────────────────
    /**
     * 남은 모든 카드를 Foundation으로 순서대로 올려 게임을 끝낼 수 있는 상태인지 판정.
     * 현재 상태를 복제해 탐욕적으로 Foundation 이동을 반복했을 때 승리에 도달하면 true.
     * (판정만 수행 — 실제 보드는 변경하지 않음)
     */
    canAutoComplete() {
        if (this._state !== 'play')
            return false;
        const sim = new FreecellGame();
        if (sim.restore(this.serialize(0)) === null)
            return false;
        sim._greedyToFoundation();
        return sim._checkWin();
    }
    /**
     * 탐욕적으로 가능한 모든 카드를 Foundation으로 이동 (더 이상 이동 없을 때까지 반복).
     * @returns 이번 호출로 이동이 한 번이라도 일어났는지
     */
    _greedyToFoundation() {
        let anyMove = false;
        let moved = true;
        while (moved) {
            moved = false;
            for (let i = DeckIndex.Free1; i <= DeckIndex.Tableau8; i++) {
                if (this._isFoundation(i))
                    continue;
                if (this.autoMoveToFoundation(i) !== null) {
                    moved = true;
                    anyMove = true;
                }
            }
        }
        return anyMove;
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
            gameNumber: this._gameNumber,
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
            this._gameNumber = snapshot.gameNumber ?? 0;
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