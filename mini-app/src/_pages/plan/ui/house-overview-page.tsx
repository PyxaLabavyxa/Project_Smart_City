"use client";
import { SectionPage } from "@/shared/ui/navigation";
import { useHouseSelection, totalApartments } from "@/entities/house";
import { HousePreview } from "@/_pages/home/ui/house-preview";
import { HouseWorks } from "@/_pages/home/ui/house-works";
import styles from "@/_pages/home/ui/home-page.module.css";
import { HouseAddress } from "@/widgets/house-address";
export function HouseOverviewPage() {
 const { house } = useHouseSelection();
 return <SectionPage title="Ваш дом" description={`${house.floors} этажей · ${totalApartments(house)} квартир`} headerContent={<HouseAddress compact showMeta={false} />}><div className={styles.houseLayout}><HousePreview /><HouseWorks /></div></SectionPage>;
}
