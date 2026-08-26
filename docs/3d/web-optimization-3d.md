# 3D 웹 최적화 — Phase 14 진행 기록

이 문서는 3D 박물관의 핵심 잠입 정보는 유지하면서 브라우저 부하와 초기 로딩을 줄인 내용을 설명한다.

## 이번에 적용한 최적화

### 로딩

- 첫 URL 진입에서는 박물관 씬을 만들거나 렌더링하지 않고 가벼운 메인 메뉴만 표시한다.
- `PLAY HEIST`를 누른 뒤 로딩 화면에서 박물관, 경비 발소리, 왕관·경보·봉쇄 시스템을 준비한다.
- 로딩률 숫자와 진행 막대를 함께 표시해 검은 화면처럼 보이지 않게 했다.
- 화면에 사용하지 않던 `test-cube.glb`와 glTF 런타임 요청을 제거했다.
- 3D JavaScript 번들은 약 1.72MB에서 1.52MB, gzip은 약 425KB에서 376KB로 줄었다.

### 조명과 그림자

- 경비 손전등, 왕관 조명, 필수 경보 피드백은 유지했다.
- 경보 표시는 6개의 Emissive 비콘과 실제 Point Light 2개 구조를 유지한다.
- Shadow Caster는 플레이어, 경비, 벽, 기둥, 선반, 큰 엄폐물 중심이다.
- LOW/MEDIUM/HIGH에 따라 내부 렌더 해상도와 그림자 맵 크기를 다르게 할당한다.

### Draw Call과 재질

- 탈출 경로 마커 14개를 같은 원본 Geometry의 Instance로 변경했다.
- 경보 비콘은 짝수·홀수 두 Instance 그룹과 두 공용 재질만 사용한다.
- 경비원 2명이 같은 의상·피부·장비 재질을 공유한다.
- 정적 박물관 메시의 World Matrix 고정과 구역별 Frustum Culling 구조를 유지했다.

### AI·LOS·애니메이션

- 경비 시야는 거리 → 각도 → Raycast 순서이며 15Hz로 제한했다.
- 시야 거리 밖에서는 Raycast가 0회가 되는 것을 디버그 패널에서 확인했다.
- CCTV 시야 검사는 10Hz이며 반복 Vector 생성을 제거했다.
- 멀리 있는 경비는 AI 위치 계산은 매 프레임 유지하고 관절 Pose만 낮은 주기로 갱신한다.
- 품질이 달라도 경비 위치, 탐지, 엄폐, 손전등 판정 규칙은 바뀌지 않는다.

### 브라우저 안정성

- 프레임 Delta Time을 최대 0.05초로 제한한다.
- 탭·창 포커스를 잃으면 입력을 비우고 자동 일시정지한다.
- 일시정지 중 경비, 탐지, 봉쇄 타이머, 실행 시간이 모두 정지한다.
- 종료 화면 지연은 프레임 수가 아니라 실제 시간 기준이라 저 FPS에서도 길어지지 않는다.
- Fullscreen 버튼과 전환 후 Canvas Resize 처리를 추가했다.
- Retry는 페이지 Reload 없이 기존 씬을 초기화하며 이벤트와 Audio Context를 새로 만들지 않는다.

## 품질 설정

| 품질 | 시작 Render Scale | Main Shadow | Flashlight Shadow | 원거리 애니메이션 |
|---|---:|---:|---:|---:|
| LOW | 약 63% | 512 | 256 | 약 8Hz |
| MEDIUM | 80% | 512 | 256 | 약 13Hz |
| HIGH | 100% | 1024 | 512 | 20Hz |

지속 FPS가 50 아래로 내려가면 내부 해상도를 한 단계씩 낮추고, 58 이상으로 회복하면 선택한 품질의 상한까지 복구한다.

## 성능 측정

`F2` 디버그 패널에서 다음을 확인할 수 있다.

- 현재/평균/낮은 FPS와 품질·Render Scale
- 전체 Mesh, Active Mesh, Material, Light 수
- Gallery, Archive, Crown Hall, Lockdown 구간별 누적 FPS
- 경비 시야 Check와 실제 Raycast 횟수

로컬 자동 브라우저의 LOW 시작 지점에서는 `289 Mesh / 53~58 Active / 78 Material / 9 Light`였고, 플레이어가 경비 시야 범위 밖일 때 `15 Checks / 0 Rays`를 확인했다. 자동 브라우저 FPS는 백그라운드 스케줄링 영향을 받으므로 실제 PC Chrome 수치와 동일하게 취급하지 않는다.

## 검증 결과

| 항목 | 상태 |
|---|---|
| Production Build | 완료 |
| 메뉴 → PLAY → Loading → Game | 완료 |
| 로딩 진행률·오디오 선행 준비 | 완료 |
| Guard Flashlight·Animation·LOS 유지 | 완료 |
| 그림자 맵·Render Scale 품질 설정 | 완료 |
| 반복 Mesh Instance·공용 재질 | 완료 |
| LOS 15Hz·CCTV 10Hz·원거리 Pose 제한 | 완료 |
| Focus Lost 입력 Reset·Auto Pause | 완료 |
| Pause 중 게임 상태 정지 | 완료 |
| 실제 시간 기준 종료 연출 | 완료 |
| 1920×1080·1366×768 메뉴 가독성 | 완료 |
| 브라우저 Console Error 0 | 완료 |
| Chrome·Edge 실제 50~60FPS | 사용자 PC 확인 필요 |
| Crown Steal·Lockdown·Chase 실제 체감 | 사용자 플레이 확인 필요 |
| 30분 장시간 Memory 측정 | 확인 필요 |
| 공개 URL·Incognito 완주 | 배포 후 확인 필요 |

## 관련 코드

- `systems/GraphicsQuality.ts`: 품질별 렌더·그림자 예산
- `core/Game.ts`: 지연 씬 로딩, 품질, Fullscreen, Focus, Benchmark
- `scenes/MuseumMap.ts`: Instance와 공용 경보 재질
- `scenes/PrototypeScene.ts`: 사운드 Preload와 원거리 애니메이션 제한
- `entities/guard/GuardVision.ts`: 15Hz 거리·각도·LOS 검사
- `systems/SecurityCamera3D.ts`: 10Hz와 임시 객체 제거
- `systems/StealthAudioSystem.ts`: MP3 한 번만 다운로드·디코딩
