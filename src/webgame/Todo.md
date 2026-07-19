## 목표
아래 폴더의 Android FreeCell 게임을 Web 으로 포팅할 계획 입니다.
원본 소스: c:\github2\freecell\src\cardgame\app\src\main\

## 요구사항
1. HTML5의 Canvas를 사용 하십시오.
2. 모바일에서도 동작해야 하며, 폴드7 접은 화면과 펼친 화면이 모두 타겟입니다.
3. 키보드, 마우스, 터치 스크린을 모두 지원 합니다.
4. 포팅 중 버그가 있으면 개선해 주세요.
5. 포팅 후 사운드 효과를 넣어 주세요. 반드시 무료 사운드를 이용해야 합니다.
6. 포팅 후 게임 실패시 카드가 불타거나 바람에 흩날리는 이펙트를 넣어 주세요.
7. Typescript를 사용해 주세요
8. 실행시 인터넷으로 로딩해야 하는 외부 라이브러리는 사용하면 안됩니다. 단, 사운드 효과는 무료 사운드 라이브러리를 사용할 수 있습니다.
9. 게임은 싱글 플레이어로 구현해 주세요.
10. 게임은 완성된 형태로 구현해 주세요. (게임 시작, 카드 이동, 게임 종료 등 모든 기능이 구현되어야 합니다.)
11. 게임 UI는 인터넷 검색으로 보다 좋은 UI가 있으면 참고해서 구현해 주세요.
12. 이미지 리소스는 img 폴더에 있는 것을 사용하세요.

---

## 수정 완료 (2026-07-19, 2차)
아래 2차 코드 리뷰의 모든 항목(P1~P3 버그, 음소거 버튼, 테스트 보강)을 수정 완료.
- 테스트: 94개 → 100개 통과 (`node test.mjs`)
- 릴리스 재빌드 완료 (`bash build.sh` → `release/index.html`)
- P1 수정 방식: `GameSnapshot.initialDecks`(옵션 필드)로 초기 배열을 함께 저장하고
  `restore()`에서 `_initialSnapshot` 재구성 (필드가 없는 구버전 저장본은
  `gameNumber > 0`일 때 동일 딜로 재구성 — 스키마 버전 유지로 기존 저장본 호환).
  `_doRestart()`는 `canRestart` 확인 후에만 이펙트/리셋 진행.
- 데드 코드 중 `toggleMute()`는 삭제 대신 음소거 버튼(🔊/🔇)으로 UI 연결.

## 코드 리뷰 결과 (2026-07-19, 2차)
1차 리뷰 수정 완료 후 전체 소스(src/ 8개 파일) 재검토. 테스트 94/94 통과 확인.

### 버그 (우선순위순)

#### P1 — 기능 파손
- [x] **이어하기 후 "다시 하기"가 조용히 실패 + 저장 데이터 삭제** (Node 재현 확인됨):
      `FreecellGame._initialSnapshot`은 `deal()`에서만 설정되고 `restore()`
      (`src/freecell.ts:413`)는 복원하지 않음 → 저장 게임을 이어한 세션에서
      `restart()`(`src/freecell.ts:104`)가 항상 `false` 반환.
      그런데 `_doRestart()`(`src/main.ts:389`)는 반환값을 무시하고 실패 이펙트 재생 후
      `elapsed = 0` 리셋, `storage.clear()`까지 실행 → 보드는 그대로인데 타이머가 0이 되고
      자동저장이 삭제됨.
      수정: ① 초기 배열을 스냅샷에 포함(`GameSnapshot`에 `initialDecks` 필드 추가, 스키마 v2)
      하거나 `gameNumber > 0`이면 `deal(gameNumber)`로 재구성(랜덤 게임은 ①만 가능),
      ② `_doRestart()`에서 `restart()` 실패 시 이펙트/리셋을 중단하고 안내.

#### P2 — 입력/UX
- [x] **승리 애니메이션·오버레이가 새 게임 위로 누출**: `_onWin()`(`src/main.ts:529`)의
      `showWhenDone` setTimeout 체인이 취소 불가능하고, renderer에 승리 애니메이션 중단
      API가 없음. 승리 직후(오버레이 뜨기 전) `N` 키로 새 게임을 시작하면 새 보드 위로
      옛 카드들이 계속 날아다니고, 애니메이션 종료 시 승리 오버레이가 새 게임 중에 표시됨.
      수정: `_onWin`의 타이머 ID를 보관해 `_newGame()`/`_doRestart()`에서 취소하고,
      `Renderer`에 `stopEffects()`(win/fail 카드·스파크 배열 초기화)를 추가해 함께 호출.
- [x] **키보드 `N`으로 첫 게임 시작 시 게임 전체가 무음**: `sound.init()`이 시작/이어하기
      버튼 클릭 핸들러(`src/main.ts:124-131`)에서만 호출됨. 시작 화면에서 `N` 키 →
      `_requestNewGame()` → `_newGame()` 경로는 init을 거치지 않고 이후 재호출 지점이
      없어 `play()`가 `!this._initialized`로 전부 조기 반환 → 세션 내내 소리 없음.
      수정: `_newGame()`·`_continueGame()` 진입부에서 `this.sound.init()` 호출
      (키 입력도 사용자 제스처이므로 자동재생 정책 문제 없음).
- [x] **자동 완료 중 Undo 미차단**: `_undo()`(`src/main.ts:431`)가 `_autoCompleting`을
      확인하지 않음 — 자동 완료 진행 중 Z 키/버튼으로 undo하면 다음 tick(120ms)이
      즉시 같은 수를 다시 실행해 undo가 무효화되고 moveCount만 증가. Undo 버튼도
      활성 상태로 유지됨. 수정: `_undo()` 진입부에 `if (this._autoCompleting) return;`
      추가(또는 undo 시 `_stopAutoComplete()` 호출).

#### P3 — 잠재 결함/정리
- [x] **승리 상태 undo로 상태 불일치**: `undo()`(`src/freecell.ts:188`)가 `'win'` 상태를
      허용하고 `_undo()`(`src/main.ts:431`)에 가드가 없음 — 승리 애니메이션 중 Z를 누르면
      state가 `play`로 돌아가지만 타이머는 정지, 저장은 이미 삭제된 채 플레이가 계속되고
      예약된 승리 오버레이도 나중에 표시됨. 수정: `_undo()`에서 `state === 'play'`일 때만
      허용하거나, win 진입 시점에 undo 버튼 비활성.
- [x] **`lose` 사운드 데드 코드**: `_makeLose()`(`src/sound.ts:140`)로 버퍼는 생성되지만
      `play('lose')` 호출이 코드 전체에 없음 — 실패 이펙트 시작 시(`_doRestart`,
      `src/main.ts:395`) 재생하는 것이 원래 의도로 보임.
- [x] **"다시 하기 (R)" 툴팁 오류**: `index.html:36`의 `title="다시 하기 (R)"`이지만
      `R` 키는 Foundation4 선택 키(`src/input.ts:41` `DECK_KEYS`)이고 재시작 단축키는
      존재하지 않음. 툴팁 수정 또는 다른 키(예: `Ctrl+R` 제외한 미사용 키) 배정.
- [x] **애니메이션이 프레임레이트 의존**: `_stepWinAnim`/`_stepFailAnim`
      (`src/renderer.ts:686,826`)이 rAF 콜백마다 `elapsed += 0.016` 고정 증분과 고정
      속도 적분을 사용 — 120Hz 디스플레이에서 2배속, 저사양 기기에서 슬로모션.
      `performance.now()` 기반 delta time으로 변경 권장.
- [x] **`restore()` 스냅샷 검증 부재**: `src/freecell.ts:413`이 카드 총수(52장)·중복
      여부를 검증하지 않고 저장 데이터를 신뢰 — 손상된 IndexedDB 데이터로 비정상 보드
      복원 가능(try/catch는 예외만 잡음). 카드 수/중복 검증 후 실패 시 null 반환 권장.
- [x] **데드 코드/미사용 정리**: `drawDropHint`(`src/renderer.ts:485`) 미호출,
      `GameStorage.hasSave()`(`src/storage.ts:119`) 미사용,
      `SoundManager.toggleMute()/muted`(`src/sound.ts:28-32`) 미사용,
      `DECK_KEY_LABELS`(`src/input.ts:29`)와 `KEY_LABELS`(`src/renderer.ts:12`) 중복 정의.

### 기능 추가 후보
- [x] **음소거 버튼**: `SoundManager.toggleMute()`가 이미 구현되어 있으나 UI가 없음 —
      헤더 버튼 그룹에 🔊/🔇 토글 추가만 하면 됨.

### 테스트 보강
- [x] restore 후 restart 회귀 테스트 (P1 수정과 함께): 스냅샷 복원 → `restart()`가
      `true`를 반환하고 초기 배열·moveCount 0으로 돌아가는지 검증
- [x] `restore()` 손상 스냅샷(카드 51장/중복) 거부 테스트

---

## 수정 완료 (2026-07-19, 1차)
아래 코드 리뷰의 모든 항목(P1~P3 버그, 기능 추가, 테스트 보강)을 수정 완료.
- 테스트: 87개 → 94개 통과 (`node test.mjs`)
- 릴리스 재빌드 완료 (`bash build.sh` → `release/index.html`)
- 게임 #1 딜이 MS 공식 배치와 완전 일치하도록 인코딩 수정 확인
- 추가로 발견·수정: Foundation으로 보낸 카드가 undo로 회수되지 않던 버그
  (`removeTopRaw()` 도입으로 Foundation 잠금을 우회해 회수)

## 코드 리뷰 결과 (2026-07-19, 1차)

### 요구사항 구현 현황
- [x] 1~12번 요구사항 모두 구현 완료 (Canvas 렌더링, 반응형 레이아웃, 키보드/마우스/터치,
      Web Audio 합성 사운드, 실패 시 불타며 흩날리는 이펙트, TypeScript, 외부 라이브러리 없음,
      싱글 플레이어, 완성된 게임 흐름, img 리소스 사용)
- [x] 추가 구현: IndexedDB 자동저장/이어하기, MS 게임 번호 선택, Undo, 일시정지,
      도움말(F1), Ctrl 키 힌트 오버레이, 자체 테스트 87개 통과 (`node test.mjs`)

### 버그 (우선순위순)

#### P1 — 게임 규칙/호환성
- [x] **MS 게임 번호 딜이 공식 배치와 불일치**: `src/deck.ts:137-138`
      `_createWithGameNumber()`의 카드 인코딩이 `figures[Math.floor(k / 13)], (k % 13 + 1)`
      (suit-major)인데, MS FreeCell 표준은 rank-major(`suit = k % 4`, `rank = Math.floor(k / 4) + 1`,
      무늬 순서 ♣♦♥♠)임. 검증 결과 게임 #1이 공식 배치와 52장 중 48장 불일치.
      LCG 셔플 자체(214013/2531011, `(seed >> 16) % (i + 1)`)는 정확하므로 인코딩만 수정하면 됨.
      수정: `new Card(figures[k % 4], (Math.floor(k / 4) + 1) as CardNumber)`
      → 수정 후 test.mjs에 게임 #1 공식 배치 회귀 테스트 추가 필요.
- [x] **키보드 이동이 유효한 시퀀스 길이를 무시**: `src/input.ts:251-266` `_kbMovableCount()`가
      `Math.min(deck.size(), maxCount)`를 반환하는데, 실제 맨 위 연속 시퀀스 길이
      (`TableauDeck.sequenceLength()`)를 고려하지 않음. 시퀀스보다 큰 count가 넘어가면
      `FreecellGame._isValidSequence()`에서 실패해 유효한 이동까지 거부됨.
      (예: 컬럼 10장 중 위 2장만 시퀀스, 빈 셀 충분 → count=5 → 이동 실패)
      수정: `Math.min(sequenceLength, maxCount)`로 계산하고, 목적지 수용 가능한 count로
      감소 탐색(최대→1)하면 UX가 더 좋아짐.

#### P2 — 입력/UX
- [x] **터치 후 마우스 좌표 어긋남**: `src/input.ts:62` `_canvasRect`가 touchstart에서 캐시된 뒤
      touchend/touchcancel에서 해제되지 않음. 이후 마우스 이벤트(`_onPress:273`,
      `_onMove:309`, `_onRelease:317`)가 `this._canvasRect ?? getBoundingClientRect()`로
      낡은 rect를 사용 → 터치 노트북에서 스크롤/리사이즈 후 마우스 좌표가 어긋남.
      수정: touchend/touchcancel에서 `this._canvasRect = null`.
- [x] **Esc가 도움말을 닫지 않음**: 도움말 닫기 버튼 라벨은 "닫기 (F1 / Esc)"지만
      `src/input.ts:201-211` Escape 처리에 도움말 분기가 없어 대신 `onPause()`가 호출됨
      → 도움말 위에 일시정지 오버레이가 겹침. 수정: Escape에서 도움말 열림 상태를 먼저 처리.
- [x] **확인 팝업 중 Space/Esc로 게임 재개됨**: 확인 팝업(`confirm-overlay`)이 떠 있는 동안
      Space가 `_togglePause()`를 호출해 팝업 뒤에서 게임이 재개되고 타이머가 돌기 시작함
      (`src/main.ts:390-407`). 오버레이 표시 중에는 게임 단축키를 차단해야 함.
- [x] **드래그 장수 자동 축소**: `src/main.ts:409-414` `_handleMove()`가
      `Math.min(count, maxCount)`로 count를 잘라 드래그한 카드 중 위쪽 일부만 이동될 수 있음
      → 사용자 의도와 다른 부분 이동. 이동 가능 장수를 초과하면 실패 처리(경고음)가 명확함.

#### P3 — 잠재 결함/정리
- [x] `didOpenCard` 미구현: `src/freecell.ts:150`에서 항상 `false`로 기록되고 undo에서 사용 안 함.
      `TableauDeck.pop/popMany`는 아래 카드를 자동 open하지만 undo 시 다시 닫지 않음.
      (FreeCell은 딜 직후 전 카드 open이라 현재는 발현 안 되는 잠재 결함.
      `closeTopIfNeeded()`(`src/deck.ts:259`)도 미사용 데드 코드)
- [x] `_startTimer()`(`src/main.ts:489`)에 중복 호출 가드 없음 — 기존 interval을 clear하지
      않고 새로 만들면 interval 누수. 진입부에 `this._stopTimer()` 추가 권장.
- [x] AudioContext `resume()` 미호출: `src/sound.ts:34-50` `play()`에서 컨텍스트가
      suspended 상태면 소리가 안 남(모바일 Safari에서 백그라운드 복귀 후 발생 가능).
- [x] 게임 번호 입력 검증이 무음 fallback: `src/main.ts:305-311` 범위 밖 값(0, 40000 등)을
      입력하면 안내 없이 랜덤 게임 시작. 오류 안내 또는 입력값 클램프 권장.
- [x] 히트 테스트 하드코딩: `src/input.ts:384` `cardY + 30`의 30px 최소 터치 영역이
      초소형 카드(최소 폭 16px, 높이 22px)보다 커서 컬럼 하단 바깥 클릭이 잡힐 수 있음.
      카드 높이에 비례한 값으로 변경 권장.
- [x] 데드 코드 정리: `src/renderer.ts:732` `this._failAnimating = true` 중복 대입,
      `src/main.ts:518` `void this._rafId`.

### 기능 추가
- [x] **풀 수 없는 게임 번호 입력 시 안내 후 재입력**: 게임 번호 다이얼로그
      (`src/main.ts:305-311` `_onGameNumberStart()`)에서 풀 수 없는 게임 번호가 입력되면
      "풀 수 없는 게임입니다" 노티를 표시하고 다이얼로그를 닫지 않은 채 다시 입력받도록 함.
      MS FreeCell 1~32000 중 풀 수 없는 게임은 #11982 하나뿐이므로 상수 목록
      (`UNSOLVABLE_GAMES = [11982]`)으로 검사하면 됨.
      안내 문구는 기존 `.game-number-hint` 아래 경고 스타일 텍스트로 표시 권장.
- [x] **자동 완료(Auto-Complete)**: 남은 카드가 모두 자동으로 풀리는 상태가 되면
      (다른 솔리테어 게임들처럼) 카드를 Foundation으로 자동 이동시켜 게임을 끝내는 기능.
      - 발동 조건: 매 이동 후 판정. 간단 기준은 "모든 태블로 컬럼이 내림차순으로 정렬되어
        있고 FreeCell 카드 포함 전부 Foundation으로 순서대로 올릴 수 있는 상태".
        (더 보수적인 대안: 양쪽 반대색 rank-1 카드가 이미 Foundation에 있는 카드만 올리는
        safe autoplay 규칙)
      - 구현: 기존 `autoMoveToFoundation()`(`src/freecell.ts:221`)을 타이머/애니메이션
        루프로 반복 호출 — 한 장씩 이동하는 모습이 보이도록 100~150ms 간격 권장.
        이동마다 `card_place` 사운드 재생, 완료 시 기존 `_onWin()`(`src/main.ts:438`) 흐름 연결.
      - UI: 자동 완료 가능 시점에 "자동 완료" 버튼을 띄우거나 즉시 자동 실행
        (즉시 실행이 일반적). 자동 이동 중에는 입력 차단 필요.

### 테스트 보강
- [x] MS 게임 #1 공식 배치(JD 2D 9H JC 5D 7H 7C 5H …) 회귀 테스트 (P1 인코딩 수정과 함께)
- [x] 키보드 이동 count 계산(`_kbMovableCount`) 단위 테스트
