import { Card, Figure, CardNumber } from './card.js';

// ─── 덱 인덱스 상수 ─────────────────────────────────────────────────────────
// FreecellGame.decks[] 배열 내 각 덱의 인덱스

export enum DeckIndex {
  Found1   = 0,   // Foundation - 클로버
  Found2   = 1,   // Foundation - 다이아
  Found3   = 2,   // Foundation - 하트
  Found4   = 3,   // Foundation - 스페이드
  Free1    = 4,   // FreeCell 1
  Free2    = 5,   // FreeCell 2
  Free3    = 6,   // FreeCell 3
  Free4    = 7,   // FreeCell 4
  Tableau1 = 8,   // Tableau 컬럼 1
  Tableau2 = 9,
  Tableau3 = 10,
  Tableau4 = 11,
  Tableau5 = 12,
  Tableau6 = 13,
  Tableau7 = 14,
  Tableau8 = 15,
}

export const TOTAL_DECKS = 16;

// ─── 기본 Deck 클래스 ────────────────────────────────────────────────────────

export abstract class Deck {
  protected _cards: Card[] = [];

  /** 카드 수 */
  size(): number { return this._cards.length; }

  /** 비어있는지 */
  isEmpty(): boolean { return this._cards.length === 0; }

  /**
   * 인덱스로 카드 접근 (0 = 바닥, size-1 = 맨 위)
   */
  get(index: number): Card { return this._cards[index]; }

  /** 맨 위 카드 (제거 안함) */
  top(): Card | null {
    return this._cards.length > 0 ? this._cards[this._cards.length - 1] : null;
  }

  /** 카드 전체 지우기 */
  clear(): void { this._cards = []; }

  /** 카드를 맨 위에 올리기 (유효성 검사 없음 - 내부/복원용) */
  push(card: Card): void {
    this._cards.push(card);
  }

  /** 맨 위 카드 제거 후 반환 */
  pop(): Card | null {
    return this._cards.length > 0 ? this._cards.pop()! : null;
  }

  /** 이 덱이 해당 카드를 받을 수 있는지 */
  abstract canAccept(card: Card): boolean;

  /** 위에서 n장을 배열로 반환 (제거 안함, 바닥→위 순서) */
  peekTop(n: number): Card[] {
    return this._cards.slice(this._cards.length - n);
  }

  /** 위에서 n장 제거 후 배열로 반환 (바닥→위 순서) */
  popMany(n: number): Card[] {
    if (n > this._cards.length) return [];
    return this._cards.splice(this._cards.length - n, n);
  }

  /** 배열의 카드들을 순서대로 push (배열 첫 번째가 먼저 쌓임) */
  pushMany(cards: Card[]): void {
    for (const card of cards) {
      this._cards.push(card);
    }
  }

  /** 모든 카드를 배열로 복사 반환 (바닥→위 순서) */
  toArray(): Card[] {
    return [...this._cards];
  }
}

// ─── InitDeck: 52장 셔플 덱 ──────────────────────────────────────────────────

export class InitDeck extends Deck {
  /**
   * @param gameNumber 1~32000: MS FreeCell 호환 시드 셔플 / undefined: 무작위
   */
  constructor(gameNumber?: number) {
    super();
    if (gameNumber !== undefined && gameNumber >= 1 && gameNumber <= 32000) {
      this._createWithGameNumber(gameNumber);
    } else {
      this._createAndShuffle();
    }
  }

  private _createAndShuffle(): void {
    this._cards = [];
    const figures: Figure[] = [Figure.Club, Figure.Diamond, Figure.Heart, Figure.Spade];
    for (const fig of figures) {
      for (let num = CardNumber.Ace; num <= CardNumber.King; num++) {
        const card = new Card(fig, num as CardNumber);
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
   * 카드 인덱스: 0=A♣ 1=2♣ … 12=K♣ 13=A♦ … 51=K♠
   */
  private _createWithGameNumber(gameNumber: number): void {
    const indices: number[] = [];
    for (let i = 0; i < 52; i++) indices.push(i);

    let seed = gameNumber;
    for (let i = 51; i >= 0; i--) {
      seed = (214013 * seed + 2531011) & 0x7FFFFFFF;
      const j = (seed >> 16) % (i + 1);
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }

    // indices[51]이 첫 번째 배분 카드 → pop()은 배열 끝(_cards[51])부터 반환하므로 그대로 저장
    const figures: Figure[] = [Figure.Club, Figure.Diamond, Figure.Heart, Figure.Spade];
    this._cards = indices.map(k => {
      const card = new Card(figures[Math.floor(k / 13)], (k % 13 + 1) as CardNumber);
      card.open();
      return card;
    });
  }

  canAccept(_card: Card): boolean { return false; }
}

// ─── FoundationDeck: 완성 덱 (같은 무늬 A→K) ────────────────────────────────

export class FoundationDeck extends Deck {
  private readonly _figure: Figure;

  constructor(figure: Figure) {
    super();
    this._figure = figure;
  }

  get figure(): Figure { return this._figure; }

  /**
   * 규칙:
   * - 빈 덱: 해당 무늬의 Ace만 허용
   * - 카드 있을 때: 같은 무늬 + 현재 맨 위 숫자 + 1
   */
  canAccept(card: Card): boolean {
    if (!card.isOpen) return false;
    if (card.figure !== this._figure) return false;
    if (this.isEmpty()) {
      return card.number === CardNumber.Ace;
    }
    return card.number === this.top()!.number + 1;
  }

  /** 13장이 모두 채워졌는지 */
  isComplete(): boolean { return this._cards.length === 13; }

  /** Foundation에서는 카드를 꺼낼 수 없음 (원본 동작 재현) */
  override pop(): null { return null; }
  override popMany(_n: number): Card[] { return []; }
}

// ─── FreeCellDeck: 임시 보관 덱 (1장만) ─────────────────────────────────────

export class FreeCellDeck extends Deck {
  /**
   * 규칙: 비어있을 때만 허용 (1장 제한을 객체 수준에서 강제)
   * freecell → freecell 이동은 FreecellGame에서 추가로 차단
   */
  canAccept(card: Card): boolean {
    if (!card.isOpen) return false;
    return this.isEmpty();
  }
}

// ─── TableauDeck: 태블로 컬럼 ────────────────────────────────────────────────

export class TableauDeck extends Deck {
  /**
   * 규칙:
   * - 빈 컬럼: 아무 카드나 허용
   * - 맨 위가 닫힌 카드: 항상 허용 (초기 배분 시)
   * - 맨 위가 열린 카드: 교대 색상 + 숫자 1 감소
   */
  canAccept(card: Card): boolean {
    if (!card.isOpen) return false;
    if (this.isEmpty()) return true;

    const topCard = this.top()!;
    if (!topCard.isOpen) return true; // 닫힌 카드 위에 항상 허용

    // 교대 색상 + 내림차순
    return (topCard.color !== card.color) && (card.number === topCard.number - 1);
  }

  /**
   * 맨 위 카드 제거 후 아래 카드 자동 오픈 (원본 동작 재현)
   * [원본 버그 수정] 원본 BoardDeck.setCheckMethod()는 파라미터를 무시하고 자기 자신을 대입했음
   */
  override pop(): Card | null {
    if (this.isEmpty()) return null;
    const card = this._cards.pop()!;
    if (!this.isEmpty() && !this.top()!.isOpen) {
      this.top()!.open();
    }
    return card;
  }

  /** 위에서 n장 제거 후 아래 카드 자동 오픈 (멀티카드 이동용) */
  override popMany(n: number): Card[] {
    if (n > this._cards.length) return [];
    const removed = this._cards.splice(this._cards.length - n, n);
    if (!this.isEmpty() && !this.top()!.isOpen) {
      this.top()!.open();
    }
    return removed;
  }

  /**
   * 맨 위에서 이어진 올바른 시퀀스 길이 반환
   * (멀티카드 드래그 시 최대 드래그 가능 장수 계산에 사용)
   */
  sequenceLength(): number {
    if (this.isEmpty()) return 0;
    let count = 1;
    for (let i = this._cards.length - 1; i > 0; i--) {
      const upper = this._cards[i];
      const lower = this._cards[i - 1];
      if (!upper.isOpen || !lower.isOpen) break;
      if (upper.color === lower.color) break;
      if (upper.number !== lower.number - 1) break;
      count++;
    }
    return count;
  }

  /**
   * undo 시 맨 위 카드를 다시 닫기 (pop 전에 open된 카드를 원복)
   * 이전에 닫혀있던 카드를 다시 닫음
   */
  closeTopIfNeeded(): void {
    if (!this.isEmpty()) {
      this.top()!.close();
    }
  }
}
