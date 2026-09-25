import { NavigationLinks, SectionPage } from "@/shared/ui/navigation";
import { RecipientSelector } from "@/features/select-recipient";
import { HealthSummary } from "./health-summary";

export function HealthPage() {
  return <SectionPage title="Здоровье дома" description="Состояние систем вашего дома">
    <HealthSummary />
    <NavigationLinks label="Обращения дома" items={[{ href: "/issues", title: "Посмотреть обращения" }]} />
  </SectionPage>;
}

export function MessagesPage({ fromPlan = false }: { fromPlan?: boolean }) {
  return <SectionPage title="Связь с квартирой" description="Сообщения соседям" backHref={fromPlan ? "/plan" : "/more"} backLabel={fromPlan ? "К плану дома" : "Ещё"}>
    <RecipientSelector />
    <NavigationLinks label="Навигация по дому" items={[{ href: "/plan", title: "Перейти к плану дома" }]} />
  </SectionPage>;
}

export function HouseInfoPage() {
  return <SectionPage title="Информация о доме" description="ул. Центральная, 18">
    <p>План дома и информация об управляющей компании.</p>
    <NavigationLinks label="Информация и план" items={[
      { href: "/plan", title: "Открыть план дома" },
      { href: "/company", title: "Управляющая компания" },
    ]} />
  </SectionPage>;
}

export function CompanyPage() {
  return <SectionPage title="Управляющая компания" description="По вопросам вашего дома">
    <p>Создайте обращение по вопросу вашего дома или посмотрите историю обращений.</p>
    <NavigationLinks label="Обращения в УК" items={[
      { href: "/issues/new?from=company", title: "Сообщить о проблеме" },
      { href: "/issues", title: "Посмотреть обращения" },
    ]} />
  </SectionPage>;
}
