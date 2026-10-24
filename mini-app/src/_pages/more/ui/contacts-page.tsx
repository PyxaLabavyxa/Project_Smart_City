"use client";
import { useHouseSelection } from "@/entities/house";
import { SectionPage } from "@/shared/ui/navigation";
import { ManagementContacts } from "./management-contacts";
import { HouseAddress } from "@/widgets/house-address";
export function ContactsPage() {
 const { house } = useHouseSelection();
 return <SectionPage title="Управляющая компания" headerContent={<HouseAddress compact showMeta={false} />}><ManagementContacts key={house.id} houseId={house.id} /></SectionPage>;
}
