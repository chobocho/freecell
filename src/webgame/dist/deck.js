import { Card, Figure, CardNumber } from './card.js';
// ─── 덱 인덱스 상수 ─────────────────────────────────────────────────────────
// FreecellGame.decks[] 배열 내 각 덱의 인덱스
export var DeckIndex;
(function (DeckIndex) {
    DeckIndex[DeckIndex["Found1"] = 0] = "Found1";
    DeckIndex[DeckIndex["Found2"] = 1] = "Found2";
    DeckIndex[DeckIndex["Found3"] = 2] = "Found3";
    DeckIndex[DeckIndex["Found4"] = 3] = "Found4";
    DeckIndex[DeckIndex["Free1"] = 4] = "Free1";
    DeckIndex[DeckIndex["Free2"] = 5] = "Free2";
    DeckIndex[DeckIndex["Free3"] = 6] = "Free3";
    DeckIndex[DeckIndex["Free4"] = 7] = "Free4";
    DeckIndex[DeckIndex["Tableau1"] = 8] = "Tableau1";
    DeckIndex[DeckIndex["Tableau2"] = 9] = "Tableau2";
    DeckIndex[DeckIndex["Tableau3"] = 10] = "Tableau3";
    DeckIndex[DeckIndex["Tableau4"] = 11] = "Tableau4";
    DeckIndex[DeckIndex["Tableau5"] = 12] = "Tableau5";
    DeckIndex[DeckIndex["Tableau6"] = 13] = "Tableau6";
    DeckIndex[DeckIndex["Tableau7"] = 14] = "Tableau7";
    DeckIndex[DeckIndex["Tableau8"] = 15] = "Tableau8";
})(DeckIndex || (DeckIndex = {}));
export const TOTAL_DECKS = 16;
// ─── 기본 Deck 클래스 ────────────────────────────────────────────────────────
export class Deck {
    constructor() {
        this._cards = [];
    }
    /** 카드 수 */
    size() { return this._cards.length; }
    /** 비어있는지 */
    isEmpty() { return this._cards.length === 0; }
    /**
     * 인덱스로 카드 접근 (0 = 바닥, size-1 = 맨 위)
     */
    get(index) { return this._cards[index]; }
    /** 맨 위 카드 (제거 안함) */
    top() {
        return this._cards.length > 0 ? this._cards[this._cards.length - 1] : null;
    }
    /** 카드 전체 지우기 */
    clear() { this._cards = []; }
    /** 카드를 맨 위에 올리기 (유효성 검사 없음 - 내부/복원용) */
    push(card) {
        this._cards.push(card);
    }
    /** 맨 위 카드 제거 후 반환 */
    pop() {
        return this._cards.length > 0 ? this._cards.pop() : null;
    }
    /** 위에서 n장을 배열로 반환 (제거 안함, 바닥→위 순서) */
    peekTop(n) {
        return this._cards.slice(this._cards.length - n);
    }
    /** 위에서 n장 제거 후 배열로 반환 (바닥→위 순서) */
    popMany(n) {
        if (n > this._cards.length)
            return [];
        return this._cards.splice(this._cards.length - n, n);
    }
    /**
     * undo 전용: 게임 규칙(Foundation 잠금 · Tableau 자동 오픈)을 무시하고
     * 맨 위 n장을 원본 그대로 제거해 반환 (바닥→위 순서)
     */
    removeTopRaw(n) {
        if (n > this._cards.length)
            return [];
        return this._cards.splice(this._cards.length - n, n);
    }
    /** 배열의 카드들을 순서대로 push (배열 첫 번째가 먼저 쌓임) */
    pushMany(cards) {
        for (const card of cards) {
            this._cards.push(card);
        }
    }
    /** 모든 카드를 배열로 복사 반환 (바닥→위 순서) */
    toArray() {
        return [...this._cards];
    }
}
// ─── InitDeck: 52장 셔플 덱 ──────────────────────────────────────────────────
export class InitDeck extends Deck {
    /**
     * @param gameNumber 1~32000: MS FreeCell 호환 시드 셔플 / undefined: 무작위
     */
    constructor(gameNumber) {
        super();
        if (gameNumber !== undefined && gameNumber >= 1 && gameNumber <= 32000) {
            this._createWithGameNumber(gameNumber);
        }
        else {
            this._createAndShuffle();
        }
    }
    _createAndShuffle() {
        this._cards = [];
        const figures = [Figure.Club, Figure.Diamond, Figure.Heart, Figure.Spade];
        for (const fig of figures) {
            for (let num = CardNumber.Ace; num <= CardNumber.King; num++) {
                const card = new Card(fig, num);
                card.open();
                this._cards.push(card);
            }
        }
        // Fisher-Yates 셔플
        for (let i = this._cards.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this._cards[i], this._cards[j]] = [this._cards[j], this._cards[i]];
        }
    }
    /**
     * MS FreeCell LCG 알고리즘으로 시드 기반 셔플
     * 카드 인덱스(rank-major, MS 표준): suit = k % 4 (♣♦♥♠), rank = ⌊k / 4⌋ + 1
     *   0=A♣ 1=A♦ 2=A♥ 3=A♠ 4=2♣ … 51=K♠
     */
    _createWithGameNumber(gameNumber) {
        const indices = [];
        for (let i = 0; i < 52; i++)
            indices.push(i);
        let seed = gameNumber;
        for (let i = 51; i >= 0; i--) {
            seed = (214013 * seed + 2531011) & 0x7FFFFFFF;
            const j = (seed >> 16) % (i + 1);
            [indices[i], indices[j]] = [indices[j], indices[i]];
        }
        // indices[51]이 첫 번째 배분 카드 → pop()은 배열 끝(_cards[51])부터 반환하므로 그대로 저장
        const figures = [Figure.Club, Figure.Diamond, Figure.Heart, Figure.Spade];
        this._cards = indices.map(k => {
            const card = new Card(figures[k % 4], (Math.floor(k / 4) + 1));
            card.open();
            return card;
        });
    }
    canAccept(_card) { return false; }
}
// ─── FoundationDeck: 완성 덱 (같은 무늬 A→K) ────────────────────────────────
export class FoundationDeck extends Deck {
    constructor(figure) {
        super();
        this._figure = figure;
    }
    get figure() { return this._figure; }
    /**
     * 규칙:
     * - 빈 덱: 해당 무늬의 Ace만 허용
     * - 카드 있을 때: 같은 무늬 + 현재 맨 위 숫자 + 1
     */
    canAccept(card) {
        if (!card.isOpen)
            return false;
        if (card.figure !== this._figure)
            return false;
        if (this.isEmpty()) {
            return card.number === CardNumber.Ace;
        }
        return card.number === this.top().number + 1;
    }
    /** 13장이 모두 채워졌는지 */
    isComplete() { return this._cards.length === 13; }
    /** Foundation에서는 카드를 꺼낼 수 없음 (원본 동작 재현) */
    pop() { return null; }
    popMany(_n) { return []; }
}
// ─── FreeCellDeck: 임시 보관 덱 (1장만) ─────────────────────────────────────
export class FreeCellDeck extends Deck {
    /**
     * 규칙: 비어있을 때만 허용 (1장 제한을 객체 수준에서 강제)
     * freecell → freecell 이동은 FreecellGame에서 추가로 차단
     */
    canAccept(card) {
        if (!card.isOpen)
            return false;
        return this.isEmpty();
    }
}
// ─── TableauDeck: 태블로 컬럼 ────────────────────────────────────────────────
export class TableauDeck extends Deck {
    constructor() {
        super(...arguments);
        /** 직전 pop/popMany가 아래 카드를 자동 오픈했는지 (undo 시 원복 판단용) */
        this._openedTopOnLastPop = false;
    }
    /**
     * 규칙:
     * - 빈 컬럼: 아무 카드나 허용
     * - 맨 위가 닫힌 카드: 항상 허용 (초기 배분 시)
     * - 맨 위가 열린 카드: 교대 색상 + 숫자 1 감소
     */
    canAccept(card) {
        if (!card.isOpen)
            return false;
        if (this.isEmpty())
            return true;
        const topCard = this.top();
        if (!topCard.isOpen)
            return true; // 닫힌 카드 위에 항상 허용
        // 교대 색상 + 내림차순
        return (topCard.color !== card.color) && (card.number === topCard.number - 1);
    }
    /**
     * 맨 위 카드 제거 후 아래 카드 자동 오픈 (원본 동작 재현)
     * [원본 버그 수정] 원본 BoardDeck.setCheckMethod()는 파라미터를 무시하고 자기 자신을 대입했음
     */
    pop() {
        this._openedTopOnLastPop = false;
        if (this.isEmpty())
            return null;
        const card = this._cards.pop();
        if (!this.isEmpty() && !this.top().isOpen) {
            this.top().open();
            this._openedTopOnLastPop = true;
        }
        return card;
    }
    /** 위에서 n장 제거 후 아래 카드 자동 오픈 (멀티카드 이동용) */
    popMany(n) {
        this._openedTopOnLastPop = false;
        if (n > this._cards.length)
            return [];
        const removed = this._cards.splice(this._cards.length - n, n);
        if (!this.isEmpty() && !this.top().isOpen) {
            this.top().open();
            this._openedTopOnLastPop = true;
        }
        return removed;
    }
    /** 직전 pop/popMany가 아래 카드를 자동 오픈했는지 반환 */
    didOpenTopOnLastPop() { return this._openedTopOnLastPop; }
    /**
     * 맨 위에서 이어진 올바른 시퀀스 길이 반환
     * (멀티카드 드래그 시 최대 드래그 가능 장수 계산에 사용)
     */
    sequenceLength() {
        if (this.isEmpty())
            return 0;
        let count = 1;
        for (let i = this._cards.length - 1; i > 0; i--) {
            const upper = this._cards[i];
            const lower = this._cards[i - 1];
            if (!upper.isOpen || !lower.isOpen)
                break;
            if (upper.color === lower.color)
                break;
            if (upper.number !== lower.number - 1)
                break;
            count++;
        }
        return count;
    }
    /**
     * undo 시 맨 위 카드를 다시 닫기 (pop 전에 open된 카드를 원복)
     * 이전에 닫혀있던 카드를 다시 닫음
     */
    closeTopIfNeeded() {
        if (!this.isEmpty()) {
            this.top().close();
        }
    }
}
//# sourceMappingURL=deck.js.map