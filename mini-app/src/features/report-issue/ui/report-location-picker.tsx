"use client";
import { useHouseSelection, findApartment, formatLocation, zoneLabel, FloorControls, FloorPlan, type HouseLocation } from "@/entities/house";
import { reportScope, type ReportScope } from "@/entities/issue/model/report-categories";
import { Icon } from "@/shared/ui/icon";
import styles from "./report-issue.module.css";

export function ReportLocationPicker({ value, onChange, details = false, showScopes = true, tourTarget }: {
  value: HouseLocation; onChange: (place: HouseLocation) => void; details?: boolean; showScopes?: boolean; tourTarget?: string;
}) {
  const { house, choices, selected } = useHouseSelection();
  const scope = reportScope(value);
  const ownApartments = choices.filter(choice => choice.houseId === house.id);
  function chooseScope(next: ReportScope) {
    if (next === "apartment") {
      const place = findApartment(house, house.residentApartment);
      if (place) onChange(place);
    } else if (next === "courtyard") {
      onChange({ houseId: house.id, entrance: 1, floor: 1, zone: "courtyard" });
    } else {
      onChange({ houseId: house.id, entrance: selected.entrance, floor: selected.floor, zone: "corridor" });
    }
  }
  return <>
    {showScopes && <div data-tour={tourTarget} className={styles.locations} role="group" aria-label="Место проблемы">
      {([{ scope: "entrance", icon: "door", label: "Подъезд", text: "Общие зоны в подъезде" },
        { scope: "courtyard", icon: "tree", label: "Двор", text: "Территория возле дома" },
        { scope: "apartment", icon: "home", label: "Квартира", text: "Внутри вашей квартиры" }] as const).map(item =>
        <button type="button" key={item.scope} aria-pressed={scope === item.scope} onClick={() => chooseScope(item.scope)}>
          <Icon name={item.icon} size={28} /><span><strong>{item.label}</strong><small>{item.text}</small></span>
          <Icon name={scope === item.scope ? "check" : "arrow"} size={18} />
        </button>)}
    </div>}
    {details && scope === "entrance" && <div className={styles.placeDetails}>
      <FloorControls house={house} entrance={value.entrance} floor={value.floor} onChange={(entrance, floor) => onChange({ houseId: house.id, entrance, floor, zone: "corridor" })} />
      <p className={styles.placeHint}>Выберите подъезд и этаж, затем отметьте на плане общую зону: холл, лифт, лестницу или другое помещение.</p>
      <FloorPlan house={house} selected={value} onSelect={onChange} allowApartmentSelection={false} />
      <label className={styles.field}>Общая зона
        <select value={value.zone} onChange={event => onChange({ ...value, zone: event.target.value as "corridor" | "stairs" | "elevator" | "technical" | "entrance" })}>
          {(["corridor", "stairs", "elevator", "technical", ...(value.floor === 1 ? ["entrance" as const] : [])] as const).map(zone => <option key={zone} value={zone}>{zoneLabel({ ...value, zone })}</option>)}
        </select>
      </label>
    </div>}
    {details && scope === "apartment" && ownApartments.length > 1 && <label className={styles.field}>Ваша квартира
      <select value={value.zone === "apartment" ? value.apartment : ""} onChange={event => { const place = findApartment(house, Number(event.target.value)); if (place) onChange(place); }}>
        {ownApartments.map(choice => <option key={choice.id} value={choice.apartment}>Квартира {choice.apartment}</option>)}
      </select>
    </label>}
    <p className={styles.locationNote}><Icon name="pin" /><span>{scope === "courtyard" ? "Территория дома" : "Выбранное место"}<strong>{formatLocation(value)}</strong></span></p>
    {details && scope === "courtyard" && <p className={styles.placeHint}>Обращение относится к территории дома. Подъезд, этаж и квартира не нужны. Уточните ориентир в описании — например, «детская площадка со стороны парковки».</p>}
  </>;
}
