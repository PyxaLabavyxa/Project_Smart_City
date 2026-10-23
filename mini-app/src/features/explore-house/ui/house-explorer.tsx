"use client";
import Link from "next/link";
import { conversationHref } from "@/shared/api/conversation-route";
import { useEffect, useRef, useState } from "react";
import { useHouseSelection, isOutdoorZone, floorApartments, findApartment, totalApartments, zoneLabel, formatLocation, sameLocation, FloorControls, FloorPlan, type HouseLocation } from "@/entities/house";
import { IssueList, useIssues } from "@/entities/issue";
import styles from "./house-explorer.module.css";

export function HouseExplorer({ initialPlace }: { initialPlace?: HouseLocation }) {
  const { issues, startAt } = useIssues();
  const { house, choices, selected: remembered, select } = useHouseSelection();
  const [selected, setLocal] = useState(initialPlace ?? remembered);
  const sheet = useRef<HTMLDialogElement>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [apartment, setApartment] = useState("");
  const [searchError, setSearchError] = useState("");
  function setSelected(place: HouseLocation) { setLocal(place); select(place); }
  function chooseRoom(place: HouseLocation) {
    setSelected(place);
    if (window.matchMedia("(min-width:1100px)").matches) return;
    setSheetOpen(true); sheet.current?.showModal();
  }
  useEffect(() => {
    const desktop = window.matchMedia("(min-width:1100px)");
    const closeOnDesktop = () => { if (desktop.matches && sheet.current?.open) sheet.current.close(); };
    desktop.addEventListener("change", closeOnDesktop);
    return () => desktop.removeEventListener("change", closeOnDesktop);
  }, []);
  function closeSheet() { sheet.current?.close(); }
  const outdoor = isOutdoorZone(selected.zone);
  const ownApartment = selected.zone === "apartment" && choices.some(choice => choice.houseId === selected.houseId && choice.apartment === selected.apartment);
  const apartments = floorApartments(house, selected.entrance, selected.floor);
  const floorIssues = issues.filter(issue => issue.place?.houseId === house.id && (outdoor ? issue.place.zone === selected.zone : !isOutdoorZone(issue.place.zone) && issue.place.entrance === selected.entrance && issue.place.floor === selected.floor));
  const selectedIssues = floorIssues.filter(issue => sameLocation(issue.place, selected));
  const problemPlaces = floorIssues.filter(issue => issue.status !== "completed").flatMap(issue => issue.place ? [issue.place] : []);
  const resolvedPlaces = floorIssues.filter(issue => issue.status === "completed").flatMap(issue => issue.place ? [issue.place] : []);
  const selectedContent = (<section className={styles.selected} aria-labelledby="selected-room">
        <h2 id="selected-room" aria-live="polite">{zoneLabel(selected)}</h2><p>{formatLocation(selected)}</p>
        <span className={styles.state} data-attention={selectedIssues.some(issue => issue.status !== "completed") || undefined} data-planned={selected.zone === "technical" && !selectedIssues.length || undefined}>{selectedIssues.some(issue => issue.status !== "completed") ? "△ Есть активное обращение" : selectedIssues.length ? "✓ Недавно решено" : selected.zone === "technical" ? "◷ Плановые работы" : "✓ В порядке"}</span>
        <p>{selectedIssues.length ? `Обращений по этому помещению: ${selectedIssues.length}. Подробности — ниже.` : "Обращений по этому помещению нет."}</p>
        <div data-tour="plan-actions" className={styles.actions}>
          {(selected.zone !== "apartment" || ownApartment) && <Link className={styles.action} href="/issues/new?from=plan" onClick={() => { closeSheet(); select(selected); startAt(selected); }}>＋ Сообщить о проблеме</Link>}
          {selected.zone === "apartment" && !ownApartment && <Link className={styles.action} href={conversationHref(selected.apartment, house.residentApartmentId)} onClick={() => { closeSheet(); select(selected); }}>Написать в квартиру {selected.apartment}</Link>}
          {selected.zone !== "apartment" && <Link className={styles.action} onClick={closeSheet} href="/cameras">Камеры дома</Link>}
        </div>
        {sheetOpen && selectedIssues.length > 0 && <div onClick={event => { if ((event.target as Element).closest("a")) closeSheet(); }}><IssueList issues={selectedIssues} /></div>}
      </section>);
  return <div className={styles.layout}>
    <section className={styles.canvas} aria-label="План этажа">
      {!outdoor && <div data-tour="plan-selection"><div data-tour="plan-floors"><FloorControls house={house} entrance={selected.entrance} floor={selected.floor} onChange={(entrance, floor) => setSelected({ houseId: house.id, entrance, floor, zone: "corridor" })} /></div>
      <div className={styles.searchRow}>
        <form data-tour="plan-search" className={styles.search} onSubmit={event => {
          event.preventDefault(); const place = findApartment(house, Number(apartment));
          if (place) { chooseRoom(place); setSearchError(""); } else setSearchError(`Введите номер от 1 до ${totalApartments(house)}`);
        }}>
          <label htmlFor="find-apartment">Найти квартиру в доме</label>
          <div><input id="find-apartment" inputMode="numeric" value={apartment} onChange={event => { setApartment(event.target.value); setSearchError(""); }} placeholder="№ квартиры" aria-invalid={!!searchError} aria-describedby={searchError ? "apartment-error" : undefined} /><button type="submit" className={styles.searchButton}>Найти</button></div>
          {searchError && <p id="apartment-error" role="alert">{searchError}</p>}
        </form>
        <p className={styles.range}>Квартиры <strong>{apartments[0]}–{apartments.at(-1)}</strong><small>на выбранном этаже</small></p>
      </div>
      </div>}
      {outdoor && <button type="button" className={styles.action} onClick={() => setSelected({ houseId: house.id, entrance: 1, floor: 1, zone: "corridor" })}>Перейти к этажам дома</button>}
      <FloorPlan tourTarget="plan-map" house={house} selected={selected} onSelect={chooseRoom} problemPlaces={problemPlaces} resolvedPlaces={resolvedPlaces} />
      <div className={styles.otherZones}><nav data-tour="plan-zones" className={styles.zoneButtons} aria-label="Другие зоны дома">{([{ zone:"courtyard", label:"Двор" },{ zone:"parking", label:"Парковка" }] as const).map(item => <button key={item.zone} type="button" aria-pressed={selected.zone === item.zone} onClick={() => chooseRoom({ houseId:house.id,entrance:1,floor:1,zone:item.zone })}>{item.label}</button>)}</nav></div>
    </section>
    <aside className={styles.sidebar}>
      {outdoor ? <header className={styles.floorHeading}><p>Общая территория</p><h2>{zoneLabel(selected)}</h2><p>{house.address}</p></header> : <header className={styles.floorHeading}><p>Подъезд {String(selected.entrance).padStart(2, "0")}</p><h2>Этаж {selected.floor}</h2><p>Квартир: {apartments.length} · обращений: {floorIssues.length}</p></header>}
      {!sheetOpen && selectedContent}
      <section className={styles.floorIssues}><h3>{outdoor ? "В этом месте" : "На этом этаже"} <span>{floorIssues.length}</span></h3>{floorIssues.length ? <IssueList issues={floorIssues} compact /> : <p>Других обращений нет.</p>}</section>
      <div className={styles.neighbors}><h3>Связь с соседями</h3><p>Выберите квартиру, чтобы написать соседу без обмена телефонами.</p></div>
    </aside><dialog ref={sheet} className={`${styles.sidebar} ${styles.sheet}`} aria-label={zoneLabel(selected)} onClose={() => setSheetOpen(false)} onClick={event => { if (event.target !== event.currentTarget) return; const r = event.currentTarget.getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) sheet.current?.close(); }}><button type="button" className={styles.sheetClose} aria-label="Закрыть карточку помещения" onClick={() => sheet.current?.close()}>×</button>{sheetOpen && selectedContent}</dialog>
  </div>;
}
