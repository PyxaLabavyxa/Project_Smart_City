import type { HouseLocation } from "@/entities/house";
import { categoriesForPlace, reportScope } from "./report-categories.ts";
export type DraftPhoto = { id: string; file: File };
export type IssueDraft = { place: HouseLocation; category: string; title: string; description: string; step: number; photos: DraftPhoto[] };
export function initialReportStep(place: HouseLocation): number {
  return reportScope(place) === "entrance" ? 0 : 1;
}
function reportPlace(place: HouseLocation): HouseLocation {
  return place.zone === "house" ? { houseId: place.houseId, entrance: 1, floor: 1, zone: "courtyard" } : place;
}
export function emptyDraft(place: HouseLocation): IssueDraft {
  return { place: reportPlace(place), category: "", title: "", description: "", step: -1, photos: [] };
}

export function updateIssueDraft(draft: IssueDraft, patch: Partial<IssueDraft>): IssueDraft {
  const next = { ...draft, ...patch };
  const place = reportPlace(next.place);
  return { ...next, place, category: categoriesForPlace(place).some(item => item.value === next.category) ? next.category : "" };
}
