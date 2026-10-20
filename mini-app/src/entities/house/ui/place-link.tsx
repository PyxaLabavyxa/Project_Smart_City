"use client";
import Link from "next/link";
import type { ReactNode } from "react";
import type { HouseLocation } from "../model/house";
import { isOutdoorZone, locationQuery, resolveLocation } from "../model/house";
import { useHouseSelection } from "../model/selection-provider";
export function PlaceLink({ place, children, className }: { place: HouseLocation; children: ReactNode; className?: string }) {
  const { house, select } = useHouseSelection();
  const currentPlace = resolveLocation(house, place);
  if (isOutdoorZone(place.zone)) return <span className={className}>{children}</span>;
  return currentPlace ? <Link href={"/plan?" + locationQuery(currentPlace)} className={className} onClick={() => select(currentPlace)}>{children}</Link> : <p>Место отсутствует в текущей структуре дома.</p>;
}
