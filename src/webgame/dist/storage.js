/**
 * storage.ts - IndexedDB 기반 게임 자동저장
 *
 * DB: "freecell-db" / ObjectStore: "saves" / key: "autosave"
 */
// ─── 상수 ──────────────────────────────────────────────────────────────────
const DB_NAME = 'freecell-db';
const DB_VERSION = 1;
const STORE_NAME = 'saves';
const SAVE_KEY = 'autosave';
const SCHEMA_VER = 1;
// ─── GameStorage ───────────────────────────────────────────────────────────
export class GameStorage {
    constructor() {
        this.db = null;
    }
    /** IndexedDB 연결 초기화 */
    async init() {
        return new Promise((resolve) => {
            const req = indexedDB.open(DB_NAME, DB_VERSION);
            req.onupgradeneeded = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    db.createObjectStore(STORE_NAME);
                }
            };
            req.onsuccess = (e) => {
                this.db = e.target.result;
                resolve();
            };
            req.onerror = () => {
                console.warn('IndexedDB 초기화 실패:', req.error);
                resolve(); // 실패해도 게임은 동작 (저장 기능만 비활성)
            };
        });
    }
    /** 게임 상태 저장 */
    async save(snapshot) {
        if (!this.db)
            return;
        return new Promise((resolve) => {
            const tx = this.db.transaction(STORE_NAME, 'readwrite');
            const st = tx.objectStore(STORE_NAME);
            const req = st.put(snapshot, SAVE_KEY);
            req.onsuccess = () => resolve();
            req.onerror = () => resolve(); // 저장 실패 시 무시
        });
    }
    /** 저장된 게임 상태 불러오기 (없으면 null) */
    async load() {
        if (!this.db)
            return null;
        return new Promise((resolve) => {
            const tx = this.db.transaction(STORE_NAME, 'readonly');
            const st = tx.objectStore(STORE_NAME);
            const req = st.get(SAVE_KEY);
            req.onsuccess = () => {
                const data = req.result;
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
    async clear() {
        if (!this.db)
            return;
        return new Promise((resolve) => {
            const tx = this.db.transaction(STORE_NAME, 'readwrite');
            const st = tx.objectStore(STORE_NAME);
            const req = st.delete(SAVE_KEY);
            req.onsuccess = () => resolve();
            req.onerror = () => resolve();
        });
    }
}
/** 스냅샷의 저장 시각을 사람이 읽기 쉬운 문자열로 변환 */
export function formatSavedAt(savedAt) {
    const d = new Date(savedAt);
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getMonth() + 1}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
//# sourceMappingURL=storage.js.map