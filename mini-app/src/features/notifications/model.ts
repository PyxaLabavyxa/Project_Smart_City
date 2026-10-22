import { number, record, string } from "@/shared/api/parse";

export type Notification = {
  id: number; kind: string; title: string; body: string; href: string | null;
  houseId: string | null; apartmentId: number | null; address: string | null;
  createdAt: string; readAt: string | null;
};
export type InboxPage = { items: Notification[]; nextCursor: number | null; unreadCount: number; snapshotId: number };
export function parseInbox(value: unknown): InboxPage {
  const page = record(value);
  if (!Array.isArray(page.items)) throw new Error("Не удалось прочитать уведомления");
  return {
    items: page.items.map(value => {
      const row = record(value);
      return { id: number(row.id), kind: string(row.kind), title: string(row.title), body: string(row.body),
        href: row.href == null ? null : string(row.href), houseId: row.house_id == null ? null : String(number(row.house_id)),
        apartmentId: row.apartment_id == null ? null : number(row.apartment_id), address: row.address == null ? null : string(row.address),
        createdAt: string(row.created_at), readAt: row.read_at == null ? null : string(row.read_at) };
    }),
    nextCursor: page.next_cursor == null ? null : number(page.next_cursor),
    unreadCount: number(page.unread_count), snapshotId: number(page.snapshot_id),
  };
}

export { notificationHref } from "./notification-route";
export function notificationDate(value: string) {
  const date = new Date(/(?:Z|[+-]\d{2}:\d{2})$/.test(value) ? value : `${value}Z`);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}
