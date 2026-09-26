"use client";
import { demoHouse, useHouseSelection, totalApartments, FloorControls, PlaceLink } from "@/entities/house";
import { useIssues } from "@/entities/issue";
import { Icon } from "@/shared/ui/icon";
import styles from "./home-page.module.css";

export function HousePreview() {
  const house = demoHouse;
  const { selected, select } = useHouseSelection();
  const { issues } = useIssues();
  return <section className={styles.house} aria-labelledby="your-house">
    <div className={styles.sectionHead}><h2 id="your-house">Ваш дом</h2><Icon name="home" /></div>
    <p className={styles.muted}>Выберите подъезд и этаж</p>
    <div className={styles.structure}>{Array.from({ length: house.entrances }, (_, index) => <div key={index} className={styles.entrance}><span>Подъезд {index + 1}</span><div>{Array.from({ length: house.floors }, (_, offset) => {
      const floor = house.floors - offset;
      const count = issues.filter(issue => issue.status !== "completed" && issue.place?.entrance === index + 1 && issue.place.floor === floor).length;
      return <button type="button" key={floor} aria-label={`Подъезд ${index + 1}, этаж ${floor}${count ? `, обращений: ${count}` : ""}`} aria-pressed={selected.entrance === index + 1 && selected.floor === floor} onClick={() => select({ houseId: house.id, entrance: index + 1, floor, zone: "corridor" })}><span>{floor}</span><span>{count ? `${count} обр.` : "—"}</span></button>;
    })}</div></div>)}</div>
    <FloorControls house={house} entrance={selected.entrance} floor={selected.floor} onChange={(entrance, floor) => select({ houseId: house.id, entrance, floor, zone: "corridor" })} />
    <p className={styles.houseMeta}><span>{totalApartments(house)} квартиры</span><span>Этаж {selected.floor} выбран</span></p>
    <PlaceLink place={selected} className={styles.planButton}><Icon name="plan" /> Открыть план этажа</PlaceLink>
  </section>;
}
