/** Lifecycle states an event can be in. */
export const EVENT_STATUSES = [
  "scheduled",
  "delayed",
  "live",
  "ended",
  "canceled",
] as const;

export type EventStatus = (typeof EVENT_STATUSES)[number];

/**
 * The kinds of change that are worth notifying a follower about.
 * Maps directly onto the product's notification catalogue.
 */
export const EVENT_CHANGE_TYPES = [
  "starting_soon",
  "started",
  "delayed",
  "canceled",
  "location_changed",
  "schedule_changed",
  "announcement",
  "checkin_update",
  "status_changed",
] as const;

export type EventChangeType = (typeof EVENT_CHANGE_TYPES)[number];

export interface PuckEvent {
  id: string;
  /** Stable id from the upstream source (e.g. Janus), if mirrored. */
  externalId: string | null;
  source: string;
  title: string;
  status: EventStatus;
  startsAt: string | null;
  location: string | null;
  organizerId: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * An immutable record that *something happened* to an event. Event changes are
 * the outbox: they are written in the same transaction as the underlying event
 * mutation, then fanned out into per-follower notifications.
 */
export interface EventChange {
  id: string;
  eventId: string;
  type: EventChangeType;
  /** Human-facing summary and any structured detail for rendering. */
  payload: EventChangePayload;
  /** Deterministic key making the change itself idempotent at the source. */
  dedupeKey: string;
  createdAt: string;
}

export interface EventChangePayload {
  title?: string;
  body?: string;
  /** Free-form structured detail (old/new location, new time, etc.). */
  data?: Record<string, unknown>;
}
