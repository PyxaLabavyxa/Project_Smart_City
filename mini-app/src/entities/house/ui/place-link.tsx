"use client";
import Link from "next/link";
import type { ReactNode } from "react";
import type { HouseLocation } from "../model/house";
import { isOutdoorZone, locationQuery, resolveLocation } from "../model/house";
import { useHouseSelection } from "../model/selection-provider";
export function PlaceLink({ place, children, className, returnTo }: { place: HouseLocation; children: ReactNode; className?: string; returnTo?: string }) {
  const { house, select } = useHouseSelection();
  const currentPlace = resolveLocation(house, place);
  if (isOutdoorZone(place.zone)) return <span className={className}>{children}</span>;
  const back = returnTo ? `&returnTo=${encodeURIComponent(returnTo)}&from=${house.residentApartmentId}` : "";
  return currentPlace ? <Link href={"/plan?" + locationQuery(currentPlace) + back} className={className} onClick={() => select(currentPlace)}>{children}</Link> : <p>Место отсутствует в текущей структуре дома.</p>;
}
