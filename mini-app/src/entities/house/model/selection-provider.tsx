"use client";
import { createContext, useContext, useState, type ReactNode } from "react";
import type { HouseLocation } from "./house";
import { demoHouse } from "./demo-house";

export const defaultPlace: HouseLocation = { houseId: demoHouse.id, entrance: 2, floor: 9, zone: "corridor" };
const Context = createContext<{ selected: HouseLocation; select: (place: HouseLocation) => void } | null>(null);
export function HouseSelectionProvider({ children }: { children: ReactNode }) {
  const [selected, select] = useState<HouseLocation>(defaultPlace);
  return <Context.Provider value={{ selected, select }}>{children}</Context.Provider>;
}
export function useHouseSelection() {
  const value = useContext(Context);
  if (!value) throw new Error("HouseSelectionProvider is required");
  return value;
}
