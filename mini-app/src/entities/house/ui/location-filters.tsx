import { commonZones, isOutdoorZone, type CommonZone, type House, type HouseLocation, type LocationFilterValues } from "../model/house";
import type { ReactNode } from "react";

export function LocationFilters({ house, value, onChange, children, zones = [...Object.keys(commonZones) as CommonZone[], "apartment"] }: { house: House; value: LocationFilterValues; onChange: (key: keyof LocationFilterValues, value: string) => void; children?: ReactNode; zones?: readonly HouseLocation["zone"][] }) {
  const outdoor = isOutdoorZone(value.zone) || zones.length > 0 && zones.every(isOutdoorZone);
  const groundFloor = value.zone === "entrance";
  return <>
    <label>Место<select value={value.zone} onChange={event => onChange("zone", event.target.value)}><option value="">Все места</option>{zones.map(zone => <option key={zone} value={zone}>{zone === "apartment" ? "Квартира" : commonZones[zone]}</option>)}</select></label>
    {children}
    <label>Подъезд<select value={outdoor ? "" : value.entrance} disabled={outdoor} onChange={event => onChange("entrance", event.target.value)}><option value="">{outdoor ? "Нет" : "Все"}</option>{!outdoor && Array.from({ length: house.entrances }, (_, i) => <option key={i + 1} value={i + 1}>№ {i + 1}</option>)}</select></label>
    <label>Этаж<select value={outdoor ? "" : groundFloor ? "1" : value.floor} disabled={outdoor || groundFloor} onChange={event => onChange("floor", event.target.value)}>{groundFloor ? <option value="1">1</option> : <><option value="">{outdoor ? "Нет" : "Все"}</option>{!outdoor && Array.from({ length: house.floors }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1}</option>)}</>}</select></label>
  </>;
}
