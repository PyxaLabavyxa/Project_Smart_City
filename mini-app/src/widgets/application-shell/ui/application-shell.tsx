import type { ReactNode } from "react";
import Link from "next/link";
import { ThemeToggle } from "@/features/toggle-theme";
import { BottomNavigation } from "./bottom-navigation";
import styles from "./shell.module.css";
import { Icon } from "@/shared/ui/icon";

export function ApplicationShell({ children }: { children: ReactNode }) {
  return (
    <>
      <a className={styles.skip} href="#main">Перейти к содержимому</a>
      <header className={styles.header}>
        <Link href="/" prefetch={false} className={styles.brand}><span className={styles.brandmark}><Icon name="home" /></span>ДомПульс</Link>
        <ThemeToggle />
      </header>
      <BottomNavigation />
      <main id="main" className={styles.main} tabIndex={-1}>{children}</main>
    </>
  );
}
