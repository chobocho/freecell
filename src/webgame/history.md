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
