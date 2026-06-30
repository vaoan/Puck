create or replace function public.can_edit_event(p_event_id uuid, p_key text)
returns boolean language sql security definer stable as $$
  select
    public.has_global_permission(auth.uid(), 'platform.admin')
    or exists (select 1 from public.events e where e.id = p_event_id and e.owner_id = auth.uid())
    or exists (
      select 1 from public.event_delegates d
      where d.event_id = p_event_id and d.user_id = auth.uid() and p_key = any(d.permissions)
    );
$$;

create or replace function public.can_act_on_session(p_session_id uuid, p_key text)
returns boolean language sql security definer stable as $$
  select
    public.has_global_permission(auth.uid(), 'platform.admin')
    or exists (select 1 from public.sessions s where s.id = p_session_id and s.owner_id = auth.uid())
    or exists (
      select 1 from public.session_delegates d
      where d.session_id = p_session_id and d.user_id = auth.uid() and p_key = any(d.permissions)
    )
    or exists (
      -- waterfall: parent-event authority (owner or moderator) overrides
      select 1 from public.sessions s
      where s.id = p_session_id
        and public.can_edit_event(s.event_id, 'event.moderate_sessions')
    );
$$;
