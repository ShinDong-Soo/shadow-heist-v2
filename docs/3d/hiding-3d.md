# 3D 은신 시스템 — Phase 08

이 문서는 버튼 없이 환경 뒤에 숨는 **자연 은폐**와, 문을 열고 들어가는 **전용 Locker 은신**을 설명한다.

## 두 가지 은신 방식

| 방식 | 예시 | 입력 | 특징 |
|---|---|---|---|
| 자연 은폐 | 벽, 기둥, 조각상, 높은 전시대, 기록 선반 | 없음 | 계속 움직일 수 있지만 경비 방향에 맞춰 자리를 바꿔야 한다. |
| 전용 은신처 | 직원용 Locker | `E` | 강한 LOS 차단 대신 이동과 시야가 제한된다. |

자연 은폐에는 `HIDDEN` 상태를 붙이지 않는다. Guard와 Player 사이의 실제 3D Mesh가 Raycast를 막으면 `GuardVision`이 `BLOCKED`를 반환한다. 따라서 환경과 판정 규칙이 일치한다.

## Locker 구조

```text
HideSpotRoot
├─ EntryPoint       가까이에서 E를 누르는 위치
├─ HidePoint        실제로 캐릭터가 머무는 내부 위치
├─ ExitPoint        나올 때 배치되는 안전 위치
├─ CameraTarget     은신 카메라가 바라보는 위치
├─ 금속 외벽        이동과 Guard LOS 차단
└─ 회전문            열기·닫기 연출과 LOS 차단
```

Locker는 왕관실 북동쪽 Archive 선반 옆에 한 개만 배치했다. 왕관실 전체에 안전한 Locker를 여러 개 두지 않아 기둥과 조각상 이동이 여전히 기본 전략이 되도록 했다.

## Player 상태

```text
NORMAL
→ ENTERING_HIDE
→ HIDDEN
→ EXITING_HIDE
→ NORMAL
```

진입과 이탈은 각각 약 0.82초다.

1. 문이 열린다.
2. Player가 시작 위치에서 HidePoint까지 부드럽게 이동한다.
3. 문이 닫힌다.
4. 이동이 잠기고 `E EXIT LOCKER`만 사용할 수 있다.

이탈할 때도 반대 순서로 ExitPoint까지 이동한다. 순간이동이나 캐릭터 삭제 방식이 아니다.

## Guard LOS와 마지막 목격 위치

Locker 외벽과 문에는 `blocksVision`이 설정되어 있다. 문이 닫히면 Guard의 실제 Ray가 Player보다 먼저 Locker Mesh에 닿는다.

경비가 진입 장면을 보고 있었다면 다음 정보는 유지된다.

- `OBSERVED YES`
- `GuardVision.lastVisiblePosition`
- 기존 Detection 수치

이제 이 정보는 저장만 하는 값이 아니다. 경비는 Locker 앞까지 `INVESTIGATE`로 접근하고, 약 1초간 `SEARCH` 동작을 한 뒤 문을 연다. 플레이어가 아직 안에 있으면 `FOUND IN LOCKER` 실패로 전환된다. 진입을 목격하지 않았고 Lockdown 장기 은신 조건도 아니라면 닫힌 Locker는 안전하다.

Detection을 강제로 0으로 만들지 않는다. 문이 닫혀 LOS가 끊긴 뒤 기존 감소 속도로 자연스럽게 내려간다. 브라우저 테스트에서는 `DETECTED 100%` 상태로 들어간 뒤 문이 닫히자 Locker 문에 Ray가 차단되고 `SUSPICIOUS 58%`로 감소하는 것을 확인했다.

## Locker 내부 카메라와 정보 제한

초기 HIDE 카메라는 탑다운 화면을 조금 확대하는 방식이어서 주변 공간이 대부분 보였고, 실제 Locker에 들어간 느낌이 약했다. 현재는 HIDE 상태에서 **Locker 내부 눈높이 시점**으로 전환한다.

- 카메라 높이는 약 1.3m다.
- 반경은 약 1.35m로 줄어든다.
- 카메라는 Locker 안쪽에서 바깥 복도를 향한다.
- 실제 금속문 상·하판 사이의 관찰 틈으로만 바깥이 보인다.
- 관찰 틈에는 금속 세로대가 있어 Locker 문 구조가 전경에 남는다.
- 이동 Look Ahead가 사라진다.
- 진입과 이탈 때 원래 탑다운 카메라와 부드럽게 보간한다.

화면 전체를 검게 끄지는 않지만 위·아래와 좌우 대부분을 Locker 내부 금속으로 가린다. 중앙의 좁은 수평 틈에서는 경비 일부와 손전등만 볼 수 있다. 일반 헤더와 안내는 약해지고 다음 정보만 강조된다.

```text
[E] EXIT LOCKER
FOOTSTEPS LEFT · APPROACHING
```

정확한 Guard 좌표나 거리는 표시하지 않는다.

## 발소리와 접근 압박

`StealthAudioSystem`은 Guard가 실제로 이동한 거리를 누적해 발걸음을 재생한다.

- 10m 밖에서는 들리지 않는다.
- 가까울수록 음량이 곡선 형태로 증가한다.
- Player 기준 Guard의 좌우 위치를 Stereo Panning에 반영한다.
- HIDDEN에서는 발소리를 조금 더 분명하게 들려준다.
- Guard가 매우 가까울 때만 작은 숨소리와 붉은 가장자리 압박을 추가한다.

Locker 문에는 작은 금속 열림·닫힘 소리가 있다. 진입 자체로 경비를 부르는 소음 판정은 이번 단계에 넣지 않았다.

## Lockdown 장기 은신 방지

Lockdown 중 같은 Locker에서 5.5초 이상 머무르면 경비가 해당 위치를 조사한다. 숨기 게이지나 강제 퇴장 대신 실제 Guard 행동으로 압박을 만든다.

```text
HIDDEN 5.5초
→ Guard INVESTIGATE
→ Locker 앞 SEARCH
→ 계속 안에 있으면 문 개방 및 실패
```

경비가 도착하기 전에 `E`로 나와 다른 엄폐물로 이동할 수 있다. 따라서 Locker는 잠깐 위험을 피하는 수단이지 Lockdown 전체를 건너뛰는 정답이 아니다.

## Archive 선반

북동쪽에 높이 2.35m인 기록 선반 두 개와 약 1.28m 폭의 통로를 만들었다.

- 선반 본체는 각각 하나의 Mesh다.
- 책 수백 개를 만들지 않고 통합된 금색 선반 띠로 재질감을 표현한다.
- Player와 Guard 이동을 막는다.
- Guard LOS와 손전등 그림자를 막는다.
- 시각적인 작은 장식 틈은 판정상 완전 차단으로 유지한다.

선반을 추가한 뒤 기존 Guard 시작점과 복귀 경로가 선반 충돌 영역에 들어가 경비가 멈추는 문제가 있었다. 현재 순찰은 다음처럼 선반 통로를 정상적으로 빠져나온다.

```text
Archive 통로 3.20, 6.90
→ 남쪽 통로 입구 3.20, 4.85
→ 전시실 순찰
→ 남쪽 입구로 복귀
→ Archive 통로 진입
```

## 공통 상호작용

`InteractionSystem`이 현재 사용할 수 있는 상호작용을 우선순위로 고른다.

```text
Locker HIDE/EXIT 우선순위 100
Crown STEAL 우선순위 50
```

입력 자체는 기존 `InputManager`의 `E`를 재사용한다. 별도의 은신 전용 입력 시스템은 만들지 않았다.

## 담당 파일

| 파일 | 역할 |
|---|---|
| `entities/hide/HideSpot.ts` | 모든 전용 은신처의 공통 Point와 상호작용 조건 |
| `entities/hide/LockerHideSpot.ts` | Locker Mesh, 충돌, 문 회전 |
| `entities/player/PlayerHideController.ts` | Player 상태, 진입·이탈 보간, 이동 잠금 |
| `systems/InteractionSystem.ts` | Crown과 Hide 상호작용 우선순위 |
| `systems/StealthAudioSystem.ts` | 거리·좌우·표면 기반 발소리, 문 소리, 가까운 숨소리 |
| `systems/NoiseSystem.ts` | Player 발 접촉 소음 반경과 Guard 청각 이벤트 |
| `camera/GameCamera.ts` | HIDE 카메라 상태와 부드러운 전환 |
| `entities/guard/GuardVision.ts` | 실제 Geometry Raycast와 마지막 목격 위치 |

## 테스트 키

| 키 | 테스트 |
|---|---|
| `F5` | 기둥 뒤 LOS 차단 |
| `F8` | Locker 입구로 이동 |
| `F9` | Guard가 Locker 진입을 보는 상황 |
| `F10` | 기록 선반 반대편 LOS 차단 |
| `F6` | Lockdown 시작 |
| `F7` | Lockdown을 5초 남은 상태로 단축 |
| `R` | 전체 상태 초기화 |

## 검증 결과

| 항목 | 결과 |
|---|---|
| 기둥 자연 은폐 | `BLOCKED · safe-route-pillar-middle` |
| 선반 자연 은폐 | `BLOCKED · archive-shelf-cover-west` |
| Locker 진입과 문 연출 | 정상 |
| HIDDEN 중 W 이동 | 위치 변화 없음 |
| E 이탈과 ExitPoint | 정상 |
| HIDE 카메라와 제한 UI | 정상 |
| Locker 내부 시점 | 높이 약 1.3m, 반경 약 1.4m, 복도 방향 관찰 틈 확인 |
| Guard 선반 통로 순찰 | 멈춤 없이 `3.20, 6.53 → 3.20, 4.85 → 2.55, 4.82` 이동 확인 |
| 경비 목격 상태 진입 | `OBSERVED YES`, Detection 유지 |
| 닫힌 Locker LOS | `BLOCKED · hide-locker-door` |
| 목격된 Locker 조사 | `INVESTIGATE → SEARCH → FOUND IN LOCKER` 연결 |
| Lockdown 장기 은신 | 5.5초 뒤 `LOCKDOWN_SWEEP` 조사 요청 |
| Console 경고·오류 | 0건 |
| TypeScript·배포 빌드 | 완료 |
| 실제 PC에서 발소리 좌우 청음 | 확인 필요 |
| 1080p 60FPS 장시간 Lockdown 체감 | 확인 필요 |
| 공개 배포와 Edge | 남음 |

외부 배포·브라우저별 체감·장시간 FPS는 실제 배포 환경에서 별도로 확인한다. 기능 코드 기준으로는 Guard Locker Search, 체포 실패, 장기 은신 대응과 낮은 전시대 Crouch 탐지 높이까지 연결됐다.
