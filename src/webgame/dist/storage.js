/**
 * storage.ts - IndexedDB 기반 게임 자동저장
 *
 * DB: "freecell-db" / ObjectStore: "saves" / key: "autosave"
 */
import { isValidLfsrState } from './lfsr.js';
// ─── 상수 ──────────────────────────────────────────────────────────────────
const DB_NAME = 'freecell-db';
const DB_VERSION = 1;
const STORE_NAME = 'saves';
const SAVE_KEY = 'autosave';
/** 랜덤 새 게임용 LFSR 상태 (같은 저장소, 키만 다름 → DB 버전/마이그레이션 불필요) */
const LFSR_KEY = 'lfsr';
const SCHEMA_VER = 1;
const lfsrKey = (level) => (level ? `${LFSR_KEY}:${level}` : LFSR_KEY);
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
    /**
     * 저장소에 요청 하나를 보내고 결과를 기다린다.
     * 어떤 실패(연결이 닫혀 transaction() 이 예외를 던짐, 요청 오류, 용량 초과로 트랜잭션 중단)에도
     * 거부하지 않고 fallback 으로 끝난다 — 저장이 안 되어도 게임은 계속 동작해야 한다.
     */
    _request(mode, run, fallback, map = () => fallback) {
        const db = this.db;
        if (!db)
            return Promise.resolve(fallback);
        return new Promise((resolve) => {
            try {
                const tx = db.transaction(STORE_NAME, mode);
                const req = run(tx.objectStore(STORE_NAME));
                req.onsuccess = () => resolve(map(req.result));
                req.onerror = () => resolve(fallback);
                tx.onabort = () => resolve(fallback);
            }
            catch (e) {
                console.warn('IndexedDB 요청 실패:', e);
                resolve(fallback);
            }
        });
    }
    /** 게임 상태 저장 */
    save(snapshot) {
        return this._request('readwrite', st => st.put(snapshot, SAVE_KEY), undefined);
    }
    /** 저장된 게임 상태 불러오기 (없으면 null) */
    load() {
        return this._request('readonly', st => st.get(SAVE_KEY), null, (v) => {
            const data = v;
            return data && data.version === SCHEMA_VER ? data : null;
        });
    }
    /** 저장 데이터 삭제 (새 게임 시작 시) */
    clear() {
        return this._request('readwrite', st => st.delete(SAVE_KEY), undefined);
    }
    /**
     * 새 게임용 LFSR 상태 저장 (새 게임을 시작해도 지워지지 않음)
     * @param level 난이도 이름. 생략하면 난이도 없는 랜덤용 (키 "lfsr"), 주면 "lfsr:난이도"
     */
    saveLfsrState(state, level) {
        return this._request('readwrite', st => st.put(state, lfsrKey(level)), undefined);
    }
    /** 저장된 LFSR 상태 불러오기 (없거나 손상되었으면 null) */
    loadLfsrState(level) {
        return this._request('readonly', st => st.get(lfsrKey(level)), null, (v) => (isValidLfsrState(v) ? v : null));
    }
}
/** 스냅샷의 저장 시각을 사람이 읽기 쉬운 문자열로 변환 */
export function formatSavedAt(savedAt) {
    const d = new Date(savedAt);
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getMonth() + 1}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
//# sourceMappingURL=storage.js.map