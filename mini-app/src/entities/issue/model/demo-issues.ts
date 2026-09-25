import type { HouseLocation } from "@/entities/house";

// Presentation data for one fictional resident. This is not a backend DTO.
// accepted/assigned/awaiting-confirmation are UI-only workflow states.
export type DemoIssueStatus = "new" | "accepted" | "assigned" | "in-progress" | "awaiting-confirmation" | "completed";

export type DemoIssue = {
  id: string;
  title: string;
  category: string;
  address: string;
  location: string;
  // Structured fixture location; free-text reports retain their original location.
  place?: HouseLocation;
  createdAt: string;
  status: DemoIssueStatus;
  description: string;
  history: readonly { status: DemoIssueStatus; at: string }[];
};

export const demoIssues: readonly DemoIssue[] = [
  {
    id: "151",
    title: "Не работает свет на лестнице",
    category: "Электричество",
    address: "ул. Центральная, 18",
    location: "Подъезд 2 · этаж 8 · Лестница",
    place: { houseId: "central-18", entrance: 2, floor: 8, zone: "stairs" },
    createdAt: "2026-09-23T08:40:00+03:00",
    status: "new",
    history: [{ status: "new", at: "2026-09-23T08:40:00+03:00" }],
    description: "На лестничной площадке восьмого этажа не горят две лампы. Вечером на лестнице темно.",
  },
  {
    id: "150",
    title: "Не закрывается дверь в подъезд",
    category: "Подъезд",
    address: "ул. Центральная, 18",
    location: "Подъезд 2 · этаж 1 · Входная группа",
    place: { houseId: "central-18", entrance: 2, floor: 1, zone: "entrance" },
    createdAt: "2026-09-22T17:10:00+03:00",
    status: "accepted",
    history: [
      { status: "new", at: "2026-09-22T17:10:00+03:00" },
      { status: "accepted", at: "2026-09-22T17:25:00+03:00" },
    ],
    description: "Входная дверь остаётся открытой: доводчик не дотягивает её до замка. Пожалуйста, отрегулируйте механизм.",
  },
  {
    id: "148",
    title: "Протечка возле стояка",
    category: "Водоснабжение",
    address: "ул. Центральная, 18",
    location: "Подъезд 2 · этаж 9 · Коридор",
    place: { houseId: "central-18", entrance: 2, floor: 9, zone: "corridor" },
    createdAt: "2026-09-22T09:15:00+03:00",
    status: "in-progress",
    history: [
      { status: "new", at: "2026-09-22T09:15:00+03:00" },
      { status: "accepted", at: "2026-09-22T09:23:00+03:00" },
      { status: "in-progress", at: "2026-09-22T10:30:00+03:00" },
    ],
    description: "Вода собирается возле стояка в общем коридоре девятого этажа. На полу появилась лужа, труба влажная. Протечка продолжается.",
  },
  {
    id: "146",
    title: "Лифт закрывается с задержкой",
    category: "Лифт",
    address: "ул. Центральная, 18",
    location: "Подъезд 2 · этаж 1 · Лифт",
    place: { houseId: "central-18", entrance: 2, floor: 1, zone: "elevator" },
    createdAt: "2026-09-18T19:10:00+03:00",
    status: "completed",
    history: [
      { status: "new", at: "2026-09-18T19:10:00+03:00" },
      { status: "accepted", at: "2026-09-19T09:00:00+03:00" },
      { status: "in-progress", at: "2026-09-21T10:00:00+03:00" },
      { status: "completed", at: "2026-09-21T12:40:00+03:00" },
    ],
    description: "Перед поездкой двери лифта несколько раз открывались и закрывались. Задержка повторялась даже при пустом дверном проёме.",
  },
];

const dateFormatter = new Intl.DateTimeFormat("ru-RU", {
  day: "numeric", month: "long", year: "numeric",
  hour: "2-digit", minute: "2-digit", timeZone: "Europe/Moscow",
});

export function formatIssueDate(value: string) {
  return dateFormatter.format(new Date(value));
}
