"use client";
import { useHouseSelection } from "../model/selection-provider";
import { commonZones, floorApartments, formatLocation, isOutdoorZone, zoneLabel, type HouseLocation, type CommonZone } from "../model/house";
import { Icon } from "@/shared/ui/icon";
import { FloorControls } from "./floor-controls";
import { FloorPlan } from "./floor-plan";
import styles from "./house-controls.module.css";
export function LocationSelector({ value, onChange, problemPlaces }: { value: HouseLocation; onChange: (place: HouseLocation) => void; problemPlaces?: readonly HouseLocation[] }) {
  const { house } = useHouseSelection();
  return <div data-location-selector>
    <FloorControls dropdown house={house} entrance={value.entrance} floor={value.floor} zone={value.zone} onChange={(entrance, floor) => onChange({ houseId: house.id, entrance, floor, zone: value.zone === "entrance" ? "entrance" : "corridor" })} />
    <label className={styles.locationField}>Помещение
      <select value={value.zone === "apartment" ? "apartment:" + value.apartment : value.zone} onChange={event => {
        const zone = event.target.value;
        onChange(zone.startsWith("apartment:") ? { houseId: house.id, entrance: value.entrance, floor: value.floor, zone: "apartment", apartment: Number(zone.split(":")[1]) }
          : { houseId: house.id, entrance: isOutdoorZone(zone) ? 1 : value.entrance, floor: isOutdoorZone(zone) || zone === "entrance" ? 1 : value.floor, zone: zone as CommonZone });
      }}>
        {(Object.keys(commonZones) as CommonZone[]).map(zone => <option key={zone} value={zone}>{zoneLabel({ ...value, zone })}</option>)}
        {floorApartments(house, value.entrance, value.floor).map(apartment => <option key={apartment} value={"apartment:" + apartment}>Квартира {apartment}</option>)}
      </select>
    </label>
    <FloorPlan house={house} selected={value} onSelect={onChange} problemPlaces={problemPlaces} />
    <p className={styles.selectedLocation}><Icon name="pin" size={24} />{formatLocation(value)}</p>
  </div>;
}
