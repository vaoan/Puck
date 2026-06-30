create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Probe used only by the integration test to confirm the helper deployed.
create or replace function public.set_updated_at_probe()
returns boolean language sql stable as $$
  select exists (
    select 1 from pg_proc where proname = 'set_updated_at'
  );
$$;
