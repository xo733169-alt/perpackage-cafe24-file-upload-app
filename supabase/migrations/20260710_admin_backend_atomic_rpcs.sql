-- Admin backend atomic operations.
-- Apply this migration only after the production-schema preflight passes.

begin;

create or replace function public.admin_update_file_status(
  p_file_id uuid,
  p_expected_status text,
  p_new_status text,
  p_memo text default null,
  p_admin_user text default 'admin',
  p_ip_address text default null,
  p_user_agent text default null
)
returns table (
  changed boolean,
  file_id uuid,
  previous_status text,
  current_status text,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_current_status text;
  v_expected_status text;
  v_new_status text;
  v_updated_at timestamptz := clock_timestamp();
  v_transition_allowed boolean := false;
  v_memo text;
  v_admin_user text;
  v_ip_address text;
  v_user_agent text;
begin
  if p_file_id is null then
    raise exception using errcode = 'P0001', message = 'file_status_missing_file_id';
  end if;

  v_expected_status := nullif(btrim(p_expected_status), '');
  v_new_status := nullif(btrim(p_new_status), '');

  if v_expected_status is null or v_new_status is null then
    raise exception using errcode = 'P0001', message = 'file_status_missing_status';
  end if;

  select files_row.status
    into v_current_status
  from public.files as files_row
  where files_row.id = p_file_id
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'file_status_file_not_found';
  end if;

  if v_current_status is distinct from v_expected_status then
    raise exception using errcode = 'P0001', message = 'file_status_conflict';
  end if;

  if v_current_status = v_new_status then
    return query
    select false, p_file_id, v_current_status, v_current_status, files_row.updated_at
    from public.files as files_row
    where files_row.id = p_file_id;
    return;
  end if;

  v_transition_allowed := case v_current_status
    when 'uploaded_pending' then v_new_status in ('reviewing', 'approved', 'need_reupload', 'archived')
    when 'reviewing' then v_new_status in ('approved', 'need_reupload', 'archived')
    when 'approved' then v_new_status in ('reviewing', 'need_reupload', 'archived')
    when 'need_reupload' then v_new_status in ('reviewing', 'approved', 'replaced', 'archived')
    when 'replaced' then v_new_status = 'archived'
    when 'archived' then false
    else false
  end;

  if not v_transition_allowed then
    raise exception using errcode = 'P0001', message = 'file_status_transition_not_allowed';
  end if;

  v_memo := nullif(left(btrim(regexp_replace(coalesce(p_memo, ''), E'[\r\n]+', ' ', 'g')), 500), '');
  v_admin_user := coalesce(nullif(left(btrim(p_admin_user), 120), ''), 'admin');
  v_ip_address := nullif(left(btrim(p_ip_address), 120), '');
  v_user_agent := nullif(left(btrim(p_user_agent), 500), '');

  update public.files as files_row
  set
    status = v_new_status,
    updated_at = v_updated_at
  where files_row.id = p_file_id;

  insert into public.file_status_change_logs (
    file_id,
    previous_status,
    new_status,
    memo,
    admin_user,
    ip_address,
    user_agent
  ) values (
    p_file_id,
    v_current_status,
    v_new_status,
    v_memo,
    v_admin_user,
    v_ip_address,
    v_user_agent
  );

  return query
  select true, p_file_id, v_current_status, v_new_status, v_updated_at;
end;
$$;

create or replace function public.admin_link_file_order(
  p_file_id uuid,
  p_order_id text,
  p_link_source text,
  p_webhook_event_id text default null,
  p_admin_user text default 'admin',
  p_memo text default null,
  p_ip_address text default null,
  p_user_agent text default null
)
returns table (
  changed boolean,
  file_id uuid,
  previous_order_id text,
  current_order_id text,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_previous_order_id text;
  v_order_id text;
  v_link_source text;
  v_webhook_event_id text;
  v_updated_at timestamptz := clock_timestamp();
  v_admin_user text;
  v_memo text;
  v_ip_address text;
  v_user_agent text;
begin
  if p_file_id is null then
    raise exception using errcode = 'P0001', message = 'file_order_missing_file_id';
  end if;

  v_order_id := nullif(btrim(p_order_id), '');
  v_link_source := nullif(btrim(p_link_source), '');

  if v_order_id is null then
    raise exception using errcode = 'P0001', message = 'file_order_missing_order_id';
  end if;

  if char_length(v_order_id) > 120 then
    raise exception using errcode = 'P0001', message = 'file_order_invalid_order_id';
  end if;

  if v_link_source not in ('manual', 'cafe24_order_lookup', 'webhook') then
    raise exception using errcode = 'P0001', message = 'file_order_invalid_link_source';
  end if;

  select files_row.order_id
    into v_previous_order_id
  from public.files as files_row
  where files_row.id = p_file_id
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'file_order_file_not_found';
  end if;

  if v_previous_order_id = v_order_id then
    return query
    select false, p_file_id, v_previous_order_id, v_previous_order_id, files_row.updated_at
    from public.files as files_row
    where files_row.id = p_file_id;
    return;
  end if;

  if v_previous_order_id is not null then
    raise exception using errcode = 'P0001', message = 'file_order_conflict';
  end if;

  v_webhook_event_id := case
    when v_link_source = 'webhook' then nullif(left(btrim(p_webhook_event_id), 120), '')
    else null
  end;
  v_admin_user := coalesce(nullif(left(btrim(p_admin_user), 120), ''), 'admin');
  v_memo := nullif(left(btrim(regexp_replace(coalesce(p_memo, ''), E'[\r\n]+', ' ', 'g')), 500), '');
  v_ip_address := nullif(left(btrim(p_ip_address), 120), '');
  v_user_agent := nullif(left(btrim(p_user_agent), 500), '');

  update public.files as files_row
  set
    order_id = v_order_id,
    updated_at = v_updated_at
  where files_row.id = p_file_id;

  insert into public.file_order_link_logs (
    file_id,
    previous_order_id,
    new_order_id,
    link_source,
    webhook_event_id,
    admin_user,
    memo,
    ip_address,
    user_agent
  ) values (
    p_file_id,
    v_previous_order_id,
    v_order_id,
    v_link_source,
    v_webhook_event_id,
    v_admin_user,
    v_memo,
    v_ip_address,
    v_user_agent
  );

  return query
  select true, p_file_id, v_previous_order_id, v_order_id, v_updated_at;
end;
$$;

revoke all on function public.admin_update_file_status(uuid, text, text, text, text, text, text) from public;
revoke all on function public.admin_update_file_status(uuid, text, text, text, text, text, text) from anon, authenticated;
grant execute on function public.admin_update_file_status(uuid, text, text, text, text, text, text) to service_role;

revoke all on function public.admin_link_file_order(uuid, text, text, text, text, text, text, text) from public;
revoke all on function public.admin_link_file_order(uuid, text, text, text, text, text, text, text) from anon, authenticated;
grant execute on function public.admin_link_file_order(uuid, text, text, text, text, text, text, text) to service_role;

comment on function public.admin_update_file_status(uuid, text, text, text, text, text, text)
  is 'Atomically updates an admin-reviewed file status and writes its audit log.';

comment on function public.admin_link_file_order(uuid, text, text, text, text, text, text, text)
  is 'Atomically links an unlinked file to an order and writes its audit log without overwriting another order.';

commit;
