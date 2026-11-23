# 개발 이력

## 2026-04-11

### Todo.md 요구사항 분석 및 구현 계획 수립
- 원본 Android FreeCell 소스 분석 (Java → TypeScript 포팅)
- 원본 버그 3건 발견 및 수정 계획 수립

### TypeScript 환경 설정
- `tsconfig.json` 생성 (target: ES2020, strict 모드)
- 폴더 구조: `src/` (TS 소스) → `dist/` (컴파일 출력)
- TypeScript 5.9.3 로컬 컴파일러 사용 (외부 라이브러리 없음)

### 1단계: 게임 로직 구현

**src/card.ts**
- `Color`, `Figure`, `CardNumber` enum 정의
- `Card` 클래스: 색상, 무늬, 숫자, 오픈/닫기, 이미지명(`imageName`) 계산

**src/deck.ts**
- `DeckIndex` enum: Foundation(0~3), FreeCell(4~7), Tableau(8~15)
- `Deck` 추상 클래스 + 4가지 구체 구현
  - `InitDeck`: Fisher-Yates 셔플 52장
  - `FoundationDeck`: 같은 무늬 오름차순 (Ace→King)
  - `FreeCellDeck`: 1장만 허용 (객체 수준 강제)
  - `TableauDeck`: 교대 색상 + 내림차순, pop 시 아래 카드 자동 오픈

**원본 버그 수정:**
1. `BoardDeck.setCheckMethod()` - 파라미터 무시하고 자기 자신 대입 → TypeScript 타입 시스템으로 원천 차단
2. `MoveCommand.toStinrg()` - 오타 메서드명 → TypeScript로 정확히 구현
3. `PlayState` - undo가 moveCount를 증가시키는 의미 오류 → undo 시 moveCount 증가 안함

**src/freecell.ts**
- `FreecellGame`: 게임 상태 머신 (`idle` → `play` ↔ `pause` → `win`)
- 카드 배분: 컬럼 1~4에 7장, 컬럼 5~8에 6장
- 멀티카드 이동 공식: `(빈 FreeCell + 1) × 2^(빈 Tableau)` 적용
- `undo()`: 이동 이력 스택 기반 취소
- `autoMoveToFoundation()`: 더블클릭/더블탭 자동 이동

### 테스트

**test.mjs** (Node.js ES module 유닛 테스트)
- Card 클래스: 13개 테스트
- InitDeck: 4개 테스트
- FoundationDeck: 7개 테스트
- FreeCellDeck: 3개 테스트
- TableauDeck: 8개 테스트
- FreecellGame 기본 구조: 7개 테스트
- FreecellGame 이동 규칙: 6개 테스트
- FreecellGame Undo: 4개 테스트
- FreecellGame 승리 판정: 3개 테스트
- FreecellGame 상태 머신: 3개 테스트
- maxMovableCount 공식: 7개 테스트
- **합계: 65개 전체 통과**

**test.html** (브라우저 유닛 테스트 - dist/ ES module 로드)

### 2단계: 렌더링 + UI

**src/renderer.ts**
- `calcLayout()`: 화면 크기별 반응형 레이아웃 계산 (카드 40~100px)
- `loadImages()`: 52장 카드 이미지 + 뒷면 + 배경 비동기 preload
- `Renderer`: Canvas 2D 렌더링
  - Foundation/FreeCell/Tableau 각 덱 타입별 그리기
  - 드래그 중인 카드 그림자 효과로 표시
  - 빈 슬롯에 무늬 힌트(♣♦♥♠) 및 FREE 텍스트 표시
  - devicePixelRatio 대응 (고해상도 디스플레이)
- 승리 이펙트: Foundation 카드 포물선 날리기
- 패배 이펙트: 카드 바람에 흩날리기 + 불꽃 파티클

**css/style.css**
- 반응형 레이아웃 (Galaxy Fold 7 접힘 ≤360px ~ 데스크톱)
- 다크 그린 테마 (카드 게임 전통 색상)
- 시작/일시정지/승리 오버레이

**index.html**
- 헤더: 이동 횟수, 타이머, 되돌리기/일시정지/새 게임 버튼
- Canvas 영역
- 시작 화면, 일시정지 화면, 승리 화면 오버레이

### 3단계: 입력 처리

**src/input.ts**
- 마우스 드래그앤드롭 (mousedown → mousemove → mouseup)
- 터치 드래그앤드롭 (touchstart → touchmove → touchend)
- 더블클릭 / 더블탭 자동 Foundation 이동
- 키보드: Z=되돌리기, N=새 게임, Space/Esc=일시정지
- 멀티카드 히트 테스트: 카드 중앙/좌/우/위 4개 지점 검사

### 4단계: 사운드

**src/sound.ts**
- Web Audio API 기반 프로그래매틱 사운드 합성 (외부 파일/라이브러리 불필요)
- `card_place`: 카드 놓기 소리 (노이즈+저음 펄스)
- `card_flip`: 카드 뒤집기 소리 (주파수 상승 슬라이드)
- `win`: 승리 팡파레 (도-미-솔-도 상승 멜로디)
- `lose`: 패배음 (하강 멜로디)
- `invalid`: 이동 불가 경고음
- 첫 사용자 제스처 후 초기화 (브라우저 자동재생 정책 대응)

### 5단계: 통합 (src/main.ts)
- `GameController`: 모든 모듈 통합
- 게임 시작/종료/일시정지/되돌리기 흐름 관리
- ResizeObserver로 화면 크기 변경 감지 및 레이아웃 재계산
- requestAnimationFrame 기반 60fps 렌더 루프
- 승리 시 2초 애니메이션 후 승리 오버레이 표시

## 2026-04-11 (추가)

### IndexedDB 자동저장 / 이어하기 기능

**src/storage.ts** (신규)
- `GameStorage` 클래스: IndexedDB "freecell-db" 기반 저장/불러오기/삭제
- 저장 키: `"autosave"` (단일 슬롯)
- `GameSnapshot` 인터페이스: 16개 덱 전체 + 이동 이력 + 경과시간 + 버전 정보
- 스키마 버전 관리 (버전 불일치 시 저장 무효 처리)
- `formatSavedAt()`: 저장 시각을 "MM/DD HH:mm" 형식으로 변환

**src/freecell.ts** (추가)
- `serialize(elapsed)`: 현재 게임 상태 → `GameSnapshot` 변환
- `restore(snapshot)`: `GameSnapshot` → 게임 상태 복원, 경과시간 반환

**src/main.ts** (수정)
- 이동/undo마다 `_scheduleSave()` 호출 (디바운스 800ms)
- 일시정지 시 즉시 저장
- `pagehide` / `beforeunload` / `visibilitychange` 이벤트에서 즉시 저장
- 시작 화면 진입 시 저장 여부 확인 → 이어하기 버튼/저장 정보 표시
- 새 게임 시작 / 승리 완료 시 저장 데이터 삭제
- 저장 완료 시 토스트 알림 1.5초 표시

**index.html / style.css** (수정)
- 시작 화면에 "이어하기" 버튼 추가 (저장 없으면 숨김)
- 저장 정보 표시 (저장 시각 · 이동 횟수 · 경과 시간)
- 자동저장 토스트 알림 스타일

**테스트 추가** (test.mjs): 직렬화/복원 케이스 7개
- **합계: 72개 전체 통과**

## 2026-04-11 (추가 2)

### F1 단축키 도움말 화면 추가

**src/input.ts** (수정)
- `InputCallbacks`에 `onHelp(): void` 콜백 추가
- 키보드 핸들러에 `F1` 케이스 추가 → `onHelp()` 호출

**src/main.ts** (수정)
- `helpOverlay` 필드 및 `_setupDOM()`에서 초기화
- `onHelp` 콜백 연결 (`_toggleHelp()` 호출)
- `help-close-btn` 클릭 이벤트 바인딩
- `_hideAllOverlays()`에 `helpOverlay` 추가
- `_toggleHelp()` 메서드: 도움말 열기/닫기, 게임 중 타이머 자동 일시정지/재개

**index.html** (수정)
- `#help-overlay` 패널 추가 (단축키 테이블, 마우스/터치 조작, 게임 규칙, 닫기 버튼)

**css/style.css** (수정)
- `.help-panel`, `.help-table`, `kbd`, `.help-rules` 스타일 추가

**테스트**: 기존 72개 전체 통과 (신규 케이스 없음)

## 2026-04-11 (추가 3)

### 키보드 전용 플레이 + Ctrl 키 힌트 오버레이

**src/renderer.ts** (수정)
- `KeyboardSelectState` 인터페이스 추가 (순환 참조 방지를 위해 여기서 정의)
- `KEY_LABELS`: 덱 인덱스 → 키 레이블 매핑 (화면 배치 순서와 일치)
- `render()` 에 `kbState?` 파라미터 추가
- `_drawKbHighlight()`: 선택된 소스 덱에 황금 테두리 + 옅은 오버레이
- `_drawKeyOverlay()`: Ctrl 누르는 동안 전체 화면 다크 오버레이 + 각 슬롯에 키 배지
- `_drawKeyLegend()`: 오버레이 하단 범례 (전체 키 매핑 안내)

**src/input.ts** (수정)
- `DECK_KEY_LABELS`, `DECK_KEYS` 상수 추가 (화면 배치 일치 키 매핑)
  - Foundation: `Q W E R`, FreeCell: `U I O P`, Tableau: `1-8`
- `_kbState: KeyboardSelectState` 필드 추가
- `getKeyboardState()` 메서드 추가
- `_handleDeckKey()`: 소스 선택 → 이동 흐름 처리
- `_kbMovableCount()`: 키보드 이동 시 카드 수 결정
- Ctrl `keydown/keyup` 추적 (오버레이 표시용)
- `Enter`: 선택된 덱 → Foundation 자동이동
- `Esc`: 키보드 선택 취소 우선, 이후 드래그 취소, 일시정지 순서

**src/main.ts** (수정)
- `render()` 호출 시 `input.getKeyboardState()` 전달

**index.html** (수정)
- 도움말 패널에 키보드 카드 조작 섹션 추가 (키 배치 표, 조작 설명)
- Ctrl 힌트 오버레이 설명 추가

**테스트**: 기존 72개 전체 통과

### 빌드 방법
```bash
tsc          # 단일 컴파일
tsc --watch  # 감시 모드
node test.mjs  # 유닛 테스트 실행
```

## 2026-04-12

### 게임 번호 선택 기능 (MS FreeCell 호환 RNG)

**src/deck.ts** (수정)
- `InitDeck` 생성자에 `gameNumber?: number` 파라미터 추가
- MS FreeCell 호환 선형 합동 생성기(LCG) 구현: `seed = (214013 * seed + 2531011) & 0x7FFFFFFF`
- `gameNumber` 지정 시 해당 시드로 셔플, 미지정 시 `Math.random()` 무작위 셔플

**src/freecell.ts** (수정)
- `_gameNumber` 필드 추가 (0 = 랜덤)
- `deal(gameNumber?: number)`: 게임 번호 저장 및 `InitDeck`에 전달
- `restart()`: `_initialSnapshot`에서 초기 배치 복원 (다시 하기 기능)
- `serialize()` / `restore()`: `gameNumber` 필드 직렬화/복원 지원

**src/main.ts** (수정)
- 새 게임 클릭 → 게임 번호 입력 오버레이 표시
- 번호 입력 후 시작 → 해당 번호로 `deal()` 호출
- 헤더에 현재 게임 번호 표시 (`#game-number-display`)

**index.html** (수정)
- `#game-number-overlay` 추가: 숫자 입력 필드 (1~32000, 비우면 랜덤) + 시작/취소 버튼
- 헤더 `<h1>`에 `<span id="game-number-display">` 추가

**css/style.css** (수정)
- `.game-number-input-wrap`, `.game-number-input`, `.game-number-hint` 스타일 추가

**src/input.ts** (수정)
- 게임 번호 입력 필드에 포커스 중일 때 게임 단축키(N, Z, Space 등) 비활성화
- 창 포커스 잃을 때 `ctrlHeld` 상태 초기화 (오버레이 잠금 방지)

**테스트 추가** (test.mjs): 기존 72개 전체 통과

### 터치 드래그 버그 수정 (solitaire_web 참고)

**src/input.ts** (수정)
- `_canvasRect: DOMRect | null` 필드 추가
- `touchstart`에서 `getBoundingClientRect()` 캐시 → URL 바 숨김/표시 시 좌표 불일치 방지
- 좌표 이중 변환 버그 수정: `_bindTouch`에서 `t.clientX/Y`를 직접 전달 (기존 `pos.x/y` 이중 차감 제거)
- `_onPress`: 클릭 지점부터 덱 맨 위까지 카드 전체 grab (중간 카드 잡기 지원)
- 히트 영역 최소값 30px로 확대 (기존 20px)

**src/renderer.ts** (수정)
- `_drawTableaus()`: 드래그 중인 카드를 원위치에 25% 알파(고스트)로 표시
- `calcLayout()` 반응형 패딩/갭 공식 개선: 좁은 화면(Galaxy 분할)에서 카드 오버플로우 방지

**src/freecell.ts** (수정)
- `deal()`: 모든 태블로 카드 앞면 공개 (FreeCell 규칙 — Klondike와 달리 뒷면 카드 없음)
- `moveCard()` / `undo()`: `didOpenCard` 관련 데드코드 제거 (FreeCell은 항상 앞면)

**css/style.css** (수정)
- `#game-canvas`에 `touch-action: none` 직접 지정 (부모 상속 불가 문제 해결)
- `#header`, `.btn-group`에 `flex-wrap: wrap` 추가
- 반응형 미디어 쿼리 (solitaire_web 패턴 참고):
  - `≤600px`: 헤더 패딩/폰트 축소
  - `≤400px`: `.btn-label` 숨김, `#game-number-display` 숨김
  - `≤320px`: 마지막 stat-item 숨김

**index.html** (수정)
- 버튼 텍스트를 `<span class="btn-label">` 으로 감싸 좁은 화면에서 선택적 숨김

**테스트 추가** (test.mjs)
- "FreeCell: 태블로 모든 카드 앞면 공개" 테스트로 교체

## 2026-04-13

### 테스트 케이스 확충 (87개)

**test.mjs** (수정)
- **이동/Undo 후 카드 앞면 유지**: `moveCard` 및 `undo` 후 모든 태블로 카드 앞면 유지 검증 (2개)
- **autoMoveToFoundation**: 에이스 자동이동 성공, King 이동 불가, Foundation에서 호출, `isAutoMovable` true/false (5개)
- **게임 번호 & restart**: `gameNumber` 1/32000/0(랜덤), 같은 번호 → 동일 배치, 다른 번호 → 다른 배치, `restart()` 초기 배치 복원·`gameNumber` 유지·`deal()` 전 false 반환 (8개)
- **합계: 87개 전체 통과**

## 2026-11-23

### 한글 IME 상태에서 단축키 미동작 수정 (solitaire_web 참고)

**src/input.ts** (수정)
- 키 매핑을 `e.key` → `e.code`(물리 키 위치) 기반으로 변경: `DECK_KEYS` → `DECK_CODES` (KeyQ/W/E/R, KeyU/I/O/P, Digit1~8)
- 한글 입력 상태에서는 `e.key`가 `ㅂ`·`Process`로 들어와 Q/W/E/R, U/I/O/P, Z, N이 동작하지 않던 문제 해결
- 숫자 키패드(Numpad1~8)로 Tableau 선택, NumpadEnter로 자동 이동 지원
- `keyCodeOf()` 추가: `e.code`가 비어 있는 환경(일부 가상 키보드)은 `e.key`로 대체 인식

**index.html / README.md** (수정): 숫자 키패드·한글 입력 상태 동작 안내 추가

### 멀티터치 드래그 가로채기 방지 (solitaire_web 참고)

**src/input.ts** (수정)
- `_activeTouchId` 추가: 드래그를 시작한 손가락의 `identifier`만 추적 (`_findActiveTouch`)
- 드래그 중 두 번째 손가락의 touchstart/touchmove/touchend/touchcancel 무시
  - 기존: `changedTouches[0]`만 사용해 두 번째 손가락이 드래그를 바꾸거나, 떼는 위치에 카드가 놓이거나, 더블탭 자동이동이 오발동

**test.mjs** (수정)
- 가짜 window/canvas로 실제 `InputHandler` + `Renderer`를 구동하는 입력 테스트 추가
- 키보드 11개 + 터치 8개 추가 → **합계 119개 전체 통과** (`tsc && node test.mjs`)
- 미확인: 실제 기기(한글 IME 키보드, 터치스크린)에서의 동작

### 랜덤 새 게임의 게임 번호 순환 — LFSR (solitaire_web 참고)

**src/lfsr.ts** (신규)
- 15비트 최대주기 LFSR(x^15 + x^14 + 1, 주기 32767). solitaire_web은 11비트(주기 2047)라 1~32000에 맞게 확장
- `nextGameNumber(state, exclude)`: 32000 초과 상태와 제외 번호는 건너뛰어(cycle walking) 한 바퀴 동안 중복 없이 번호 선택
- 번호 1개당 LFSR을 15칸 전진: 1칸씩이면 연속 번호가 2배 관계(#100 → #200 → #401)로 보이기 때문. 15와 32767은 서로소라 전체 주기 유지
- `randomLfsrState()`, `isValidLfsrState()` 제공

**src/storage.ts** (수정)
- `saveLfsrState()` / `loadLfsrState()` 추가: 같은 `saves` 저장소에 키 `lfsr`로 숫자 1개 저장 (DB 버전/마이그레이션 없음)
- 새 게임 시 `clear()`는 자동저장만 지우므로 LFSR 상태는 유지됨

**src/main.ts** (수정)
- 게임 번호를 비워두고 시작하면 `Math.random` 셔플(번호 없음) 대신 LFSR로 고른 1~32000 번호로 시작
  - 랜덤 게임도 헤더에 `#번호`가 표시되어 같은 판을 번호로 다시 할 수 있음
  - 풀 수 없는 #11982는 제외. 저장값이 없으면 랜덤 위치에서 시작
- 시작할 때마다 전진하므로 포기한 판도 한 바퀴 동안은 다시 나오지 않음

**bundle.js / index.html / README.md** (수정): 번들 모듈 순서에 `lfsr` 추가, 안내 문구 갱신

**test.mjs** (수정)
- LFSR 10개(전체 주기, 한 바퀴 32000판 중복 없음·전부 등장, 제외 번호 등) + 가짜 IndexedDB로 저장소 5개 추가
- **합계 134개 전체 통과**, `build.sh` 릴리스 빌드 성공
- 미확인: 실제 브라우저에서의 동작(IndexedDB 저장 후 새로고침 시 이어지는지)

### 난이도 선택 (하/중/상) — 솔버로 32000판 분류 (solitaire_web 참고)

**src/solver.ts** (신규, 릴리스 번들에는 미포함)
- FreeCell 솔버: 휴리스틱 최선 우선 탐색 + 방문 상태 메모(열/프리셀 정렬로 대칭 제거) + 안전한 파운데이션 자동 이동
- 여러 장 이동(슈퍼무브)을 실제 게임의 이동 가능 장수 공식 그대로 탐색. 풀이는 `moveCard(from, to, count)`에 바로 넣을 수 있는 형태
- 탐색 성향(가중치) 3종 `SOLVER_PROFILES`. `measure()`는 세 성향 중 가장 적게 탐색한 값을 난이도 지표로 사용
- 휴리스틱에서 가장 효과가 컸던 항목: "같은 열에서 자기보다 낮은 카드를 깔고 있는 카드 수"
- solitaire_web의 클론다이크 솔버는 규칙이 달라 재사용하지 못하고 새로 작성

**scripts/gen-levels.mjs** (신규)
- 게임 #1~#32000을 워커 스레드 16개로 풀어 `src/levels.ts` 생성 (약 22분, 상한 30000 상태)
- 결과: 32000판 중 30189판 풀이 확인, 1811판은 상한 안에 미해결
- 풀린 판의 탐색 상태 수로 3등분: 하 ≤115 (10740판) / 중 ≤319 (10597판) / 상 (10663판, 미해결 포함)
- 미해결 판을 버리지 않고 "상"에 넣은 이유: MS 1~32000은 #11982 외에는 모두 풀리는 판으로 알려져 있음
- 재생성: `tsc && node scripts/gen-levels.mjs && tsc`. 게임별 측정값 `scripts/levels-nodes.json`은 git 제외

**src/levels.ts** (자동 생성) / **src/difficulty.ts** (신규)
- 난이도 표: 3판을 한 글자(판당 2비트)로 묶어 10667자 문자열로 저장
- `difficultyOf(번호)`, `nextGameNumberOfDifficulty(난이도, 상태, 제외)`: LFSR 번호 순환에서 해당 난이도 번호만 선택
  → 그 난이도의 약 1만 판을 한 번씩 다 할 때까지 같은 번호가 나오지 않음
- solitaire_web은 난이도별 2000판 목록 방식이지만, 여기서는 32000판 전체를 분류해 목록 없이 처리

**src/storage.ts / src/main.ts / index.html / css/style.css / bundle.js** (수정)
- 새 게임 창에 "랜덤 / 하 / 중 / 상" 버튼 추가. 번호를 비워두고 시작하면 고른 난이도에서 번호를 선택
- 선택은 localStorage(`freecell-difficulty`)에 기억. LFSR 상태는 선택 방식별로 따로 저장(`lfsr`, `lfsr:easy` …)
- 헤더에 `#번호 난이도` 표시 (직접 입력한 번호에도 난이도 표시)

**test.mjs** (수정)
- 솔버 12개(풀이를 실제 게임에 재생해 승리 확인 등) + 난이도 10개 + 저장소 1개 추가 → **합계 157개 전체 통과**
- `build.sh` 릴리스 빌드 성공(솔버는 번들에 없음, 난이도 표는 포함)
- 미확인: 실제 브라우저에서의 화면 동작(난이도 버튼, 헤더 표시). 헤드리스 브라우저 확인은 실행 권한 문제로 하지 못함
- 한계: 난이도는 "솔버가 헤맨 정도"이며 사람이 느끼는 난이도와 다를 수 있음

### 포기 버튼 + 패배 오버레이 (solitaire_web 참고)

**src/freecell.ts** (수정)
- `GameState`에 `lost` 추가, `giveUp()` 추가 (play/pause → lost, 그 외 상태에서는 false)
- lost 상태에서는 이동·되돌리기·일시정지·자동 완료 불가. `restart()`(같은 배열) 또는 `deal()`(새 게임)로만 벗어남
- 카드 배치·이동 횟수·게임 번호는 유지 → 결과 표시와 같은 판 다시 하기 가능

**src/main.ts** (수정)
- 헤더 "✕ 포기" 버튼 → 확인 창("정말 포기하시겠습니까?") → 타이머 정지, 자동저장 삭제, 패배 효과음, 불·바람 이펙트
- 이펙트가 끝나면 패배 오버레이 표시: 게임 번호·이동 횟수·시간 + "같은 판 다시 하기" / "새 게임"
  - solitaire_web은 "새 게임"만 있으나, FreeCell은 같은 배치를 다시 할 수 있어 버튼 추가
- 포기 직후 예약된 자동저장을 취소해 이어하기가 되살아나지 않게 함
- 포기 버튼은 진행 중(play/pause)일 때만 활성. 자동 완료 중에는 무시
- 포기한 상태에서 헤더 "다시 하기"는 확인 없이 바로 같은 판 재시작
- 게임 번호 창을 열 때 예약된 승리/패배 오버레이 표시를 취소 (이펙트 중 N 키로 창을 열면 결과 오버레이가 겹쳐 뜨던 문제)

**src/renderer.ts** (수정): lost 상태에서는 이펙트가 끝난 뒤에도 카드를 다시 그리지 않음

**index.html / css/style.css / README.md** (수정): 포기 버튼, 패배 오버레이, 도움말 안내 추가

**test.mjs** (수정)
- 포기 상태 테스트 14개 추가 → **합계 171개 전체 통과**, `build.sh` 릴리스 빌드 성공
- 미확인: 실제 브라우저에서의 화면 동작(버튼 배치, 이펙트 후 오버레이). 좁은 화면(400px 이하)에서 헤더 버튼이 하나 늘어난 영향도 미확인

### 수동 자동 올리기 버튼 (solitaire_web 참고)

**src/freecell.ts** (수정)
- `hasFoundationMove()`: 진행 중인 판에서 Foundation으로 올릴 카드가 있는지
- `autoMoveOne()`: 올릴 수 있는 카드 한 장을 올리고 출발 덱을 반환 (FreeCell → Tableau 순). 반복 호출하면 연쇄까지 모두 올라감
- play 상태에서만 동작 (일시정지·포기·승리 상태에서는 false / null)

**src/main.ts / src/input.ts** (수정)
- 헤더 "⤒ 자동 올리기" 버튼과 `A` 키 추가 (한글 입력 상태에서도 동작, Ctrl+A는 브라우저에 맡김)
- 지금 올릴 수 있는 카드를 연쇄까지 한 장씩(120ms 간격) Foundation으로 올림. 판을 끝낼 수 없는 상태여도 동작하고, 더 올릴 카드가 없으면 멈춤
- 기존 "끝낼 수 있으면 자동 완료"는 그대로 유지. 두 기능이 같은 진행 루프를 사용
- 올릴 카드가 없으면 버튼 비활성, 키로 누르면 실패 효과음
- 올린 카드는 한 장씩 되돌리기 가능 (한 번에 묶어서 되돌리지는 않음)
- solitaire_web은 한 번에 모두 옮기지만, 여기서는 기존 자동 완료와 같은 한 장씩 방식으로 통일
- 함께 수정: 자동 올리기 도중 새 게임/다시 하기를 하면 진행 루프가 새 판의 카드를 계속 올리던 문제 → 판이 바뀔 때 루프를 중단
- 함께 수정: 자동 올리기가 승리 없이 멈춘 경우에도 자동저장 예약

**index.html / css/style.css / README.md** (수정): 버튼, 도움말, 단축키 표 추가

**test.mjs** (수정)
- 테스트 9개 추가 (게임 로직 7, 입력 2) → **합계 180개 전체 통과**, `build.sh` 릴리스 빌드 성공
- 미확인: 실제 브라우저에서의 화면 동작. 헤더 버튼이 7개가 되어 좁은 화면에서의 줄바꿈 확인 필요
- 테스트로 다루지 못한 부분: `main.ts`의 진행 루프(타이머)와 버튼 활성 상태 갱신은 DOM이 필요해 자동 테스트가 없음

### 릴리스 빌드를 esbuild IIFE 번들로 전환 (solitaire_web 참고)

**build.sh / build.bat** (수정)
- 빌드 순서: `tsc` → esbuild로 `dist/main.js`를 IIFE 하나로 묶음 → `bundle.js`가 단일 HTML로 조립
- esbuild 명령은 `ESBUILD` 환경 변수로 바꿀 수 있음 (기본 `npx --yes esbuild`, 처음 한 번 내려받음)
- solitaire_web은 `src/main.ts`를 묶지만, 여기서는 `dist/main.js`를 묶음 → 테스트가 검증한 것과 같은 코드가 릴리스에 들어감

**bundle.js** (재작성)
- 삭제: 수동 모듈 순서 목록(`MODULE_ORDER`), 정규식으로 import/export를 지우던 처리, 번들 안의 이미지 로더 줄을 정규식으로 바꿔치던 처리
- 조립 로직을 `assemble()` 함수로 분리해 테스트 가능하게 함
- 빌드 실패로 처리하는 경우 추가: index.html에 교체할 태그가 없음 / 번들에 `</script`가 있음 / import·export가 남아 있음 / 번들 문법 오류
- 넣는 코드에 `$&`, `$1` 같은 문자열이 있어도 바뀌지 않도록 치환 방식을 함수로 변경
- 릴리스 스크립트는 `<script type="module">` 대신 일반 `<script>`(IIFE, strict)

**src/renderer.ts** (수정)
- `loadImages()`가 내장 이미지 맵(`window.__IMG__`)을 직접 확인 → 빌드 때 코드를 고쳐 쓰지 않아도 됨. 맵이 없으면(개발 실행) 기존대로 `img/`에서 불러옴

**test.mjs / README.md** (수정)
- 테스트 7개 추가 (`loadImages` 2, `assemble` 5) → **합계 187개 전체 통과**
- README에 릴리스 빌드 방법 추가

**검증**
- `build.sh`, `build.bat` 모두 실행해 `release/index.html` 생성 확인 (캐시된 esbuild 0.28.2, `--no-install`)
- 솔버는 번들에 없음, 난이도 표는 포함. 릴리스 크기 220.7KB (이전과 비슷)
- 릴리스 파일을 로컬 서버(127.0.0.1)로 띄워 Chrome에서 확인: 콘솔 오류 없음, 서버 요청은 index.html뿐(이미지 내장 동작),
  난이도 "하" 새 게임, 키보드 이동, `A` 자동 올리기, 포기 → 패배 화면 → 같은 판 다시 하기까지 정상
- 미확인: esbuild를 처음 내려받는 경로(`npx --yes`), 좁은 화면 레이아웃(창이 최대화 상태라 크기 변경 불가), 터치 입력

### 파비콘 추가 및 릴리스에 내장 (solitaire_web 참고)

**img/icon.png** (신규) / **scripts/gen-icon.mjs** (신규)
- `index.html`이 `img/icon.png`를 가리키고 있었지만 파일이 없었음(개발 실행 시 404, 릴리스에서는 태그 삭제) → 아이콘을 새로 만듦
- 초록 바탕에 금색 스페이드, 192×192 PNG, 약 2KB. 헤더 로고 "♠ FreeCell"과 같은 색
- 외부 도구 없이 Node 스크립트로 도형을 그려 생성 (`node scripts/gen-icon.mjs`로 재생성)
- solitaire_web의 아이콘(킹 카드 두 장)은 가져오지 않음: 두 게임의 탭 아이콘이 같아지는 것을 피함

**bundle.js** (수정)
- `assemble()`에 `icon` 인자 추가: 있으면 파비콘 태그의 href를 data URI로 교체, 없으면 기존처럼 태그 삭제
- `icon.png`는 게임이 쓰는 이미지 맵(`__IMG__`)에서 제외 (중복 내장 방지)
- `img/icon.png`가 없으면 경고를 출력하고 파비콘 없이 빌드

**test.mjs** (수정)
- 테스트 3개 추가 (파비콘 내장 / 없을 때 태그 삭제 / 아이콘 파일 검사) → **합계 190개 전체 통과**

**검증**
- `build.sh` 빌드 성공: 223.4KB (이전 220.7KB), 이미지 53장 + 파비콘 내장
- 릴리스 파일을 Chrome에서 확인: 파비콘이 192×192 이미지로 읽히고, 콘솔 오류 없음, 서버 요청은 index.html 하나뿐(이전에는 favicon.ico 요청이 404)
- 미확인: 브라우저 탭에 실제로 표시된 모양(자동화 화면에 탭 영역이 잡히지 않음), `build.bat`은 이번 변경 후 다시 실행하지 않음(변경은 공용 `bundle.js`에만 있음)

### 테스트 파일 분리 + `node --test` 전환 (solitaire_web 참고)

**tests/** (신규) / **test.mjs** (삭제)
- 한 파일(1946줄)이던 `test.mjs`를 주제별 10개 파일로 분리: deck, game, game-number, game-save, input, lfsr, solver, difficulty, storage, build
- 직접 만든 테스트 프레임워크(통과/실패 집계, 색상 출력)를 없애고 Node.js 내장 러너 `node --test` 사용
- `tests/helpers.mjs`: `suite()/test()/testAsync()/assert()/assertEqual()`를 `node:test` 위에 얇게 구현 → 테스트 본문은 한 줄도 고치지 않고 그대로 옮김
  - 테스트 이름은 "묶음 이름 › 설명"으로 보고됨
  - 여러 파일이 함께 쓰는 `makeOpen`, `makeInputEnv`, `touchOnTop`도 이곳으로 이동
- 실행: `tsc && node --test` (전체), `node --test tests/solver.test.mjs` (파일 하나)
- solitaire_web은 `node:test`의 `describe/it`와 `node:assert`를 직접 쓰지만, 여기서는 기존 190개 테스트를 그대로 보존하는 쪽을 택함

**효과**
- 파일별로 별도 프로세스에서 병렬 실행 → 전체 실행 시간이 약 1.2초로 줄어듦
- 가짜 `window`, `Image`, `indexedDB` 같은 전역 조작이 다른 파일의 테스트에 영향을 주지 않음
- 실패한 테스트만 골라 실행(`--test-name-pattern`)하는 등 표준 러너 기능 사용 가능

**검증**
- 분리 전후 테스트 수 동일: 190개 → 190개, 전체 통과
- 일부러 실패하는 테스트를 넣어 종료 코드가 1이 되는 것 확인(확인 후 삭제), 통과 시 0
- 분리 스크립트가 넣은 import 중 쓰이지 않는 것 2개 제거
- `test.html`(브라우저용 옛 테스트 페이지)은 `test.mjs`와 별개의 사본이라 건드리지 않음. 최근 테스트는 반영되어 있지 않음

### 필수 DOM 요소 누락 시 명확한 오류 (solitaire_web 참고)

**src/dom.ts** (신규) / **src/main.ts** (수정)
- `req<T>(id)`: 요소가 없으면 `필수 DOM 요소를 찾을 수 없습니다: #id` 오류를 던짐
- `main.ts`의 `getElementById(...)!` / `as HTML...` 39곳을 `req()`로 교체
  → index.html과 코드의 id가 어긋나면, 나중에 엉뚱한 곳에서 null 오류가 나는 대신 시작 시점에 어떤 id인지 드러남
- 없어도 되는 요소 3곳(`game-number-error`, `game-number-display`)은 기존 null 검사 그대로 유지
- 테스트 3개 추가 (`tests/dom.test.mjs`)

### `sound.init()`에서 suspended 컨텍스트 재개 (solitaire_web 참고)

**src/sound.ts** (수정)
- `init()`에서 AudioContext가 suspended 상태면 바로 `resume()` 요청 (iOS Safari는 사용자 제스처 안에서 만들어도 suspended로 시작할 수 있음)
  - 기존에는 `play()`에서만 재개를 시도했는데, `play()`는 타이머(자동 올리기, 승리 등)에서도 불려 제스처 밖일 수 있음
- solitaire_web과 다른 점: `resume()`이 끝나기를 기다리지 않음 → 재개가 끝나지 않는 환경에서 초기화가 멈춰 소리가 영영 안 나는 상황을 피함
- 함께 수정: `init()`을 연달아 부르면 AudioContext가 여러 개 만들어지던 문제 (시작 버튼 처리에서 실제로 두 번 불림) → 진행 중인 초기화를 공유
- 초기화 실패 시 `ctx`를 비워 다음 `init()`에서 다시 시도
- 테스트 8개 추가 (`tests/sound.test.mjs`, 가짜 AudioContext). 수정 전 2개 실패 확인
- 미확인: 실제 iOS Safari에서의 동작

### 패배 이펙트: 모든 카드가 제자리에서 날아가도록 수정 (solitaire_web의 "이중 표시 방지" 검토 결과)

**검토 결과**
- solitaire_web의 `_animDecks`는 이펙트 중인 덱을 보드에서 빼 카드가 두 번 그려지는 것을 막는 장치
- FreeCell은 구조가 달라 이중 표시는 없었음: 승리 이펙트 중에는 Foundation 슬롯만 그리고, 패배 이펙트 중에는 보드를 아예 그리지 않음
- 대신 같은 구조 때문에 반대 문제가 있었음 (코드로 확인, 테스트로 재현):
  1. 패배 이펙트가 시작되면 카드가 전부 사라졌다가, 각자 지연 시간(최대 1.5초)이 지난 뒤 하나씩 나타나 날아감
  2. FreeCell·Foundation에 있던 카드는 이펙트 대상이 아니라 그냥 사라짐

**src/renderer.ts** (수정)
- `startFailEffect()`: Tableau뿐 아니라 FreeCell·Foundation의 모든 카드를 이펙트에 포함
- `_stepFailAnim()`: 아직 날아가지 않은 카드는 제자리에 그리고, 날아가는 카드를 그 위에 그림
- 다시 하기(이펙트 후 같은 판 재시작)와 포기 모두 같은 이펙트를 쓰므로 둘 다 적용

**tests/renderer.test.mjs** (신규): 테스트 9개. 수정 전 6개 실패 확인

**검증 (3건 공통)**
- `tsc` 통과, `node --test` **210/210 통과**, `build.sh` 릴리스 빌드 성공
- 릴리스 파일을 Chrome에서 확인: 콘솔 오류 없음, 포기 시 대기 중인 카드는 제자리에 남고 나머지가 날아가는 것 확인
- 미확인: 이펙트 중 위쪽 빈 슬롯 테두리는 여전히 그려지지 않음(기존 동작). 자동화 창에서는 이펙트가 느리게 진행되어
  8초 안전장치로 패배 화면이 먼저 뜨는 것을 봄 — 창이 가려져 화면 갱신이 느려진 영향으로 보이나 단정하지 못함
