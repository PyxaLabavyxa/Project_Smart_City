"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./shell.module.css";
import { Icon } from "@/shared/ui/icon";

const items = [
  { href: "/", label: "Дом", icon: "home" },
  { href: "/utilities", label: "ЖКХ", icon: "receipt" },
  { href: "/issues", label: "Обращения", icon: "messages" },
  { href: "/cameras", label: "Камеры", icon: "camera" },
  { href: "/more", label: "Ещё", icon: "more" },
] as const;

export function BottomNavigation() {
  const pathname = usePathname();
  const section = pathname === "/settings" || pathname.startsWith("/settings/") || ["/invite", "/health", "/messages", "/info", "/plan", "/house", "/contacts"].includes(pathname)
    ? "/more"
    : items.find(item => item.href !== "/" && (pathname === item.href || pathname.startsWith(item.href + "/")))?.href ?? pathname;

  return (
    <nav className={styles.nav} aria-label="Основная навигация">
      {items.map(({ href, label, icon }) => (
        <Link key={href} href={href} aria-current={section === href ? (pathname === href ? "page" : "location") : undefined}>
          <Icon name={icon} active={section === href} /><span>{label}</span>
        </Link>
      ))}
    </nav>
  );
}
