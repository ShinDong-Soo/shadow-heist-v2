# 변경 이력

이 문서는 각 프로토타입에서 크게 바뀐 분야만 기록한다. 기능의 상세한 현재 동작은 [개발 문서 목차](README.md)의 담당 문서에서 관리한다.

## Prototype 14

변경 분야:

- F2 실시간 플레이테스트 패널
- 경비 상태, 감지, 소음, 노출, 봉쇄 정보 표시
- 경비 A* 경로와 소음 파동 표시 전환
- 최근 5회 플레이 요약
- 전체 플레이 기록 JSON 내보내기와 초기화
- 주요 밸런스 수치를 `balance.ts`로 분리
- 플레이테스트 도구 문서 추가

관련 문서:

- [플레이테스트 도구와 밸런스](playtest-tools.md)
- [플레이테스트](playtest.md)
- [기술 안내](technical-guide.md)
- [UI와 그래픽](ui-and-visuals.md)

## Prototype 13

변경 분야:

- 왕관실 CCTV를 우측 상단 모서리로 이동
- 왕관과 보안문 접근로를 향하도록 회전 범위 수정
- 벽에 과도하게 막히는 CCTV 배치 자동 경고
- CCTV 배치 확인 항목 추가

관련 문서:

- [CCTV](cctv.md)
- [플레이테스트](playtest.md)

## Prototype 12

변경 분야:

- 한 번 본 구역의 탐색 기억
- 미탐색·기억·현재 시야의 3단계 안개
- LOS와 닫힌 문을 반영한 탐색 판정
- MAP 탐색률 HUD
- 재시작 시 탐색 기억 초기화
- 최대 탐색률 플레이테스트 기록
- 탐색 격자 계산 모듈 분리

관련 문서:

- [맵, 시야, 조명](map-vision-lighting.md)
- [UI와 그래픽](ui-and-visuals.md)
- [플레이테스트](playtest.md)

## Prototype 11

변경 분야:

- C 키 웅크리기 이동
- 웅크리기 전용 속도, 보행 간격, 소음 범위
- 경비와 CCTV 탐지 거리·속도 감소
- 웅크린 캐릭터 실루엣과 소음 HUD
- 웅크리기 플레이테스트 시간 기록
- 세 단계 이동 소음 계산 확장

관련 문서:

- [플레이어와 조작](player-and-controls.md)
- [사운드](audio.md)
- [경비원 AI](guard-ai.md)
- [CCTV](cctv.md)
- [UI와 그래픽](ui-and-visuals.md)
- [플레이테스트](playtest.md)

## Prototype 10

변경 분야:

- 보물 소지 중 CCTV 경보의 출구 봉쇄
- 마지막 보물 획득 시 강화 봉쇄
- 반복 경보의 봉쇄 시간 연장
- 봉쇄 남은 시간 HUD와 출구 차단 표현
- 봉쇄 경고·반복·해제 사운드
- 봉쇄 생존 및 출구 시도 플레이테스트 기록
- 봉쇄 시간 계산 모듈 분리

관련 문서:

- [강탈과 점수](heist-and-scoring.md)
- [사운드](audio.md)
- [UI와 그래픽](ui-and-visuals.md)
- [플레이테스트](playtest.md)

## Prototype 09

변경 분야:

- 브라보 경비 추가
- 두 경비의 독립 순찰, 감지, 조사, 추격, 수색
- 발각·CCTV·보물·큰 문 소음의 무전 위치 공유
- 가장 가까운 경비 기준 접근음
- 경비별 시야와 캐릭터 표시
- 무전 및 협동 조사 플레이테스트 기록
- 경비 자료형과 브라보 순찰 데이터 모듈 분리

관련 문서:

- [경비원 AI](guard-ai.md)
- [사운드](audio.md)
- [UI와 그래픽](ui-and-visuals.md)
- [플레이테스트](playtest.md)

## Prototype 08

변경 분야:

- 일반 문 열기와 닫기
- 문 상태에 따른 충돌, LOS, 조명, 길찾기 변화
- 키카드와 왕관 보관실 잠금문
- 문 조작 소음과 경비 조사
- 출입 권한 HUD
- 문·키카드 플레이테스트 기록
- 문과 출입 데이터 모듈 분리

관련 문서:

- [문과 출입 권한](doors-and-access.md)
- [경비원 AI](guard-ai.md)
- [사운드](audio.md)
- [플레이테스트](playtest.md)

## Prototype 07

변경 분야:

- 일반 걷기와 조심 걷기의 보행 소음
- 벽 차폐 및 경계 단계에 따른 경비 청취 거리
- 발소리 위치 조사 AI
- 보물 수에 따른 소음 위험 증가
- 플레이어 소음 HUD와 원형 파동
- 소음 플레이테스트 기록
- 소음 계산 모듈 분리

관련 문서:

- [사운드](audio.md)
- [플레이어와 조작](player-and-controls.md)
- [경비원 AI](guard-ai.md)
- [플레이테스트](playtest.md)

## Prototype 06

변경 분야:

- 회전 CCTV 3대
- 누적 감지와 재사용 대기 상태
- CCTV 경보의 경비 조사 및 전역 경계 연동
- 일회용 CCTV 제어반과 자동 복구
- 은신 및 조명 노출도 연동
- CCTV 모터·경보·제어반 사운드
- CCTV 플레이테스트 기록
- 공통 시야 계산 모듈 분리

관련 문서:

- [CCTV](cctv.md)
- [경비원 AI](guard-ai.md)
- [맵, 시야, 조명](map-vision-lighting.md)
- [사운드](audio.md)
- [플레이테스트](playtest.md)

## Prototype 05

변경 분야:

- 은신처 5개
- 은신 진입과 이탈
- 은신 중 이동 및 시야 제한
- 경비의 은신 목격과 `HIDE_CHECK`
- 높은 경계 단계의 은신처 수색
- 은신 효과음과 플레이테스트 기록
- 은신처 데이터 모듈 분리

관련 문서:

- [숨기 시스템](hiding.md)
- [경비원 AI](guard-ai.md)
- [사운드](audio.md)
- [플레이테스트](playtest.md)

## Prototype 04

변경 분야:

- 벽에 차단되는 조명
- 플레이어 노출도
- 밝기 기반 시야와 경비 탐지
- 전시 스포트라이트
- 경계 단계별 비상등
- 일회용 조명 스위치
- 조명 환경음

관련 문서:

- [맵, 시야, 조명](map-vision-lighting.md)
- [사운드](audio.md)
- [UI와 그래픽](ui-and-visuals.md)

## Prototype 03

변경 분야:

- 보물 3개
- 선택적 조기 탈출
- 연속 획득 점수 배수
- 전역 경계 단계
- 강탈 현황 HUD
- 점수 플레이테스트 기록

관련 문서:

- [강탈과 점수](heist-and-scoring.md)
- [UI와 그래픽](ui-and-visuals.md)
- [플레이테스트](playtest.md)

## Prototype 02

변경 분야:

- 경비원 상태 AI
- A* 길찾기
- 마지막 목격 지점 조사와 수색
- Fake 2.5D 환경
- 캐릭터 보행 애니메이션
- 벽 너머 사운드 차폐
- 플레이테스트 기록

관련 문서:

- [경비원 AI](guard-ai.md)
- [UI와 그래픽](ui-and-visuals.md)
- [사운드](audio.md)
- [플레이테스트](playtest.md)

## Prototype 01

변경 분야:

- 플레이어 이동
- 박물관 맵과 충돌
- 제한 시야와 LOS
- 경비원 한 명의 순찰과 시야
- 거리 및 방향 기반 접근음
- 단일 보물과 출구
- 추격, 성공, 실패, 재시작

관련 문서:

- [플레이어와 조작](player-and-controls.md)
- [맵, 시야, 조명](map-vision-lighting.md)
- [경비원 AI](guard-ai.md)
- [사운드](audio.md)

## 기록 규칙

새 프로토타입을 개발하면 문서 가장 위에 다음 내용만 추가한다.

1. 버전 이름
2. 변경된 분야 목록
3. 관련 담당 문서 링크

상세 기능 설명은 이 파일에 복사하지 않는다.
