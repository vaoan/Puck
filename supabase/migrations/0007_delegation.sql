create table public.event_delegates (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  user_id uuid not null references public.user_profiles (id) on delete cascade,
  permissions text[] not null default '{}',
  granted_by uuid references public.user_profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, user_id)
);
create index event_delegates_user_idx on public.event_delegates (user_id);
create trigger set_event_delegates_updated_at before update on public.event_delegates
  for each row execute function public.set_updated_at();

create table public.event_session_owners (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  user_id uuid not null references public.user_profiles (id) on delete cascade,
  granted_by uuid references public.user_profiles (id),
  created_at timestamptz not null default now(),
  unique (event_id, user_id)
);
create index event_session_owners_user_idx on public.event_session_owners (user_id);

create table public.session_delegates (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions (id) on delete cascade,
  user_id uuid not null references public.user_profiles (id) on delete cascade,
  permissions text[] not null default '{}',
  granted_by uuid references public.user_profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (session_id, user_id)
);
create index session_delegates_user_idx on public.session_delegates (user_id);
create trigger set_session_delegates_updated_at before update on public.session_delegates
  for each row execute function public.set_updated_at();

-- Service-role access (bypasses RLS; needed for harness admin() client).
-- RLS policies and anon/authenticated grants are deferred to Task 10.
grant all on public.event_delegates to service_role;
grant all on public.event_session_owners to service_role;
grant all on public.session_delegates to service_role;
