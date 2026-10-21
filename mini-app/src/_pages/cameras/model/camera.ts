import type { HouseLocation } from "@/entities/house";
import { isOutdoorZone } from "../../../entities/house/model/house.ts";

export type CameraStatus = "online" | "maintenance" | "unavailable";
export type Camera = {
  id: string; name: string; status: CameraStatus; note: string;
  mine: boolean; visibility: "private" | "public";
  moderationStatus: "pending" | "approved" | "rejected";
  moderationReason: string | null;
  liveAvailable?: boolean;
  place?: HouseLocation;
};
export const cameraVisibilityLabel = (camera: Camera) => camera.visibility === "private" ? "Личная камера"
  : camera.moderationStatus === "pending" ? "На модерации"
  : camera.moderationStatus === "rejected" ? "Отклонена УК" : "Общедоступная";

export type CameraFilters = { type: "all" | "mine" | "public"; entrance: string; floor: string; zone: string };
export function filterCameras(cameras: readonly Camera[], filters: CameraFilters) {
  return cameras.filter(camera => (filters.type === "all" || (filters.type === "mine" ? camera.mine
    : camera.visibility === "public" && camera.moderationStatus === "approved"))
    && (!filters.entrance || (camera.place && !isOutdoorZone(camera.place.zone) && camera.place.entrance === Number(filters.entrance)))
    && (!filters.floor || (camera.place && !isOutdoorZone(camera.place.zone) && camera.place.floor === Number(filters.floor)))
    && (!filters.zone || camera.place?.zone === filters.zone));
}
export const cameraStatusLabels: Record<CameraStatus, string> = {
  online: "Онлайн", maintenance: "Обслуживание", unavailable: "Нет связи",
};
