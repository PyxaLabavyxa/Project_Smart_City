// Local state fixtures. No video stream, polling or backend connection.
export type CameraStatus = "online" | "maintenance" | "unavailable";
export type Camera = { id: string; name: string; status: CameraStatus; note: string };

export const cameraStatusLabels: Record<CameraStatus, string> = {
  online: "Онлайн", maintenance: "Обслуживание", unavailable: "Нет связи",
};

export const demoCameras: readonly Camera[] = [
  { id: "entrance-1", name: "Вход в подъезд 1", status: "online", note: "Камера входной группы первого подъезда." },
  { id: "entrance-2", name: "Вход в подъезд 2", status: "online", note: "Камера входной группы второго подъезда." },
  { id: "courtyard", name: "Двор", status: "maintenance", note: "Плановое обслуживание камеры во дворе." },
  { id: "parking", name: "Парковка", status: "unavailable", note: "Камера общей зоны парковки." },
];
