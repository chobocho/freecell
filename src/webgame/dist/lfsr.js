// ─── LFSR 게임 번호 순환 ─────────────────────────────────────────────────────
// 15비트 피보나치 LFSR (다항식 x^15 + x^14 + 1, 최대주기 32767).
// 0을 제외한 1~32767을 한 번씩 모두 방문한 뒤 처음으로 돌아온다.
// "현재 상태" 숫자 하나만 저장하면, 랜덤 새 게임이 한 바퀴(1~32000) 동안
// 같은 게임 번호를 다시 내지 않는다.
export const LFSR_PERIOD = 32767;
/** MS FreeCell 호환 게임 번호 상한 */
export const MAX_GAME_NUMBER = 32000;
/**
 * 번호 하나를 뽑을 때 LFSR을 전진시키는 횟수.
 * 1칸씩만 전진하면 연속 번호가 2배 관계(#100 → #200 → #401)로 보이므로 레지스터 전체를 갈아 끼운다.
 * 15와 주기 32767(= 7·31·151)은 서로소이므로 15칸씩 건너뛰어도 모든 상태를 한 번씩 방문한다.
 */
const STEPS_PER_DRAW = 15;
/** 다음 상태 (1~32767) */
export function lfsrStep(state) {
    const bit = ((state >> 14) ^ (state >> 13)) & 1;
    return ((state << 1) | bit) & 0x7FFF;
}
/** 1~32767 사이의 랜덤 시작 상태 */
export function randomLfsrState() {
    return 1 + Math.floor(Math.random() * LFSR_PERIOD);
}
/** 저장소에서 읽은 값이 유효한 LFSR 상태(1~32767 정수)인지 */
export function isValidLfsrState(v) {
    return typeof v === 'number' && Number.isInteger(v) && v >= 1 && v <= LFSR_PERIOD;
}
/**
 * LFSR 순서로 다음 게임 번호(1~32000)를 고른다.
 * 32000보다 큰 상태와 제외 번호는 건너뛴다(cycle walking) → 한 바퀴 동안 중복 없음.
 * @param state   현재 LFSR 상태 (저장된 값)
 * @param exclude 뽑지 않을 게임 번호 (풀 수 없는 판 등)
 * @returns 고른 게임 번호와 새 LFSR 상태 (새 상태를 저장해야 한다)
 */
export function nextGameNumber(state, exclude = []) {
    let s = state;
    do {
        for (let i = 0; i < STEPS_PER_DRAW; i++)
            s = lfsrStep(s);
    } while (s > MAX_GAME_NUMBER || exclude.includes(s));
    return { gameNumber: s, state: s };
}
//# sourceMappingURL=lfsr.js.map