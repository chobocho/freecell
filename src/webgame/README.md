# FreeCell Web

Android FreeCell 게임을 HTML5 Canvas + TypeScript로 포팅한 웹 버전입니다.

## 스크린샷

> `index.html`을 브라우저에서 열어 바로 실행할 수 있습니다.

## 특징

- **MS FreeCell 호환 RNG** — 게임 번호 1~32000으로 MS FreeCell과 동일한 배치 재현
- **난이도 선택 (하/중/상)** — 게임 번호 1~32000을 솔버로 미리 풀어 헤맨 정도로 3등분. 새 게임 창에서 난이도를 고르고 번호를 비워두면 그 난이도의 판이 나옴
- **중복 없는 랜덤 게임** — 번호를 비워두면 15비트 LFSR 순서로 번호를 골라, 한 바퀴(1~32000) 동안 같은 판이 다시 나오지 않음 (풀 수 없는 #11982 제외)
- **반응형 레이아웃** — Galaxy Z Fold 7 접힘(≈360px)부터 데스크톱까지 대응
- **멀티 입력** — 마우스 드래그앤드롭 / 터치 드래그앤드롭 / 키보드 전용 플레이
- **자동저장** — IndexedDB에 게임 상태 자동 저장, 다음 방문 시 이어하기
- **프로그래매틱 사운드** — Web Audio API로 합성 (외부 파일 없음)
- **승리/패배 이펙트** — 포물선 카드 날리기 / 바람 흩날리기 + 불꽃 파티클
- **외부 라이브러리 없음** — 런타임에 인터넷 연결 불필요

## 실행 방법

### 빌드

```bash
# TypeScript 컴파일 (dist/ 에 출력)
tsc

# 감시 모드
tsc --watch
```

### 릴리스 빌드 (단일 HTML 파일)

```bash
bash build.sh      # Windows: build.bat
```

`release/index.html` 하나에 JS·CSS·카드 이미지·파비콘을 모두 넣습니다. 이 파일만 있으면 브라우저에서 바로 열립니다.

- JS는 [esbuild](https://esbuild.github.io/)가 `dist/main.js`에서 import를 따라가 하나의 IIFE로 묶습니다. `src/`에 모듈을 추가해도 빌드 스크립트를 고칠 필요가 없습니다.
- esbuild는 기본적으로 `npx`로 실행하며, 처음 한 번은 인터넷에서 내려받습니다(이후 캐시 사용).
- 설치된 esbuild를 쓰거나 내려받기를 막으려면 `ESBUILD` 환경 변수를 지정합니다.
  예: `ESBUILD="npx --no-install esbuild" bash build.sh`

### 테스트

```bash
# 전체 테스트 (먼저 tsc 로 dist/ 를 갱신)
tsc && node --test

# 파일 하나만
node --test tests/solver.test.mjs
```

테스트는 `tests/*.test.mjs`에 주제별로 나뉘어 있고, Node.js 내장 테스트 러너(`node --test`)로 실행합니다.
파일마다 별도 프로세스에서 병렬로 실행됩니다.

### 플레이

`index.html`을 로컬 서버 또는 브라우저에서 직접 열어 실행합니다.

```bash
# 예시: Python 간이 서버
python3 -m http.server 8080
```

## 조작법

### 마우스 / 터치

| 동작 | 기능 |
|------|------|
| 드래그 앤 드롭 | 카드 이동 |
| 더블클릭 / 더블탭 | Foundation으로 자동 이동 |
| ✕ 포기 버튼 | 현재 판 포기 → 결과 화면에서 같은 판 다시 하기 / 새 게임 |

### 키보드

| 키 | 동작 |
|----|------|
| `Q` `W` `E` `R` | Foundation 1–4 선택 |
| `U` `I` `O` `P` | FreeCell 1–4 선택 |
| `1`–`8` | Tableau 1–8 선택 (숫자 키패드 가능) |
| `Enter` | 선택 카드 → Foundation 자동 이동 |
| `Z` | 되돌리기 (Undo) |
| `A` | 자동 올리기 (올릴 수 있는 카드를 모두 Foundation으로) |
| `N` | 새 게임 |
| `Space` / `Esc` | 일시정지 / 재개 |
| `Ctrl` (누르는 중) | 키 배치 힌트 오버레이 표시 |
| `F1` | 단축키 도움말 |

> 단축키는 물리 키 위치로 인식하므로 한글 입력 상태에서도 그대로 동작합니다.
>
> 키를 한 번 누르면 소스 선택(황금 테두리), 다른 키를 누르면 해당 슬롯으로 이동

## 게임 규칙

- **Tableau**: 교대 색상 + 내림차순으로 쌓기
- **FreeCell**: 카드 1장 임시 보관 (4칸)
- **Foundation**: 같은 무늬 A→K 순서로 완성
- 4개 Foundation을 모두 완성하면 승리

## 프로젝트 구조

```
webgame/
├── src/              # TypeScript 소스
│   ├── card.ts       # Card, Figure, CardNumber, Color
│   ├── deck.ts       # Deck 추상 클래스 및 4가지 구현
│   ├── dom.ts        # 필수 DOM 요소 조회 (없으면 id 를 알려주는 오류)
│   ├── freecell.ts   # 게임 로직 (상태 머신, 이동 규칙)
│   ├── input.ts      # 마우스/터치/키보드 입력 처리
│   ├── lfsr.ts       # 랜덤 새 게임용 LFSR 게임 번호 순환
│   ├── difficulty.ts # 난이도(하/중/상) 조회, 난이도별 게임 번호 선택
│   ├── levels.ts     # 게임 번호별 난이도 표 (자동 생성)
│   ├── solver.ts     # FreeCell 솔버 (난이도 표 생성용, 릴리스에 미포함)
│   ├── renderer.ts   # Canvas 2D 렌더링
│   ├── sound.ts      # Web Audio API 사운드 합성
│   ├── storage.ts    # IndexedDB 자동저장
│   └── main.ts       # GameController (통합)
├── scripts/
│   ├── gen-levels.mjs  # 난이도 표 생성 (tsc && node scripts/gen-levels.mjs)
│   └── gen-icon.mjs    # 파비콘 img/icon.png 생성 (node scripts/gen-icon.mjs)
├── dist/             # 컴파일된 JS (tsc 출력)
├── css/style.css
├── img/              # 카드 이미지 (52장 + 뒷면), 파비콘 icon.png
├── index.html
├── build.sh / build.bat  # 릴리스 빌드 (tsc → esbuild → bundle.js)
├── bundle.js         # JS·CSS·이미지를 release/index.html 하나로 조립
├── tests/            # Node.js 유닛 테스트 (239개, node --test)
│   ├── helpers.mjs         # 공용 도우미 (suite/test/assert, 가짜 입력 환경)
│   ├── deck.test.mjs       # 카드, 덱
│   ├── game.test.mjs       # 게임 규칙 (이동, 되돌리기, 승리, 자동 이동)
│   ├── game-number.test.mjs  # 게임 번호 배치, 같은 판 다시 하기, 포기
│   ├── game-save.test.mjs  # 저장 / 복원
│   ├── input.test.mjs      # 키보드 / 터치 입력
│   ├── renderer.test.mjs   # 패배 이펙트, 이펙트 속도
│   ├── main.test.mjs       # 게임 컨트롤러 (다시 하기 이펙트, 버튼 상태, 경과 시간, 되돌리기)
│   ├── sound.test.mjs      # 사운드 초기화 / 재생
│   ├── dom.test.mjs        # 필수 DOM 요소 조회
│   ├── lfsr.test.mjs       # 게임 번호 순환
│   ├── solver.test.mjs     # 솔버
│   ├── difficulty.test.mjs # 난이도 표
│   ├── storage.test.mjs    # IndexedDB 저장소
│   └── build.test.mjs      # 릴리스 빌드 조립
├── tsconfig.json
├── history.md        # 개발 이력
├── history_*.md      # 이전 개발 이력 (history.md 가 30KB 를 넘으면 백업)
└── Todo.md           # 요구사항 정의
```

## 기술 스택

- **언어**: TypeScript 5.x (strict 모드)
- **렌더링**: HTML5 Canvas 2D API
- **저장**: IndexedDB
- **사운드**: Web Audio API
- **빌드**: tsc (개발) / tsc + esbuild (릴리스 단일 파일, 빌드 시에만 사용)
- **테스트**: Node.js 내장 테스트 러너 (`node --test`, 외부 라이브러리 없음)
