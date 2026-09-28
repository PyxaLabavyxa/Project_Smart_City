import { useCallback } from "react";
import { useHouseSelection } from "@/entities/house";
import { useApi } from "@/shared/api/context";
import { endpoints, type ApiClient } from "@/shared/api/client";
import { array, record, string } from "@/shared/api/parse";
import { useRemote } from "@/shared/api/use-remote";
import type { Camera } from "./camera";
import type { CameraGateway } from "./camera-gateway";

export function useCameras() {
  const { house } = useHouseSelection();
  const api = useApi();
  const load = useCallback(async (signal: AbortSignal) => array(await api(endpoints.cameras(house.id), { signal }), value => {
    const c = record(value);
    if (c.status !== "online" && c.status !== "maintenance" && c.status !== "unavailable") throw new Error("Неизвестный статус камеры");
    return { id: string(c.id), name: string(c.name), status: c.status, note: string(c.note) } satisfies Camera;
  }), [api, house.id]);
  return useRemote(load);
}
export function createCameraGateway(api: ApiClient): CameraGateway {
  return { async preview(camera) {
    const frame = record(await api(endpoints.preview(camera.id)));
    const src = string(frame.src);
    if (new URL(src).protocol !== "https:") throw new Error("Недопустимый адрес изображения");
    return { src, capturedAt: string(frame.capturedAt) };
  } };
}
