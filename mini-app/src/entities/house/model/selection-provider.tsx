"use client";
import { createContext, useContext, useState, type ReactNode } from "react";
import { fallbackLocation, validLocation, type House, type HouseLocation } from "./house";
import { demoHouse } from "./demo-house";

export const defaultPlace: HouseLocation = { houseId: demoHouse.id, entrance: 2, floor: 9, zone: "corridor" };
const Context = createContext<{ house: House; selected: HouseLocation; select: (place: HouseLocation) => void } | null>(null);
export function HouseSelectionProvider({ children, house }: { children: ReactNode; house: House }) {
  const [selection, setSelection] = useState(() => fallbackLocation(house, defaultPlace));
  const selected = fallbackLocation(house, selection);
  function select(place: HouseLocation) { if (validLocation(house, place)) setSelection(place); }
  return <Context.Provider value={{ house, selected, select }}>{children}</Context.Provider>;
}
export function useHouseSelection() {
  const value = useContext(Context);
  if (!value) throw new Error("HouseSelectionProvider is required");
  return value;
}
