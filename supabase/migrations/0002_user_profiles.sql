create table public.user_profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null check (email ~* '^.+@.+$'),
  provider text,
  display_name text,
  avatar_url text,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index user_profiles_email_idx on public.user_profiles (email);

create trigger set_user_profiles_updated_at
  before update on public.user_profiles
  for each row execute function public.set_updated_at();

alter table public.user_profiles enable row level security;
create policy "profiles_read_all" on public.user_profiles for select using (true);
create policy "profiles_insert_own" on public.user_profiles for insert with check (auth.uid() = id);
create policy "profiles_update_own" on public.user_profiles for update
  using (auth.uid() = id) with check (auth.uid() = id);

create or replace function public.sync_user_profile()
returns trigger security definer language plpgsql as $$
begin
  insert into public.user_profiles (id, email, provider, display_name, avatar_url)
  values (
    new.id, new.email,
    new.raw_app_meta_data->>'provider',
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do update set
    email = excluded.email,
    provider = excluded.provider,
    last_seen_at = now(),
    display_name = coalesce(public.user_profiles.display_name, excluded.display_name);
  return new;
end;
$$;

create trigger on_auth_user_change
  after insert or update on auth.users
  for each row execute function public.sync_user_profile();

grant select on public.user_profiles to anon;
grant select, insert, update on public.user_profiles to authenticated;
grant all on public.user_profiles to service_role;
