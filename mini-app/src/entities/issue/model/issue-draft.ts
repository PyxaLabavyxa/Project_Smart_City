import type { HouseLocation } from "@/entities/house";
import { categoriesForPlace, reportScope } from "./report-categories.ts";
export type DraftPhoto = { id: string; file: File };
export type IssueDraft = { place: HouseLocation; category: string; title: string; description: string; step: number; photos: DraftPhoto[] };
export function initialReportStep(place: HouseLocation): number {
  return reportScope(place) === "entrance" ? 0 : 1;
}
export function emptyDraft(place: HouseLocation): IssueDraft {
  return { place, category: "", title: "", description: "", step: -1, photos: [] };
}

export function updateIssueDraft(draft: IssueDraft, patch: Partial<IssueDraft>): IssueDraft {
  const next = { ...draft, ...patch };
  return { ...next, category: categoriesForPlace(next.place).some(item => item.value === next.category) ? next.category : "" };
}
