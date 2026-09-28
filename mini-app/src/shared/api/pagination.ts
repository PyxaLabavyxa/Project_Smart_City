import type { ApiClient } from "./client";
import { array, number, record } from "./parse";

export async function readPages<T>(api: ApiClient, path: string, parse: (item: unknown) => T, signal?: AbortSignal): Promise<T[]> {
  const items: T[] = [];
  let cursor = 0;
  for (;;) {
    const page = record(await api(`${path}?cursor=${cursor}&limit=100`, { signal }));
    items.push(...array(page.items, parse));
    if (page.next_cursor === null) return items;
    const next = number(page.next_cursor);
    if (next <= cursor) throw new Error("Сервер вернул некорректную страницу данных");
    cursor = next;
  }
}
