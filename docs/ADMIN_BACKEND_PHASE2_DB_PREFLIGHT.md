# 관리자 백엔드 2차 DB 사전 점검

## 목적

파일 상태 변경과 상태 이력 저장, 주문번호 연결과 연결 이력 저장을 각각 하나의 DB 트랜잭션으로 묶기 전에 실제 Supabase 스키마를 확인합니다.

현재 저장소의 `supabase/schema.sql`만으로는 `file_reupload_requests` 전체 정의를 재현할 수 없고, `file_order_link_logs.webhook_event_id` 타입도 실제 운영 DB와 일치하는지 확인이 필요합니다.

## 실행 원칙

- 아래 SQL은 조회 전용입니다.
- `drop`, `delete`, `update`, `alter`를 실행하지 않습니다.
- 결과에 고객 개인정보나 token 원문을 포함하지 않습니다.
- 결과 확인 전에는 RPC migration을 적용하지 않습니다.

## Supabase SQL Editor 사전 점검 SQL

아래 조회는 한 파일로도 준비되어 있습니다.

`supabase/preflight/20260710_admin_backend_phase2_readonly_check.sql`

이 파일은 `set transaction read only`로 쓰기를 차단하고 마지막에 `rollback`합니다. Supabase SQL Editor에 파일 전체를 붙여 넣어 실행하면 됩니다.

```sql
select
  table_name,
  column_name,
  data_type,
  udt_name,
  is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name in (
    'files',
    'file_status_change_logs',
    'file_order_link_logs',
    'file_reupload_requests',
    'cafe24_webhook_events'
  )
order by table_name, ordinal_position;
```

```sql
select
  tc.table_name,
  tc.constraint_name,
  tc.constraint_type,
  kcu.column_name,
  ccu.table_name as referenced_table,
  ccu.column_name as referenced_column
from information_schema.table_constraints tc
left join information_schema.key_column_usage kcu
  on tc.constraint_name = kcu.constraint_name
  and tc.constraint_schema = kcu.constraint_schema
left join information_schema.constraint_column_usage ccu
  on tc.constraint_name = ccu.constraint_name
  and tc.constraint_schema = ccu.constraint_schema
where tc.table_schema = 'public'
  and tc.table_name in (
    'files',
    'file_status_change_logs',
    'file_order_link_logs',
    'file_reupload_requests',
    'cafe24_webhook_events'
  )
order by tc.table_name, tc.constraint_name, kcu.ordinal_position;
```

```sql
select
  tablename,
  indexname,
  indexdef
from pg_indexes
where schemaname = 'public'
  and tablename in (
    'files',
    'file_status_change_logs',
    'file_order_link_logs',
    'file_reupload_requests',
    'cafe24_webhook_events'
  )
order by tablename, indexname;
```

## 결과 확인 후 만들 RPC

### `admin_update_file_status`

한 트랜잭션 안에서 다음을 처리합니다.

1. 현재 `files.status`가 요청 당시 상태와 같은지 확인
2. 허용된 상태 전환인지 확인
3. `files.status` 변경
4. `file_status_change_logs` 이력 저장
5. 하나라도 실패하면 전체 취소

### `admin_link_file_order`

한 트랜잭션 안에서 다음을 처리합니다.

1. 파일 존재 여부 확인
2. `order_id`가 비어 있거나 동일한 경우만 허용
3. 다른 주문번호가 있으면 충돌로 중단
4. `files.order_id` 연결
5. `file_order_link_logs` 이력 저장
6. 하나라도 실패하면 전체 취소

## 추가 DB 안전장치 후보

- 동일 `original_file_id`에 사용 가능한 `requested` 재업로드 요청이 여러 개 생기지 않도록 부분 unique index 검토
- `files.status`와 재업로드 상태에 check constraint 적용 여부 검토
- 운영 DB 기준 전체 schema/migration 재작성

이 문서의 조회 결과를 확인한 뒤 실제 migration SQL을 별도로 작성합니다.

## 결과 판정 기준

다음 조건을 모두 확인해야 RPC migration 작성으로 넘어갑니다.

- `files.id`, `file_status_change_logs.file_id`, `file_order_link_logs.file_id`가 모두 `uuid`인지
- `file_order_link_logs.webhook_event_id`와 `cafe24_webhook_events.id` 타입이 외래키로 호환되는지
- `file_status_change_logs`에 `previous_status`, `new_status`, `memo`, `admin_user`, `ip_address`, `user_agent`가 있는지
- `file_order_link_logs`에 `previous_order_id`, `new_order_id`, `link_source`, `webhook_event_id`, `admin_user`, `memo`, `ip_address`, `user_agent`가 있는지
- `invalid_file_status_rows`가 `0`인지
- `duplicate_active_reupload_file_groups`가 `0`인지
- `invalid_reupload_status_rows`가 `0`인지
- `admin_update_file_status`, `admin_link_file_order`라는 기존 함수가 없는지 또는 기존 정의를 먼저 검토했는지

특히 저장소의 `supabase/schema.sql`에는 `file_order_link_logs.webhook_event_id text`가 UUID 기본키를 참조하는 형태로 기록되어 있습니다. 실제 운영 DB 결과가 다를 수 있으므로 이 타입을 추정해서 migration을 만들지 않습니다.

## 결과 공유 방법

SQL Editor 실행 결과에서 다음 세 부분만 전달하면 됩니다.

1. 컬럼 목록 결과
2. 제약조건과 인덱스 결과
3. `check_name`, `issue_count` 집계 결과

실제 파일 ID, 주문번호, token, 고객정보는 조회하거나 전달할 필요가 없습니다.

## 2026-07-10 운영 DB 확인 결과

- `files.id`: `uuid`
- `file_status_change_logs.file_id`: `uuid`
- `file_order_link_logs.file_id`: `uuid`
- `file_order_link_logs.webhook_event_id`: `text`
- `cafe24_webhook_events.id`: `text`
- 파일 및 로그 테이블의 기본키와 파일 외래키 확인
- Webhook 이벤트 외래키 타입 호환 확인
- 잘못된 파일 상태: 0건
- 중복 활성 재업로드 요청 그룹: 0건
- 잘못된 재업로드 상태: 0건
- 기존 `admin_update_file_status`, `admin_link_file_order` RPC: 없음

위 결과를 기준으로 `supabase/migrations/20260710_admin_backend_atomic_rpcs.sql` 적용 초안을 작성했습니다. 아직 운영 DB에는 적용하지 않았습니다.
