"use client";
import { demoHouse } from "../model/demo-house";
import { commonZones, floorApartments, type HouseLocation, type CommonZone } from "../model/house";
import { FloorControls } from "./floor-controls";
import { FloorPlan } from "./floor-plan";
import styles from "./house-controls.module.css";
export function LocationSelector({ value, onChange, problemPlaces }: { value: HouseLocation; onChange: (place: HouseLocation) => void; problemPlaces?: readonly HouseLocation[] }) {
  const house = demoHouse;
  return <div>
    <FloorControls house={house} entrance={value.entrance} floor={value.floor} onChange={(entrance, floor) => onChange({ houseId: house.id, entrance, floor, zone: "corridor" })} />
    <label className={styles.locationField}>Помещение
      <select value={value.zone === "apartment" ? "apartment:" + value.apartment : value.zone} onChange={event => {
        const zone = event.target.value;
        onChange(zone.startsWith("apartment:") ? { houseId: house.id, entrance: value.entrance, floor: value.floor, zone: "apartment", apartment: Number(zone.split(":")[1]) }
          : { houseId: house.id, entrance: value.entrance, floor: value.floor, zone: zone as CommonZone });
      }}>
        {(Object.keys(commonZones) as CommonZone[]).filter(zone => zone !== "entrance" || value.floor === 1).map(zone => <option key={zone} value={zone}>{commonZones[zone]}</option>)}
        {floorApartments(house, value.entrance, value.floor).map(apartment => <option key={apartment} value={"apartment:" + apartment}>Квартира {apartment}</option>)}
      </select>
    </label>
    <FloorPlan house={house} selected={value} onSelect={onChange} problemPlaces={problemPlaces} />
  </div>;
}
