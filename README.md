# Shadow Heist V2

> 보이지 않는 경비를 빛과 소리로 추측하면서, 더 훔칠수록 더 시끄럽고 위험해지는 박물관 잠입 게임.

Shadow Heist V2는 설치 없이 브라우저에서 실행되는 Canvas 기반 스텔스 프로토타입입니다. 세 개의 하이스트를 차례로 통과하며 경비, CCTV, 추가 보물과 왕관 경보를 단계적으로 학습합니다. 기존 게임과 분리된 Babylon.js 3D 기반 화면에서 향후 부분 3D 전환도 시험할 수 있습니다.

## 핵심 차별점

- 경비가 화면에 보이지 않아도 좌우 발소리와 거리 표시로 위치를 추측합니다.
- 밝은 곳에서는 길이 잘 보이지만 플레이어도 더 쉽게 발각됩니다.
- 보물을 많이 들수록 발소리 범위와 경계 단계가 커집니다.
- 첫 임무는 경비 한 명과 보물 하나에 집중하고, 다음 임무부터 두 경비와 CCTV가 추가됩니다.
- 마지막 왕관을 훔치면 기존 출구가 닫히고 반대편 비상구까지 추격을 피해 돌아가야 합니다.
- 보물 앞에서는 탑다운 화면이 짧은 1인칭 부분 3D 장면으로 전환되어 직접 손을 뻗어 훔칩니다.
- 두 번째와 세 번째 임무에서는 보물 하나부터 탈출할 수 있어 안전과 욕심 사이의 선택이 생깁니다.

## 조작

| 입력 | 행동 |
|---|---|
| `WASD` / 방향키 | 기본 저소음 이동 |
| `Shift` | 누르는 동안 달리기·큰 소음 발생 |
| `C` | 누르는 동안 웅크리기 |
| `E` | 보물, 문, 은신처, 장치와 출구 상호작용·보물 장면에서 길게 눌러 훔치기 |
| `Esc` | 보물 3D 장면 취소 |
| `F2` | 플레이테스트 진단 패널 |

## 게임 진행

```text
FIRST JOB에서 기본 잠입 학습
→ NIGHT GALLERY에서 두 경비와 CCTV 상대
→ 지금 탈출하거나 추가 보물에 도전
→ CROWN JEWEL에서 왕관 경보 발생
→ 기존 출구가 아닌 동쪽 비상구로 탈출
```

체포되면 해당 판의 점수를 모두 잃습니다. 결과 화면에서는 잠입 보너스와 하이스트별 최고 점수를 확인할 수 있습니다.

## 로컬 실행

필요 환경은 Node.js 22.12 이상입니다.

```bash
npm install
npm run dev
```

터미널에 표시되는 로컬 주소를 브라우저에서 열고 `잠입 시작`을 누릅니다. 브라우저 오디오 정책 때문에 소리는 시작 버튼을 누른 뒤 활성화됩니다.

Babylon.js 3D 플레이어 이동 장면은 `http://localhost:5173/3d.html`에서 확인합니다. 기존 시작 화면의 `BABYLON 3D PLAYER LAB` 링크로도 이동할 수 있습니다.

Windows에서 PowerShell 실행 정책 오류가 나오거나 프로젝트 폴더를 찾기 어렵다면 [start-server.cmd](start-server.cmd)를 더블클릭합니다. 이 파일은 프로젝트 폴더로 자동 이동하고 PowerShell 스크립트 대신 `npm.cmd`로 서버를 실행합니다.

## 빌드

```bash
npm ci
npm run build
npm run preview
```

배포 파일은 `dist/`에 생성됩니다. 상대 경로 빌드를 사용하므로 루트 도메인과 GitHub Pages 같은 하위 경로에서 모두 호스팅할 수 있습니다.

## 기술 구성

- TypeScript
- Vite
- HTML5 Canvas 2D
- CSS Perspective 부분 3D Vertical Slice
- Babylon.js 3D 기반과 glTF 2.0 GLB 로딩
- Web Audio API
- Local Storage 플레이테스트 기록

## Codex 협업

Codex는 경비 AI, LOS와 Fog, 소리 시스템, 플레이테스트 계측, 캐릭터 에셋 적용, 빌드 검사와 개발 문서 정리에 사용했습니다. 개발자가 결정한 범위와 실제 협업 사례는 [Codex 협업 기록](docs/codex-collaboration.md)에 정리했습니다.

## 문서와 크레딧

- [분야별 개발 문서](docs/README.md)
- [캐릭터 에셋](docs/characters.md)
- [플레이테스트](docs/playtest.md)
- [Babylon.js 3D 기반](docs/babylon-3d-foundation.md)
- [3D 플레이어 이동과 탑다운 카메라](docs/player-movement-3d.md)
- [크레딧과 에셋 출처](CREDITS.md)
- [MIT License](LICENSE)
