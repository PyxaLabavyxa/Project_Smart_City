import Image from "next/image";
import type { CSSProperties } from "react";
import styles from "./gnome-progress.module.css";

export function GnomeProgress({ value, label = "Загрузка данных" }: { value?: number; label?: string }) {
  const progress = value === undefined ? undefined : Math.max(0, Math.min(100, value));
  return <div className={styles.track} data-indeterminate={progress === undefined || undefined} style={{ "--progress": `${progress ?? 0}%` } as CSSProperties} role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress === undefined ? undefined : Math.round(progress)}>
    <div className={styles.line}><span style={{ transform: `scaleX(${(progress ?? 35) / 100})` }} /></div>
    <span className={styles.traveller} aria-hidden="true"><Image src="/images/domoved/gnome-walk.webp" alt="" width={40} height={60} unoptimized loading="eager" /></span>
  </div>;
}
