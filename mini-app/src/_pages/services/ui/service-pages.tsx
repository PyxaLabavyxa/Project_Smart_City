import { NavigationLinks, SectionPage } from "@/shared/ui/navigation";
import { RecipientSelector } from "@/features/select-recipient";
import { HealthSummary } from "./health-summary";
import { HouseInformation } from "./house-information";

export function HealthPage() {
  return <SectionPage title="Здоровье дома" description="Состояние систем вашего дома">
    <HealthSummary />
    <NavigationLinks label="Обращения дома" items={[{ href: "/issues", title: "Посмотреть обращения" }]} />
  </SectionPage>;
}

export function MessagesPage({ from }: { from?: "plan" | "home" }) {
  return <SectionPage title="Сообщения" description="Переписки с соседями вашего дома"><RecipientSelector openSelected={!!from} /></SectionPage>;
}

export function HouseInfoPage() {
  return <SectionPage title="Информация о доме">
    <HouseInformation />
  </SectionPage>;
}
