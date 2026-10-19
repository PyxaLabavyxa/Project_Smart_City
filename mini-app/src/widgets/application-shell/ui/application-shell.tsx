"use client";
import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { BottomNavigation } from "./bottom-navigation";
import styles from "./shell.module.css";
import { BrandWordmark } from "@/shared/ui/brand-mark";
import { Icon } from "@/shared/ui/icon";

function parentPage(path: string) {
  if (path === "/plan") return { href:"/house", label:"Ваш дом" };
  if (path.startsWith("/issues/")) return { href:"/issues", label:"Обращения" };
  if (path.startsWith("/cameras/")) return { href:"/cameras", label:"Камеры" };
  if (["/settings", "/health", "/messages", "/info", "/plan", "/house", "/contacts"].includes(path)) return { href:"/more", label:"Ещё" };
  return { href:"/", label:"На главную" };
}
export function ApplicationShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const parent = parentPage(pathname);
  const inlineBack = pathname === "/contacts" || pathname.startsWith("/cameras/");
  return <div className={styles.app}>
    <a className={styles.skip} href="#main">Перейти к содержимому</a>
    {pathname !== "/issues/new" && <header className={styles.header}>
      <Link href="/" prefetch={false} className={styles.brand} aria-label="Домовед — главная"><BrandWordmark /></Link>
      {inlineBack && <Link href={parent.href} className={styles.headerBack} aria-label={`Назад: ${parent.label}`}><Icon name="back" /></Link>}
    </header>}
    <main id="main" data-page-path={pathname} className={styles.main} tabIndex={-1}>
{!inlineBack && !["/", "/issues", "/utilities", "/cameras", "/more", "/issues/new", "/contacts"].includes(pathname) && <Link href={parent.href} className={styles.back} aria-label={`Назад: ${parent.label}`}><Icon name="back" /><span>{parent.label}</span></Link>}
      <div key={pathname} className={styles.pageTransition}>{children}</div>
    </main>
    {pathname !== "/issues/new" && <BottomNavigation />}
  </div>;
}
