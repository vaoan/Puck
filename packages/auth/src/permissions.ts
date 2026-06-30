export const PERMISSION_KEYS = [
  "platform.admin",
  "events.create",
  "audit.read",
  "event.read",
  "session.read",
  "content.read",
  "subscriptions.manage",
  "event.edit_details",
  "event.edit_schedule",
  "event.manage_visibility",
  "event.manage_lifecycle",
  "event.cancel",
  "event.broadcast",
  "event.manage_delegates",
  "event.manage_session_owners",
  "event.moderate_sessions",
  "event.delete",
  "event_content.create",
  "event_content.update",
  "event_content.delete",
  "session.create",
  "session.edit_details",
  "session.edit_schedule",
  "session.delete",
  "session.manage_delegates",
  "session_content.create",
  "session_content.update",
  "session_content.delete",
] as const;

export type PermissionKey = (typeof PERMISSION_KEYS)[number];

export function matchesPermissions(
  granted: Set<string>,
  required: string | readonly string[],
  mode: "all" | "any" = "all",
): boolean {
  const keys = typeof required === "string" ? [required] : required;
  return mode === "all"
    ? keys.every((k) => granted.has(k))
    : keys.some((k) => granted.has(k));
}
