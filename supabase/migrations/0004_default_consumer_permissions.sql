create or replace function public.grant_default_consumer_permissions(p_user_id uuid)
returns void security definer language plpgsql as $$
begin
  insert into public.user_permissions (user_id, permission_id, mode, granted_by, reason)
  select p_user_id, p.id, 'grant', p_user_id, 'Default consumer permissions'
  from public.permissions p
  where p.key in ('event.read','session.read','content.read','subscriptions.manage')
  on conflict (user_id, permission_id, mode) do nothing;
end;
$$;

create or replace function public.handle_default_consumer_permissions()
returns trigger security definer language plpgsql as $$
begin
  perform public.grant_default_consumer_permissions(new.id);
  return new;
end;
$$;

create trigger on_auth_user_default_permissions
  after insert on auth.users
  for each row execute function public.handle_default_consumer_permissions();
