import { HouseExplorer } from "@/features/explore-house";
import { demoHouse, totalApartments, type HouseLocation } from "@/entities/house";
import styles from "./plan-page.module.css";

export function PlanPage({ initialPlace }: { initialPlace?: HouseLocation }) {
  return <><header className={styles.heading}><div><h1>План дома</h1><p>{demoHouse.address}</p></div>
    <p>{demoHouse.entrances} подъезда · {demoHouse.floors} этажей · {totalApartments(demoHouse)} квартиры</p></header>
    <HouseExplorer initialPlace={initialPlace} />
  </>;
}
