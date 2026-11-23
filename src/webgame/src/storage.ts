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

  /** 게임 상태 저장 */
  async save(snapshot: GameSnapshot): Promise<void> {
    if (!this.db) return;
    return new Promise((resolve) => {
      const tx  = this.db!.transaction(STORE_NAME, 'readwrite');
      const st  = tx.objectStore(STORE_NAME);
      const req = st.put(snapshot, SAVE_KEY);
      req.onsuccess = () => resolve();
      req.onerror   = () => resolve(); // 저장 실패 시 무시
    });
  }

  /** 저장된 게임 상태 불러오기 (없으면 null) */
  async load(): Promise<GameSnapshot | null> {
    if (!this.db) return null;
    return new Promise((resolve) => {
      const tx  = this.db!.transaction(STORE_NAME, 'readonly');
      const st  = tx.objectStore(STORE_NAME);
      const req = st.get(SAVE_KEY);

      req.onsuccess = () => {
        const data = req.result as GameSnapshot | undefined;
        if (!data || data.version !== SCHEMA_VER) {
          resolve(null);
          return;
        }
        resolve(data);
      };
      req.onerror = () => resolve(null);
    });
  }

  /** 저장 데이터 삭제 (새 게임 시작 시) */
  async clear(): Promise<void> {
    if (!this.db) return;
    return new Promise((resolve) => {
      const tx  = this.db!.transaction(STORE_NAME, 'readwrite');
      const st  = tx.objectStore(STORE_NAME);
      const req = st.delete(SAVE_KEY);
      req.onsuccess = () => resolve();
      req.onerror   = () => resolve();
    });
  }

  /** 랜덤 새 게임용 LFSR 상태 저장 (새 게임을 시작해도 지워지지 않음) */
  async saveLfsrState(state: number): Promise<void> {
    if (!this.db) return;
    return new Promise((resolve) => {
      const tx  = this.db!.transaction(STORE_NAME, 'readwrite');
      const req = tx.objectStore(STORE_NAME).put(state, LFSR_KEY);
      req.onsuccess = () => resolve();
      req.onerror   = () => resolve();
    });
  }

  /** 저장된 LFSR 상태 불러오기 (없거나 손상되었으면 null) */
  async loadLfsrState(): Promise<number | null> {
    if (!this.db) return null;
    return new Promise((resolve) => {
      const tx  = this.db!.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).get(LFSR_KEY);
      req.onsuccess = () => {
        const v = req.result as unknown;
        resolve(isValidLfsrState(v) ? v : null);
      };
      req.onerror = () => resolve(null);
    });
  }
}

/** 스냅샷의 저장 시각을 사람이 읽기 쉬운 문자열로 변환 */
export function formatSavedAt(savedAt: number): string {
  const d = new Date(savedAt);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getMonth() + 1}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
