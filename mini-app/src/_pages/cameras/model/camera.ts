export type CameraStatus = "online" | "maintenance" | "unavailable";
export type Camera = { id: string; name: string; status: CameraStatus; note: string };
export const cameraStatusLabels: Record<CameraStatus, string> = {
  online: "Онлайн", maintenance: "Обслуживание", unavailable: "Нет связи",
};
