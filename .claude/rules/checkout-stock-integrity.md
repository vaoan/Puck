# Subscription & Notification Integrity

## Rule

Subscription data and notification delivery are security-sensitive. The backend
must validate session existence and ownership before creating subscriptions, and
must never expose one subscriber's notification state to another.

## Required behavior

1. Session subscriptions must only be created for sessions that exist and belong
   to an event the subscriber can access.
2. Notification delivery state (delivered, failed, dedupe_key) must only be
   readable by the owning subscriber or the event organizer — not public.
3. If a session is deleted or an occurrence is cancelled, existing subscriptions
   for that occurrence must be tombstoned, not left dangling.
4. RLS policies alone are not sufficient — the application layer must also
   validate before writing subscriptions.
5. The `dedupe_key` unique constraint must never be relaxed or bypassed. A
   duplicate send is a product defect.

## Testing requirements

Every change touching subscriptions, occurrences, or notification dispatch must
keep the following coverage in place:

- Unit tests for subscription creation validating session existence
- Unit tests for dedupe_key collision behavior (upsert with ignoreDuplicates)
- Route/server tests proving notification state is not returned to non-owners
- Tests proving that deleting an occurrence tombstones its pending notifications

## Review checklist

- Can a subscriber create a subscription for a non-existent session?
- Can a subscriber read another subscriber's notification delivery state?
- Does cancelling an occurrence clean up its pending notification queue entries?
- Does the dedupe_key unique constraint remain intact after this migration?
