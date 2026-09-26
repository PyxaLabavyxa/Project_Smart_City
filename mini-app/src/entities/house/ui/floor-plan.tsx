"use client";
import { floorApartments, sameLocation, zoneLabel, type House, type HouseLocation, type CommonZone } from "../model/house";
import styles from "./floor-plan.module.css";

export function FloorPlan({ house, selected, onSelect, problemPlaces = [] }: {
  house: House; selected: HouseLocation; onSelect: (place: HouseLocation) => void;
  problemPlaces?: readonly HouseLocation[];
}) {
  const apartments = floorApartments(house, selected.entrance, selected.floor);
  const base = { houseId: house.id, entrance: selected.entrance, floor: selected.floor };
  function room(place: HouseLocation, className: string) {
    const problem = problemPlaces.some(location => sameLocation(location, place));
    const own = place.zone === "apartment" && place.apartment === house.residentApartment;
    return <button key={zoneLabel(place)} type="button" className={`${styles.room} ${className}`} data-problem={problem || undefined}
      aria-label={`${zoneLabel(place)} · ${own ? "Ваша квартира" : problem ? "Есть обращение" : "В порядке"}`} aria-pressed={sameLocation(place, selected)} onClick={() => onSelect(place)}>
      {place.zone === "apartment" ? <><span>Квартира</span><strong className={styles.number}>{place.apartment}</strong></> : <strong>{zoneLabel(place)}</strong>}
      <small>{own ? "Ваша квартира" : problem ? "Есть обращение" : "В порядке"}</small>
    </button>;
  }
  const zone = (value: CommonZone, className: string) => room({ ...base, zone: value }, className);
  return <div className={styles.container}>
    <div className={styles.caption}><span>Схема этажа {selected.floor}</span><span>{apartments.length} квартиры</span></div>
    <div className={styles.map} aria-label={`Помещения этажа ${selected.floor}`}>
      <div className={styles.services}>{zone("elevator", styles.service)}{zone("stairs", styles.service)}{zone("technical", styles.service)}</div>
      <div className={styles.floor}>
        <div className={styles.wing}>{apartments.filter((_, index) => index % 2 === 0).map(apartment => room({ ...base, zone: "apartment", apartment }, styles.apartment))}</div>
        {zone("corridor", styles.corridor)}
        <div className={styles.wing}>{apartments.filter((_, index) => index % 2 === 1).map(apartment => room({ ...base, zone: "apartment", apartment }, styles.apartment))}</div>
      </div>
      {selected.floor === 1 && zone("entrance", styles.entrance)}
    </div>
    <p className={styles.hint}>Выберите помещение на схеме</p>
    <div className={styles.legend}><span>✓ В порядке</span><span>△ Есть обращение</span><span>● Выбранное место</span></div>
  </div>;
}
