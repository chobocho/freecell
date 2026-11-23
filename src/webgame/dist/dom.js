// ─── DOM 도우미 ───────────────────────────────────────────────────────────
/**
 * 반드시 있어야 하는 DOM 요소를 id 로 찾는다.
 * 없으면 어떤 id 가 빠졌는지 알려주는 오류를 던진다.
 * (index.html 과 코드의 id 가 어긋났을 때, 나중에 엉뚱한 곳에서
 *  "null 의 속성을 읽을 수 없음" 으로 실패하는 대신 시작 시점에 바로 드러나게 함)
 */
export function req(id) {
    const el = document.getElementById(id);
    if (!el) {
        throw new Error(`필수 DOM 요소를 찾을 수 없습니다: #${id} (index.html 확인)`);
    }
    return el;
}
//# sourceMappingURL=dom.js.map