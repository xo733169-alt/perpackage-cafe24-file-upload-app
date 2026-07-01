# Cafe24 Webhook 수신 테스트 및 payload 저장 기능 보고서

작성일: 2026-07-01

## 1. 작업 목적

Cafe24 Webhook 자동 주문 연결을 바로 구현하기 전에, Webhook 요청이 실제로 서버에 도달하는지 확인하고 수신 payload를 Supabase에 안전하게 저장할 수 있도록 기본 수신/로그 기능을 추가했다.

이번 작업에서는 `files.order_id` 자동 업데이트를 하지 않았다. 목표는 수신 여부, `order_id` 포함 여부, 이벤트 타입, payload 구조를 확인하는 것이다.

## 2. 수정/추가한 파일

- `src/app/api/cafe24/webhooks/route.ts`
- `src/lib/cafe24/webhook-events.ts`
- `src/app/admin/page.tsx`
- `supabase/schema.sql`
- `docs/gpt-report-cafe24-webhook-receive-log-20260701.md`

## 3. 추가한 API route

추가 경로:

```txt
POST /api/cafe24/webhooks
```

동작:

- JSON body 수신
- JSON 파싱 실패 시 `400 Invalid JSON body.`
- 수신 성공 시 Supabase `cafe24_webhook_events`에 row 저장
- 저장 성공 시 `200` 응답
- 저장 실패 시 안전한 요약만 서버 로그에 남기고 `500` 응답

응답 예:

```json
{
  "ok": true,
  "id": "...",
  "mall_id": "peerl",
  "event_type": "order.created",
  "order_id": "20260701-0000017",
  "processed_status": "received"
}
```

## 4. 사용한 Supabase 테이블

테이블명:

```txt
public.cafe24_webhook_events
```

현재 프로젝트 `supabase/schema.sql`에 아래 SQL을 추가했다. 운영 Supabase DB에는 SQL Editor에서 별도 실행이 필요하다.

```sql
create table if not exists public.cafe24_webhook_events (
  id uuid primary key default gen_random_uuid(),
  mall_id text,
  event_type text not null default 'unknown',
  order_id text,
  payload jsonb not null default '{}'::jsonb,
  headers_summary jsonb not null default '{}'::jsonb,
  received_at timestamptz not null default now(),
  processed_status text not null default 'received',
  error_message text,
  created_at timestamptz not null default now()
);

create index if not exists cafe24_webhook_events_received_at_idx on public.cafe24_webhook_events (received_at desc);
create index if not exists cafe24_webhook_events_order_id_idx on public.cafe24_webhook_events (order_id);
create index if not exists cafe24_webhook_events_event_type_idx on public.cafe24_webhook_events (event_type);
```

## 5. Webhook payload 저장 방식

저장 필드:

- `mall_id`
- `event_type`
- `order_id`
- `payload`
- `headers_summary`
- `received_at`
- `processed_status`
- `error_message`
- `created_at`

`processed_status`는 이번 단계에서 `received`로 저장한다. 자동 연결, 주문 상세 조회, `files.order_id` 업데이트는 하지 않는다.

## 6. order_id 추출 방식

아래 후보 경로를 순서대로 확인한다.

- `order_id`
- `order.order_id`
- `resource.order_id`
- `data.order_id`
- `event.order_id`
- `orders[0].order_id`

찾지 못하면 `order_id = null`로 저장한다.

## 7. event_type 추출 방식

payload 후보:

- `event_type`
- `event`
- `topic`
- `resource_type`

header 후보:

- `x-cafe24-event-type`
- `x-cafe24-event`
- `x-cafe24-topic`
- `x-event-type`
- `x-event`
- `x-topic`

찾지 못하면 `unknown`으로 저장한다.

## 8. 민감정보 마스킹 방식

아래 key가 payload 또는 headers에 포함되면 원문을 저장하지 않고 `[masked]`로 처리한다.

- `authorization`
- `access_token`
- `refresh_token`
- `client_secret`
- `secret`
- `token`
- `signature`
- `password`
- `cookie`
- `api-key`
- `api_key`

문자열 값은 너무 길게 저장되지 않도록 길이 제한을 둔다. `/admin` 화면에는 payload 전체를 출력하지 않고 top-level keys, mall_id, order_id 후보만 표시한다.

## 9. /admin 표시 UI

`/admin`에 아래 섹션을 추가했다.

```txt
Cafe24 Webhook 수신 로그
```

표시 항목:

- 수신일시
- `event_type`
- `order_id`
- `processed_status`
- `error_message`
- payload 요약

payload 요약:

- top-level keys
- `mall_id`
- `order_id` 후보

최근 10개만 표시한다.

## 10. 기존 기능 유지 여부

아래 기능은 변경하지 않았다.

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

빌드 결과에 아래 route가 추가된 것을 확인했다.

```txt
ƒ /api/cafe24/webhooks
```

## 12. 수동 테스트 방법

운영 Supabase에 `cafe24_webhook_events` 테이블 SQL을 먼저 적용한 뒤 테스트한다.

테스트 요청 예:

```bash
curl -X POST https://perpackage-cafe24-file-upload-app.vercel.app/api/cafe24/webhooks \
  -H "Content-Type: application/json" \
  -d "{\"event_type\":\"order.created\",\"mall_id\":\"peerl\",\"order_id\":\"20260701-0000017\",\"data\":{\"order_id\":\"20260701-0000017\"}}"
```

확인 항목:

1. API 응답이 `200`인지 확인
2. Supabase `cafe24_webhook_events`에 row 생성 확인
3. `order_id = 20260701-0000017` 저장 확인
4. `processed_status = received` 저장 확인
5. `/admin`의 “Cafe24 Webhook 수신 로그”에 이벤트 표시 확인
6. 민감 header가 `[masked]` 처리되는지 확인
7. 기존 `/admin` 기능이 유지되는지 확인

## 13. 남은 작업

- Cafe24 Developers에 실제 Webhook URL 등록
- 실제 Cafe24 Webhook payload 구조 확인
- payload에 file_id가 직접 포함되는지 확인
- payload에 file_id가 없으면 주문 품목 API 재조회 흐름 연결
- 이후 단계에서만 `files.order_id` 자동 연결 구현

## 14. 커밋/푸시/배포 여부

현재 상태:

- 코드 구현 완료
- 문서 작성 완료
- 커밋 전
- GitHub push 전
- Vercel Production 배포 전

운영 반영 전 확인:

- Supabase SQL Editor에서 `cafe24_webhook_events` 테이블 생성 SQL 실행 필요
- Vercel Production 배포 후 `/api/cafe24/webhooks` 테스트 필요
