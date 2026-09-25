"use client";
import { useState } from "react";
import { demoHouse, floorApartments, commonZones, zoneLabel, formatLocation, sameLocation, FloorControls, type HouseLocation, type CommonZone } from "@/entities/house";
import { IssueList, useIssues } from "@/entities/issue";
import { NavigationLinks } from "@/shared/ui/navigation";
import styles from "./house-explorer.module.css";

export function HouseExplorer() {
  const house = demoHouse;
  const { issues } = useIssues();
  const [selected, setSelected] = useState<HouseLocation>({ houseId: house.id, entrance: 2, floor: 9, zone: "corridor" });
  const apartments = floorApartments(house, selected.entrance, selected.floor);
  const floorIssues = issues.filter(issue => issue.place?.houseId === house.id && issue.place.entrance === selected.entrance && issue.place.floor === selected.floor);
  const selectedIssues = floorIssues.filter(issue => sameLocation(issue.place, selected));
  const locationFor = (zone: CommonZone): HouseLocation => ({ houseId: house.id, entrance: selected.entrance, floor: selected.floor, zone });
  function room(location: HouseLocation) {
    const matching = floorIssues.filter(issue => sameLocation(issue.place, location));
    const activeCount = matching.filter(issue => issue.status !== "completed").length;
    return <button type="button" key={zoneLabel(location)} className={styles.room} aria-pressed={sameLocation(location, selected)} onClick={() => setSelected(location)}>
      <strong>{zoneLabel(location)}</strong>
      <small>{activeCount ? `Активных обращений: ${activeCount}` : matching.length ? "Обращения выполнены" : "Нет активных обращений"}</small>
      {location.zone === "apartment" && location.apartment === house.residentApartment && <small>Ваша квартира</small>}
    </button>;
  }
  return <>
    <FloorControls house={house} entrance={selected.entrance} floor={selected.floor} onChange={(entrance, floor) => setSelected({ houseId: house.id, entrance, floor, zone: "corridor" })} />
    <p>Квартиры {apartments[0]}–{apartments.at(-1)} · обращений на этаже: {floorIssues.length}</p>
    <section aria-label={`Схема этажа ${selected.floor}`} className={styles.map}>
      <div className={styles.apartments}>{apartments.map(apartment => room({ houseId: house.id, entrance: selected.entrance, floor: selected.floor, zone: "apartment", apartment }))}</div>
      <div className={styles.zones}>{(Object.keys(commonZones) as CommonZone[]).filter(zone => zone !== "entrance" || selected.floor === 1).map(zone => room(locationFor(zone)))}</div>
    </section>
    <section className={styles.selected} aria-labelledby="selected-room">
      <p className={styles.caption}>Выбранное помещение</p>
      <h2 id="selected-room" aria-live="polite">{zoneLabel(selected)}</h2>
      <p>{formatLocation(selected)}</p>
      {selectedIssues.length ? <IssueList issues={selectedIssues} /> : <p>Обращений по этому помещению нет.</p>}
    </section>
    <NavigationLinks label="Действия на плане" items={[
      { href: "/issues/new?from=plan", title: "Сообщить о проблеме" },
      { href: "/messages?from=plan", title: "Написать в квартиру" },
      { href: "/issues", title: "Все обращения дома" },
    ]} />
  </>;
}
