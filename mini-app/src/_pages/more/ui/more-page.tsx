"use client";
import { SectionPage } from "@/shared/ui/navigation";
import Link from "next/link";
import Image from "next/image";
import { Icon } from "@/shared/ui/icon";
import { useHouseSelection } from "@/entities/house";
import { useOnboarding } from "@/features/onboarding/onboarding";
import styles from "./more-page.module.css";
import { ManagementContacts } from "./management-contacts";

const items = [
  { href: "/plan", icon: "plan", title: "План дома", description: "Этажи, квартиры и общие зоны" },
  { href: "/utilities", icon: "receipt", title: "ЖКХ", description: "Квитанции и показания" },
  { href: "/messages", icon: "messages", title: "Сообщения", description: "Связь с соседними квартирами" },
  { href: "/health", icon: "health", title: "Здоровье дома", description: "Состояние систем" },
  { href: "/cameras", icon: "cameras", title: "Камеры", description: "Общие зоны вашего дома" },
  { href: "/info", icon: "home", title: "Информация о доме", description: "Характеристики и общие зоны" },
] as const;

export function MorePage() {
  const { start } = useOnboarding();
  const { house } = useHouseSelection();
  return <SectionPage title="Ещё" description={`${house.address} · Квартира ${house.residentApartment}`} backHref={null}>
    <div className={styles.content}><nav data-reveal="1" aria-label="Дополнительные разделы"><ul className={styles.menu}>{items.map(item => <li key={item.href}>
      <Link href={item.href}><span className={styles.icon}><Icon name={item.icon} /></span><span><strong>{item.title}</strong><small>{item.description}</small></span><Icon name="arrow" size={16} /></Link>
    </li>)}<li><button data-tour="replay-tour" type="button" className={styles.tutorial} onClick={start}><span className={styles.icon}><Icon name="play" /></span><span><strong>Как это работает</strong><small>Пройти обучение ещё раз</small></span><Icon name="arrow" size={16} /></button></li></ul></nav>

    <section data-reveal="2" className={styles.help}><h2>Вопрос по дому?</h2><p>Создайте обращение или свяжитесь с управляющей компанией.</p><Link href="/issues/new">Создать обращение <Icon name="arrow" size={16} /></Link></section>
    <details className={styles.contactsDisclosure}><summary>Контакты управляющей компании</summary><ManagementContacts key={house.id} houseId={house.id} /></details>
    <div className={styles.garden} aria-hidden="true"><Image src="/images/domoved/garden-hq.webp" alt="" width={1500} height={500} sizes="(max-width:760px) 100vw, 760px" unoptimized loading="eager" /></div></div>
  </SectionPage>;
}
