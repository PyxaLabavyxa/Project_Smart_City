import type { ReactNode } from "react";
import Link from "next/link";
import styles from "./navigation.module.css";

export function SectionPage({ title, description, backHref = "/more", backLabel = "Ещё", children }: {
  title: string;
  description: string;
  backHref?: string;
  backLabel?: string;
  children?: ReactNode;
}) {
  return <div className={styles.page}>
    <Link href={backHref} className={styles.back}><span aria-hidden="true">←</span> {backLabel}</Link>
    <header><h1>{title}</h1><p className={styles.description}>{description}</p></header>
    {children}
  </div>;
}
