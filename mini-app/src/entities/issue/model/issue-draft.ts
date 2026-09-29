import type { HouseLocation } from "@/entities/house";
export type DraftPhoto = { id: string; file: File };
export type IssueDraft = { place: HouseLocation; category: string; title: string; description: string; step: number; photos: DraftPhoto[] };
export function emptyDraft(place: HouseLocation): IssueDraft {
  return { place, category: "", title: "", description: "", step: 0, photos: [] };
}
