import { parseChatPhotos, type ChatPhoto } from "../../shared/api/chat-photos.ts";

export type IssueChatMessage = {
  id: number;
  direction: "staff" | "resident";
  author: string;
  text: string;
  photos?: readonly ChatPhoto[];
  createdAt: string;
};

export function parseChatMessage(value: unknown): IssueChatMessage {
  if (!value || typeof value !== "object") throw new Error("Некорректное сообщение");
  const row = value as Record<string, unknown>;
  if (typeof row.id !== "number" || !Number.isSafeInteger(row.id) || row.id < 1
    || (row.direction !== "staff" && row.direction !== "resident")
    || typeof row.author !== "string" || typeof row.text !== "string"
    || typeof row.created_at !== "string" || !Number.isFinite(Date.parse(row.created_at))) {
    throw new Error("Некорректное сообщение");
  }
  return { id: row.id, direction: row.direction, author: row.author, text: row.text, photos: parseChatPhotos(row.photos), createdAt: row.created_at };
}

// A delayed history response must not erase a message confirmed by POST.
export function mergeMessages(current: readonly IssueChatMessage[], incoming: readonly IssueChatMessage[]): IssueChatMessage[] {
  return [...new Map([...current, ...incoming].map(message => [message.id, message])).values()]
    .sort((a, b) => a.id - b.id);
}
