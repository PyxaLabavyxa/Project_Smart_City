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

export function MessagesPage({ fromPlan = false }: { fromPlan?: boolean }) {
  return <SectionPage title="Связь с квартирой" description="Телефон и личные контакты остаются скрытыми" backHref={fromPlan ? "/plan" : "/more"} backLabel={fromPlan ? "К плану дома" : "Ещё"}>
    <RecipientSelector />
  </SectionPage>;
}

export function HouseInfoPage() {
  return <SectionPage title="Информация о доме" description="ул. Центральная, 18">
    <HouseInformation />
  </SectionPage>;
}
