# Notification inboxes

Residents open the bell in the mini-app header; staff open the bell in the cabinet topbar.
Both support unread counts, all/unread filters, cursor pagination, individual read receipts,
and “read all” bounded by the latest loaded snapshot. A newly arriving event is not accidentally
marked as read by an older “read all” request. Counts refresh every 20 seconds while visible and
on returning to the app. This is polling, not a websocket connection.

Both inboxes open with unread events selected. Marking an event read removes it from this queue;
the “All” filter retains history without cluttering daily work. Ordinary events show a compact
title, house, date and an open action, not the conversation or issue description. Announcements
keep their full text. A rejected issue's reason remains available under a disclosure in the inbox
because the rejected issue itself can no longer be opened. Mark-read actions explicitly say
“Отметить прочитанным” rather than looking like an already-completed status.

## Event coverage

| Event | Resident inbox | Assigned staff inbox | MAX delivery |
| --- | --- | --- | --- |
| Issue submitted from mini-app or bot | — | New issue | Existing bot flow unchanged |
| Issue created by staff for a registered resident | Created issue | Other assigned staff | Existing flow unchanged |
| Issue status changed / issue rejected | Status / full rejection reason | — | Private bot notification when offline and enabled |
| Staff reply in issue chat | Reply | — | Private bot notification when offline and enabled |
| Resident reply in issue chat | — | Resident reply | No new group/private broadcast |
| Apartment message | All other residents of recipient apartment | — | Existing private bot notification when offline and enabled |
| Public camera submitted or resubmitted | — | Moderation request | No new bot messages |
| Camera approved/rejected | Camera owner | — | No new bot messages |
| Apartment registration submitted | — | Request / automatic approval | Existing flow unchanged |
| Registration approved/rejected | Applicant | — | Existing flow unchanged |
| Announcement published | Linked residents in selected houses, or explicitly selected residents | — | Selected house chats and eligible private bot recipients |

An announcement draft does not notify anyone. Publishing is idempotent. Retrying an external
delivery does not create a second inbox item. In-app announcements include residents who have
not opened the bot; the existing restrictions still apply to private MAX messages.

House chat automation remains limited to the pinned menu and explicit announcements. New issues,
status changes and private conversations are never posted to the house group by this feature.

Private bot notifications for issue updates/replies, apartment messages and announcements include
a separate “Главное меню” button. It sends a new main menu message, preserving the notification
and its links. Navigation inside an unfinished bot report continues to edit its existing message.

## Presence and delivery states

Inbox rows are inserted in the domain event transaction, independently of bot delivery,
presence and bot preferences. Disabling a category in settings disables the bot copy only.

Personal messages already used general mini-app presence. Staff replies/statuses and private
announcements now also avoid a bot copy when the resident is online and the event is safely
stored in the inbox. Legacy outbox items without an inbox copy retain the previous delivery path.
An unread reply in an actively open issue chat keeps the existing receipt/defer behavior: it can
still be delivered if the chat closes or presence expires without a read receipt.

Staff delivery labels distinguish sent, actually read, saved in-app while online, and bot
notifications disabled by the resident. Online presence is not treated as proof of reading.
An issue chat read receipt also reads matching inbox reply events.

## Storage and access

Migration `0022`, following onboarding migration `0021`, creates `inbox_notifications` and adds a suppression reason to the staff bot
outbox. There is no bulk import of historical events as unread notifications. Downgrading refuses
to discard a populated inbox. The migration does not alter issues, camera sources or residents.

Each row has exactly one recipient (resident or employee). Recipient/event uniqueness protects
against retries; inserts use bounded batches. Events are read and updated only through the
authenticated recipient. Staff also need a current assignment to the event's house, including
for history and read receipts. Staff writes retain session, origin and CSRF checks.

Notifications never contain camera connection URLs/passwords. UI text is escaped. Navigation
accepts only internal destinations. Personal messages select the exact recipient apartment;
other house events retain the current apartment when possible or choose an authorized apartment
in the correct house. Removed apartment access produces an explanation rather than opening a
different apartment's conversation.

## Local verification

The notification tests cover recipient isolation, staff assignment removal, CSRF, cursor pages,
snapshot read-all, domain event retries, online/prefs suppression, announcement audience,
camera credential privacy, and migration preservation/rollback protection. Related registration,
camera, staff action, personal message, issue chat and MAX delivery suites are run alongside them.
Browser checks use isolated local data and no bot workers, so they cannot send messages to MAX.
