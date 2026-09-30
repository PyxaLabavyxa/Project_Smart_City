"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./shell.module.css";
import { Icon } from "@/shared/ui/icon";

const items = [
  { href: "/", label: "Дом", icon: "home" },
  { href: "/issues", label: "Обращения", icon: "bubble" },
  { href: "/utilities", label: "ЖКХ", icon: "droplet" },
  { href: "/cameras", label: "Камеры", icon: "camera" },
  { href: "/more", label: "Ещё", icon: "more" },
] as const;

export function BottomNavigation() {
  const pathname = usePathname();
  const section = ["/health", "/messages", "/info", "/plan"].includes(pathname)
    ? "/more"
    : items.find(item => item.href !== "/" && (pathname === item.href || pathname.startsWith(item.href + "/")))?.href ?? pathname;

  return (
    <nav className={styles.nav} aria-label="Основная навигация">
      {items.map(({ href, label, icon }) => (
        <Link key={href} href={href} aria-current={section === href ? (pathname === href ? "page" : "location") : undefined}>
          <Icon name={icon} /><span>{label}</span>
        </Link>
      ))}
    </nav>
  );
}
