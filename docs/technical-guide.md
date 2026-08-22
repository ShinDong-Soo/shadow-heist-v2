# 기술 안내

이 문서는 프로젝트 실행 방법과 사용 기술, 현재 코드 구조를 초보 개발자 기준으로 설명한다.

## 사용 기술

| 기술 | 역할 |
|---|---|
| Vite | 개발 서버 실행과 배포 파일 생성 |
| TypeScript | 코드의 자료형을 검사해 실수 방지 |
| HTML5 Canvas | 맵, 캐릭터, 조명, 시야 그리기 |
| CSS | 메뉴와 HUD 모양 |
| Web Audio API | 발소리, 효과음, 환경음 생성 |

## 필요한 환경

- Node.js
- npm
- 최신 버전의 일반적인 웹 브라우저

Node.js를 설치하면 npm도 함께 설치되는 경우가 많다.

## 처음 실행

프로젝트 폴더에서 다음 명령을 실행한다.

```bash
npm install
npm run dev
```

- `npm install`: 프로젝트에 필요한 개발 도구를 내려받는다.
- `npm run dev`: 개발용 서버를 실행한다.

터미널에 표시된 `http://localhost:...` 주소를 브라우저에서 열면 게임을 실행할 수 있다.

## 빌드 검사

```bash
npm run build
```

이 명령은 다음 작업을 순서대로 수행한다.

1. TypeScript가 잘못된 자료형 사용을 검사한다.
2. Vite가 배포용 파일을 만든다.
3. 결과를 `dist` 폴더에 저장한다.

오류 없이 끝나고 `dist` 폴더가 생성되면 기본 빌드에 성공한 것이다.

빌드 성공은 코드가 실행 가능한 상태라는 뜻이다. 게임의 재미, 난이도, 화면 배치는 [플레이테스트](playtest.md)를 통해 별도로 확인해야 한다.

## 주요 파일

```text
SHADOW-HEIST_V2/
├─ index.html
├─ package.json
├─ tsconfig.json
├─ src/
│  ├─ main.ts
│  ├─ cctv.ts
│  ├─ doors.ts
│  ├─ exploration.ts
│  ├─ guards.ts
│  ├─ hiding.ts
│  ├─ noise.ts
│  ├─ security.ts
│  ├─ vision.ts
│  └─ style.css
└─ docs/
```

- `index.html`: Canvas, 시작 화면, HUD, 결과 화면의 HTML 구조
- `src/main.ts`: 게임 상태, 이동, AI, 시야, 조명, 사운드, 렌더링
- `src/cctv.ts`: CCTV와 제어반의 종류, 위치, 초기 상태
- `src/doors.ts`: 문과 키카드의 이름, 위치, 잠금 및 초기 상태
- `src/exploration.ts`: 탐색률 계산에 사용하는 격자 생성과 백분율 계산
- `src/guards.ts`: 경비 자료형, 브라보 경비 초기 상태와 순찰 경로
- `src/hiding.ts`: 은신처 종류, 이름, 맵 배치 데이터
- `src/noise.ts`: 일반·조심·웅크리기별 소음 범위와 벽·경계 단계에 따른 청취 거리 계산
- `src/security.ts`: CCTV와 마지막 보물 조건에 따른 출구 봉쇄 시간 계산
- `src/vision.ts`: 경비, 플레이어, 조명, CCTV가 함께 사용하는 LOS와 광선 계산
- `src/style.css`: 메뉴와 HUD 디자인
- `package.json`: 실행 명령과 개발 도구 목록
- `tsconfig.json`: TypeScript 검사 설정
- `docs/`: 분야별 개발 문서

## 현재 구조의 특징

현재 프로토타입은 대부분의 게임 코드가 `src/main.ts` 한 파일에 있다. 초기 기능을 빠르게 검증하기에는 편하지만 기능이 계속 늘어나면 찾고 수정하기 어려워진다.

기능이 더 늘어나기 전에 다음과 같이 기능별 파일 분리를 계속 진행한다.

```text
src/
├─ game/
├─ player/
├─ guard/
├─ map/
├─ vision/
├─ lighting/
├─ audio/
├─ ui/
└─ telemetry/
```

파일을 나눌 때는 기능을 바꾸지 않고 코드 위치만 이동한 뒤 매 단계마다 빌드와 플레이를 확인해야 한다.

## 외부 파일과 저장 데이터

- 현재 사운드는 외부 음원 파일 없이 브라우저에서 생성한다.
- 캐릭터와 맵은 외부 이미지 없이 Canvas 도형으로 그린다.
- 플레이 결과는 서버가 아닌 브라우저 로컬 스토리지에 저장한다.

각 시스템의 동작 규칙은 [개발 문서 목차](README.md)에서 담당 문서를 선택해 확인한다.
