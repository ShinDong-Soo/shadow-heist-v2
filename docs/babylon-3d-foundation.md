# Babylon.js 3D 기반

이 문서는 기존 2D 게임을 지우지 않고, 앞으로 부분 3D 장면을 확장하기 위한 별도 Babylon.js 기반을 설명한다. 이번 단계는 **3D 게임플레이 구현이 아니라 엔진·장면·에셋 로딩 구조 검증**이 목적이다.

## 확인 방법

개발 서버를 실행한 뒤 `http://localhost:5173/3d.html`을 연다. 기존 게임 시작 화면의 `BABYLON 3D FOUNDATION` 링크로도 들어갈 수 있다.

화면에는 20m × 20m 바닥, 코드로 만든 시험 오브젝트, GLB에서 읽은 갈색 큐브, 탑다운 카메라, 조명과 그림자, FPS 디버그 정보가 보여야 한다. Phase 02부터 실제 게임 방향에 맞춰 카메라 회전을 잠갔다. `1`, `2`, `3`으로 Near·Medium·Far 거리를 비교하고 `R`을 누르면 기본 Medium 카메라로 돌아간다.

## 파일 구조

```text
3d.html                         3D 전용 HTML 진입점
src/3d/
├─ main.ts                     HTML과 Game을 연결
├─ style.css                   3D 화면과 로딩 UI
├─ config/gameConfig.ts        카메라·바닥·단위·그림자 설정
├─ core/Game.ts                엔진, 렌더 루프, 리사이즈, 디버그 UI
├─ core/SceneManager.ts        만들 장면을 선택하는 중간 관리자
├─ core/AssetManager.ts        GLB 파일 로딩
└─ scenes/PrototypeScene.ts    바닥, 카메라, 조명, 큐브 시험 장면
public/models/prototype/
└─ test-cube.glb               로더 검증용 작은 GLB
scripts/
└─ generate-prototype-glb.mjs  시험 GLB를 다시 만드는 스크립트
```

`Game`은 브라우저와 Babylon 엔진의 생명주기를 담당한다. `PrototypeScene`은 장면 내용만 만들고, `AssetManager`는 외부 모델 로딩만 담당한다. 역할을 나눠 다음 단계의 플레이어 코드가 한 파일에 몰리지 않게 했다.

## 에셋 폴더 규칙

```text
public/
├─ models/characters, environment, props
├─ textures/characters, environment, props, ui
└─ audio/bgm, sfx, ambience, ui
```

파일은 역할에 맞는 폴더에 넣는다. Vite의 `public` 파일은 루트 경로처럼 읽지만, 하위 경로 배포도 지원하도록 코드에서는 `import.meta.env.BASE_URL`을 앞에 붙인다.

## GLB 로딩 구조

Babylon 코어만 설치하면 `.glb` 파일을 읽을 수 없다. `@babylonjs/loaders`의 glTF 2.0 로더를 명시적으로 등록하고 `SceneLoader.ImportMeshAsync`를 사용한다.

시험 모델을 다시 만들려면 `npm run generate:prototype-glb`를 실행한다. 모델 로딩이 실패해도 장면 전체를 중단하지 않고 콘솔에 원인을 남긴 뒤 코드로 만든 초록 큐브를 계속 표시한다.

## 로딩과 디버그

- 엔진 준비 → GLB 다운로드 → 장면 준비 순서가 로딩 화면에 표시된다.
- 창 크기가 바뀌면 엔진 렌더 크기도 자동으로 맞춘다.
- 디버그 표시는 0.25초마다 갱신해 매 프레임 HTML을 수정하지 않는다.
- 현재 단위는 `1 Babylon unit = 1m`이다.

2026-08-24 로컬 Chrome 검증에서는 WebGL2로 장면과 GLB가 정상 표시됐고, 1920×1080 화면에서 약 165 FPS를 확인했다. Phase 02 장면은 2026-08-25 로컬 배포 미리보기에서 약 165 FPS, 메시 14개, 콘솔 경고·오류 0개를 확인했다. 배포 폴더 전체는 약 6.98MB이고 3D JavaScript 파일은 약 1.58MB다. FPS와 로딩 속도는 컴퓨터와 브라우저 상태에 따라 달라진다.

## 이번 단계에 포함하지 않은 기능

- 3D 플레이어 이동과 충돌
- 3D 경비원과 AI
- 보물 획득 게임플레이
- 기존 2D 임무의 완전한 3D 전환
- 실제 운영 주소 배포는 아직 외부 배포 대상과 계정이 정해지지 않아 남아 있다. 현재는 `npm run build` 결과를 로컬 배포 미리보기로 검증했다.

플레이어 캡슐, WASD 이동, 벽 충돌과 추적 카메라는 [3D 플레이어 이동과 탑다운 카메라](player-movement-3d.md)에서 이어서 구현했다.
