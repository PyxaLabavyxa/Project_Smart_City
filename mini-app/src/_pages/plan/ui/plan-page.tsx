import { NavigationLinks, SectionPage } from "@/shared/ui/navigation";

export function PlanPage() {
  return <SectionPage title="План дома" description="ул. Центральная, 18" backHref="/" backLabel="На главную">
    <p>Сообщите о проблеме в доме или перейдите к сообщениям соседям.</p>
    <NavigationLinks label="Действия на плане" items={[
      { href: "/issues/new?from=plan", title: "Сообщить о проблеме" },
      { href: "/messages?from=plan", title: "Написать в квартиру" },
    ]} />
  </SectionPage>;
}
