import type { ReactNode } from "react";
import Link from "next/link";
import { HouseArt } from "@/shared/ui/house-art";
import styles from "./navigation.module.css";

export function SectionPage({ title, description, backHref = "/more", backLabel = "Ещё", children }: {
  title: string;
  description: string;
  backHref?: string | null;
  backLabel?: string;
  children?: ReactNode;
}) {
  return <div className={styles.page}>
    {backHref && <Link href={backHref} className={styles.back}><span aria-hidden="true">←</span> {backLabel}</Link>}
    <header data-reveal data-long-title={title.length > 12 || undefined} className={styles.hero}><HouseArt className={styles.heroArt} /><h1>{title}</h1><p className={styles.description}>{description}</p></header>
    {children}
  </div>;
}
