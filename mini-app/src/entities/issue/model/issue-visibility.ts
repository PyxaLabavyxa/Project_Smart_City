import { findApartment, isOutdoorZone, type House } from "../../house/model/house.ts";
import type { IssueRecord } from "./issue";

/** Keep the current feed scoped during refreshes and immediately after creation. */
export function visibleInSelectedHome(issue: Pick<IssueRecord, "place" | "mine">, house: House): boolean {
  const place = issue.place;
  if (!place) return issue.mine === true;
  if (place.houseId !== house.id) return false;
  if (place.zone === "apartment") return issue.mine === true;
  if (isOutdoorZone(place.zone)) return true;
  const resident = findApartment(house, house.residentApartment);
  return resident !== null && place.entrance === resident.entrance;
}
