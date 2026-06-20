/* eslint-disable @typescript-eslint/no-unsafe-assignment -- Supabase results are
   untyped until `pnpm db:types` generates the schema; rows are cast to the row
   shapes at the mapping boundary below. */
import type {
  ChannelSubscription,
  DeliveryAttempt,
  EventChange,
  EventChangeRepository,
  EventRepository,
  Follow,
  FollowRepository,
  NewNotification,
  Notification,
  NotificationRepository,
  PuckEvent,
  SubscriptionRepository,
} from "@puck/core";

import type { PuckSupabaseClient } from "../client.js";

/**
 * Supabase-backed implementations of the core repository ports.
 *
 * Types here are intentionally loose until `pnpm db:types` generates the real
 * `Database` definitions; the row shapes below document the expected columns
 * and are the single place that knows about snake_case ↔ camelCase mapping.
 */

// Until generated types land, the client is loosely typed (see database.types).
type Client = PuckSupabaseClient;

interface FollowRow {
  id: string;
  user_id: string;
  event_id: string;
  muted_types: string[] | null;
  created_at: string;
}

interface SubscriptionRow {
  id: string;
  user_id: string;
  channel: string;
  address: string;
  verified: boolean;
  created_at: string;
}

interface EventRow {
  id: string;
  external_id: string | null;
  source: string;
  title: string;
  status: PuckEvent["status"];
  starts_at: string | null;
  location: string | null;
  organizer_id: string | null;
  created_at: string;
  updated_at: string;
}

interface EventChangeRow {
  id: string;
  event_id: string;
  type: string;
  payload: EventChange["payload"];
  dedupe_key: string;
  created_at: string;
}

interface NotificationRow {
  id: string;
  event_change_id: string;
  subscription_id: string;
  channel: string;
  dedupe_key: string;
  status: Notification["status"];
  attempts: number;
  created_at: string;
  sent_at: string | null;
}

function mapFollow(row: FollowRow): Follow {
  return {
    id: row.id,
    userId: row.user_id,
    eventId: row.event_id,
    mutedTypes: (row.muted_types ?? []) as Follow["mutedTypes"],
    createdAt: row.created_at,
  };
}

function mapSubscription(row: SubscriptionRow): ChannelSubscription {
  return {
    id: row.id,
    userId: row.user_id,
    channel: row.channel as ChannelSubscription["channel"],
    address: row.address,
    verified: row.verified,
    createdAt: row.created_at,
  };
}

function mapEvent(row: EventRow): PuckEvent {
  return {
    id: row.id,
    externalId: row.external_id,
    source: row.source,
    title: row.title,
    status: row.status,
    startsAt: row.starts_at,
    location: row.location,
    organizerId: row.organizer_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapEventChange(row: EventChangeRow): EventChange {
  return {
    id: row.id,
    eventId: row.event_id,
    type: row.type as EventChange["type"],
    payload: row.payload,
    dedupeKey: row.dedupe_key,
    createdAt: row.created_at,
  };
}

function mapNotification(row: NotificationRow): Notification {
  return {
    id: row.id,
    eventChangeId: row.event_change_id,
    subscriptionId: row.subscription_id,
    channel: row.channel as Notification["channel"],
    dedupeKey: row.dedupe_key,
    status: row.status,
    attempts: row.attempts,
    createdAt: row.created_at,
    sentAt: row.sent_at,
  };
}

function unwrap<T>(result: {
  data: T | null;
  error: { message: string } | null;
}): T {
  if (result.error) throw new Error(result.error.message);
  if (result.data === null) {
    throw new Error("Expected a row but none was returned");
  }
  return result.data;
}

export function createEventRepository(client: Client): EventRepository {
  return {
    async getById(id) {
      const { data, error } = await client
        .from("events")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data ? mapEvent(data as EventRow) : null;
    },
  };
}

export function createFollowRepository(client: Client): FollowRepository {
  return {
    async listFollowersForEvent(eventId) {
      const { data, error } = await client
        .from("follows")
        .select("*")
        .eq("event_id", eventId);
      if (error) throw new Error(error.message);
      return ((data ?? []) as FollowRow[]).map((row) => mapFollow(row));
    },
  };
}

export function createSubscriptionRepository(
  client: Client,
): SubscriptionRepository {
  return {
    async getById(id) {
      const { data, error } = await client
        .from("channel_subscriptions")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data ? mapSubscription(data as SubscriptionRow) : null;
    },
    async listVerifiedForUser(userId) {
      const { data, error } = await client
        .from("channel_subscriptions")
        .select("*")
        .eq("user_id", userId)
        .eq("verified", true);
      if (error) throw new Error(error.message);
      return ((data ?? []) as SubscriptionRow[]).map((row) =>
        mapSubscription(row),
      );
    },
  };
}

export function createEventChangeRepository(
  client: Client,
): EventChangeRepository {
  return {
    async getById(id) {
      const { data, error } = await client
        .from("event_changes")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data ? mapEventChange(data as EventChangeRow) : null;
    },
  };
}

export function createNotificationRepository(
  client: Client,
): NotificationRepository {
  return {
    async getById(id) {
      const { data, error } = await client
        .from("notifications")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data ? mapNotification(data as NotificationRow) : null;
    },

    async createIfAbsent(input: NewNotification) {
      // Upsert on the unique dedupe_key. With `ignoreDuplicates`, a replayed
      // change inserts nothing and `inserted` comes back null — that's how we
      // know whether this call created the row or merely found an existing one.
      const { data: inserted, error: upsertError } = await client
        .from("notifications")
        .upsert(
          {
            event_change_id: input.eventChangeId,
            subscription_id: input.subscriptionId,
            channel: input.channel,
            dedupe_key: input.dedupeKey,
            status: "pending",
          },
          { onConflict: "dedupe_key", ignoreDuplicates: true },
        )
        .select()
        .maybeSingle();
      if (upsertError) throw new Error(upsertError.message);

      if (inserted) {
        return {
          notification: mapNotification(inserted as NotificationRow),
          created: true,
        };
      }

      // Already existed: read back the canonical row.
      const row = unwrap<NotificationRow>(
        await client
          .from("notifications")
          .select("*")
          .eq("dedupe_key", input.dedupeKey)
          .single(),
      );
      return { notification: mapNotification(row), created: false };
    },

    async markSent(id, sentAt) {
      const { error } = await client
        .from("notifications")
        .update({ status: "sent", sent_at: sentAt })
        .eq("id", id);
      if (error) throw new Error(error.message);
    },

    async markFailed(id, attempts) {
      const { error } = await client
        .from("notifications")
        .update({ status: "failed", attempts })
        .eq("id", id);
      if (error) throw new Error(error.message);
    },

    async bumpAttempts(id, attempts) {
      const { error } = await client
        .from("notifications")
        .update({ attempts })
        .eq("id", id);
      if (error) throw new Error(error.message);
    },

    async markSkipped(id) {
      const { error } = await client
        .from("notifications")
        .update({ status: "skipped" })
        .eq("id", id);
      if (error) throw new Error(error.message);
    },

    async recordAttempt(input: DeliveryAttempt) {
      const { error } = await client.from("notification_deliveries").insert({
        notification_id: input.notificationId,
        attempt: input.attempt,
        ok: input.ok,
        provider_ref: input.providerRef ?? null,
        error: input.error ?? null,
      });
      if (error) throw new Error(error.message);
    },
  };
}
