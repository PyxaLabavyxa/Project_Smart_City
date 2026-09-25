"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./shell.module.css";

const items = [
  { href: "/", label: "Дом" },
  { href: "/issues", label: "Обращения" },
  { href: "/plan", label: "План" },
  { href: "/cameras", label: "Камеры" },
  { href: "/more", label: "Ещё" },
];

export function BottomNavigation() {
  const pathname = usePathname();
  const section = ["/health", "/messages", "/info", "/company"].includes(pathname)
    ? "/more"
    : items.find(item => item.href !== "/" && (pathname === item.href || pathname.startsWith(item.href + "/")))?.href ?? pathname;

  return (
    <nav className={styles.nav} aria-label="Основная навигация">
      {items.map(({ href, label }) => (
        <Link key={href} href={href} aria-current={section === href ? (pathname === href ? "page" : "location") : undefined}>
          {label}
        </Link>
      ))}
    </nav>
  );
}
