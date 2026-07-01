# 주문번호 연결 이력 로그 추가 보고서

## 1. 작업 목적

`files.order_id`가 언제, 어떤 경로로 연결되었는지 추적할 수 있도록 주문번호 연결 이력 로그 구조를 추가했습니다.

대상 연결 흐름은 아래 3가지입니다.

- 관리자 file_id 검색 결과에서 주문번호를 직접 입력하는 수동 연결
- Cafe24 주문 조회 테스트 결과에서 업로드 파일 ID를 확인한 뒤 누르는 반자동 연결
- Cafe24 Webhook 자동 연결

## 2. 수정한 파일

- `src/lib/files/order-link-log-service.ts`
- `src/app/admin/actions.ts`
- `src/app/api/cafe24/webhooks/route.ts`
- `src/app/admin/page.tsx`
- `supabase/schema.sql`
- `docs/gpt-report-file-order-link-logs-20260701.md`

## 3. 추가한 Supabase 테이블

테이블명:

```sql
public.file_order_link_logs
```

컬럼:

```txt
id
file_id
previous_order_id
new_order_id
link_source
webhook_event_id
admin_user
memo
created_at
ip_address
user_agent
```

`link_source` 허용값:

```txt
manual
cafe24_order_lookup
webhook
```

## 4. Supabase에서 실행해야 할 SQL

이번 작업에서는 운영 DB에 SQL을 자동 실행하지 않았습니다.
아래 SQL을 Supabase SQL Editor에서 먼저 실행해야 주문번호 연결 이력 로그가 저장됩니다.

```sql
create table if not exists public.file_order_link_logs (
  id uuid primary key default gen_random_uuid(),
  file_id uuid not null references public.files(id) on delete cascade,
  previous_order_id text,
  new_order_id text not null,
  link_source text not null,
  webhook_event_id text references public.cafe24_webhook_events(id) on delete set null,
  admin_user text,
  memo text,
  created_at timestamptz not null default now(),
  ip_address text,
  user_agent text,
  constraint file_order_link_logs_link_source_check
    check (link_source in ('manual', 'cafe24_order_lookup', 'webhook'))
);

create index if not exists file_order_link_logs_file_id_idx
on public.file_order_link_logs (file_id);

create index if not exists file_order_link_logs_new_order_id_idx
on public.file_order_link_logs (new_order_id);

create index if not exists file_order_link_logs_link_source_idx
on public.file_order_link_logs (link_source);

create index if not exists file_order_link_logs_created_at_idx
on public.file_order_link_logs (created_at desc);
```

## 5. 로그 저장 방식

새 서비스:

```txt
src/lib/files/order-link-log-service.ts
```

추가 함수:

```txt
createFileOrderLinkLog()
listFileOrderLinkLogs()
getFileOrderLinkSourceLabel()
```

로그 저장 실패는 기존 연결 기능 실패로 처리하지 않습니다.
Supabase insert 실패 시 안전한 `console.warn`만 남기고, 수동 연결/자동 연결 흐름은 유지됩니다.

## 6. 연결 흐름별 기록 위치

### 수동 연결

파일:

```txt
src/app/admin/actions.ts
```

액션:

```txt
linkFileOrderIdAction
```

로그:

```txt
link_source = manual
admin_user = admin
memo = 관리자 file_id 검색 화면에서 주문번호 수동 연결
```

같은 주문번호로 다시 저장하는 경우 중복 로그는 남기지 않습니다.

### Cafe24 주문 조회 기반 반자동 연결

파일:

```txt
src/app/admin/actions.ts
```

액션:

```txt
linkCafe24LookupFileOrderIdAction
```

로그:

```txt
link_source = cafe24_order_lookup
admin_user = admin
memo = Cafe24 주문 조회 결과에서 업로드 파일 ID 확인 후 주문번호 연결
```

이미 같은 주문번호에 연결된 경우에는 로그를 남기지 않습니다.
다른 주문번호가 이미 연결된 경우에도 기존 정책대로 덮어쓰지 않고 로그를 남기지 않습니다.

### Cafe24 Webhook 자동 연결

파일:

```txt
src/app/api/cafe24/webhooks/route.ts
```

조건:

```txt
files.order_id가 비어 있고 Webhook 주문번호로 새로 연결되는 경우
```

로그:

```txt
link_source = webhook
admin_user = system
webhook_event_id = cafe24_webhook_events.id
memo = Cafe24 Webhook order.received 자동 연결
```

`already_linked`, `conflict_order_id`, `file_not_found`, `no_file_id`, `no_order_id`, `failed` 상태에서는 주문번호 연결 로그를 남기지 않습니다.

## 7. /admin UI 변경

`/admin?file_id=<file_id>` 검색 결과에 아래 섹션을 추가했습니다.

```txt
주문번호 연결 이력
```

표시 항목:

- 연결일시
- 이전 주문번호
- 새 주문번호
- 연결 방식
- 메모

연결 방식 한글 라벨:

- `manual` → 수동 연결
- `cafe24_order_lookup` → Cafe24 주문 조회 연결
- `webhook` → Webhook 자동 연결

이력이 없으면 아래 문구를 표시합니다.

```txt
아직 주문번호 연결 이력이 없습니다.
```

## 8. 변경하지 않은 기존 기능

아래 기능은 변경하지 않았습니다.

- Cafe24 Webhook 수신 API 기본 동작
- Webhook 자동 연결 조건
- `already_linked` 처리
- `conflict_order_id` 처리
- Cafe24 주문 조회 테스트
- Cafe24 주문 조회 기반 자동 연결 버튼 조건
- file_id 검색
- 주문번호 검색
- 주문번호 수동 연결 기존 정책
- 파일 다운로드
- 다운로드 로그 저장
- 파일 상태 변경
- 상태 변경 이력
- 최근 업로드 파일 목록
- Webhook 수신 로그 필터
- 전체 다운로드 로그/CSV

## 9. 보안 기준

로그 테이블과 `/admin` 화면에는 아래 값을 저장하거나 표시하지 않습니다.

- access token
- refresh token
- authorization header
- bearer token
- client secret
- webhook secret
- Supabase service role key
- Naver Object Storage access key
- Naver Object Storage secret key
- signed URL 원문
- JWT 원문
- raw Webhook payload 전체

## 10. 검증 결과

실행 명령:

```bash
npm run typecheck
npm run build
```

결과:

```txt
typecheck: 통과
build: 통과
```

참고:

현재 PowerShell 세션에서 `npm` 명령이 PATH로 직접 잡히지 않아 설치된 `npm.cmd` 절대 경로로 실행했습니다.

## 11. 커밋/푸시/배포 상태

현재 보고서 작성 시점:

```txt
commit: 아직 진행 전
push: 하지 않음
Vercel Production 배포: 하지 않음
```

지시서 기준으로 Production 배포까지 바로 진행하지 않고, push 전 단계에서 멈춰야 합니다.

## 12. 운영 테스트 순서

Supabase SQL 적용 및 배포 후 아래 순서로 확인하면 됩니다.

1. `/admin` 로그인
2. file_id 검색
3. 수동으로 Cafe24 주문번호 연결
4. `file_order_link_logs`에 `link_source=manual` row 생성 확인
5. Cafe24 주문 조회 테스트에서 업로드 파일 ID가 발견된 주문 조회
6. 자동 연결 버튼 클릭
7. `file_order_link_logs`에 `link_source=cafe24_order_lookup` row 생성 확인
8. Cafe24 Webhook 90023 테스트 또는 실제 Webhook 수신
9. 새로 연결되는 파일이면 `link_source=webhook` row 생성 확인
10. `/admin?file_id=<file_id>`에서 주문번호 연결 이력 섹션 표시 확인

## 13. 다음 단계 제안

1. Supabase SQL Editor에서 `file_order_link_logs` 테이블 생성 SQL 실행
2. 이번 코드 변경분을 GitHub main에 push
3. Vercel Production 배포 READY 확인
4. 수동 연결, Cafe24 주문 조회 연결, Webhook 자동 연결 순서로 로그 저장 테스트
5. 운영 로그가 쌓이면 주문번호 기준 연결 이력 검색 또는 전체 연결 이력 목록을 추가
