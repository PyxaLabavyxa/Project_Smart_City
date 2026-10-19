"use client";
import { SectionPage } from "@/shared/ui/navigation";
import Link from "next/link";
import { BrandWordmark } from "@/shared/ui/brand-mark";
import { Zhorik } from "@/shared/ui/zhorik";
import { Icon } from "@/shared/ui/icon";
import { useHouseSelection } from "@/entities/house";
import { useOnboarding } from "@/features/onboarding/onboarding";
import styles from "./more-page.module.css";
const items = [
 { href:"/settings", icon:"settings", title:"Настройки", description:"Тема и уведомления" },
 { href:"/house", icon:"building", title:"План дома", description:"Этажи, квартиры и общие зоны" },
 { href:"/utilities", icon:"receipt", title:"ЖКХ", description:"Квитанции и показания" },
 { href:"/messages", icon:"messages", title:"Сообщения", description:"Переписки с соседями" },
 { href:"/health", icon:"health", title:"Здоровье дома", description:"Состояние и история" },
 { href:"/cameras", icon:"camera", title:"Камеры", description:"Общие зоны" },
 { href:"/info", icon:"issues", title:"Информация о доме", description:"Характеристики и документы" },
] as const;
export function MorePage() {
 const { start }=useOnboarding(); const { house }=useHouseSelection();
 return <SectionPage title="Ещё" description={`${house.address.replace(/^г\.\s*Казань,?\s*ул\.\s*/, "")} · Квартира ${house.residentApartment}`} backHref={null}>
  <div className={styles.content}><nav aria-label="Дополнительные разделы"><ul className={styles.menu}>{items.map(item => <li key={item.href}><Link href={item.href}><span className={styles.icon}><Icon name={item.icon} /></span><span><strong>{item.title}</strong><small>{item.description}</small></span><Icon name="arrow" size={17} /></Link></li>)}<li><button data-tour="replay-tour" type="button" className={styles.tutorial} onClick={start}><span className={styles.icon}><Icon name="play" /></span><span><strong>Как это работает</strong><small>Пройти обучение ещё раз</small></span><Icon name="arrow" size={17} /></button></li></ul></nav>
  <Link href="/contacts" className={styles.contactLink}><span className={styles.icon}><Icon name="phone" /></span><span>Контакты управляющей компании</span><Icon name="arrow" size={17} /></Link>
  <div className={styles.footer}><Zhorik pose="wave" className={styles.mascot} /><div><BrandWordmark /><p>Ваш дом — рядом.</p></div></div></div>
 </SectionPage>;
}
