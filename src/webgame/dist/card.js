// ─── 상수 정의 ──────────────────────────────────────────────────────────────
export var Color;
(function (Color) {
    Color["Red"] = "red";
    Color["Black"] = "black";
})(Color || (Color = {}));
export var Figure;
(function (Figure) {
    Figure[Figure["Club"] = 1] = "Club";
    Figure[Figure["Diamond"] = 2] = "Diamond";
    Figure[Figure["Heart"] = 3] = "Heart";
    Figure[Figure["Spade"] = 4] = "Spade";
})(Figure || (Figure = {}));
export var CardNumber;
(function (CardNumber) {
    CardNumber[CardNumber["Ace"] = 1] = "Ace";
    CardNumber[CardNumber["Two"] = 2] = "Two";
    CardNumber[CardNumber["Three"] = 3] = "Three";
    CardNumber[CardNumber["Four"] = 4] = "Four";
    CardNumber[CardNumber["Five"] = 5] = "Five";
    CardNumber[CardNumber["Six"] = 6] = "Six";
    CardNumber[CardNumber["Seven"] = 7] = "Seven";
    CardNumber[CardNumber["Eight"] = 8] = "Eight";
    CardNumber[CardNumber["Nine"] = 9] = "Nine";
    CardNumber[CardNumber["Ten"] = 10] = "Ten";
    CardNumber[CardNumber["Jack"] = 11] = "Jack";
    CardNumber[CardNumber["Queen"] = 12] = "Queen";
    CardNumber[CardNumber["King"] = 13] = "King";
})(CardNumber || (CardNumber = {}));
// 무늬별 이미지 파일명 접두사 (img/ 폴더 규칙과 동일)
const FIGURE_PREFIX = {
    [Figure.Club]: 'c',
    [Figure.Diamond]: 'd',
    [Figure.Heart]: 'h',
    [Figure.Spade]: 's',
};
// 숫자별 이미지 파일명 접미사
const NUMBER_SUFFIX = {
    [CardNumber.Ace]: 'a',
    [CardNumber.Two]: '2',
    [CardNumber.Three]: '3',
    [CardNumber.Four]: '4',
    [CardNumber.Five]: '5',
    [CardNumber.Six]: '6',
    [CardNumber.Seven]: '7',
    [CardNumber.Eight]: '8',
    [CardNumber.Nine]: '9',
    [CardNumber.Ten]: '10',
    [CardNumber.Jack]: 'j',
    [CardNumber.Queen]: 'q',
    [CardNumber.King]: 'k',
};
// ─── Card 클래스 ────────────────────────────────────────────────────────────
export class Card {
    constructor(figure, number) {
        this._isOpen = false;
        this._figure = figure;
        this._number = number;
    }
    get figure() { return this._figure; }
    get number() { return this._number; }
    get isOpen() { return this._isOpen; }
    /** 카드 색상: 하트/다이아 → Red, 클로버/스페이드 → Black */
    get color() {
        return (this._figure === Figure.Heart || this._figure === Figure.Diamond)
            ? Color.Red
            : Color.Black;
    }
    /**
     * img/ 폴더의 파일명 (확장자 제외)
     * 예: 하트 킹 → 'hk', 다이아 10 → 'd10', 클로버 에이스 → 'ca'
     */
    get imageName() {
        return FIGURE_PREFIX[this._figure] + NUMBER_SUFFIX[this._number];
    }
    open() { this._isOpen = true; }
    close() { this._isOpen = false; }
    /** 무늬와 숫자가 같은지 비교 */
    equals(other) {
        return this._figure === other._figure && this._number === other._number;
    }
    toString() {
        const figureNames = {
            [Figure.Club]: 'Club',
            [Figure.Diamond]: 'Diamond',
            [Figure.Heart]: 'Heart',
            [Figure.Spade]: 'Spade',
        };
        const numStr = this._number === CardNumber.Ace ? 'A'
            : this._number === CardNumber.Jack ? 'J'
                : this._number === CardNumber.Queen ? 'Q'
                    : this._number === CardNumber.King ? 'K'
                        : String(this._number);
        return `${figureNames[this._figure]}${numStr}(${this._isOpen ? 'O' : 'C'})`;
    }
}
//# sourceMappingURL=card.js.map