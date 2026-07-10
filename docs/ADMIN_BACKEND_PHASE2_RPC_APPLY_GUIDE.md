# 관리자 백엔드 2차 RPC 적용 안내

## 적용 상태

- 2026-07-10 Supabase 운영 DB 적용 확인
- `admin_link_file_order`: 생성 확인
- `admin_update_file_status`: 생성 확인
- 애플리케이션 RPC 호출 전환: 로컬 코드 반영 완료, 배포 전

## 확인된 운영 DB 구조

- `files.id`: `uuid`
- `files.order_id`: `text`, nullable
- `files.status`: `text`, not null
- `files.updated_at`: `timestamptz`, not null
- `file_status_change_logs.file_id`: `uuid`, `files.id` 외래키
- `file_order_link_logs.file_id`: `uuid`, `files.id` 외래키
- `file_order_link_logs.webhook_event_id`: `text`
- `cafe24_webhook_events.id`: `text`
- 기존 `admin_update_file_status`, `admin_link_file_order` 함수: 없음
- 잘못된 파일 상태, 중복 활성 재업로드 요청, 잘못된 재업로드 상태: 모두 0건

## 적용 대상

`supabase/migrations/20260710_admin_backend_atomic_rpcs.sql`

이 migration은 다음 두 함수를 만듭니다.

### `admin_update_file_status`

하나의 트랜잭션에서 다음을 처리합니다.

1. 파일 행 잠금
2. 화면이 알고 있던 상태와 현재 DB 상태 비교
3. 허용된 상태 전환인지 확인
4. `files.status` 변경
5. `file_status_change_logs` 저장
6. 어느 단계든 실패하면 전체 취소

### `admin_link_file_order`

하나의 트랜잭션에서 다음을 처리합니다.

1. 파일 행 잠금
2. 현재 주문번호 확인
3. 미연결 파일 또는 동일 주문번호만 허용
4. 다른 주문번호가 있으면 충돌로 중단
5. `files.order_id` 연결
6. `file_order_link_logs` 저장
7. 어느 단계든 실패하면 전체 취소

## 권한

- `service_role`만 실행할 수 있습니다.
- `anon`, `authenticated`, 기본 `public` 실행 권한은 제거합니다.
- 함수의 `search_path`는 비워 두고 모든 테이블을 `public.<table>`로 명시합니다.
- 함수 생성과 권한 제한은 하나의 migration 트랜잭션에서 처리합니다.
- 고객용 위젯이나 브라우저에서 직접 호출하지 않습니다.

## 유지되는 운영 원칙

- 파일 상태는 관리자가 직접 선택합니다.
- `approved` 자동 변경은 없습니다.
- 기존 주문번호를 다른 주문번호로 덮어쓰지 않습니다.
- Webhook은 주문번호 연결까지만 수행합니다.
- 기존 파일 자동 삭제 또는 자동 교체는 없습니다.

## 적용 순서

1. Supabase SQL Editor에서 migration 파일 전체를 붙여 넣습니다.
2. 실행 전에 파일명이 `20260710_admin_backend_atomic_rpcs.sql`인지 확인합니다.
3. 실행 후 두 함수가 생성됐는지 아래 조회로 확인합니다.

```sql
select
  routine_name,
  data_type as return_type
from information_schema.routines
where routine_schema = 'public'
  and routine_name in ('admin_update_file_status', 'admin_link_file_order')
order by routine_name;
```

4. 권한과 `SECURITY DEFINER`, `search_path`를 아래 조회로 확인합니다.

```sql
select
  routine.proname as function_name,
  routine.prosecdef as security_definer,
  routine.proconfig as function_config,
  has_function_privilege(
    'anon',
    routine.oid,
    'EXECUTE'
  ) as anon_can_execute,
  has_function_privilege(
    'authenticated',
    routine.oid,
    'EXECUTE'
  ) as authenticated_can_execute,
  has_function_privilege(
    'service_role',
    routine.oid,
    'EXECUTE'
  ) as service_role_can_execute
from pg_proc routine
join pg_namespace namespace_info
  on namespace_info.oid = routine.pronamespace
where namespace_info.nspname = 'public'
  and routine.proname in ('admin_update_file_status', 'admin_link_file_order')
order by routine.proname;
```

정상 결과:

- `security_definer`: `true`
- `function_config`: `search_path=""` 포함
- `anon_can_execute`: `false`
- `authenticated_can_execute`: `false`
- `service_role_can_execute`: `true`

5. 함수 생성 결과와 권한 확인 결과를 Codex에 전달합니다.
6. 그 다음 애플리케이션 코드를 RPC 호출 방식으로 변경합니다.

## 이번 단계에서 하지 않는 작업

- 운영 DB 함수는 적용됐지만 애플리케이션 배포 전까지 기존 Production 코드는 기존 경로를 사용합니다.
- commit, push, Vercel 배포를 진행하지 않습니다.
