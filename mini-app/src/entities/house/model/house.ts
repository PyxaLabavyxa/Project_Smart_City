export type House = {
  id: string;
  address: string;
  entrances: number;
  floors: number;
  apartmentsPerFloor: number;
  residentApartment: number;
};

export const commonZones = {
  corridor: "Коридор",
  stairs: "Лестница",
  elevator: "Лифт",
  technical: "Техническая зона",
  entrance: "Входная группа",
} as const;

export type CommonZone = keyof typeof commonZones;
export type HouseLocation = { houseId: string; entrance: number; floor: number } & (
  { zone: "apartment"; apartment: number } | { zone: CommonZone }
);

export function totalApartments(house: House) {
  return house.entrances * house.floors * house.apartmentsPerFloor;
}

export function floorApartments(house: House, entrance: number, floor: number): number[] {
  if (!Number.isInteger(entrance) || !Number.isInteger(floor) || entrance < 1 || entrance > house.entrances || floor < 1 || floor > house.floors) return [];
  const first = ((entrance - 1) * house.floors + floor - 1) * house.apartmentsPerFloor + 1;
  return Array.from({ length: house.apartmentsPerFloor }, (_, index) => first + index);
}

export function findApartment(house: House, apartment: number): HouseLocation | null {
  if (!Number.isInteger(apartment) || apartment < 1 || apartment > totalApartments(house)) return null;
  const floorIndex = Math.floor((apartment - 1) / house.apartmentsPerFloor);
  return {
    houseId: house.id,
    entrance: Math.floor(floorIndex / house.floors) + 1,
    floor: floorIndex % house.floors + 1,
    zone: "apartment",
    apartment,
  };
}

export function zoneLabel(location: HouseLocation) {
  return location.zone === "apartment" ? `Квартира ${location.apartment}` : commonZones[location.zone];
}

export function formatLocation(location: HouseLocation) {
  return `Подъезд ${location.entrance} · этаж ${location.floor} · ${zoneLabel(location)}`;
}

export function sameLocation(a: HouseLocation | undefined, b: HouseLocation) {
  return !!a && a.houseId === b.houseId && a.entrance === b.entrance && a.floor === b.floor
    && a.zone === b.zone && (a.zone !== "apartment" || (b.zone === "apartment" && a.apartment === b.apartment));
}

export function validLocation(house: House, place: HouseLocation | undefined): place is HouseLocation {
  if (!place || place.houseId !== house.id) return false;
  const apartments = floorApartments(house, place.entrance, place.floor);
  if (!apartments.length) return false;
  if (place.zone === "apartment") return apartments.includes(place.apartment);
  return Object.hasOwn(commonZones, place.zone) && (place.zone !== "entrance" || place.floor === 1);
}

export function locationQuery(place: HouseLocation) {
  return new URLSearchParams({ house: place.houseId, entrance: String(place.entrance), floor: String(place.floor), zone: place.zone, ...(place.zone === "apartment" ? { apartment: String(place.apartment) } : {}) }).toString();
}

export function parseLocation(house: House, params: Record<string, string | string[] | undefined>): HouseLocation | undefined {
  if (Object.values(params).some(value => Array.isArray(value))) return undefined;
  const zone = params.zone;
  if (typeof zone !== "string" || (zone !== "apartment" && !Object.hasOwn(commonZones, zone))) return undefined;
  const base = { houseId: typeof params.house === "string" ? params.house : "", entrance: Number(params.entrance), floor: Number(params.floor) };
  const place: HouseLocation = zone === "apartment" ? { ...base, zone, apartment: Number(params.apartment) } : { ...base, zone: zone as CommonZone };
  return validLocation(house, place) ? place : undefined;
}
