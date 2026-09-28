export type House = {
  id: string;
  address: string;
  entrances: number;
  floors: number;
  apartmentsPerFloor: number;
  residentApartment: number;
  residentApartmentId?: number;
  apartments?: readonly { id: number; number: number; entrance: number; floor: number }[];
  overrides?: Readonly<Record<string, number>>;
};

export const commonZones = {
  corridor: "Коридор",
  stairs: "Лестница",
  elevator: "Лифт",
  technical: "Техническая зона",
  entrance: "Входная группа",
  house: "Дом",
  courtyard: "Двор",
  parking: "Парковка",
} as const;

export type CommonZone = keyof typeof commonZones;
export type HouseLocation = { houseId: string; entrance: number; floor: number } & (
  { zone: "apartment"; apartment: number } | { zone: CommonZone }
);

export function totalApartments(house: House) {
  if (house.apartments) return house.apartments.length;
  let total = 0;
  for (let e = 1; e <= house.entrances; e++) for (let f = 1; f <= house.floors; f++) total += floorCount(house, e, f);
  return total;
}

export function floorCount(house: House, entrance: number, floor: number) {
  if (house.apartments) return house.apartments.filter(a => a.entrance === entrance && a.floor === floor).length;
  return house.overrides?.[`${entrance}:${floor}`] ?? house.apartmentsPerFloor;
}

export function validStructure(house: House) {
  const within = (value: number, max: number) => Number.isInteger(value) && value >= 1 && value <= max;
  if (!within(house.entrances, 8) || !within(house.floors, 40) || !within(house.apartmentsPerFloor, 60)) return false;
  return Object.entries(house.overrides ?? {}).every(([key, count]) => {
    const [e, f] = key.split(":").map(Number);
    return key === `${e}:${f}` && within(e, house.entrances) && within(f, house.floors) && within(count, 60);
  });
}

export function floorApartments(house: House, entrance: number, floor: number): number[] {
  if (house.apartments) return house.apartments.filter(a => a.entrance === entrance && a.floor === floor).map(a => a.number).sort((a, b) => a - b);
  if (!Number.isInteger(entrance) || !Number.isInteger(floor) || entrance < 1 || entrance > house.entrances || floor < 1 || floor > house.floors) return [];
  let first = 1;
  for (let e = 1; e <= entrance; e++) for (let f = 1; f <= (e === entrance ? floor - 1 : house.floors); f++) first += floorCount(house, e, f);
  return Array.from({ length: floorCount(house, entrance, floor) }, (_, index) => first + index);
}

export function findApartment(house: House, apartment: number): HouseLocation | null {
  if (house.apartments) {
    const found = house.apartments.find(a => a.number === apartment);
    return found ? { houseId: house.id, entrance: found.entrance, floor: found.floor, zone: "apartment", apartment } : null;
  }
  if (!Number.isInteger(apartment) || apartment < 1 || apartment > totalApartments(house)) return null;
  let first = 1;
  for (let entrance = 1; entrance <= house.entrances; entrance++) for (let floor = 1; floor <= house.floors; floor++) {
    const count = floorCount(house, entrance, floor);
    if (apartment < first + count) return { houseId: house.id, entrance, floor, zone: "apartment", apartment };
    first += count;
  }
  return null;
}

// Apartment numbers identify recipients; obsolete common zones remain unbound.
export function resolveLocation(house: House, place: HouseLocation | undefined): HouseLocation | undefined {
  if (!place || place.houseId !== house.id) return undefined;
  if (place.zone === "apartment") return findApartment(house, place.apartment) ?? undefined;
  return validLocation(house, place) ? place : undefined;
}

export function fallbackLocation(house: House, place: HouseLocation): HouseLocation {
  return resolveLocation(house, place) ?? { houseId: house.id, entrance: Math.max(1, Math.min(house.entrances, place.entrance)), floor: Math.max(1, Math.min(house.floors, place.floor)), zone: "corridor" };
}

export function zoneLabel(location: HouseLocation) {
  return location.zone === "apartment" ? `Квартира ${location.apartment}` : commonZones[location.zone];
}

export function formatLocation(location: HouseLocation) {
  if (["house", "courtyard", "parking"].includes(location.zone)) return zoneLabel(location);
  return `Подъезд ${location.entrance} · этаж ${location.floor} · ${zoneLabel(location)}`;
}

export function sameLocation(a: HouseLocation | undefined, b: HouseLocation) {
  return !!a && a.houseId === b.houseId && a.entrance === b.entrance && a.floor === b.floor
    && a.zone === b.zone && (a.zone !== "apartment" || (b.zone === "apartment" && a.apartment === b.apartment));
}

export function validLocation(house: House, place: HouseLocation | undefined): place is HouseLocation {
  if (!place || place.houseId !== house.id) return false;
  if (!Number.isInteger(place.entrance) || !Number.isInteger(place.floor) || place.entrance < 1 || place.entrance > house.entrances || place.floor < 1 || place.floor > house.floors) return false;
  const apartments = floorApartments(house, place.entrance, place.floor);
  if (place.zone === "apartment") return apartments.includes(place.apartment);
  if (["house", "courtyard", "parking"].includes(place.zone)) return place.entrance === 1 && place.floor === 1;
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
