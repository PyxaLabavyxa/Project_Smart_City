"use client";
import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { BottomNavigation } from "./bottom-navigation";
import styles from "./shell.module.css";
import { BrandWordmark } from "@/shared/ui/brand-mark";
import { Icon } from "@/shared/ui/icon";

function parentPage(path: string) {
  if (path.startsWith("/settings/")) return { href:"/settings", label:"Настройки" };
  if (path === "/plan") return { href:"/house", label:"Ваш дом" };
  if (path.startsWith("/issues/")) return { href:"/issues", label:"Обращения" };
  if (path.startsWith("/cameras/")) return { href:"/cameras", label:"Камеры" };
  if (["/invite", "/settings", "/health", "/messages", "/info", "/plan", "/house", "/contacts"].includes(path)) return { href:"/more", label:"Ещё" };
  return { href:"/", label:"На главную" };
}
export function ApplicationShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const neighborChat = pathname === "/messages" || pathname.startsWith("/messages/") || /^\/issues\/[1-9]\d*\/chat\/?$/.test(pathname);
  const parent = parentPage(pathname);
  const inlineBack = pathname === "/contacts" || pathname.startsWith("/cameras/");
  return <div className={`${styles.app}${neighborChat ? ` ${styles.chatApp}` : ""}`}>
    <a className={styles.skip} href="#main">Перейти к содержимому</a>
    {!neighborChat && pathname !== "/issues/new" && <header className={styles.header}>
      <Link href="/" prefetch={false} className={styles.brand} aria-label="Домовед — главная"><BrandWordmark /></Link>
      {inlineBack && <Link href={parent.href} className={styles.headerBack} aria-label={`Назад: ${parent.label}`}><Icon name="back" /></Link>}
    </header>}
    <main id="main" data-page-path={pathname} className={`${styles.main}${neighborChat ? ` ${styles.chatMain}` : ""}`} tabIndex={-1}>
{!neighborChat && !inlineBack && !["/", "/issues", "/utilities", "/cameras", "/more", "/issues/new", "/contacts", "/plan"].includes(pathname) && <Link href={parent.href} className={styles.back} aria-label={`Назад: ${parent.label}`}><Icon name="back" /><span>{parent.label}</span></Link>}
      <div key={pathname} className={`${styles.pageTransition}${neighborChat ? ` ${styles.chatTransition}` : ""}`}>{children}</div>
    </main>
    {!neighborChat && pathname !== "/issues/new" && <BottomNavigation />}
  </div>;
}
