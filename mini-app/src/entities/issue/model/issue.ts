import type { HouseLocation } from "@/entities/house";

export type IssueStateStatus = "new" | "accepted" | "assigned" | "in-progress" | "awaiting-confirmation" | "completed";

export type IssueRecord = {
  id: string;
  title: string;
  category: string;
  address: string;
  location: string;
  place?: HouseLocation;
  createdAt: string;
  status: IssueStateStatus;
  priority?: "normal" | "high";
  mine?: boolean;
  assignee?: string;
  deadline?: string;
  description: string;
  photoIds?: readonly number[];
  history: readonly { status: IssueStateStatus; at: string }[];
};

const dateFormatter = new Intl.DateTimeFormat("ru-RU", {
  day: "numeric", month: "long", year: "numeric",
  hour: "2-digit", minute: "2-digit", timeZone: "Europe/Moscow",
});

export function formatIssueDate(value: string) {
  return dateFormatter.format(new Date(value));
}
