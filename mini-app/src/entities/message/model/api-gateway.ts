import type { House } from "@/entities/house";
import { endpoints, type ApiClient } from "@/shared/api/client";
import { number, record, string } from "@/shared/api/parse";
import { readPages } from "@/shared/api/pagination";
import type { Message, MessageGateway } from "./message";

export function parseMessage(value: unknown): Message {
  const row = record(value);
  if (row.direction !== "incoming" && row.direction !== "outgoing") throw new Error("Неизвестный отправитель");
  return { id: String(number(row.id)), apartment: number(row.apartment), text: string(row.text), direction: row.direction, createdAt: string(row.createdAt) };
}
export function createMessageGateway(api: ApiClient, house: House): MessageGateway {
  const path = endpoints.messages(house.residentApartmentId!);
  return {
    list: signal => readPages(api, path, parseMessage, signal),
    async send(place, text, requestId) {
      const apartment = place.zone === "apartment" ? house.apartments?.find(a => a.number === place.apartment) : undefined;
      if (!apartment) throw new Error("Квартира не найдена");
      return parseMessage(await api(path, { body: { recipient_id: apartment.id, text, request_id: requestId } }));
    },
  };
}
