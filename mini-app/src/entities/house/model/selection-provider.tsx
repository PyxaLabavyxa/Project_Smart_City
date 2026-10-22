"use client";
import { createContext, useContext, useState, type ReactNode } from "react";
import { fallbackLocation, validLocation, type House, type HouseLocation } from "./house";

export const defaultPlace: HouseLocation = { houseId: "", entrance: 1, floor: 1, zone: "corridor" };
type ApartmentsState = { loading: boolean; error: string; reload: () => void };
const readyApartments: ApartmentsState = { loading: false, error: "", reload: () => {} };
type Choice = { id: number; houseId: string; address: string; apartment: number };
const Context = createContext<{ house: House; apartmentsState: ApartmentsState; choices: readonly Choice[]; choose: (id: number) => void; refreshHomes: () => void; selected: HouseLocation; select: (place: HouseLocation) => void } | null>(null);
export function HouseSelectionProvider({ children, house, choices = [], choose = () => {}, refreshHomes = () => {}, apartmentsState = readyApartments }: { apartmentsState?: ApartmentsState; children: ReactNode; house: House; choices?: readonly Choice[]; choose?: (id: number) => void; refreshHomes?: () => void }) {
  const [selection, setSelection] = useState<HouseLocation>(() => ({ ...defaultPlace, houseId: house.id }));
  const selected = fallbackLocation(house, selection);
  function select(place: HouseLocation) { if (validLocation(house, place)) setSelection(place); }
  return <Context.Provider value={{ house, apartmentsState, choices, choose, refreshHomes, selected, select }}>{children}</Context.Provider>;
}
export function useHouseSelection() {
  const value = useContext(Context);
  if (!value) throw new Error("HouseSelectionProvider is required");
  return value;
}
