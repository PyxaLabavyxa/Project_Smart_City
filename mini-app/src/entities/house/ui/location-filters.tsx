import { commonZones, isOutdoorZone, type House, type LocationFilterValues } from "../model/house";

export function LocationFilters({ house, value, onChange }: { house: House; value: LocationFilterValues; onChange: (key: keyof LocationFilterValues, value: string) => void }) {
  const outdoor = isOutdoorZone(value.zone);
  const groundFloor = value.zone === "entrance";
  return <>
    <label>Место<select value={value.zone} onChange={event => onChange("zone", event.target.value)}><option value="">Все места</option>{Object.entries(commonZones).map(([zone, title]) => <option key={zone} value={zone}>{title}</option>)}<option value="apartment">Квартира</option></select></label>
    <label>Подъезд<select value={outdoor ? "" : value.entrance} disabled={outdoor} onChange={event => onChange("entrance", event.target.value)}><option value="">{outdoor ? "Нет подъездов" : "Все подъезды"}</option>{!outdoor && Array.from({ length: house.entrances }, (_, i) => <option key={i + 1} value={i + 1}>Подъезд {i + 1}</option>)}</select></label>
    <label>Этаж<select value={outdoor ? "" : groundFloor ? "1" : value.floor} disabled={outdoor || groundFloor} onChange={event => onChange("floor", event.target.value)}>{groundFloor ? <option value="1">Этаж 1</option> : <><option value="">{outdoor ? "Нет этажей" : "Все этажи"}</option>{!outdoor && Array.from({ length: house.floors }, (_, i) => <option key={i + 1} value={i + 1}>Этаж {i + 1}</option>)}</>}</select></label>
  </>;
}
