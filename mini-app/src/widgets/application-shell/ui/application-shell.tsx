import type { ReactNode } from "react";
import Link from "next/link";
import { ThemeToggle } from "@/features/toggle-theme";
import { BottomNavigation } from "./bottom-navigation";
import styles from "./shell.module.css";

export function ApplicationShell({ children }: { children: ReactNode }) {
  return (
    <>
      <a className={styles.skip} href="#main">Перейти к содержимому</a>
      <header className={styles.header}>
        <Link href="/" prefetch={false}>ДомПульс</Link>
        <ThemeToggle />
      </header>
      <main id="main" className={styles.main} tabIndex={-1}>{children}</main>
      <BottomNavigation />
    </>
  );
}
