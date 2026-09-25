import { NavigationLinks, SectionPage } from "@/shared/ui/navigation";

export function MorePage() {
  return <SectionPage title="Ещё" description="Информация и сервисы вашего дома" backHref="/" backLabel="На главную">
    <NavigationLinks label="Дополнительные разделы" items={[
      { href: "/messages", title: "Сообщения", description: "Связь с соседними квартирами" },
      { href: "/health", title: "Здоровье дома", description: "Состояние систем" },
      { href: "/cameras", title: "Камеры", description: "Общие зоны дома" },
      { href: "/info", title: "Информация о доме", description: "Адрес и план" },
      { href: "/company", title: "Управляющая компания", description: "Обращения по вопросам дома" },
    ]} />
  </SectionPage>;
}
