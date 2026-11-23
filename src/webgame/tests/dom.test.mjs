// DOM 도우미 (필수 요소 조회)
import { req } from '../dist/dom.js';
import { suite, test, assert, assertEqual } from './helpers.mjs';

suite('req: 필수 DOM 요소 조회');

/** id → 요소 맵으로 가짜 document 설치 */
function installFakeDocument(elements) {
  globalThis.document = { getElementById: (id) => elements[id] ?? null };
}

test('요소가 있으면 그 요소를 그대로 반환', () => {
  const btn = { tagName: 'BUTTON' };
  installFakeDocument({ 'btn-undo': btn });
  assertEqual(req('btn-undo'), btn);
});

test('요소가 없으면 어떤 id 가 없는지 알려주는 오류를 던진다', () => {
  installFakeDocument({ 'btn-undo': {} });
  let err = null;
  try { req('btn-missing'); } catch (e) { err = e; }
  assert(err instanceof Error, '오류 발생');
  assert(err.message.includes('#btn-missing'), `메시지에 id 포함: ${err.message}`);
});

test('빈 문자열 id 도 오류 (null 을 조용히 돌려주지 않음)', () => {
  installFakeDocument({});
  let err = null;
  try { req(''); } catch (e) { err = e; }
  assert(err instanceof Error);
});
