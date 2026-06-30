alter table public.events enable row level security;
alter table public.sessions enable row level security;
alter table public.session_occurrences enable row level security;
alter table public.documents enable row level security;
alter table public.event_delegates enable row level security;
alter table public.event_session_owners enable row level security;
alter table public.session_delegates enable row level security;

-- EVENTS
create policy "events_select" on public.events for select using (
  (status = 'published' and visibility = 'public')
  or public.can_edit_event(id, 'event.edit_details')
);
create policy "events_insert" on public.events for insert with check (
  public.has_global_permission(auth.uid(), 'events.create') and owner_id = auth.uid()
);
create policy "events_update" on public.events for update
  using (public.can_edit_event(id, 'event.edit_details'))
  with check (public.can_edit_event(id, 'event.edit_details'));
create policy "events_delete" on public.events for delete
  using (public.can_edit_event(id, 'event.delete'));

-- SESSIONS
create policy "sessions_select" on public.sessions for select using (
  exists (select 1 from public.events e where e.id = event_id
          and ((e.status='published' and e.visibility='public') or public.can_edit_event(e.id,'event.edit_details')))
);
create policy "sessions_insert" on public.sessions for insert with check (
  public.can_edit_event(event_id, 'event.moderate_sessions')
  or exists (select 1 from public.event_session_owners o
             where o.event_id = event_id and o.user_id = auth.uid())
);
create policy "sessions_update" on public.sessions for update
  using (public.can_act_on_session(id, 'session.edit_details'))
  with check (public.can_act_on_session(id, 'session.edit_details'));
create policy "sessions_delete" on public.sessions for delete
  using (public.can_act_on_session(id, 'session.delete'));

-- SESSION OCCURRENCES (schedule)
create policy "occurrences_select" on public.session_occurrences for select using (
  exists (select 1 from public.sessions s where s.id = session_id) -- visibility governed by session policy via join in app
);
create policy "occurrences_write" on public.session_occurrences for all
  using (public.can_act_on_session(session_id, 'session.edit_schedule'))
  with check (public.can_act_on_session(session_id, 'session.edit_schedule'));

-- DOCUMENTS
create policy "documents_select" on public.documents for select using (
  is_published
  or (event_id is not null and public.can_edit_event(event_id, 'event_content.update'))
  or (session_id is not null and public.can_act_on_session(session_id, 'session_content.update'))
);
create policy "documents_write_event" on public.documents for all
  using (event_id is not null and public.can_edit_event(event_id, 'event_content.update'))
  with check (event_id is not null and public.can_edit_event(event_id, 'event_content.create'));
create policy "documents_write_session" on public.documents for all
  using (session_id is not null and public.can_act_on_session(session_id, 'session_content.update'))
  with check (session_id is not null and public.can_act_on_session(session_id, 'session_content.create'));

-- DELEGATION TABLES
create policy "event_delegates_read" on public.event_delegates for select
  using (user_id = auth.uid() or public.can_edit_event(event_id, 'event.manage_delegates'));
create policy "event_delegates_write" on public.event_delegates for all
  using (public.can_edit_event(event_id, 'event.manage_delegates'))
  with check (public.can_edit_event(event_id, 'event.manage_delegates'));

create policy "event_session_owners_read" on public.event_session_owners for select
  using (user_id = auth.uid() or public.can_edit_event(event_id, 'event.manage_session_owners'));
create policy "event_session_owners_write" on public.event_session_owners for all
  using (public.can_edit_event(event_id, 'event.manage_session_owners'))
  with check (public.can_edit_event(event_id, 'event.manage_session_owners'));

create policy "session_delegates_read" on public.session_delegates for select
  using (user_id = auth.uid() or public.can_act_on_session(session_id, 'session.manage_delegates'));
create policy "session_delegates_write" on public.session_delegates for all
  using (public.can_act_on_session(session_id, 'session.manage_delegates'))
  with check (public.can_act_on_session(session_id, 'session.manage_delegates'));

-- ─── Deferred anon / authenticated GRANTs ──────────────────────────────────
-- These were held back from Tasks 5–7 because the RLS policies needed here
-- to scope them safely did not exist yet.  Grant exactly the privilege classes
-- that have a matching policy (no grant without a policy; no anon write grant
-- because no anon write policy exists).

-- events: published+public → anon read; any authenticated → all DML (filtered by policy)
grant select on public.events to anon;
grant select, insert, update, delete on public.events to authenticated;

-- sessions: sessions of published+public events → anon read; authenticated → all DML
grant select on public.sessions to anon;
grant select, insert, update, delete on public.sessions to authenticated;

-- session_occurrences: occurrences of visible sessions → anon read; authenticated → all DML
grant select on public.session_occurrences to anon;
grant select, insert, update, delete on public.session_occurrences to authenticated;

-- documents: published docs → anon read; authenticated → all DML (event or session content)
grant select on public.documents to anon;
grant select, insert, update, delete on public.documents to authenticated;

-- delegation tables: no anon policy → no anon grant; authenticated → all DML
grant select, insert, update, delete on public.event_delegates to authenticated;
grant select, insert, update, delete on public.event_session_owners to authenticated;
grant select, insert, update, delete on public.session_delegates to authenticated;
