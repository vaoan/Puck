import type { EventChange, EventChangeType, PuckEvent } from "../domain/events.js";
import type { RenderedMessage } from "../domain/notifications.js";

const TITLES: Record<EventChangeType, (event: PuckEvent) => string> = {
  starting_soon: (e) => `⏰ ${e.title} is about to start`,
  started: (e) => `▶️ ${e.title} has started`,
  delayed: (e) => `⏳ ${e.title} is delayed`,
  canceled: (e) => `❌ ${e.title} has been canceled`,
  location_changed: (e) => `📍 ${e.title} changed location`,
  schedule_changed: (e) => `🗓️ ${e.title} schedule updated`,
  announcement: (e) => `📣 ${e.title}: new announcement`,
  checkin_update: (e) => `🎟️ ${e.title}: check-in update`,
  status_changed: (e) => `ℹ️ ${e.title} status changed`,
};

/**
 * Turn an event change into a channel-agnostic message. Adapters take this and
 * format it for their medium. Keeping rendering here (not in adapters) means
 * copy lives in one place and every channel stays consistent.
 */
export function renderEventChange(
  event: PuckEvent,
  change: EventChange,
): RenderedMessage {
  const title = change.payload.title ?? TITLES[change.type](event);
  const body =
    change.payload.body ?? defaultBody(event, change.type) ?? title;
  return { title, body };
}

function defaultBody(
  event: PuckEvent,
  type: EventChangeType,
): string | undefined {
  switch (type) {
    case "location_changed":
      return event.location
        ? `New location: ${event.location}`
        : "The location has changed.";
    case "delayed":
      return event.startsAt
        ? `New start time: ${event.startsAt}`
        : "The event has been delayed.";
    case "canceled":
      return "Unfortunately, this event has been canceled.";
    default:
      return undefined;
  }
}
