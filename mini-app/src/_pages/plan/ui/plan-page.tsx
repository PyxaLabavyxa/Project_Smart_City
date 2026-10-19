"use client";
import { HouseExplorer } from "@/features/explore-house";
import { useHouseSelection, parseLocation, locationQuery } from "@/entities/house";
import styles from "./plan-page.module.css";

export function PlanPage({ params = {} }: { params?: Record<string, string | string[] | undefined> }) {
  const { house } = useHouseSelection();
  const initialPlace = parseLocation(house, params);
  return <><header className={styles.heading}><div><h1>План этажа</h1></div>
</header>
    {params.zone && !initialPlace && <p role="status">Место из ссылки отсутствует в текущей структуре. Выберите другое помещение.</p>}
    <HouseExplorer key={`${house.id}:${initialPlace ? locationQuery(initialPlace) : "selected"}`} initialPlace={initialPlace} />
  </>;
}
