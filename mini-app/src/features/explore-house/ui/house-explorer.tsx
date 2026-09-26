"use client";
import Link from "next/link";
import { useState } from "react";
import { useHouseSelection, demoHouse, floorApartments, findApartment, totalApartments, zoneLabel, formatLocation, sameLocation, FloorControls, FloorPlan, type HouseLocation } from "@/entities/house";
import { IssueList, useIssues } from "@/entities/issue";
import styles from "./house-explorer.module.css";

export function HouseExplorer({ initialPlace }: { initialPlace?: HouseLocation }) {
  const house = demoHouse;
  const { issues, startAt } = useIssues();
  const { selected: remembered, select } = useHouseSelection();
  const [selected, setLocal] = useState(initialPlace ?? remembered);
  const [apartment, setApartment] = useState("");
  const [searchError, setSearchError] = useState("");
  function setSelected(place: HouseLocation) { setLocal(place); select(place); }
  const apartments = floorApartments(house, selected.entrance, selected.floor);
  const floorIssues = issues.filter(issue => issue.place?.houseId === house.id && issue.place.entrance === selected.entrance && issue.place.floor === selected.floor);
  const selectedIssues = floorIssues.filter(issue => sameLocation(issue.place, selected));
  const problemPlaces = floorIssues.filter(issue => issue.status !== "completed").flatMap(issue => issue.place ? [issue.place] : []);
  return <div className={styles.layout}>
    <section className={styles.canvas} aria-label="План этажа">
      <FloorControls expanded house={house} entrance={selected.entrance} floor={selected.floor} onChange={(entrance, floor) => setSelected({ houseId: house.id, entrance, floor, zone: "corridor" })} />
      <div className={styles.searchRow}>
        <form className={styles.search} onSubmit={event => {
          event.preventDefault(); const place = findApartment(house, Number(apartment));
          if (place) { setSelected(place); setSearchError(""); } else setSearchError(`Введите номер от 1 до ${totalApartments(house)}`);
        }}>
          <label htmlFor="find-apartment">Найти квартиру в доме</label>
          <div><input id="find-apartment" inputMode="numeric" value={apartment} onChange={event => { setApartment(event.target.value); setSearchError(""); }} placeholder="№ квартиры" aria-invalid={!!searchError} aria-describedby={searchError ? "apartment-error" : undefined} /><button type="submit" className={styles.searchButton}>Найти</button></div>
          {searchError && <p id="apartment-error" role="alert">{searchError}</p>}
        </form>
        <p className={styles.range}>Квартиры <strong>{apartments[0]}–{apartments.at(-1)}</strong><small>на выбранном этаже</small></p>
      </div>
      <FloorPlan house={house} selected={selected} onSelect={setSelected} problemPlaces={problemPlaces} />
    </section>
    <aside className={styles.sidebar}>
      <header className={styles.floorHeading}><p>Подъезд {String(selected.entrance).padStart(2, "0")}</p><h2>Этаж {selected.floor}</h2><p>{apartments.length} квартиры · обращений: {floorIssues.length}</p></header>
      <section className={styles.selected} aria-labelledby="selected-room">
        <h2 id="selected-room" aria-live="polite">{zoneLabel(selected)}</h2><p>{formatLocation(selected)}</p>
        <span className={styles.state}>{selectedIssues.some(issue => issue.status !== "completed") ? "△ Есть активное обращение" : "✓ В порядке"}</span>
        <p>{selectedIssues.length ? `Обращений по этому помещению: ${selectedIssues.length}. Подробности — ниже.` : "Обращений по этому помещению нет."}</p>
        <div className={styles.actions}>
          <Link className={styles.action} href="/issues/new?from=plan" onClick={() => { select(selected); startAt(selected); }}>＋ Сообщить о проблеме</Link>
          {selected.zone === "apartment" && selected.apartment !== house.residentApartment && <Link className={styles.action} href="/messages?from=plan" onClick={() => select(selected)}>Написать в квартиру {selected.apartment}</Link>}
        </div>
      </section>
      <section className={styles.floorIssues}><h3>На этом этаже <span>{floorIssues.length}</span></h3>{floorIssues.length ? <IssueList issues={floorIssues} /> : <p>Других обращений нет.</p>}</section>
      <div className={styles.neighbors}><h3>Связь с соседями</h3><p>Выберите квартиру, чтобы написать соседу без обмена телефонами.</p></div>
    </aside>
  </div>;
}
