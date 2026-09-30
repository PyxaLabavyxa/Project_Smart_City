"use client";
import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { ThemeToggle } from "@/features/toggle-theme";
import { BottomNavigation } from "./bottom-navigation";
import styles from "./shell.module.css";
import { BrandMark } from "@/shared/ui/brand-mark";

export function ApplicationShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return (
    <>
      <a className={styles.skip} href="#main">Перейти к содержимому</a>
      <header className={styles.header}>
        <Link href="/" prefetch={false} className={styles.brand}><BrandMark className={styles.brandmark} />Домовед</Link>
        <ThemeToggle />
      </header>
      <BottomNavigation />
      <main id="main" data-page-path={pathname} className={styles.main} tabIndex={-1}>
        <div key={pathname} className={styles.pageTransition}>{children}</div>
      </main>
    </>
  );
}
