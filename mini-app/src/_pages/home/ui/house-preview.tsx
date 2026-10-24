"use client";
import { useHouseSelection, floorPlanLocation, floorCount, totalApartments, HouseElevation, FloorControls, PlaceLink } from "@/entities/house";
import { Icon } from "@/shared/ui/icon";
import { useIssues } from "@/entities/issue";
import styles from "./home-page.module.css";
import { RequestState } from "@/shared/ui/navigation/request-state";

export function HousePreview({ showHeading = false }: { showHeading?: boolean }) {
  const { house, selected: remembered, select, apartmentsState } = useHouseSelection();
  const selected = floorPlanLocation(house, remembered);
  const { issues } = useIssues();
  if (apartmentsState.loading || apartmentsState.error) return <RequestState {...apartmentsState} />;
  return <section className={styles.house} aria-label={showHeading ? "Ваш дом" : "Схема дома"}>
    {showHeading && <header className={styles.houseHeading}><h2>Ваш дом</h2><p>{house.floors} этажей · {totalApartments(house)} квартир</p></header>}
    <HouseElevation house={house} selected={selected} onSelect={select} problemPlaces={issues.filter(issue => issue.status !== "completed").flatMap(issue => issue.place ? [issue.place] : [])} />
    <FloorControls dropdown house={house} entrance={selected.entrance} floor={selected.floor} zone={selected.zone} onChange={(entrance, floor) => select({ houseId: house.id, entrance, floor, zone: "corridor" })} />
    <p className={styles.houseMeta}><span>{`Этаж ${selected.floor} · квартир: ${floorCount(house, selected.entrance, selected.floor)}`}</span></p>
    <PlaceLink place={selected} className={styles.planButton}><Icon name="plan" /> Открыть план этажа</PlaceLink>
  </section>;
}
