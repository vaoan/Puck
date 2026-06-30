create or replace function public.cancel_event(p_event_id uuid)
returns void security definer language plpgsql as $$
begin
  if not public.can_edit_event(p_event_id, 'event.cancel') then
    raise exception 'insufficient_privilege' using errcode = '42501';
  end if;
  update public.events set status = 'canceled' where id = p_event_id;
  -- sub-project #3 hooks cancellation notifications here.
end;
$$;

create or replace function public.publish_event(p_event_id uuid)
returns void security definer language plpgsql as $$
begin
  if not public.can_edit_event(p_event_id, 'event.manage_lifecycle') then
    raise exception 'insufficient_privilege' using errcode = '42501';
  end if;
  update public.events set status = 'published' where id = p_event_id;
end;
$$;

create or replace function public.set_event_visibility(p_event_id uuid, p_visibility text)
returns void security definer language plpgsql as $$
begin
  if not public.can_edit_event(p_event_id, 'event.manage_visibility') then
    raise exception 'insufficient_privilege' using errcode = '42501';
  end if;
  update public.events set visibility = p_visibility::event_visibility where id = p_event_id;
end;
$$;

create or replace function public.broadcast_announcement(p_event_id uuid, p_title text, p_body text)
returns void security definer language plpgsql as $$
begin
  if not public.can_edit_event(p_event_id, 'event.broadcast') then
    raise exception 'insufficient_privilege' using errcode = '42501';
  end if;
  -- Stub: validated here; notification fan-out is implemented in sub-project #3.
  if coalesce(trim(p_title), '') = '' then
    raise exception 'announcement title required' using errcode = '22000';
  end if;
end;
$$;
