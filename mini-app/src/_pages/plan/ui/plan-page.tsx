import { SectionPage } from "@/shared/ui/navigation";
import { HouseExplorer } from "@/features/explore-house";
import { demoHouse, totalApartments, type HouseLocation } from "@/entities/house";

export function PlanPage({ initialPlace }: { initialPlace?: HouseLocation }) {
  return <SectionPage title="План дома" description={demoHouse.address} backHref="/" backLabel="На главную">
    <p>{demoHouse.entrances} подъезда · {demoHouse.floors} этажей · {totalApartments(demoHouse)} квартиры</p>
    <HouseExplorer initialPlace={initialPlace} />
  </SectionPage>;
}
