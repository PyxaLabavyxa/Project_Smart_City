import type { ReactNode } from "react";
import styles from "./navigation.module.css";

export function SectionPage({ title, description, headerContent, children }: {
  title: string;
  description?: string;
  headerContent?: ReactNode;
  backHref?: string | null;
  backLabel?: string;
  children?: ReactNode;
}) {
  return <div className={styles.page}>
    <header data-reveal data-long-title={title.length > 21 || undefined} className={styles.hero}><h1>{title}</h1>{description && <p className={styles.description}>{description}</p>}{headerContent}</header>
    {children}
  </div>;
}
