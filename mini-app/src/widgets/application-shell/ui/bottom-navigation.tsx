"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./shell.module.css";

const items = [
  { href: "/", label: "Дом" },
  { href: "/issues", label: "Обращения" },
  { href: "/plan", label: "План" },
  { href: "/more", label: "Ещё" },
];

export function BottomNavigation() {
  const pathname = usePathname();

  return (
    <nav className={styles.nav} aria-label="Основная навигация">
      {items.map(({ href, label }) => (
        <Link key={href} href={href} aria-current={pathname === href || (href === "/issues" && pathname.startsWith("/issues/")) ? "page" : undefined}>
          {label}
        </Link>
      ))}
    </nav>
  );
}
