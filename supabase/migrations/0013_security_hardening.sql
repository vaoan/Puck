-- 0013_security_hardening.sql
-- Final whole-branch pre-merge hardening for sub-project #1.
-- Append-only: this migration ADJUSTS objects defined in 0002–0012; it never
-- edits those files. Covers (A) PII column-scoping on user_profiles,
-- (B) nothing schema-side (expiry already correct, tested only),
-- (C) tighter documents_select, and (D) defense-in-depth hardening.

-- ─────────────────────────────────────────────────────────────────────────────
-- A. PII leak fix — anon/authenticated could read every user's email.
--
-- 0002 granted ALL-COLUMNS `select` to anon + authenticated, and the
-- `profiles_read_all USING (true)` policy makes every row visible. Together an
-- unauthenticated client could `select email from user_profiles` and enumerate
-- all emails. Replace the table-wide SELECT with a column-scoped grant that
-- excludes the PII columns (email, provider). Profiles stay publicly readable
-- for display (id, display_name, avatar_url, timestamps). service_role keeps
-- `grant all` (set in 0002) and is unaffected.
-- ─────────────────────────────────────────────────────────────────────────────
revoke select on public.user_profiles from anon;
revoke select on public.user_profiles from authenticated;

grant select (id, display_name, avatar_url, first_seen_at, last_seen_at, created_at, updated_at)
  on public.user_profiles to anon;
grant select (id, display_name, avatar_url, first_seen_at, last_seen_at, created_at, updated_at)
  on public.user_profiles to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- C. Tighten documents_select — a published document must ALSO have a
--    published + public parent event before it is anon-readable, mirroring the
--    transitive visibility used for sessions/occurrences. The authority arms
--    (event/session editors seeing unpublished docs) are preserved verbatim.
-- ─────────────────────────────────────────────────────────────────────────────
drop policy "documents_select" on public.documents;
create policy "documents_select" on public.documents for select using (
  -- public arm (event documents): published doc on a published+public event
  (
    is_published and event_id is not null and exists (
      select 1 from public.events e
      where e.id = documents.event_id
        and e.status = 'published' and e.visibility = 'public'
    )
  )
  -- public arm (session documents): published doc whose session's event is published+public
  or (
    is_published and session_id is not null and exists (
      select 1 from public.sessions s
      join public.events e on e.id = s.event_id
      where s.id = documents.session_id
        and e.status = 'published' and e.visibility = 'public'
    )
  )
  -- authority arms (unchanged from 0009): editors can see unpublished docs
  or (event_id is not null and public.can_edit_event(event_id, 'event_content.update'))
  or (session_id is not null and public.can_act_on_session(session_id, 'session_content.update'))
);

-- ─────────────────────────────────────────────────────────────────────────────
-- D.1 owner_id indexes — RLS waterfall helpers filter on owner_id = auth.uid().
-- ─────────────────────────────────────────────────────────────────────────────
create index if not exists events_owner_idx on public.events (owner_id);
create index if not exists sessions_owner_idx on public.sessions (owner_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- D.2 Pin search_path on every SECURITY DEFINER function (defense-in-depth vs
--     search_path hijacking). All functions fully-qualify their references, so
--     `search_path = ''` is safe for every one EXCEPT set_event_visibility,
--     which casts to the unqualified enum `event_visibility`; that one is
--     re-created with the type fully-qualified so it also runs with ''.
-- ─────────────────────────────────────────────────────────────────────────────
alter function public.sync_user_profile() set search_path = '';
alter function public.has_global_permission(uuid, text) set search_path = '';
alter function public.grant_default_consumer_permissions(uuid) set search_path = '';
alter function public.handle_default_consumer_permissions() set search_path = '';
alter function public.can_edit_event(uuid, text) set search_path = '';
alter function public.can_act_on_session(uuid, text) set search_path = '';
alter function public.cancel_event(uuid) set search_path = '';
alter function public.publish_event(uuid) set search_path = '';
alter function public.broadcast_announcement(uuid, text, text) set search_path = '';
alter function public.orphan_sessions_of_removed_owner() set search_path = '';
alter function public.clear_delegates_on_orphan() set search_path = '';
alter function audit.log_changes() set search_path = '';

-- set_event_visibility: re-created with public.event_visibility so the enum cast
-- resolves under an empty search_path. Body otherwise identical to 0010.
create or replace function public.set_event_visibility(p_event_id uuid, p_visibility text)
returns void security definer language plpgsql
set search_path = '' as $$
begin
  if not public.can_edit_event(p_event_id, 'event.manage_visibility') then
    raise exception 'insufficient_privilege' using errcode = '42501';
  end if;
  update public.events set visibility = p_visibility::public.event_visibility where id = p_event_id;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- D.3 granted_by FKs → on delete set null. As created in 0007 these FKs default
--     to NO ACTION, so deleting a user who granted a delegation is blocked.
--     Re-create each as `on delete set null`. Constraint names are resolved
--     from the catalog so this is robust to auto-generated names.
-- ─────────────────────────────────────────────────────────────────────────────
do $$
declare
  t text;
  c text;
begin
  foreach t in array array['event_delegates','event_session_owners','session_delegates'] loop
    select con.conname into c
    from pg_constraint con
    join pg_attribute a
      on a.attrelid = con.conrelid and a.attnum = any(con.conkey)
    where con.contype = 'f'
      and con.conrelid = ('public.' || t)::regclass
      and a.attname = 'granted_by';
    if c is not null then
      execute format('alter table public.%I drop constraint %I', t, c);
    end if;
    execute format(
      'alter table public.%I add constraint %I foreign key (granted_by) '
      || 'references public.user_profiles (id) on delete set null',
      t, t || '_granted_by_fkey'
    );
  end loop;
end $$;
