# /admin Cafe24 Webhook 수신 로그 UI 개선 보고서

작성일: 2026-07-01

## 1. 작업 목적

Cafe24 Webhook 기반 파일 자동 연결이 정상 작동하는 상태에서, `/admin`의 Webhook 수신 로그를 운영자가 더 쉽게 읽을 수 있도록 표시 방식을 개선했다.

이번 작업은 Webhook 수신/자동 연결 로직을 변경하지 않고, 관리자 화면 표시 UI만 개선했다.

## 2. 수정한 파일

- `src/app/admin/page.tsx`
- `src/app/globals.css`

## 3. processed_status 한글 라벨 매핑

| 원본 status | 한글 라벨 |
| --- | --- |
| `received` | 수신됨 |
| `auto_linked` | 자동 연결 완료 |
| `already_linked` | 이미 연결됨 |
| `no_order_id` | 주문번호 없음 |
| `no_file_id` | 업로드 파일 ID 없음 |
| `file_not_found` | 업로드 파일 없음 |
| `conflict_order_id` | 다른 주문번호 연결됨 |
| `failed` | 처리 실패 |

## 4. event_type 한글 라벨 매핑

| 원본 event_type | 한글 라벨 |
| --- | --- |
| `order.received` | 주문 접수 |
| `order.updated` | 주문 상태 변경 |
| `order.created` | 주문 생성 |
| `deployment.check` | 배포 확인 |
| `unknown` | 알 수 없음 |

## 5. UI 변경 내용

### Webhook 수신 로그 테이블

`/admin`의 `Cafe24 Webhook 수신 로그` 섹션에서 아래 항목을 개선했다.

- `event_type` 컬럼을 `이벤트`로 변경
- `processed_status` 컬럼을 `처리 상태`로 변경
- `error_message` 컬럼을 `처리 메시지`로 변경
- 이벤트 타입은 한글 라벨로 표시
- 처리 상태는 한글 배지로 표시

### 상태 배지 색상

성공 상태:

- `auto_linked`
- `already_linked`

위 상태는 초록 계열 배지로 표시한다.

주의/실패 상태:

- `no_order_id`
- `no_file_id`
- `file_not_found`
- `conflict_order_id`
- `failed`

위 상태는 주황 계열 배지로 표시한다.

### 긴 메시지 처리

`error_message`가 긴 경우 테이블이 깨지지 않도록 아래 CSS를 추가했다.

- `max-width`
- `white-space: normal`
- `overflow-wrap: anywhere`
- `word-break: break-word`

## 6. 유지한 기능

아래 기존 기능은 변경하지 않았다.

- Cafe24 Webhook 수신
- Webhook 기반 `files.order_id` 자동 연결
- 중복 Webhook `already_linked` 처리
- `/admin` Webhook 수신 로그 로딩
- Cafe24 주문 조회 테스트
- 주문번호 검색
- `file_id` 검색
- 파일 다운로드
- 파일 상태 변경
- 최근 업로드 파일 목록
- 고객용 `product-upload-widget.js`

## 7. 보안 기준

- payload raw 전체는 화면에 표시하지 않는다.
- 기존처럼 payload 요약만 표시한다.
- token, secret, authorization, signature 등 민감정보는 화면에 표시하지 않는다.
- 이번 작업은 표시 UI 개선만 포함하며 Webhook 저장 로직은 변경하지 않았다.

## 8. 테스트 결과

- `npm run typecheck`: 통과
- `npm run build`: 통과

빌드 중 기존 `/api/cafe24/auth/start` route의 dynamic server usage 경고가 출력됐지만, build exit code는 0으로 성공했다.

## 9. 운영 확인 방법

1. `/admin` 로그인
2. `Cafe24 Webhook 수신 로그` 섹션 확인
3. `order.received`가 `주문 접수`으로 표시되는지 확인
4. `auto_linked`가 `자동 연결 완료`로 표시되는지 확인
5. `already_linked`가 `이미 연결됨`으로 표시되는지 확인
6. 실패/주의 상태가 주황 계열 배지로 표시되는지 확인
7. 긴 처리 메시지가 테이블을 깨지 않도록 줄바꿈되는지 확인
8. payload 요약만 표시되고 raw payload 전체가 표시되지 않는지 확인

## 10. 커밋/푸시/배포 여부

- 커밋: 아직 안 함
- 푸시: 아직 안 함
- Vercel Production 배포: 아직 안 함

