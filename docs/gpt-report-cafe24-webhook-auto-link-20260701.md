# Cafe24 Webhook 기반 파일 자동 연결 구현 보고서

작성일: 2026-07-01

## 1. 작업 목적

Cafe24 Webhook 수신 후 payload에서 `order_id`를 추출하고, Cafe24 Admin API 주문 상세/주문 품목 조회를 실행해 업로드 파일 ID를 찾은 뒤 Supabase `files.order_id`를 자동 연결하는 기능을 구현했다.

이번 작업은 실제 Webhook payload가 운영 서버에 들어오는 것이 확인된 다음 단계다.

## 2. 수정한 파일

- `src/app/api/cafe24/webhooks/route.ts`
- `src/lib/cafe24/webhook-events.ts`

## 3. 재사용한 기존 함수

기존 구현을 재사용해 중복 업데이트 로직을 줄였다.

- `fetchCafe24OrderLookup`
  - Cafe24 주문 상세 조회
  - Cafe24 주문 품목 조회
  - 주문 품목 내 업로드 파일 ID 추출
- `getFileById`
  - Supabase `files.id` 기준 파일 조회
- `updateFileOrderId`
  - Supabase `files.order_id`, `files.updated_at` 갱신

## 4. Webhook 자동 연결 처리 흐름

`POST /api/cafe24/webhooks` 처리 흐름:

1. Webhook JSON body 파싱
2. payload와 headers를 마스킹 후 `cafe24_webhook_events`에 먼저 저장
3. 저장 성공 후 같은 row 기준으로 자동 연결 처리 시작
4. payload에서 `order_id` 추출
5. `order_id`가 없으면 `processed_status = no_order_id`
6. `order_id`가 있으면 Cafe24 Admin API 주문 상세/주문 품목 조회 실행
7. 주문 품목에서 업로드 파일 ID 추출
8. 업로드 파일 ID가 없으면 `processed_status = no_file_id`
9. file_id가 있으면 Supabase `files.id` 조회
10. 파일이 없으면 `processed_status = file_not_found`
11. `files.order_id`가 비어 있으면 Webhook `order_id`로 업데이트
12. 업데이트 성공 시 `processed_status = auto_linked`
13. 이미 같은 주문번호로 연결되어 있으면 `processed_status = already_linked`
14. 다른 주문번호가 이미 연결되어 있으면 덮어쓰지 않고 `processed_status = conflict_order_id`
15. 예외 발생 시 `processed_status = failed`

## 5. processed_status 목록

이번 작업에서 사용하는 상태값:

- `received`
- `auto_linked`
- `already_linked`
- `no_order_id`
- `no_file_id`
- `file_not_found`
- `conflict_order_id`
- `failed`

## 6. 여러 file_id 처리

Cafe24 주문 품목에서 여러 업로드 파일 ID가 발견될 수 있으므로 각 file_id를 순차 처리한다.

처리 결과는 `error_message`에 민감정보 없이 요약한다.

예:

```txt
auto_linked=1, already_linked=1, file_not_found=0, conflict_order_id=0
```

최종 `processed_status` 우선순위:

1. 하나라도 새로 연결되면 `auto_linked`
2. 모두 이미 같은 주문번호에 연결된 경우 `already_linked`
3. 다른 주문번호와 충돌이 있으면 `conflict_order_id`
4. 파일을 찾지 못하면 `file_not_found`
5. 그 외 예상 밖의 경우 `failed`

## 7. Webhook 응답 안정성

Cafe24가 Webhook 실패로 계속 재전송하지 않도록 아래 원칙을 적용했다.

- payload 저장 실패: `500`
- payload 저장 성공 후 자동 연결 실패: 가능한 경우 `200`
- 자동 연결 실패 내용은 `processed_status`와 `error_message`에 저장

즉, 자동 연결 실패만으로 Cafe24에 실패 응답을 보내지 않도록 했다.

## 8. event_no 처리

실제 Cafe24 Webhook에서 `event_no = 90023`이 들어오는 것이 확인되어 이벤트 타입 매핑을 추가했다.

- `event_no = 90023` → `event_type = order.received`
- `event_no = 90025` → `event_type = order.updated`
- 그 외 이벤트 타입 후보가 없으면 `unknown`

## 9. 보안 기준

아래 값은 화면/API 응답/DB 로그에 원문 노출하지 않도록 유지했다.

- `authorization`
- `access_token`
- `refresh_token`
- `client_secret`
- `secret`
- `token`
- `signature`
- `password`
- `cookie`
- Supabase service role key
- Naver Object Storage key
- signed URL 원문

headers와 payload는 기존 마스킹 함수를 계속 사용한다.

## 10. 기존 기능 유지 여부

아래 기능은 건드리지 않았다.

- `/admin` 로그인
- Cafe24 주문 조회 테스트
- Cafe24 주문 조회 기반 자동 연결 버튼
- file_id 검색
- 주문번호 검색
- 주문번호 수동 연결
- 파일 다운로드
- 다운로드 로그/CSV
- 상태 변경
- 상태 변경 이력
- 최근 업로드 파일 목록/필터
- 고객용 `product-upload-widget.js`

## 11. 검증 결과

실행한 명령:

```bash
npm run typecheck
npm run build
```

결과:

- `npm run typecheck`: 통과
- `npm run build`: 통과

빌드 결과:

```txt
ƒ /api/cafe24/webhooks
```

## 12. 운영 테스트 기준

테스트 대상:

```txt
order_id = 20260701-0000026
file_id = 361f8b91-b8d1-4e91-b891-8d5c8e899235
event_no = 90023
```

테스트 순서:

1. 변경분 배포
2. `/api/cafe24/webhooks`에 실제와 유사한 payload POST
3. `cafe24_webhook_events` row 저장 확인
4. `processed_status`가 `auto_linked` 또는 이미 연결된 경우 `already_linked`인지 확인
5. Supabase `files.order_id`가 `20260701-0000026`으로 저장됐는지 확인
6. `/admin` 주문번호 검색에서 `20260701-0000026`로 파일이 검색되는지 확인
7. 같은 payload를 다시 POST했을 때 `already_linked`로 처리되는지 확인
8. 기존 `/admin` 기능이 유지되는지 확인

## 13. 현재 커밋/푸시/배포 상태

현재 상태:

- 코드 구현 완료
- 보고서 작성 완료
- 커밋 전
- GitHub push 전
- Vercel Production 배포 전

권장 커밋 메시지:

```txt
feat: auto link files from cafe24 webhooks
```

커밋 대상 후보:

- `src/app/api/cafe24/webhooks/route.ts`
- `src/lib/cafe24/webhook-events.ts`
- `docs/gpt-report-cafe24-webhook-auto-link-20260701.md`

주의:

- 현재 작업공간에는 이번 작업과 무관한 기존 변경 파일과 미추적 문서가 남아 있으므로, 커밋 시 위 파일만 선별해서 포함해야 한다.
