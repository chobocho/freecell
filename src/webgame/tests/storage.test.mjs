// GameStorage (가짜 IndexedDB)
import { FreecellGame } from '../dist/freecell.js';
import { GameStorage } from '../dist/storage.js';
import { suite, testAsync, assert, assertEqual } from './helpers.mjs';

suite('GameStorage - LFSR 상태 저장 (가짜 IndexedDB)');

/** 최소 기능 가짜 IndexedDB: 키-값 저장소 하나, 요청은 비동기로 완료 */
function installFakeIndexedDB() {
  const data = new Map();
  const request = (run) => {
    const req = { result: undefined, error: null, onsuccess: null, onerror: null };
    queueMicrotask(() => { req.result = run(); req.onsuccess?.({ target: req }); });
    return req;
  };
  const store = {
    put:    (v, k) => request(() => { data.set(k, v); return k; }),
    get:    (k)    => request(() => data.get(k)),
    delete: (k)    => request(() => { data.delete(k); }),
  };
  const db = {
    objectStoreNames: { contains: () => true },
    createObjectStore: () => store,
    transaction: () => ({ objectStore: () => store }),
  };
  globalThis.indexedDB = { open: () => request(() => db) };
  return data;
}


await testAsync('저장값이 없으면 loadLfsrState 는 null', async () => {
  installFakeIndexedDB();
  const st = new GameStorage();
  await st.init();
  assertEqual(await st.loadLfsrState(), null);
});

await testAsync('saveLfsrState → loadLfsrState 왕복', async () => {
  installFakeIndexedDB();
  const st = new GameStorage();
  await st.init();
  await st.saveLfsrState(12345);
  assertEqual(await st.loadLfsrState(), 12345);
});

await testAsync('손상된 저장값(범위 밖/비정수/문자열)은 null 로 처리', async () => {
  const data = installFakeIndexedDB();
  const st = new GameStorage();
  await st.init();
  for (const bad of [0, 32768, 1.5, '77', { a: 1 }]) {
    data.set('lfsr', bad);
    assertEqual(await st.loadLfsrState(), null, String(bad));
  }
});

await testAsync('새 게임 시 clear() 는 자동저장만 지우고 LFSR 상태는 유지', async () => {
  const data = installFakeIndexedDB();
  const st = new GameStorage();
  await st.init();
  const g = new FreecellGame();
  g.deal(1);
  await st.save(g.serialize(0));
  await st.saveLfsrState(321);
  assert(data.has('autosave'), '자동저장 기록됨');
  await st.clear();
  assert(!data.has('autosave'), '자동저장 삭제됨');
  assertEqual(await st.loadLfsrState(), 321);
});

await testAsync('난이도별 LFSR 상태는 서로 다른 키(lfsr, lfsr:easy …)에 따로 저장', async () => {
  const data = installFakeIndexedDB();
  const st = new GameStorage();
  await st.init();
  await st.saveLfsrState(11);
  await st.saveLfsrState(22, 'easy');
  await st.saveLfsrState(33, 'hard');
  assertEqual(await st.loadLfsrState(), 11);
  assertEqual(await st.loadLfsrState('easy'), 22);
  assertEqual(await st.loadLfsrState('medium'), null);
  assertEqual(await st.loadLfsrState('hard'), 33);
  assertEqual([...data.keys()].sort().join(','), 'lfsr,lfsr:easy,lfsr:hard');
});

await testAsync('IndexedDB 를 쓸 수 없어도(init 전) 오류 없이 null/무시', async () => {
  const st = new GameStorage();
  await st.saveLfsrState(5);
  assertEqual(await st.loadLfsrState(), null);
});

suite('GameStorage - 저장소 오류 (연결이 닫힌 뒤 등)');

/** transaction() 이 예외를 던지는 가짜 IndexedDB (연결이 닫힌 상태) */
function installClosedIndexedDB() {
  const db = {
    objectStoreNames: { contains: () => true },
    transaction: () => { throw new Error('InvalidStateError: 연결이 닫힘'); },
  };
  globalThis.indexedDB = {
    open: () => {
      const req = { result: db, error: null };
      queueMicrotask(() => req.onsuccess?.({ target: req }));
      return req;
    },
  };
}

await testAsync('transaction() 이 예외를 던져도 저장/삭제는 거부되지 않고 끝남', async () => {
  installClosedIndexedDB();
  const st = new GameStorage();
  await st.init();
  const g = new FreecellGame(); g.deal(1);
  await st.save(g.serialize(0));
  await st.clear();
  await st.saveLfsrState(7);
});

await testAsync('transaction() 이 예외를 던지면 불러오기는 null', async () => {
  installClosedIndexedDB();
  const st = new GameStorage();
  await st.init();
  assertEqual(await st.load(), null);
  assertEqual(await st.loadLfsrState(), null);
});

await testAsync('요청은 성공했지만 트랜잭션이 중단되면(용량 초과 등) 기다리던 쪽이 멈추지 않음', async () => {
  // 요청 콜백은 부르지 않고 트랜잭션 중단만 알리는 가짜 저장소
  const tx = { objectStore: () => ({ put: () => ({}), delete: () => ({}), get: () => ({}) }) };
  const db = {
    objectStoreNames: { contains: () => true },
    transaction: () => { queueMicrotask(() => tx.onabort?.()); return tx; },
  };
  globalThis.indexedDB = {
    open: () => {
      const req = { result: db, error: null };
      queueMicrotask(() => req.onsuccess?.({ target: req }));
      return req;
    },
  };
  const st = new GameStorage();
  await st.init();
  const g = new FreecellGame(); g.deal(1);
  await st.save(g.serialize(0));
  assertEqual(await st.load(), null);
});
