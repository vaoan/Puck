create schema if not exists audit;
grant usage on schema audit to authenticated;
grant usage on schema audit to service_role;

create table if not exists audit.logged_actions (
  event_id bigserial primary key,
  schema_name text not null,
  table_name text not null,
  user_id uuid,
  db_user text not null default session_user,
  action_type text not null check (action_type in ('INSERT','UPDATE','DELETE')),
  row_data jsonb,
  changed_fields jsonb,
  action_timestamp timestamptz not null default now(),
  transaction_id bigint default txid_current(),
  client_ip inet default inet_client_addr()
);
create index if not exists logged_actions_table on audit.logged_actions using btree (table_name);
create index if not exists logged_actions_user on audit.logged_actions using btree (user_id) where user_id is not null;
grant select on audit.logged_actions to authenticated;
grant select on audit.logged_actions to service_role;
-- Grant update/delete so the BEFORE immutability trigger fires (not a grant gap)
grant update, delete on audit.logged_actions to service_role;

create or replace function audit.log_changes()
returns trigger security definer language plpgsql as $$
declare v_user uuid; v_changed jsonb;
begin
  begin v_user := auth.uid(); exception when others then v_user := null; end;
  if (tg_op = 'INSERT') then
    insert into audit.logged_actions (schema_name, table_name, user_id, action_type, row_data)
      values (tg_table_schema, tg_table_name, v_user, 'INSERT', to_jsonb(new));
    return new;
  elsif (tg_op = 'UPDATE') then
    select jsonb_object_agg(key, value) into v_changed
      from jsonb_each(to_jsonb(new)) where to_jsonb(new)->key is distinct from to_jsonb(old)->key;
    if v_changed is null then return new; end if;
    insert into audit.logged_actions (schema_name, table_name, user_id, action_type, row_data, changed_fields)
      values (tg_table_schema, tg_table_name, v_user, 'UPDATE', to_jsonb(new), v_changed);
    return new;
  elsif (tg_op = 'DELETE') then
    insert into audit.logged_actions (schema_name, table_name, user_id, action_type, row_data)
      values (tg_table_schema, tg_table_name, v_user, 'DELETE', to_jsonb(old));
    return old;
  end if;
  return null;
end;
$$;

create or replace function audit.enable_tracking(target regclass)
returns void language plpgsql as $$
declare n text;
begin
  n := replace(replace('audit_' || target::text, '.', '_'), '"', '');
  execute format('drop trigger if exists %I on %s', n, target);
  execute format('create trigger %I after insert or update or delete on %s for each row execute function audit.log_changes()', n, target);
end;
$$;

select audit.enable_tracking('public.user_profiles');
select audit.enable_tracking('public.permissions');
select audit.enable_tracking('public.user_permissions');
select audit.enable_tracking('public.events');
select audit.enable_tracking('public.sessions');
select audit.enable_tracking('public.session_occurrences');
select audit.enable_tracking('public.documents');
select audit.enable_tracking('public.event_delegates');
select audit.enable_tracking('public.event_session_owners');
select audit.enable_tracking('public.session_delegates');

-- Immutability: block update/delete on audit rows.
create or replace function audit.block_mutation()
returns trigger language plpgsql as $$
begin
  raise exception 'audit.logged_actions is append-only' using errcode = '42501';
end;
$$;
create trigger audit_immutable
  before update or delete on audit.logged_actions
  for each row execute function audit.block_mutation();

-- Read access: admin (all) or event authority (scoped) with audit.read.
alter table audit.logged_actions enable row level security;
create policy "audit_read" on audit.logged_actions for select using (
  public.has_global_permission(auth.uid(), 'platform.admin')
  or (
    public.has_global_permission(auth.uid(), 'audit.read')
    and table_name in ('events','sessions','session_occurrences','documents',
                       'event_delegates','event_session_owners','session_delegates')
    -- (Sub-project #2 refines this to the specific events the user owns/delegates.)
  )
);
