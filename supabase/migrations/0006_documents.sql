create table public.documents (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references public.events (id) on delete cascade,
  session_id uuid references public.sessions (id) on delete cascade,
  storage_path text not null,
  filename text not null,
  content_type text,
  size_bytes bigint,
  title text,
  is_published boolean not null default false,
  uploaded_by uuid references public.user_profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint documents_one_parent check (
    (event_id is not null and session_id is null) or
    (event_id is null and session_id is not null)
  )
);
create index documents_event_idx on public.documents (event_id) where event_id is not null;
create index documents_session_idx on public.documents (session_id) where session_id is not null;
create trigger set_documents_updated_at before update on public.documents
  for each row execute function public.set_updated_at();

-- Service-role access (bypasses RLS; needed for harness admin() client).
-- RLS policies and anon/authenticated grants are deferred to Task 10.
grant all on public.documents to service_role;
