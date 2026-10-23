import { record, string } from "../../../shared/api/parse.ts";

export type HouseChat = {
  status: "available" | "not_connected" | "link_missing" | "unavailable";
  title: string;
  joinUrl: string | null;
};

export function safeMaxChatLink(value: unknown): string | null {
  return typeof value === "string" && value.length <= 1024 && /^https:\/\/max\.ru\/[A-Za-z0-9_-]+(?:\/[A-Za-z0-9_-]+)*\/?$/.test(value) ? value : null;
}

export function parseHouseChat(value: unknown): HouseChat {
  const data = record(value);
  const status = data.status;
  if (status !== "available" && status !== "not_connected" && status !== "link_missing" && status !== "unavailable") throw new Error("Не удалось прочитать данные чата");
  const joinUrl = status === "available" ? safeMaxChatLink(data.join_url) : null;
  return { status: status === "available" && !joinUrl ? "link_missing" : status, title: string(data.title), joinUrl };
}

export function openHouseChat(url: string, bridge?: { openMaxLink?: (url: string) => void; initData?: string }): boolean {
  if (!safeMaxChatLink(url) || !bridge?.initData || !bridge.openMaxLink) return false;
  try { bridge.openMaxLink(url); return true; } catch { return false; }
}
