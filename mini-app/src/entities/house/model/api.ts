import { array, number, record, string } from "@/shared/api/parse";
export function parseApartment(value: unknown) {
  const a = record(value);
  return { id: number(a.id), houseId: String(number(a.house_id)), number: number(a.number), entrance: number(a.entrance), floor: number(a.floor) };
}
export function parseProfile(value: unknown) {
  const profile = record(value);
  return {
    id: number(profile.id), name: string(profile.name),
    apartments: array(profile.apartments, parseApartment),
    houses: array(profile.houses, value => {
      const h = record(value);
      return { id: String(number(h.id)), address: string(h.address), entrances: number(h.entrances_count), floors: number(h.floors_count), apartmentsPerFloor: number(h.apartments_per_floor) };
    }),
  };
}
export type ResidentProfile = ReturnType<typeof parseProfile>;
