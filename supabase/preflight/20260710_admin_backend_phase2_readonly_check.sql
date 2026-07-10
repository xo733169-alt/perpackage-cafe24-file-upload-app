-- Admin backend phase 2 production-schema preflight.
-- This script is read-only and intentionally ends with ROLLBACK.

begin;
set transaction read only;

-- 1. Required columns and their actual types.
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

-- 2. Primary keys, foreign keys, unique constraints, and checks.
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

-- 3. Existing indexes. This confirms whether a migration would duplicate one.
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

-- 4. Aggregate-only data checks. No file ID, order ID, token, or customer data is returned.
select 'invalid_file_status_rows' as check_name, count(*)::bigint as issue_count
from public.files
where status not in (
  'uploaded_pending',
  'reviewing',
  'approved',
  'need_reupload',
  'replaced',
  'archived'
)
union all
select 'duplicate_active_reupload_file_groups', count(*)::bigint
from (
  select original_file_id
  from public.file_reupload_requests
  where status = 'requested'
    and used_at is null
    and new_file_id is null
    and expires_at > now()
  group by original_file_id
  having count(*) > 1
) duplicate_groups
union all
select 'invalid_reupload_status_rows', count(*)::bigint
from public.file_reupload_requests
where status not in (
  'requested',
  'uploaded',
  'reviewing',
  'completed',
  'expired',
  'canceled',
  'failed'
);

-- 5. Confirm whether the planned RPC names already exist.
select
  routine_name,
  data_type as return_type
from information_schema.routines
where routine_schema = 'public'
  and routine_name in ('admin_update_file_status', 'admin_link_file_order')
order by routine_name;

rollback;
