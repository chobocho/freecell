/**
 * storage.ts - IndexedDB 기반 게임 자동저장
 *
 * DB: "freecell-db" / ObjectStore: "saves" / key: "autosave"
 */

import { isValidLfsrState } from './lfsr.js';

// ─── 저장 데이터 스키마 ────────────────────────────────────────────────────

export interface SavedCard {
  figure: number;   // Figure enum 값
  number: number;   // CardNumber enum 값
  isOpen: boolean;
}

export interface SavedDeck {
  cards: SavedCard[];
}

export interface SavedMove {
  from: number;
  to:   number;
  count: number;
  didOpenCard: boolean;
}

export interface GameSnapshot {
  version:    number;   // 스키마 버전 (하위호환용)
  savedAt:    number;   // Date.now() 타임스탬프
  gameState:  string;   // 'play' | 'pause'
  moveCount:  number;
  elapsed:    number;   // 경과 시간 (초)
  decks:      SavedDeck[];
  history:    SavedMove[];
  gameNumber: number;   // 0 = 랜덤, 1~32000 = MS FreeCell 게임 번호
  /** deal() 직후의 초기 배열 (이어하기 후 "다시 하기"용, v1 저장본에는 없을 수 있음) */
  initialDecks?: SavedDeck[];
}

// ─── 상수 ──────────────────────────────────────────────────────────────────

const DB_NAME    = 'freecell-db';
const DB_VERSION = 1;
const STORE_NAME = 'saves';
const SAVE_KEY   = 'autosave';
/** 랜덤 새 게임용 LFSR 상태 (같은 저장소, 키만 다름 → DB 버전/마이그레이션 불필요) */
const LFSR_KEY   = 'lfsr';
const SCHEMA_VER = 1;

const lfsrKey = (level?: string): string => (level ? `${LFSR_KEY}:${level}` : LFSR_KEY);

// ─── GameStorage ───────────────────────────────────────────────────────────

export class GameStorage {
  private db: IDBDatabase | null = null;

  /** IndexedDB 연결 초기화 */
  async init(): Promise<void> {
    return new Promise((resolve) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);

      req.onupgradeneeded = (e) => {
        const db = (e.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };

      req.onsuccess = (e) => {
        this.db = (e.target as IDBOpenDBRequest).result;
        resolve();
      };

      req.onerror = () => {
        console.warn('IndexedDB 초기화 실패:', req.error);
        resolve(); // 실패해도 게임은 동작 (저장 기능만 비활성)
      };
    });
  }

  /**
   * 저장소에 요청 하나를 보내고 결과를 기다린다.
   * 어떤 실패(연결이 닫혀 transaction() 이 예외를 던짐, 요청 오류, 용량 초과로 트랜잭션 중단)에도
   * 거부하지 않고 fallback 으로 끝난다 — 저장이 안 되어도 게임은 계속 동작해야 한다.
   */
  private _request<T>(
    mode: IDBTransactionMode,
    run: (store: IDBObjectStore) => IDBRequest,
    fallback: T,
    map: (result: unknown) => T = () => fallback,
  ): Promise<T> {
    const db = this.db;
    if (!db) return Promise.resolve(fallback);
    return new Promise<T>((resolve) => {
      try {
        const tx  = db.transaction(STORE_NAME, mode);
        const req = run(tx.objectStore(STORE_NAME));
        req.onsuccess = () => resolve(map(req.result));
        req.onerror   = () => resolve(fallback);
        tx.onabort    = () => resolve(fallback);
      } catch (e) {
        console.warn('IndexedDB 요청 실패:', e);
        resolve(fallback);
      }
    });
  }

  /** 게임 상태 저장 */
  save(snapshot: GameSnapshot): Promise<void> {
    return this._request<void>('readwrite', st => st.put(snapshot, SAVE_KEY), undefined);
  }

  /** 저장된 게임 상태 불러오기 (없으면 null) */
  load(): Promise<GameSnapshot | null> {
    return this._request<GameSnapshot | null>('readonly', st => st.get(SAVE_KEY), null, (v) => {
      const data = v as GameSnapshot | undefined;
      return data && data.version === SCHEMA_VER ? data : null;
    });
  }

  /** 저장 데이터 삭제 (새 게임 시작 시) */
  clear(): Promise<void> {
    return this._request<void>('readwrite', st => st.delete(SAVE_KEY), undefined);
  }

  /**
   * 새 게임용 LFSR 상태 저장 (새 게임을 시작해도 지워지지 않음)
   * @param level 난이도 이름. 생략하면 난이도 없는 랜덤용 (키 "lfsr"), 주면 "lfsr:난이도"
   */
  saveLfsrState(state: number, level?: string): Promise<void> {
    return this._request<void>('readwrite', st => st.put(state, lfsrKey(level)), undefined);
  }

  /** 저장된 LFSR 상태 불러오기 (없거나 손상되었으면 null) */
  loadLfsrState(level?: string): Promise<number | null> {
    return this._request<number | null>('readonly', st => st.get(lfsrKey(level)), null,
      (v) => (isValidLfsrState(v) ? v : null));
  }
}

/** 스냅샷의 저장 시각을 사람이 읽기 쉬운 문자열로 변환 */
export function formatSavedAt(savedAt: number): string {
  const d = new Date(savedAt);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getMonth() + 1}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
