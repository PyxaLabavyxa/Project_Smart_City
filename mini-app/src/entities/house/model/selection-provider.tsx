"use client";
import { createContext, useContext, useState, type ReactNode } from "react";
import { fallbackLocation, findApartment, validLocation, type House, type HouseLocation } from "./house";

export const defaultPlace: HouseLocation = { houseId: "", entrance: 1, floor: 1, zone: "corridor" };
type Choice = { id: number; houseId: string; address: string; apartment: number };
const Context = createContext<{ house: House; choices: readonly Choice[]; choose: (id: number) => void; selected: HouseLocation; select: (place: HouseLocation) => void } | null>(null);
export function HouseSelectionProvider({ children, house, choices = [], choose = () => {} }: { children: ReactNode; house: House; choices?: readonly Choice[]; choose?: (id: number) => void }) {
  const [selection, setSelection] = useState(() => {
    const resident = findApartment(house, house.residentApartment);
    return fallbackLocation(house, { ...defaultPlace, houseId: house.id, entrance: resident?.entrance ?? 1, floor: resident?.floor ?? 1 });
  });
  const selected = fallbackLocation(house, selection);
  function select(place: HouseLocation) { if (validLocation(house, place)) setSelection(place); }
  return <Context.Provider value={{ house, choices, choose, selected, select }}>{children}</Context.Provider>;
}
export function useHouseSelection() {
  const value = useContext(Context);
  if (!value) throw new Error("HouseSelectionProvider is required");
  return value;
}
