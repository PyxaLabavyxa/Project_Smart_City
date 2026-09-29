import type { House } from "@/entities/house";
import { commonZones, formatLocation, type HouseLocation } from "@/entities/house";
import { endpoints, type ApiClient } from "@/shared/api/client";
import { array, number, record, string } from "@/shared/api/parse";
import { readPages } from "@/shared/api/pagination";
import type { IssueRecord, IssueStateStatus } from "./issue";
import type { IssueGateway } from "./issue-gateway";

const categories: Record<string, string> = { water: "Водоснабжение", heating: "Отопление", electricity: "Электричество", elevator: "Лифт", entrance: "Подъезд", yard: "Двор", garbage: "Мусор", security: "Безопасность", other: "Другое" };
function status(value: unknown): IssueStateStatus {
  switch (value) { case "new": return "new"; case "in_progress": return "in-progress"; case "resolved": return "completed"; default: throw new Error("Неизвестный статус обращения"); }
}
export function parseIssue(value: unknown, house: House): IssueRecord {
  const row = record(value);
  let place: HouseLocation | undefined;
  if (row.place) {
    const p = record(row.place);
    const base = { houseId: String(number(row.house_id)), entrance: number(p.entrance), floor: number(p.floor) };
    if (p.zone === "apartment") {
      const apartment = house.apartments?.find(a => a.id === number(p.apartment_id));
      if (apartment) place = { ...base, zone: "apartment", apartment: apartment.number };
    } else {
      const zone = string(p.zone);
      if (!Object.hasOwn(commonZones, zone)) throw new Error("Неизвестное место обращения");
      place = { ...base, zone: zone as keyof typeof commonZones };
    }
  }
  const category = categories[string(row.category)];
  if (!category) throw new Error("Неизвестная категория обращения");
  return { id: String(number(row.id)), title: string(row.title), description: string(row.description),
    category, address: string(row.address), createdAt: string(row.created_at), status: status(row.status),
    mine: row.mine === true, priority: number(row.priority) === 1 ? "high" : "normal", place,
    photoIds: row.photo_ids === undefined ? [] : array(row.photo_ids, number),
    location: place ? formatLocation(place) : "Место не указано",
    history: array(row.history, value => { const event = record(value); return { status: status(event.status), at: string(event.at) }; }),
  };
}
export function createIssueGateway(api: ApiClient, house: House): IssueGateway {
  return {
    list: signal => readPages(api, endpoints.issues(house.id), value => parseIssue(value, house), signal),
    get: async (id, signal) => parseIssue(await api(endpoints.issue(id), { signal }), house),
    async create(input, requestId) {
      const category = Object.keys(categories).find(key => categories[key] === input.category);
      if (!category) throw new Error("Выберите доступную категорию");
      const place = input.place;
      const apartmentId = place.zone === "apartment" ? house.apartments?.find(a => a.number === place.apartment)?.id : undefined;
      if (place.zone === "apartment" && !apartmentId) throw new Error("Квартира не найдена");
      const data = {
        title: input.title, description: input.description, category, request_id: requestId,
        place: { entrance: place.entrance, floor: place.floor, zone: place.zone, apartment_id: apartmentId ?? null },
      };
      if (input.photos?.length) {
        const body = new FormData();
        body.append("data", JSON.stringify(data));
        for (const photo of input.photos) body.append("photos", photo.file, photo.file.name);
        return parseIssue(await api(endpoints.issues(house.id) + "/with-photos", { body }), house);
      }
      return parseIssue(await api(endpoints.issues(house.id), { body: data }), house);
    },
  };
}
