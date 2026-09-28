import type { Message } from "./message.ts";

export function messageThreads(messages: readonly Message[]) {
  const threads = new Map<number, Message>();
  for (const message of messages) {
    const previous = threads.get(message.apartment);
    if (!previous || Date.parse(message.createdAt) >= Date.parse(previous.createdAt)) threads.set(message.apartment, message);
  }
  return [...threads.values()].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}
