import type { HouseLocation } from "@/entities/house";
export type IssueDraft = { place: HouseLocation; category: string; title: string; description: string; step: number };
export function emptyDraft(place: HouseLocation): IssueDraft {
  return { place, category: "", title: "", description: "", step: 0 };
}
