"use client";
import { useHouseSelection } from "@/entities/house";
import { SectionPage } from "@/shared/ui/navigation";
import { ManagementContacts } from "./management-contacts";
export function ContactsPage() {
 const { house } = useHouseSelection();
 return <SectionPage title="Управляющая компания" description={house.address.replace(/^г\.\s*Казань,?\s*ул\.\s*/, "")}><ManagementContacts key={house.id} houseId={house.id} /></SectionPage>;
}
