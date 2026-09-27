import { SectionPage } from "@/shared/ui/navigation";
import Link from "next/link";
import { Icon } from "@/shared/ui/icon";
import { demoHouse } from "@/entities/house";
import styles from "./more-page.module.css";

const items = [
  { href: "/messages", icon: "messages", title: "Сообщения", description: "Связь с соседними квартирами" },
  { href: "/health", icon: "health", title: "Здоровье дома", description: "Состояние систем и причины изменений" },
  { href: "/cameras", icon: "cameras", title: "Камеры", description: "Общие зоны вашего дома" },
  { href: "/info", icon: "home", title: "Информация о доме", description: "Характеристики и общие зоны" },
  { href: "/settings", icon: "plan", title: "Структура дома", description: "Подъезды, этажи и квартиры" },
] as const;

export function MorePage() {
  return <SectionPage title="Ещё" description={`Мой дом · квартира ${demoHouse.residentApartment}`} backHref="/" backLabel="На главную">
    <div className={styles.content}><nav aria-label="Дополнительные разделы"><ul className={styles.menu}>{items.map(item => <li key={item.href}>
      <Link href={item.href}><span className={styles.icon}><Icon name={item.icon} /></span><span><strong>{item.title}</strong><small>{item.description}</small></span><Icon name="arrow" size={16} /></Link>
    </li>)}</ul></nav>
    <section className={styles.help}><h2>Вопрос по дому?</h2><p>Создайте обращение, чтобы описать проблему и следить за её решением.</p><Link href="/issues/new">Сообщить о проблеме <Icon name="arrow" size={16} /></Link></section></div>
  </SectionPage>;
}
