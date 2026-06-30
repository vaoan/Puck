create table public.permissions (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  name text not null,
  description text,
  scope text not null check (scope in ('platform','event','session','content'))
);

create table public.user_permissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  permission_id uuid not null references public.permissions (id) on delete cascade,
  mode text not null default 'grant' check (mode in ('grant','deny')),
  expires_at timestamptz,
  granted_by uuid references auth.users (id),
  reason text,
  created_at timestamptz not null default now(),
  unique (user_id, permission_id, mode)
);
create index user_permissions_user_idx on public.user_permissions (user_id);

create or replace function public.has_global_permission(p_user_id uuid, p_key text)
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from public.user_permissions up
    join public.permissions p on p.id = up.permission_id
    where up.user_id = p_user_id and p.key = p_key and up.mode = 'grant'
      and (up.expires_at is null or up.expires_at > now())
  )
  and not exists (
    select 1 from public.user_permissions up
    join public.permissions p on p.id = up.permission_id
    where up.user_id = p_user_id and p.key = p_key and up.mode = 'deny'
      and (up.expires_at is null or up.expires_at > now())
  );
$$;

insert into public.permissions (key, name, scope) values
  ('platform.admin','Platform admin','platform'),
  ('events.create','Create events','platform'),
  ('audit.read','Read audit log','platform'),
  ('event.read','Read events','event'),
  ('session.read','Read sessions','session'),
  ('content.read','Download content','content'),
  ('subscriptions.manage','Manage subscriptions','platform'),
  ('event.edit_details','Edit event details','event'),
  ('event.edit_schedule','Edit event schedule','event'),
  ('event.manage_visibility','Manage event visibility','event'),
  ('event.manage_lifecycle','Manage event lifecycle','event'),
  ('event.cancel','Cancel event','event'),
  ('event.broadcast','Broadcast announcement','event'),
  ('event.manage_delegates','Manage event delegates','event'),
  ('event.manage_session_owners','Manage session owners','event'),
  ('event.moderate_sessions','Moderate sessions','event'),
  ('event.delete','Delete event','event'),
  ('event_content.create','Upload event content','content'),
  ('event_content.update','Edit event content','content'),
  ('event_content.delete','Delete event content','content'),
  ('session.create','Create sessions','session'),
  ('session.edit_details','Edit session details','session'),
  ('session.edit_schedule','Edit session schedule','session'),
  ('session.delete','Delete session','session'),
  ('session.manage_delegates','Manage session delegates','session'),
  ('session_content.create','Upload session content','content'),
  ('session_content.update','Edit session content','content'),
  ('session_content.delete','Delete session content','content');

alter table public.permissions enable row level security;
alter table public.user_permissions enable row level security;

-- permissions: read-only catalog; any authenticated or anonymous client may read it.
create policy "permissions_read_all" on public.permissions for select using (true);

-- user_permissions: users read their own rows; platform admins can read any row.
create policy "user_permissions_read_own" on public.user_permissions for select
  using (auth.uid() = user_id or public.has_global_permission(auth.uid(), 'platform.admin'));

-- user_permissions: only platform admins may write (insert/update/delete).
create policy "user_permissions_admin_write" on public.user_permissions for all
  using (public.has_global_permission(auth.uid(), 'platform.admin'))
  with check (public.has_global_permission(auth.uid(), 'platform.admin'));

-- GRANTs
--
-- permissions: read-only catalog seeded by this migration; no write policy exists
--   for non-privileged roles, so only SELECT is granted.
--   anon + authenticated: SELECT (backed by permissions_read_all policy)
--   service_role: ALL (bypasses RLS; harness reads permission IDs via admin())
grant select on public.permissions to anon;
grant select on public.permissions to authenticated;
grant all on public.permissions to service_role;

-- user_permissions: authenticated users may SELECT (own rows via policy) and
--   write (INSERT/UPDATE/DELETE guarded by user_permissions_admin_write policy).
--   anon has no corresponding policy so receives no grant.
--   service_role: ALL (bypasses RLS; harness inserts grant/deny rows via admin())
grant select, insert, update, delete on public.user_permissions to authenticated;
grant all on public.user_permissions to service_role;
