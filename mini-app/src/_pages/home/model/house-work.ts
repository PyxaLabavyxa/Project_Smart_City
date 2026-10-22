import { number, record, string } from "../../../shared/api/parse.ts";

export function parseHouseWork(value: unknown) {
  const work = record(value);
  const startsAt = string(work.starts_at), endsAt = work.ends_at === null ? null : string(work.ends_at);
  if (!Number.isFinite(Date.parse(startsAt)) || (endsAt !== null && (!Number.isFinite(Date.parse(endsAt)) || Date.parse(endsAt) <= Date.parse(startsAt)))) throw new Error("Некорректные даты работ");
  return { id: number(work.id), title: string(work.title), startsAt, endsAt, location: string(work.location), description: work.description === undefined ? "" : string(work.description) };
}
export type HouseWork = ReturnType<typeof parseHouseWork>;

export function activeHouseWorks(works: HouseWork[], now = Date.now()) {
  return works.filter(work => work.endsAt === null || Date.parse(work.endsAt) > now).sort((a,b) => Date.parse(a.startsAt) - Date.parse(b.startsAt) || a.id-b.id);
}
export function houseWorkStatus(work: HouseWork, now = Date.now()) {
  return work.endsAt !== null && Date.parse(work.endsAt) <= now ? "Завершены" : Date.parse(work.startsAt) <= now ? "Идут работы" : "Запланированы";
}
export function workPeriod(work: HouseWork) {
  const options: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Moscow" };
  const start = new Date(work.startsAt).toLocaleString("ru-RU", options);
  if (work.endsAt === null) return `С ${start} · МСК`;
  const sameDay = new Date(work.startsAt).toLocaleDateString("ru-RU", { timeZone: "Europe/Moscow" }) === new Date(work.endsAt).toLocaleDateString("ru-RU", { timeZone: "Europe/Moscow" });
  const end = new Date(work.endsAt).toLocaleString("ru-RU", sameDay ? { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Moscow" } : options);
  return `${start} — ${end} · МСК`;
}
