import type { House, HouseLocation } from "@/entities/house";
import type { Camera } from "./camera";

export function cameraIssueContext(camera: Camera, house: House): { place: HouseLocation; category: string } | undefined {
  const name = camera.name.toLocaleLowerCase("ru");
  const base = { houseId: house.id, entrance: 1, floor: 1 };
  if (/(?:^|\s)двор(?:\s|$|[.,·—-])/.test(name) || camera.id === "courtyard") {
    return { place: { ...base, zone: "courtyard" }, category: "Двор" };
  }
  const match = /подъезд\s*№?\s*(\d+)/.exec(name) ?? /^entrance-(\d+)$/.exec(camera.id);
  if (match) {
    const entrance = Number(match[1]);
    if (entrance >= 1 && entrance <= house.entrances) {
      return { place: { ...base, entrance, zone: "entrance" }, category: "Подъезд" };
    }
  }
  return undefined;
}
