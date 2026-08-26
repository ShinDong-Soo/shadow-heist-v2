# 09. 3D 캐릭터 애니메이션 핵심 리워크

## 이번 단계에서 해결한 문제

기존 플레이어와 경비원은 하나의 Capsule이 바닥 위를 이동했다. 충돌 판정에는 편하지만 사람처럼 보이지 않았고, 경비원의 상태도 디버그 UI를 읽어야만 알 수 있었다.

이번 단계에서는 게임 판정을 담당하는 `Root`와 화면에 보이는 `CharacterVisual`을 분리했다.

```text
PlayerRoot / GuardRoot
├── 충돌과 위치 판정
├── 카메라·탐지 기준점
└── CharacterVisual
    ├── 몸통과 머리
    ├── 양팔
    └── 양다리
```

팔과 다리가 움직여도 충돌체와 카메라는 흔들리지 않는다. 나중에 GLB 캐릭터를 도입할 때도 `CharacterVisual`만 교체하면 된다.

## 플레이어

### 구현된 상태

- `IDLE`: 호흡, 어깨와 고개의 작은 움직임
- `WALK`: 짧은 보폭과 작은 팔 흔들림
- `RUN`: 상체를 앞으로 숙이고 보폭과 팔 움직임을 크게 변경
- `CROUCH`: 몸 전체를 낮추고 탐지 기준 높이도 낮춤
- `CROUCH_WALK`: 낮은 높이를 유지하며 짧은 보폭으로 이동
- `INTERACT`: 상체를 기울이고 양팔을 앞으로 뻗음
- `HIDE_ENTER`, `HIDDEN`, `HIDE_EXIT`: 라커 진입·대기·이탈 자세

### 조작

```text
WASD / 방향키  이동
Shift          달리기
Ctrl 또는 C    웅크리기
E              상호작용
```

달리기는 걷기보다 빠르고 발소리도 크다. 웅크린 이동은 느리지만 탐지 기준 높이와 발소리가 낮아진다.

## 경비원

### 현재 게임에 연결된 상태

- `PATROL`: 일정한 경비 보행, 손전등을 든 자세
- `IDLE`: Waypoint에서 잠시 멈추고 주변을 살핌
- `TURN`: 발을 옮기며 방향 전환
- `SUSPICIOUS`: 걸음을 멈추고 몸과 손전등을 관심 방향으로 고정
- `ALERT`: 경보 후 상체가 긴장되고 보행과 Scan이 빨라짐

### 조사·추격 흐름에 연결된 상태

- `INVESTIGATE`: 조심스럽게 접근하는 보행
- `SEARCH`: 좌우로 고개와 손전등을 훑는 동작
- `CHASE`: Patrol을 빠르게 재생한 것이 아닌 별도 달리기 자세. 완전 발각 시 마지막 목격 위치를 향해 실제 이동한다.

`DETECTED` 상태에서는 Player를 실제로 추격하고, 가까이 도달하면 체포 실패로 전환한다. LOS가 끊기면 마지막 목격 위치까지 이동해 `SEARCH`하고, 찾지 못하면 원래 순찰 경로로 복귀한다. 발소리를 들은 경우에도 소리가 난 위치를 같은 흐름으로 조사한다.

개발 중에는 `F3`을 누를 때마다 경비 애니메이션을 하나씩 확인할 수 있다. 모든 상태를 지난 다음 `AUTO`로 돌아오면 실제 AI 상태를 다시 따른다.

## 발 미끄러짐과 발소리

시간만 보고 다리를 움직이면 프레임 저하나 속도 변경 때 발이 미끄러질 수 있다. 이번 구현은 캐릭터가 실제로 이동한 거리를 기준으로 보행 주기를 계산한다.

```text
실제 이동 거리
→ 보행 주기 계산
→ 발이 바닥에 닿는 시점
→ 발소리 재생
```

- Walk, Run, Crouch Walk의 보폭이 서로 다르다.
- Player Run은 큰 발소리, Crouch Walk는 매우 작은 발소리를 낸다.
- Guard Patrol과 Alert/Chase의 발소리 세기가 다르다.
- 경비 발소리는 기존과 같이 플레이어와의 거리에 따라 크기와 좌우 방향이 변한다.
- Marble, Carpet, Metal 세 표면에 따라 음색과 소음 반경이 달라진다.
- Player 발 접촉 이벤트는 `NoiseSystem`으로 전달되고, 반경 안의 Guard가 실제 조사 행동을 시작한다.
- Run은 약 7m, Walk는 약 2.6m, Crouch Walk는 약 0.8m의 기본 소음 반경을 사용하며 표면에 따라 보정된다.

## 손전등과 LOS

경비원 손목 아래에 `flashlightSocket`을 만들었다. 손전등 모델은 손목을 따라가고, SpotLight 시작 위치도 같은 Socket을 사용한다. 빛 방향은 팔 애니메이션의 과도한 흔들림을 피하기 위해 Guard Root 방향과 고정 하향각으로 계산한다.

탐지 위치 자체는 안정적인 Root 기준점을 사용한다. 걷는 Bounce 때문에 탐지 광선이 과하게 흔들리지 않게 하기 위해서다.

## Crouch 충돌과 왕관 접촉

- 이동 충돌은 Stand 1.76m, Crouch 1.08m의 현재 자세 높이를 사용한다.
- 탐지 목표도 Stand 1.15m, Crouch 0.72m로 내려가 낮은 전시대 뒤에서 자세 차이가 생긴다.
- `INTERACT`는 손을 뻗었다가 미리 되돌리지 않고 접촉 시점까지 자세를 유지한다.
- Hold E가 완료되면 `CROWN_CONTACT` 이벤트가 발생하고, 왕관은 고정 좌표가 아니라 움직인 오른손 위치로 이동한다.

## 성능 방향

- Skeleton과 4K 텍스처를 사용하지 않는 저비용 관절 캐릭터다.
- Player 1명과 Guard 1명의 관절만 매 프레임 갱신한다.
- 박물관 정적 Mesh의 기존 World Matrix 고정 최적화는 유지된다.
- 최종 GLB 모델을 도입하기 전에도 상태와 게임 감각을 먼저 검증할 수 있다.

## 확인 방법

1. `/3d.html`을 연다.
2. WASD로 Walk와 정지를 반복한다.
3. Shift를 누른 채 이동해 Run 자세를 비교한다.
4. Ctrl 또는 C를 누른 채 이동해 Crouch Walk를 확인한다.
5. F3으로 경비원 상태 동작을 순환한다.
6. F6으로 왕관 획득과 Alert 전환을 확인한다.
7. F8에서 라커 진입과 이탈 자세를 확인한다.

## 검증 결과

- TypeScript 및 Vite production build 통과
- 브라우저에서 `IDLE → WALK`, `RUN`, `CROUCH_WALK` 상태 전환 확인
- 브라우저에서 Guard `PATROL → SUSPICIOUS` 상태와 애니메이션 동기화 확인
- 라커 진입·이탈 애니메이션 상태 연결 확인
- Console error 및 warning 없음
- 손전등 하향각을 조정해 밝은 지면 중심이 경비 앞 약 4m에 오도록 보정
- 서쪽 기둥과 겹치던 순찰 경로 수정 및 경로 정체 자동 복구 추가
- F3 애니메이션 미리보기가 더 이상 경비 AI를 정지시키지 않도록 변경

인앱 브라우저의 WebGL 성능은 매우 낮아 최종 보폭·Blend 감각은 일반 Chrome 1080p에서 한 번 더 눈으로 확인해야 한다.

## 기능 완료 현황

| 항목 | 상태 |
|---|---|
| Player Idle / Walk / Run / Crouch / Crouch Walk | 완료 |
| Stand/Crouch 충돌·탐지 높이 동기화 | 완료 |
| Interact와 오른손 Crown 접촉 타이밍 | 완료 |
| Hide Enter / Hidden / Hide Exit | 완료 |
| Guard Patrol / Turn / Suspicious / Investigate / Search / Alert / Chase | 완료 |
| LOS 상실 후 마지막 위치 조사와 순찰 복귀 | 완료 |
| Guard 추격과 체포 실패 | 완료 |
| 손전등 손 위치·Root 방향·LOS 동기화 | 완료 |
| 이동 거리 기반 발 접촉 이벤트 | 완료 |
| Marble / Carpet / Metal 발소리 | 완료 |
| Player Noise와 Guard 청각 조사 | 완료 |

현재 관절형 캐릭터는 최종 GLB가 들어와도 게임 상태 코드를 바꾸지 않고 Visual만 교체할 수 있는 구조다. 최종 Humanoid GLB 교체는 원본 모델·Rig 에셋이 필요한 시각 자산 작업이며, 현재 기획 기능의 코드 미완성 항목으로 남기지 않는다. 외부 배포, Chrome·Edge 장시간 체감과 목표 FPS는 별도 검수 항목이다.
