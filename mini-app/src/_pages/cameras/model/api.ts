import { useCallback } from "react";
import { commonZones, isOutdoorZone, useHouseSelection, validLocation, type House, type HouseLocation } from "@/entities/house";
import { useApi } from "@/shared/api/context";
import { endpoints, type ApiClient } from "@/shared/api/client";
import { array, number, record, string } from "@/shared/api/parse";
import { useRemote } from "@/shared/api/use-remote";
import type { Camera } from "./camera";
import type { CameraGateway } from "./camera-gateway";

export function useCameras() {
  const { house } = useHouseSelection();
  const api = useApi();
  const load = useCallback(async (signal: AbortSignal) => array(await api(endpoints.cameras(house.id), { signal }), value => parseCamera(value, house)), [api, house]);
  return useRemote(load);
}
export function parseCamera(value: unknown, house: House): Camera {
  const c = record(value);
  if (c.status !== "online" && c.status !== "maintenance" && c.status !== "unavailable") throw new Error("Неизвестный статус камеры");
  if (typeof c.mine !== "boolean" || (c.visibility !== "private" && c.visibility !== "public")) throw new Error("Неизвестный доступ к камере");
  if (c.moderation_status !== "pending" && c.moderation_status !== "approved" && c.moderation_status !== "rejected") throw new Error("Неизвестный статус модерации");
  let place: HouseLocation | undefined;
  if (c.place) {
    const p = record(c.place);
    const outdoor = isOutdoorZone(string(p.zone));
    const base = { houseId: house.id, entrance: outdoor ? 1 : number(p.entrance), floor: outdoor ? 1 : number(p.floor) };
    if (p.zone === "apartment") {
      const apartment = house.apartments?.find(a => a.id === number(p.apartment_id));
      if (!apartment) throw new Error("Квартира камеры не найдена");
      place = { ...base, zone: "apartment", apartment: apartment.number };
    } else {
      const zone = string(p.zone);
      if (!Object.hasOwn(commonZones, zone)) throw new Error("Неизвестное место камеры");
      place = { ...base, zone: zone as keyof typeof commonZones };
    }
    if (!validLocation(house, place)) throw new Error("Место камеры отсутствует в доме");
  }
  return { id: string(c.id), name: string(c.name), status: c.status, note: string(c.note),
    mine: c.mine, visibility: c.visibility, moderationStatus: c.moderation_status,
    moderationReason: c.moderation_reason == null ? null : string(c.moderation_reason), place };
}
export function createCameraGateway(api: ApiClient): CameraGateway {
  return { async preview(camera, attempt = 0) {
    const frame = record(await api(endpoints.preview(camera.id), { cacheFor: attempt === 0 ? 60000 : 0 }));
    const src = string(frame.src);
    if (!/^\/images\/cameras\/(entrance-[12]|yard)-[12]\.png$/.test(src) && new URL(src).protocol !== "https:") throw new Error("Недопустимый адрес изображения");
    return { src, capturedAt: string(frame.capturedAt) };
  } };
}
