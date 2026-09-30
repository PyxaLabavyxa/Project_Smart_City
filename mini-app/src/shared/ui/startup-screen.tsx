import type { ReactNode } from "react";
import { BrandMark } from "./brand-mark";
import { GnomeProgress } from "./gnome-progress";
import styles from "./startup-screen.module.css";

export function StartupScreen({ percent = 0, status = "Подключаемся к вашему дому…", error, actions, complete }: {
  percent?: number; status?: string; error?: string; actions?: ReactNode; complete?: boolean;
}) {
  return <section className={styles.screen} data-complete={complete || undefined} aria-labelledby="preparation-title">
    <div className={styles.content}>
      <div className={styles.mark} aria-hidden="true"><BrandMark size={62} /></div>
      <h2 id="preparation-title">Готовим ваш Домовед</h2>
      <p className={styles.description}>Загружаем разделы и фотографии, чтобы знакомство с домом прошло плавно.</p>
      <GnomeProgress value={percent} label="Подготовка приложения" />
      <span role="status" className={styles.status}>{error ? "Подготовка прервана" : status}</span>
      {(error || actions) && <div className={styles.actions}>{error && <p role="alert">{error}</p>}{actions}</div>}
    </div>
  </section>;
}
