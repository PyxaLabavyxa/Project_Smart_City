"use client";
import Link from "next/link";
import type { ReactNode } from "react";
import type { HouseLocation } from "../model/house";
import { locationQuery } from "../model/house";
import { useHouseSelection } from "../model/selection-provider";
export function PlaceLink({ place, children, className }: { place: HouseLocation; children: ReactNode; className?: string }) {
  const { select } = useHouseSelection();
  return <Link href={"/plan?" + locationQuery(place)} className={className} onClick={() => select(place)}>{children}</Link>;
}
