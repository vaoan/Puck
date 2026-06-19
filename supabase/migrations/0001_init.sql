-- ============================================================================
-- Puck initial schema
--
-- Sets up the event-following + notification domain on Supabase Postgres,
-- plus the durable queue (pgmq) and scheduler (pg_cron) that drive delivery.
-- No external infrastructure is required: the queue lives in this database.
-- ============================================================================

create extension if not exists pgcrypto;   -- gen_random_uuid()
create extension if not exists pg_cron;     -- scheduled "starting soon" reminders
create extension if not exists pgmq;        -- durable in-Postgres message queue

-- ----------------------------------------------------------------------------
-- Enums
-- ----------------------------------------------------------------------------
create type event_status as enum (
  'scheduled', 'delayed', 'live', 'ended', 'canceled'
);

create type event_change_type as enum (
  'starting_soon', 'started', 'delayed', 'canceled',
  'location_changed', 'schedule_changed', 'announcement',
  'checkin_update', 'status_changed'
);

create type channel_key as enum ('telegram', 'email');

create type notification_status as enum (
  'pending', 'sent', 'failed', 'skipped'
);

-- ----------------------------------------------------------------------------
-- Core tables
-- ----------------------------------------------------------------------------
create table events (
  id           uuid primary key default gen_random_uuid(),
  external_id  text,
  source       text not null default 'puck',
  title        text not null,
  status       event_status not null default 'scheduled',
  starts_at    timestamptz,
  location     text,
  organizer_id uuid references auth.users (id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index events_starts_at_idx on events (starts_at);

-- Immutable record of "something happened to an event". This is the outbox.
create table event_changes (
  id         uuid primary key default gen_random_uuid(),
  event_id   uuid not null references events (id) on delete cascade,
  type       event_change_type not null,
  payload    jsonb not null default '{}'::jsonb,
  -- Makes the change itself idempotent at the source.
  dedupe_key text not null unique,
  created_at timestamptz not null default now()
);
create index event_changes_event_id_idx on event_changes (event_id);

create table follows (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  event_id    uuid not null references events (id) on delete cascade,
  muted_types event_change_type[] not null default '{}',
  created_at  timestamptz not null default now(),
  unique (user_id, event_id)
);
create index follows_event_id_idx on follows (event_id);

create table channel_subscriptions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  channel    channel_key not null,
  address    text not null,           -- chat id, email, etc.
  verified   boolean not null default false,
  created_at timestamptz not null default now(),
  unique (user_id, channel, address)
);
create index channel_subscriptions_user_id_idx on channel_subscriptions (user_id);

-- One intended delivery. The unique dedupe_key is Puck's hard guarantee
-- against duplicate sends.
create table notifications (
  id              uuid primary key default gen_random_uuid(),
  event_change_id uuid not null references event_changes (id) on delete cascade,
  subscription_id uuid not null references channel_subscriptions (id) on delete cascade,
  channel         channel_key not null,
  dedupe_key      text not null unique,
  status          notification_status not null default 'pending',
  attempts        integer not null default 0,
  created_at      timestamptz not null default now(),
  sent_at         timestamptz
);
create index notifications_status_idx on notifications (status);

-- Per-attempt audit trail for observability.
create table notification_deliveries (
  id              uuid primary key default gen_random_uuid(),
  notification_id uuid not null references notifications (id) on delete cascade,
  attempt         integer not null,
  ok              boolean not null,
  provider_ref    text,
  error           text,
  attempted_at    timestamptz not null default now()
);
create index notification_deliveries_notification_id_idx
  on notification_deliveries (notification_id);

-- ----------------------------------------------------------------------------
-- Queues (pgmq) + thin public wrappers
--
-- The app is granted access only to these SECURITY DEFINER wrappers, not to
-- the pgmq schema directly. Keeps the RPC surface small and auditable.
-- ----------------------------------------------------------------------------
select pgmq.create('puck_fanout');
select pgmq.create('puck_notifications');

create or replace function public.puck_queue_send(
  queue_name text, msg jsonb, delay_seconds integer default 0
) returns bigint
language sql security definer set search_path = pgmq, public as $$
  select pgmq.send(queue_name, msg, delay_seconds);
$$;

create or replace function public.puck_queue_read(
  queue_name text, qty integer default 10, visibility_seconds integer default 30
) returns table (msg_id bigint, read_ct integer, message jsonb)
language sql security definer set search_path = pgmq, public as $$
  select msg_id, read_ct, message
  from pgmq.read(queue_name, visibility_seconds, qty);
$$;

create or replace function public.puck_queue_delete(
  queue_name text, msg_id bigint
) returns boolean
language sql security definer set search_path = pgmq, public as $$
  select pgmq.delete(queue_name, msg_id);
$$;

create or replace function public.puck_queue_archive(
  queue_name text, msg_id bigint
) returns boolean
language sql security definer set search_path = pgmq, public as $$
  select pgmq.archive(queue_name, msg_id);
$$;

-- ----------------------------------------------------------------------------
-- Outbox trigger: every new event change enqueues a fan-out job in the SAME
-- transaction. If the insert commits, the job is guaranteed enqueued; if it
-- rolls back, so does the job. No lost or phantom notifications.
-- ----------------------------------------------------------------------------
create or replace function public.enqueue_event_change_fanout()
returns trigger
language plpgsql security definer set search_path = pgmq, public as $$
begin
  perform pgmq.send(
    'puck_fanout',
    jsonb_build_object('eventChangeId', new.id::text),
    0
  );
  return new;
end;
$$;

create trigger event_changes_fanout
  after insert on event_changes
  for each row execute function public.enqueue_event_change_fanout();

-- ----------------------------------------------------------------------------
-- Scheduler: once a minute, create a one-time "starting_soon" change for any
-- scheduled event starting within the next 15 minutes. The unique dedupe_key
-- ensures it happens exactly once per event; the outbox trigger then fans it
-- out. This is the cheap, Redis-free replacement for a delayed-job scheduler.
-- ----------------------------------------------------------------------------
select cron.schedule(
  'puck-starting-soon',
  '* * * * *',
  $cron$
    insert into public.event_changes (event_id, type, payload, dedupe_key)
    select e.id,
           'starting_soon',
           '{}'::jsonb,
           'starting_soon:' || e.id::text
    from public.events e
    where e.status = 'scheduled'
      and e.starts_at is not null
      and e.starts_at between now() and now() + interval '15 minutes'
    on conflict (dedupe_key) do nothing;
  $cron$
);

-- ----------------------------------------------------------------------------
-- Row Level Security
--
-- The backend (api + worker) uses the service-role key and bypasses RLS.
-- These policies protect the data the moment any anon/user-scoped client is
-- introduced. Notification tables have RLS enabled with NO policy, so they are
-- reachable only via the service role.
-- ----------------------------------------------------------------------------
alter table events enable row level security;
alter table event_changes enable row level security;
alter table follows enable row level security;
alter table channel_subscriptions enable row level security;
alter table notifications enable row level security;
alter table notification_deliveries enable row level security;

-- Events and their changes are public to read.
create policy events_select_all on events
  for select using (true);
create policy event_changes_select_all on event_changes
  for select using (true);

-- A user manages only their own follows.
create policy follows_owner_all on follows
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- A user manages only their own channel subscriptions.
create policy subscriptions_owner_all on channel_subscriptions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
