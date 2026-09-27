"use client";
import { createContext, useContext, useState, type ReactNode } from "react";
import { fallbackLocation, validLocation, validStructure, type House, type HouseLocation } from "./house";
import { demoHouse } from "./demo-house";

export const defaultPlace: HouseLocation = { houseId: demoHouse.id, entrance: 2, floor: 9, zone: "corridor" };
const Context = createContext<{ house: House; revision: number; selected: HouseLocation; select: (place: HouseLocation) => void; applyStructure: (house: House) => void } | null>(null);
export function HouseSelectionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState({ house: demoHouse, selected: defaultPlace, revision: 0 });
  function select(place: HouseLocation) { setState(current => validLocation(current.house, place) ? { ...current, selected: place } : current); }
  function applyStructure(house: House) {
    if (!validStructure(house)) throw new Error("Проверьте параметры дома и отдельных этажей.");
    setState(current => ({ house: { ...house, overrides: { ...house.overrides } }, selected: fallbackLocation(house, current.selected), revision: current.revision + 1 }));
  }
  return <Context.Provider value={{ ...state, select, applyStructure }}>{children}</Context.Provider>;
}
export function useHouseSelection() {
  const value = useContext(Context);
  if (!value) throw new Error("HouseSelectionProvider is required");
  return value;
}
