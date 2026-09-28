"use client";
import { useHouseSelection, totalApartments, floorCount, HouseElevation, FloorControls, PlaceLink } from "@/entities/house";
import { Icon } from "@/shared/ui/icon";
import { useIssues } from "@/entities/issue";
import styles from "./home-page.module.css";

export function HousePreview() {
  const { house, selected, select } = useHouseSelection();
  const { issues } = useIssues();
  return <section className={styles.house} aria-labelledby="your-house">
    <div className={styles.sectionHead}><h2 id="your-house">Ваш дом</h2><Icon name="home" /></div>
    <p className={styles.muted}>{house.floors} этажей · {totalApartments(house)} квартир</p>
    <HouseElevation house={house} selected={selected} onSelect={select} problemPlaces={issues.filter(issue => issue.status !== "completed").flatMap(issue => issue.place ? [issue.place] : [])} />
    <FloorControls house={house} entrance={selected.entrance} floor={selected.floor} onChange={(entrance, floor) => select({ houseId: house.id, entrance, floor, zone: "corridor" })} />
    <p className={styles.houseMeta}><span>Этаж {selected.floor} · квартир: {floorCount(house, selected.entrance, selected.floor)}</span></p>
    <PlaceLink place={selected} className={styles.planButton}><Icon name="plan" /> Открыть план этажа</PlaceLink>
  </section>;
}
