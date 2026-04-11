// ─── 상수 정의 ──────────────────────────────────────────────────────────────

export enum Color {
  Red   = 'red',
  Black = 'black',
}

export enum Figure {
  Club    = 1,   // 클로버 ♣ (검정)
  Diamond = 2,   // 다이아 ♦ (빨강)
  Heart   = 3,   // 하트   ♥ (빨강)
  Spade   = 4,   // 스페이드 ♠ (검정)
}

export enum CardNumber {
  Ace   = 1,
  Two   = 2,
  Three = 3,
  Four  = 4,
  Five  = 5,
  Six   = 6,
  Seven = 7,
  Eight = 8,
  Nine  = 9,
  Ten   = 10,
  Jack  = 11,
  Queen = 12,
  King  = 13,
}

// 무늬별 이미지 파일명 접두사 (img/ 폴더 규칙과 동일)
const FIGURE_PREFIX: Record<Figure, string> = {
  [Figure.Club]:    'c',
  [Figure.Diamond]: 'd',
  [Figure.Heart]:   'h',
  [Figure.Spade]:   's',
};

// 숫자별 이미지 파일명 접미사
const NUMBER_SUFFIX: Record<CardNumber, string> = {
  [CardNumber.Ace]:   'a',
  [CardNumber.Two]:   '2',
  [CardNumber.Three]: '3',
  [CardNumber.Four]:  '4',
  [CardNumber.Five]:  '5',
  [CardNumber.Six]:   '6',
  [CardNumber.Seven]: '7',
  [CardNumber.Eight]: '8',
  [CardNumber.Nine]:  '9',
  [CardNumber.Ten]:   '10',
  [CardNumber.Jack]:  'j',
  [CardNumber.Queen]: 'q',
  [CardNumber.King]:  'k',
};

// ─── Card 클래스 ────────────────────────────────────────────────────────────

export class Card {
  private readonly _figure: Figure;
  private readonly _number: CardNumber;
  private _isOpen: boolean = false;

  constructor(figure: Figure, number: CardNumber) {
    this._figure = figure;
    this._number = number;
  }

  get figure(): Figure     { return this._figure; }
  get number(): CardNumber { return this._number; }
  get isOpen(): boolean    { return this._isOpen; }

  /** 카드 색상: 하트/다이아 → Red, 클로버/스페이드 → Black */
  get color(): Color {
    return (this._figure === Figure.Heart || this._figure === Figure.Diamond)
      ? Color.Red
      : Color.Black;
  }

  /**
   * img/ 폴더의 파일명 (확장자 제외)
   * 예: 하트 킹 → 'hk', 다이아 10 → 'd10', 클로버 에이스 → 'ca'
   */
  get imageName(): string {
    return FIGURE_PREFIX[this._figure] + NUMBER_SUFFIX[this._number];
  }

  open():  void { this._isOpen = true;  }
  close(): void { this._isOpen = false; }

  /** 무늬와 숫자가 같은지 비교 */
  equals(other: Card): boolean {
    return this._figure === other._figure && this._number === other._number;
  }

  toString(): string {
    const figureNames: Record<Figure, string> = {
      [Figure.Club]:    'Club',
      [Figure.Diamond]: 'Diamond',
      [Figure.Heart]:   'Heart',
      [Figure.Spade]:   'Spade',
    };
    const numStr = this._number === CardNumber.Ace   ? 'A'
                 : this._number === CardNumber.Jack  ? 'J'
                 : this._number === CardNumber.Queen ? 'Q'
                 : this._number === CardNumber.King  ? 'K'
                 : String(this._number);
    return `${figureNames[this._figure]}${numStr}(${this._isOpen ? 'O' : 'C'})`;
  }
}
