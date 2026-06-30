create or replace function public.orphan_sessions_of_removed_owner()
returns trigger security definer language plpgsql as $$
begin
  update public.sessions
    set owner_id = null
    where event_id = old.event_id and owner_id = old.user_id;
  return old;
end;
$$;

create trigger event_session_owner_removed
  after delete on public.event_session_owners
  for each row execute function public.orphan_sessions_of_removed_owner();

create or replace function public.clear_delegates_on_orphan()
returns trigger security definer language plpgsql as $$
begin
  if new.owner_id is null and old.owner_id is not null then
    delete from public.session_delegates where session_id = new.id;
  end if;
  return new;
end;
$$;

create trigger session_orphaned
  after update of owner_id on public.sessions
  for each row execute function public.clear_delegates_on_orphan();
