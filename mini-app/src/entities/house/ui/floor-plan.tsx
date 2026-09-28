"use client";
import { useState, type CSSProperties } from "react";
import { Icon } from "@/shared/ui/icon";
import { floorApartments, sameLocation, zoneLabel, type House, type HouseLocation, type CommonZone } from "../model/house";
import styles from "./floor-plan.module.css";

export function FloorPlan({ house, selected, onSelect, problemPlaces = [], resolvedPlaces = [] }: {
  house: House; selected: HouseLocation; onSelect: (place: HouseLocation) => void;
  problemPlaces?: readonly HouseLocation[];
  resolvedPlaces?: readonly HouseLocation[];
}) {
  const allApartments = floorApartments(house, selected.entrance, selected.floor);
  const [segment, setSegment] = useState({ key: "", page: 0 });
  const key = `${selected.entrance}:${selected.floor}:${allApartments.join(",")}`;
  const pages = Math.ceil(allApartments.length / 6);
  const selectedPage = selected.zone === "apartment" ? Math.floor(allApartments.indexOf(selected.apartment) / 6) : null;
  const page = Math.max(0, Math.min(pages - 1, selectedPage ?? (segment.key === key ? segment.page : 0)));
  const apartments = allApartments.slice(page * 6, (page + 1) * 6);
  function changePage(next: number) { setSegment({ key, page: next }); onSelect({ houseId: house.id, entrance: selected.entrance, floor: selected.floor, zone: "corridor" }); }
  const base = { houseId: house.id, entrance: selected.entrance, floor: selected.floor };
  function room(place: HouseLocation, className: string, position?: CSSProperties) {
    const problem = problemPlaces.some(location => sameLocation(location, place));
    const resolved = !problem && resolvedPlaces.some(location => sameLocation(location, place));
    const condition = problem ? "Есть обращение" : resolved ? "Недавно решено" : "Нет обращений";
    const own = place.zone === "apartment" && place.apartment === house.residentApartment;
    return <button key={zoneLabel(place)} type="button" style={position} className={`${styles.room} ${className}`} data-problem={problem || undefined} data-resolved={resolved || undefined}
      aria-label={`${zoneLabel(place)} · ${own ? "Ваша квартира · " : ""}${condition}`} aria-pressed={sameLocation(place, selected)} onClick={() => onSelect(place)}>
      {place.zone === "apartment" ? <><span className={styles.apartmentHeading}>Квартира {sameLocation(place, selected) && <Icon name="check" size={14} />}</span><strong className={styles.number} data-long={place.apartment >= 1000 || undefined}>{place.apartment}</strong></> : place.zone === "corridor" ? <><strong>{pages > 1 ? "Коридор" : "Холл"}</strong>{pages === 1 && <span>Общий коридор</span>}</> : <><Icon name={place.zone === "elevator" ? "lift" : place.zone === "stairs" ? "stairs" : place.zone === "technical" ? "settings" : "door"} /><strong>{place.zone === "technical" ? "Тех. помещение" : zoneLabel(place)}</strong></>}
      {(place.zone === "apartment" || place.zone === "corridor") && <small><Icon name={problem ? "warning" : "check"} size={12} />{own && !problem ? "Ваша квартира" : condition}</small>}
    </button>;
  }
  const zone = (value: CommonZone, className: string) => room({ ...base, zone: value }, className);
  return <div className={styles.container}>
    {pages > 1 && <><div className={styles.pagination}><button type="button" disabled={page === 0} aria-label="Предыдущий участок" onClick={() => changePage(page - 1)}>←</button><label>Участок коридора<select value={page} onChange={event => changePage(Number(event.target.value))}>{Array.from({ length: pages }, (_, index) => <option key={index} value={index}>{index + 1} из {pages}</option>)}</select></label><button type="button" disabled={page === pages - 1} aria-label="Следующий участок" onClick={() => changePage(page + 1)}>→</button></div><p className={styles.segmentRange} aria-live="polite">На схеме: квартиры {apartments[0]}–{apartments.at(-1)}</p></>}
    <div className={styles.caption}><span>Схема этажа {selected.floor}</span><span>Квартир: {allApartments.length}{pages > 1 ? ` · участок ${page + 1}/${pages}` : ""}</span></div>
    <div className={styles.map} aria-label={`Помещения этажа ${selected.floor}`}>
      {pages > 1 && <div className={styles.services}>{zone("elevator", styles.service)}{zone("stairs", styles.service)}{zone("technical", styles.service)}</div>}
      <div className={styles.floor} data-large={pages > 1 || undefined} style={{ "--rows": Math.max(1, Math.ceil(apartments.length / 2)) } as CSSProperties}>
        <div className={styles.core}>{pages === 1 && <div className={styles.transport}>{zone("elevator", styles.service)}{zone("stairs", styles.service)}</div>}{zone("corridor", styles.corridor)}{pages === 1 && zone("technical", `${styles.service} ${styles.technical}`)}</div>
        {apartments.map((apartment, index) => room({ ...base, zone: "apartment", apartment }, "", { gridColumn: index % 2 ? 3 : 1, gridRow: Math.floor(index / 2) + 1 }))}
        {apartments.length % 2 === 1 && <div className={styles.end} style={{ gridColumn: 3, gridRow: Math.ceil(apartments.length / 2) }}>Граница этажа</div>}
      </div>
      {selected.floor === 1 && zone("entrance", styles.entrance)}
    </div>
    <p className={styles.hint}>Выберите помещение на схеме</p>
    <div className={styles.legend}><span>✓ В порядке</span><span>△ Есть обращение</span><span>● Выбранное место</span></div>
  </div>;
}
