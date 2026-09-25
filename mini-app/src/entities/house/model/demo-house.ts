import type { House } from "./house";

// Local fixture, not a backend response. Shared by plan and recipient selection.
export const demoHouse: House = {
  id: "central-18", address: "ул. Центральная, 18",
  entrances: 2, floors: 9, apartmentsPerFloor: 4, residentApartment: 71,
};
