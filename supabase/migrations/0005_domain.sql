create type event_status as enum ('draft','published','canceled','archived');
create type event_visibility as enum ('public','private');
create type session_status as enum ('draft','published','canceled');

create table public.events (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references public.user_profiles (id) on delete set null,
  title text not null,
  description text,
  category text,
  banner_url text,
  venue text,
  start_date date,
  end_date date,
  timezone text not null default 'UTC',
  status event_status not null default 'draft',
  visibility event_visibility not null default 'public',
  event_code text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger set_events_updated_at before update on public.events
  for each row execute function public.set_updated_at();

create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  owner_id uuid references public.user_profiles (id) on delete set null,
  title text not null,
  description text,
  track text,
  status session_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index sessions_event_idx on public.sessions (event_id);
create trigger set_sessions_updated_at before update on public.sessions
  for each row execute function public.set_updated_at();

create table public.session_occurrences (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions (id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz,
  created_at timestamptz not null default now()
);
create index session_occurrences_session_idx on public.session_occurrences (session_id);
create index session_occurrences_starts_idx on public.session_occurrences (starts_at);

-- Service-role access (bypasses RLS; needed for harness admin() client).
-- Grants to anon/authenticated are deferred to Task 10 (depends on RLS policies
-- from Task 9 waterfall helpers that do not exist yet).
grant all on public.events to service_role;
grant all on public.sessions to service_role;
grant all on public.session_occurrences to service_role;
